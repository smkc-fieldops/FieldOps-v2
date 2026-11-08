import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { decode as decodeJpeg } from 'jpeg-js';
import { InferenceSession, Tensor } from 'onnxruntime-node';
import { AppConfig } from '../../../shared/config/app-config';
import { AppError } from '../../../shared/errors/app-error';
import { ErrorCode } from '../../../shared/errors/error-codes';
import {
  alignedFaceTensor,
  antiSpoofTensor,
  decodeYunet,
  letterboxBgr,
  nonMaxSuppression,
  realProbability,
  RgbaImage,
  scaleFace,
  YunetLevel,
} from './face-geometry';
import { FaceAnalysis, FaceEngine } from './local-face.verifier';

/** Bumped when the embedding model changes: older templates stop counting and staff re-enrol. */
export const FACE_MODEL_NAME = 'auraface-v1-glintr100';

const DETECTOR_FILE = 'face_detection_yunet_2023mar.onnx';
const ANTI_SPOOF_FILE = 'minifas_antispoof_int8.onnx';
const EMBEDDING_FILE = 'glintr100.onnx';

const DETECTOR_SIZE = 640;
const DETECTOR_STRIDES = [8, 16, 32];
const MIN_FACE_SCORE = 0.6;
const MAX_FACE_OVERLAP = 0.3;

interface Models {
  detector: InferenceSession;
  antiSpoof: InferenceSession;
  embedding: InferenceSession;
}

/**
 * YuNet + MiniFASNet + AuraFace through ONNX Runtime, inside this process (decision D4).
 * Images stay in memory and are dropped after each call. Models load on first use, and at most
 * FACE_MAX_PARALLEL analyses run together so the 06:00 burst queues instead of starving the API.
 */
@Injectable()
export class OnnxFaceEngine extends FaceEngine {
  private readonly logger = new Logger(OnnxFaceEngine.name);
  private models?: Promise<Models>;
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly config: AppConfig) {
    super();
  }

  async analyse(image: Buffer): Promise<FaceAnalysis> {
    const models = await this.loadModels();
    await this.acquire();
    try {
      return await this.run(models, image);
    } finally {
      this.release();
    }
  }

  private async run(models: Models, bytes: Buffer): Promise<FaceAnalysis> {
    const image = this.decode(bytes);
    if (!image) return { faceCount: 0, livenessScore: 0, embedding: [] };

    const { tensor, scale } = letterboxBgr(image, DETECTOR_SIZE);
    const outputs = await models.detector.run({
      [models.detector.inputNames[0]]: new Tensor('float32', tensor, [1, 3, DETECTOR_SIZE, DETECTOR_SIZE]),
    });
    const levels: YunetLevel[] = DETECTOR_STRIDES.map((stride) => ({
      stride,
      cls: outputs[`cls_${stride}`].data as Float32Array,
      obj: outputs[`obj_${stride}`].data as Float32Array,
      bbox: outputs[`bbox_${stride}`].data as Float32Array,
      kps: outputs[`kps_${stride}`].data as Float32Array,
    }));
    const faces = nonMaxSuppression(decodeYunet(levels, DETECTOR_SIZE, MIN_FACE_SCORE), MAX_FACE_OVERLAP);
    if (faces.length !== 1) return { faceCount: faces.length, livenessScore: 0, embedding: [] };

    const face = scaleFace(faces[0], scale);
    const spoof = await models.antiSpoof.run({
      [models.antiSpoof.inputNames[0]]: new Tensor('float32', antiSpoofTensor(image, face), [1, 3, 128, 128]),
    });
    const logits = spoof[models.antiSpoof.outputNames[0]].data as Float32Array;

    const embedded = await models.embedding.run({
      [models.embedding.inputNames[0]]: new Tensor('float32', alignedFaceTensor(image, face.landmarks), [1, 3, 112, 112]),
    });
    return {
      faceCount: 1,
      livenessScore: realProbability(logits[0], logits[1]),
      embedding: Array.from(embedded[models.embedding.outputNames[0]].data as Float32Array),
    };
  }

  /** A file that is not a readable JPEG counts as "no face", the same answer as a blank photo. */
  private decode(bytes: Buffer): RgbaImage | null {
    try {
      const { width, height, data } = decodeJpeg(bytes, {
        useTArray: true,
        maxResolutionInMP: 20,
        maxMemoryUsageInMB: 256,
      });
      return { width, height, data };
    } catch (error) {
      this.logger.warn(`Unreadable face image: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private loadModels(): Promise<Models> {
    this.models ??= this.createSessions().catch((error: unknown) => {
      this.models = undefined; // Installing the files later must work without a restart.
      throw error;
    });
    return this.models;
  }

  private async createSessions(): Promise<Models> {
    const dir = resolve(this.config.face.modelDir);
    const missing = [DETECTOR_FILE, ANTI_SPOOF_FILE, EMBEDDING_FILE].filter((f) => !existsSync(join(dir, f)));
    if (missing.length > 0) {
      throw new AppError(ErrorCode.FACE_PROVIDER_UNAVAILABLE, 'Face models are not installed', {
        provider: 'local',
        missing,
      });
    }
    const options: InferenceSession.SessionOptions = { intraOpNumThreads: this.config.face.threadsPerModel };
    const started = Date.now();
    const [detector, antiSpoof, embedding] = await Promise.all([
      InferenceSession.create(join(dir, DETECTOR_FILE), options),
      InferenceSession.create(join(dir, ANTI_SPOOF_FILE), options),
      InferenceSession.create(join(dir, EMBEDDING_FILE), options),
    ]);
    this.logger.log(`Face models loaded in ${Date.now() - started} ms`);
    return { detector, antiSpoof, embedding };
  }

  private acquire(): Promise<void> {
    if (this.running < this.config.face.maxParallel) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((grant) => this.waiting.push(grant));
  }

  /** Hands the slot straight to the next in line, so `running` only falls when none wait. */
  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.running--;
  }
}
