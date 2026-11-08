// Real face models through the running development API: enrols a JPEG for a test person, then
// checks that person in. Refuses to run against anything but localhost.
//   node scripts/face-smoke.mjs <photo.jpg> <employeeCode> <wardInspectorCode> <lat> <lng>
// Clears the enrolment afterwards. The attendance row stays, so use a throwaway test person.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const [photoPath, code, wardInspectorCode, lat, lng] = process.argv.slice(2);
if (!lng) {
  console.error('Usage: node scripts/face-smoke.mjs <photo.jpg> <employeeCode> <wardInspectorCode> <lat> <lng>');
  process.exit(2);
}
const API = 'http://localhost:3000/api/v1';

async function call(path, { token, body, method } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function login(identifier) {
  const res = await call('/auth/test-login', { body: { identifier } });
  if (res.status >= 300) throw new Error(`Sign-in failed for ${identifier}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

const photo = readFileSync(photoPath).toString('base64');
const subject = await login(code);
const manager = await login(wardInspectorCode);
const staffId = subject.staff?.id ?? subject.profile?.id ?? subject.user?.id;
if (!staffId) throw new Error(`No staff id in the sign-in answer: ${Object.keys(subject).join(', ')}`);
const token = subject.accessToken;

const punch = async (image) => {
  const challenge = await call('/attendance/challenges', { token, body: {} });
  return call('/attendance/punches', {
    token,
    body: {
      clientUuid: randomUUID(),
      type: 'CHECK_IN',
      challengeId: challenge.body.challengeId,
      latitude: Number(lat),
      longitude: Number(lng),
      accuracyM: 10,
      faceImageBase64: image,
    },
  });
};

try {
  const enrol = await call('/face/enrolments', {
    token: manager.accessToken,
    body: { staffId, imageBase64: photo },
  });
  console.log('enrol', enrol.status, enrol.body.code ?? 'ok');

  const blank = await punch(Buffer.from('not a jpeg'.padEnd(200, '.')).toString('base64'));
  console.log('unreadable image', blank.status, blank.body.code, JSON.stringify(blank.body.details ?? blank.body.errors ?? ''));

  const real = await punch(photo);
  const a = real.body.attendance;
  console.log('same face', real.status, a ? `status=${a.status} score=${a.checkinFaceScore}` : JSON.stringify(real.body));
} finally {
  const cleared = await call(`/face/enrolments/${staffId}`, { token: manager.accessToken, method: 'DELETE' });
  console.log('cleared enrolment', cleared.status);
}
