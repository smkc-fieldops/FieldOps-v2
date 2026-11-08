import { AppError } from '../../../shared/errors/app-error';
import { ErrorCode } from '../../../shared/errors/error-codes';
import {
  FaceCaptureOptions,
  FaceVerificationInput,
  FaceVerificationResult,
  FaceVerifier,
} from '../face-verifier';
import { decideMatch, type Embedding } from '../face.policy';

/** Result of running the server models on one face crop. */
export interface FaceAnalysis {
  faceCount: number;
  /** Passive anti-spoofing score in [0, 1]; higher = more likely a real face. */
  livenessScore: number;
  /** Embedding of the (single) detected face; empty when faceCount !== 1. */
  embedding: Embedding;
}

/** Runs detection + anti-spoofing + embedding (YuNet, MiniFASNet, AuraFace). See OnnxFaceEngine. */
export abstract class FaceEngine {
  abstract analyse(image: Buffer): Promise<FaceAnalysis>;
}

/** Enrolled embeddings per person (3-5 enrolment photos). See DbFaceTemplateStore. */
export abstract class FaceTemplateStore {
  abstract embeddingsFor(staffId: string): Promise<Embedding[]>;
}

export interface LocalFaceSettings {
  matchThreshold: number;
  livenessThreshold: number;
}

export class LocalFaceVerifier extends FaceVerifier {
  readonly provider = 'local' as const;

  constructor(
    private readonly engine: FaceEngine,
    private readonly templates: FaceTemplateStore,
    private readonly settings: LocalFaceSettings,
  ) {
    super();
  }

  async captureOptions(): Promise<FaceCaptureOptions> {
    return { provider: 'local', instructions: 'ML_KIT_LIVENESS_THEN_UPLOAD_CROP' };
  }

  async verify(input: FaceVerificationInput): Promise<FaceVerificationResult> {
    if (input.kind !== 'image') {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'The local face provider expects a face image', {
        expected: 'image',
        received: input.kind,
      });
    }

    const enrolled = await this.templates.embeddingsFor(input.staffId);
    if (enrolled.length === 0) {
      throw new AppError(ErrorCode.FACE_NOT_ENROLLED, undefined, { staffId: input.staffId });
    }

    const analysis = await this.engine.analyse(input.image);
    if (analysis.faceCount === 0) {
      return this.rejected('NO_FACE');
    }
    if (analysis.faceCount > 1) {
      return this.rejected('MULTIPLE_FACES');
    }
    if (analysis.livenessScore < this.settings.livenessThreshold) {
      return this.rejected('SPOOF_SUSPECTED');
    }

    const decision = decideMatch(analysis.embedding, enrolled, this.settings.matchThreshold);
    return {
      provider: 'local',
      matched: decision.matched,
      score: decision.score,
      threshold: decision.threshold,
      reasonCode: decision.matched ? undefined : 'FACE_MISMATCH',
    };
  }

  private rejected(reasonCode: string): FaceVerificationResult {
    return { provider: 'local', matched: false, reasonCode, threshold: this.settings.matchThreshold };
  }
}
