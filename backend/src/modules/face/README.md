# Face verification module

One interface (`FaceVerifier`) with two interchangeable providers, chosen by `FACE_PROVIDER`:

| Provider | Default | Where matching happens | What the phone does |
| --- | --- | --- | --- |
| `local` | Yes | Our server: YuNet detection, MiniFASNet anti-spoofing, AuraFace embedding | ML Kit blink/smile liveness, then uploads a face crop |
| `aadhaar` | No | UIDAI, through SMKC's ASA | Launches the UIDAI **AadhaarFaceRD** app, sends back its encrypted PidData |

The attendance engine only calls `FaceVerifier.verify()`; it never knows which provider runs.
The app calls `GET /api/v1/face/capture-options` and follows `instructions`, so switching
providers needs **no app release**.

Model selection and licences: `docs/FieldOps_Face_Recognition_Model_Selection_D4_...docx`.

## Installing the local models

Put these three files in `FACE_MODEL_DIR` (default `backend/storage/models`, not in git). The API
answers `FACE_PROVIDER_UNAVAILABLE` until they are there; no restart is needed afterwards.

| File | Source | Licence |
| --- | --- | --- |
| `glintr100.onnx` (261 MB) | Hugging Face `fal/AuraFace-v1` | Apache-2.0 |
| `face_detection_yunet_2023mar.onnx` | Hugging Face `opencv/face_detection_yunet` | MIT |
| `minifas_antispoof_int8.onnx` | GitHub `SuriAI/face-antispoof-onnx`, `models/best_model_quantized.onnx`, renamed | Apache-2.0 |

Do not use the other files in the AuraFace repository (`2d106det.onnx`, `scrfd_*`, `1k3d68.onnx`,
`genderage.onnx`): they match InsightFace's non-commercial packs.

Enrol with `POST /face/enrolments` (ADMIN, or WARD_INSPECTOR for field staff of their ward).
`scripts/face-smoke.mjs` runs the real models through a local API; Jest cannot, because ONNX Runtime
does not work inside its sandbox.

## Switching to Aadhaar face authentication (plug and play)

Only SMKC can do these steps; everything else is already built.

1. **UIDAI onboarding (SMKC):** SMKC (or its department) is an authorised AUA / Sub-AUA with an
   ASA, has a licence key, an ASA licence key and a Class II/III signing certificate whose
   organisation matches the AUA. Staff give explicit informed consent.
2. **Aadhaar Data Vault (SMKC):** Aadhaar numbers must not live in our tables. Implement
   `AadhaarIdentityResolver.resolve(staffId)` to return a UID token / VID (or a vault lookup)
   and register it in `face.module.ts` in place of `UnconfiguredIdentityResolver`.
3. **Configuration:** set `FACE_PROVIDER=aadhaar` and the `AADHAAR_*` variables (see
   `env-templates/*.example`). The server refuses to start if any required value is missing.
4. **Pre-production test:** keep `AADHAAR_ENV=PP` until UIDAI pre-production passes, then `P`.

What is already done:

- PidOptions XML generation with a fresh `txn` per capture (`aadhaar-xml.ts`)
- PidData parsing, FaceRD error codes, txn check (`aadhaar-parsers.ts`)
- Auth XML (API 2.5: `rc="Y"`, `tid="registered"`, `bio="y" bt="FID"`) and ASA URL (`aadhaar-xml.ts`)
- W3C XML signature with the AUA certificate (`XmlDsigSigner`, using xml-crypto)
- HTTPS ASA client with timeout (`HttpAsaClient`)
- Result mapping (`ret="y"` → matched; `err` → `UIDAI_<code>`) and the signed UIDAI response
  returned for the audit trail, as UIDAI requires. No biometric data is logged or stored.

Check at onboarding: UIDAI's current spec versions (API, PID version) and whether face-only
authentication is enabled for SMKC's AUA (the API 2.5 document lists face-only as error 914;
AEBAS today authenticates by face alone through FaceRD). Both versions are configuration values.

## Mobile side (Phase 3)

Android: start the FaceRD app for a result and pass the server's PidOptions.

```kotlin
// MainActivity.kt - MethodChannel "fieldops/facerd"
val intent = Intent("in.gov.uidai.rdservice.face.CAPTURE").apply {
    putExtra("request", pidOptionsXml)          // from /face/capture-options
}
startActivityForResult(intent, FACERD_REQUEST)
// onActivityResult: read the PidData XML from the result extras and return it to Flutter
```

- Android 11+: add a `<queries>` entry for package `in.gov.uidai.facerd` and the intent action.
- The result extra name is confirmed against the FaceRD version installed during testing.
- iOS: FaceRD posts the PID to a backend callback URL; the app polls by `txn`.

The app then posts `{ txn, pidDataXml }` with the punch; the backend calls `verify()`.
