import {
  alignedFaceTensor,
  antiSpoofTensor,
  ARCFACE_TEMPLATE,
  decodeYunet,
  DetectedFace,
  fitSimilarity,
  letterboxBgr,
  nonMaxSuppression,
  Point,
  realProbability,
  reflectIndex,
  RgbaImage,
  scaleFace,
} from './face-geometry';

function solid(width: number, height: number, [r, g, b]: number[]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([r, g, b, 255], i * 4);
  return { width, height, data };
}

const box = (x: number, y: number, size: number, score: number): DetectedFace => ({
  x,
  y,
  width: size,
  height: size,
  score,
  landmarks: [],
});

describe('reflectIndex', () => {
  it.each([
    [-1, 5, 1],
    [0, 5, 0],
    [4, 5, 4],
    [5, 5, 3],
    [9, 5, 1],
    [3, 1, 0],
  ])('%i in a size of %i is %i', (index, size, expected) => {
    expect(reflectIndex(index, size)).toBe(expected);
  });
});

describe('letterboxBgr', () => {
  it('scales the longer side, swaps channels and pads with black', () => {
    const { tensor, scale } = letterboxBgr(solid(20, 10, [200, 100, 50]), 10);
    expect(scale).toBe(0.5);
    expect(tensor[0]).toBeCloseTo(50); // blue plane first
    expect(tensor[100]).toBeCloseTo(100);
    expect(tensor[200]).toBeCloseTo(200);
    expect(tensor[9 * 10]).toBe(0); // below the 5 scaled rows
  });
});

describe('decodeYunet', () => {
  it('reads one confident cell of the grid, scores below the bar are skipped', () => {
    const cells = 4; // 32 px input at stride 8
    const zeros = (n: number): number[] => new Array<number>(n).fill(0);
    const cls = zeros(cells * cells);
    const obj = zeros(cells * cells);
    const bbox = zeros(cells * cells * 4);
    const kps = zeros(cells * cells * 10);
    const i = 1 * cells + 2; // row 1, column 2
    cls[i] = 0.81;
    obj[i] = 1;
    bbox.splice(i * 4, 4, 0.5, 0.5, 0, 0);
    kps.splice(i * 10, 2, 0.25, 0.75);
    const [face, ...rest] = decodeYunet([{ stride: 8, cls, obj, bbox, kps }], 32, 0.5);
    expect(rest).toHaveLength(0);
    expect(face.score).toBeCloseTo(0.9);
    expect([face.x, face.y, face.width, face.height]).toEqual([16, 8, 8, 8]);
    expect(face.landmarks[0]).toEqual([18, 14]);
  });
});

describe('nonMaxSuppression', () => {
  it('keeps the best of overlapping boxes and separate faces', () => {
    const kept = nonMaxSuppression([box(1, 0, 10, 0.7), box(0, 0, 10, 0.9), box(50, 50, 10, 0.8)], 0.3);
    expect(kept.map((f) => f.score)).toEqual([0.9, 0.8]);
  });
});

describe('scaleFace', () => {
  it('returns to image coordinates', () => {
    const face = scaleFace({ ...box(10, 20, 30, 1), landmarks: [[4, 8]] }, 0.5);
    expect([face.x, face.y, face.width]).toEqual([20, 40, 60]);
    expect(face.landmarks[0]).toEqual([8, 16]);
  });
});

describe('fitSimilarity', () => {
  it('recovers a known rotation, scale and shift', () => {
    const [a, b, tx, ty] = [1.2, 0.5, 7, -3];
    const to = ARCFACE_TEMPLATE.map(([x, y]): Point => [a * x - b * y + tx, b * x + a * y + ty]);
    const fit = fitSimilarity(ARCFACE_TEMPLATE, to);
    expect(fit.a).toBeCloseTo(a);
    expect(fit.b).toBeCloseTo(b);
    expect(fit.tx).toBeCloseTo(tx);
    expect(fit.ty).toBeCloseTo(ty);
  });

  it('refuses landmarks that are all at one point', () => {
    const same: Point[] = [
      [1, 1],
      [1, 1],
    ];
    expect(() => fitSimilarity(same, same)).toThrow();
  });
});

describe('alignedFaceTensor', () => {
  it('samples RGB in -1..1', () => {
    const tensor = alignedFaceTensor(solid(200, 200, [255, 127, 0]), ARCFACE_TEMPLATE);
    expect(tensor).toHaveLength(3 * 112 * 112);
    expect(tensor[0]).toBeCloseTo(1);
    expect(tensor[2 * 112 * 112]).toBeCloseTo(-1);
  });
});

describe('antiSpoofTensor', () => {
  it('samples RGB in 0..1, also past the image edge', () => {
    const tensor = antiSpoofTensor(solid(100, 100, [255, 0, 51]), box(0, 0, 100, 1));
    expect(tensor).toHaveLength(3 * 128 * 128);
    expect(tensor[0]).toBeCloseTo(1);
    expect(tensor[128 * 128]).toBeCloseTo(0);
    expect(tensor[2 * 128 * 128]).toBeCloseTo(0.2);
  });
});

describe('realProbability', () => {
  it.each([
    [0, 0, 0.5],
    [10, -10, 1],
    [-10, 10, 0],
  ])('real %d, spoof %d', (real, spoof, expected) => {
    expect(realProbability(real, spoof)).toBeCloseTo(expected);
  });
});
