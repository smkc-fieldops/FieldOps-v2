/**
 * The arithmetic around the face models, as pure functions (no model, file or clock):
 * image resampling, YuNet output decoding, non-maximum suppression and ArcFace alignment.
 */

/** Decoded image: 4 bytes per pixel (R, G, B, A), as jpeg-js returns it. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export type Point = [number, number];

export interface DetectedFace {
  /** Top-left corner and size, in the coordinates the decoder was given. */
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  /** Eye, eye, nose, mouth corner, mouth corner: image left before image right. */
  landmarks: Point[];
}

/** One YuNet feature level: flat arrays from the model, row by row. */
export interface YunetLevel {
  stride: number;
  cls: ArrayLike<number>;
  obj: ArrayLike<number>;
  bbox: ArrayLike<number>;
  kps: ArrayLike<number>;
}

/** Where the five landmarks sit in the 112 x 112 crop the ArcFace family was trained on. */
export const ARCFACE_TEMPLATE: Point[] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

function clampIndex(value: number, max: number): number {
  return value < 0 ? 0 : value > max ? max : value;
}

/** Mirrors an index into [0, size) without repeating the edge (OpenCV BORDER_REFLECT_101). */
export function reflectIndex(index: number, size: number): number {
  if (size === 1) return 0;
  const period = 2 * (size - 1);
  const wrapped = ((index % period) + period) % period;
  return wrapped < size ? wrapped : period - wrapped;
}

function sampleBilinear(
  image: RgbaImage,
  x: number,
  y: number,
  out: Float32Array,
  index: (value: number, size: number) => number,
): void {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const left = index(x0, image.width);
  const right = index(x0 + 1, image.width);
  const top = index(y0, image.height);
  const bottom = index(y0 + 1, image.height);
  const { data, width } = image;
  for (let c = 0; c < 3; c++) {
    const a = data[(top * width + left) * 4 + c];
    const b = data[(top * width + right) * 4 + c];
    const d = data[(bottom * width + left) * 4 + c];
    const e = data[(bottom * width + right) * 4 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }
}

const clampToEdge = (value: number, size: number): number => clampIndex(value, size - 1);

/**
 * Fits an image into a square for YuNet, keeping its shape and padding the rest with black.
 * Returns channels-first BGR in 0..255 and the scale from image to tensor coordinates.
 */
export function letterboxBgr(image: RgbaImage, size: number): { tensor: Float32Array; scale: number } {
  const scale = size / Math.max(image.width, image.height);
  const scaledWidth = Math.min(size, Math.round(image.width * scale));
  const scaledHeight = Math.min(size, Math.round(image.height * scale));
  const tensor = new Float32Array(3 * size * size);
  const pixel = new Float32Array(3);
  // A few samples per output pixel when shrinking, so large photos do not alias.
  const samples = Math.max(1, Math.min(4, Math.ceil(1 / scale)));
  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          sampleBilinear(image, (x + (sx + 0.5) / samples) / scale - 0.5, (y + (sy + 0.5) / samples) / scale - 0.5, pixel, clampToEdge);
          r += pixel[0];
          g += pixel[1];
          b += pixel[2];
        }
      }
      const n = samples * samples;
      const at = y * size + x;
      tensor[at] = b / n;
      tensor[size * size + at] = g / n;
      tensor[2 * size * size + at] = r / n;
    }
  }
  return { tensor, scale };
}

/** Turns YuNet's grid outputs into faces, in tensor coordinates, above a score. */
export function decodeYunet(levels: YunetLevel[], inputSize: number, minScore: number): DetectedFace[] {
  const faces: DetectedFace[] = [];
  for (const { stride, cls, obj, bbox, kps } of levels) {
    const cells = Math.floor(inputSize / stride);
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        const i = row * cells + col;
        const score = Math.sqrt(clamp01(cls[i]) * clamp01(obj[i]));
        if (score < minScore) continue;
        const cx = (col + bbox[i * 4]) * stride;
        const cy = (row + bbox[i * 4 + 1]) * stride;
        const width = Math.exp(bbox[i * 4 + 2]) * stride;
        const height = Math.exp(bbox[i * 4 + 3]) * stride;
        const landmarks: Point[] = [];
        for (let k = 0; k < 5; k++) {
          landmarks.push([(kps[i * 10 + k * 2] + col) * stride, (kps[i * 10 + k * 2 + 1] + row) * stride]);
        }
        faces.push({ x: cx - width / 2, y: cy - height / 2, width, height, score, landmarks });
      }
    }
  }
  return faces;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function intersectionOverUnion(a: DetectedFace, b: DetectedFace): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (width <= 0 || height <= 0) return 0;
  const shared = width * height;
  return shared / (a.width * a.height + b.width * b.height - shared);
}

/** Keeps the best box where several overlap; best score first. */
export function nonMaxSuppression(faces: DetectedFace[], maxOverlap: number): DetectedFace[] {
  const kept: DetectedFace[] = [];
  for (const face of [...faces].sort((a, b) => b.score - a.score)) {
    if (kept.every((k) => intersectionOverUnion(k, face) <= maxOverlap)) kept.push(face);
  }
  return kept;
}

/** Scales a face from tensor coordinates back to image coordinates. */
export function scaleFace(face: DetectedFace, scale: number): DetectedFace {
  return {
    ...face,
    x: face.x / scale,
    y: face.y / scale,
    width: face.width / scale,
    height: face.height / scale,
    landmarks: face.landmarks.map(([x, y]): Point => [x / scale, y / scale]),
  };
}

/** Rotation + uniform scale + shift: x' = a x - b y + tx, y' = b x + a y + ty. */
export interface Similarity {
  a: number;
  b: number;
  tx: number;
  ty: number;
}

/** Least-squares similarity taking `from` onto `to` (never a mirror image). */
export function fitSimilarity(from: Point[], to: Point[]): Similarity {
  const n = from.length;
  const mean = (points: Point[], axis: 0 | 1): number => points.reduce((sum, p) => sum + p[axis], 0) / n;
  const fromX = mean(from, 0);
  const fromY = mean(from, 1);
  const toX = mean(to, 0);
  const toY = mean(to, 1);
  let dot = 0;
  let cross = 0;
  let spread = 0;
  for (let i = 0; i < n; i++) {
    const fx = from[i][0] - fromX;
    const fy = from[i][1] - fromY;
    const tx = to[i][0] - toX;
    const ty = to[i][1] - toY;
    dot += fx * tx + fy * ty;
    cross += fx * ty - fy * tx;
    spread += fx * fx + fy * fy;
  }
  if (spread === 0) throw new Error('Landmarks are all at one point');
  const a = dot / spread;
  const b = cross / spread;
  return { a, b, tx: toX - (a * fromX - b * fromY), ty: toY - (b * fromX + a * fromY) };
}

/** The 1 x 3 x 112 x 112 AuraFace input: aligned, channels-first RGB scaled to -1..1. */
export function alignedFaceTensor(image: RgbaImage, landmarks: Point[], size = 112): Float32Array {
  // Walk the output pixels and look each one up in the image, so fit output -> image.
  const { a, b, tx, ty } = fitSimilarity(ARCFACE_TEMPLATE, landmarks);
  const tensor = new Float32Array(3 * size * size);
  const pixel = new Float32Array(3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      sampleBilinear(image, a * x - b * y + tx, b * x + a * y + ty, pixel, clampToEdge);
      const at = y * size + x;
      tensor[at] = (pixel[0] - 127.5) / 127.5;
      tensor[size * size + at] = (pixel[1] - 127.5) / 127.5;
      tensor[2 * size * size + at] = (pixel[2] - 127.5) / 127.5;
    }
  }
  return tensor;
}

/**
 * The anti-spoofing input: a square around the face (`expansion` x its longer side), mirrored
 * past the image edges, resized to `size`, channels-first RGB in 0..1.
 */
export function antiSpoofTensor(image: RgbaImage, face: DetectedFace, size = 128, expansion = 1.5): Float32Array {
  const side = Math.max(face.width, face.height) * expansion;
  const left = face.x + face.width / 2 - side / 2;
  const top = face.y + face.height / 2 - side / 2;
  const step = side / size;
  const samples = Math.max(1, Math.min(4, Math.ceil(step)));
  const tensor = new Float32Array(3 * size * size);
  const pixel = new Float32Array(3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = left + (x + (sx + 0.5) / samples) * step - 0.5;
          const v = top + (y + (sy + 0.5) / samples) * step - 0.5;
          sampleBilinear(image, u, v, pixel, reflectIndex);
          r += pixel[0];
          g += pixel[1];
          b += pixel[2];
        }
      }
      const n = samples * samples * 255;
      const at = y * size + x;
      tensor[at] = r / n;
      tensor[size * size + at] = g / n;
      tensor[2 * size * size + at] = b / n;
    }
  }
  return tensor;
}

/** Probability the face is real, from the model's [real, spoof] scores. */
export function realProbability(realLogit: number, spoofLogit: number): number {
  return 1 / (1 + Math.exp(spoofLogit - realLogit));
}
