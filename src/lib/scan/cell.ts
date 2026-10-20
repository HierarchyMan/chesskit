import { GridRect, RawImage } from "./gridDetect";

export const CELL_SIZE = 32;
export const SHAPE_SIZE = 16;

const RING_WIDTH = 3;
const FOREGROUND_DISTANCE = 34;
const EMPTY_FRACTION = 0.06;
const MIN_PIECE_HEIGHT = 0.3;
const MIN_PIECE_WIDTH = 0.2;
const LIGHT_PIXEL = 0.6;
const WHITE_LIGHT_FRACTION = 0.4;

export interface ShapeDescriptor {
  shape: Float32Array;
  aspect: number;
  heightFraction: number;
}

export interface CellAnalysis {
  empty: boolean;
  color?: "w" | "b";
  descriptor?: ShapeDescriptor;
  foregroundFraction: number;
}

const bilinear = (
  image: RawImage,
  x: number,
  y: number,
  channel: number
): number => {
  const clampedX = Math.min(image.width - 1, Math.max(0, x));
  const clampedY = Math.min(image.height - 1, Math.max(0, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const fx = clampedX - x0;
  const fy = clampedY - y0;

  const at = (px: number, py: number) =>
    image.data[(py * image.width + px) * 4 + channel];

  return (
    at(x0, y0) * (1 - fx) * (1 - fy) +
    at(x1, y0) * fx * (1 - fy) +
    at(x0, y1) * (1 - fx) * fy +
    at(x1, y1) * fx * fy
  );
};

export const sampleCell = (
  image: RawImage,
  grid: GridRect,
  column: number,
  row: number,
  size = CELL_SIZE
): Uint8ClampedArray => {
  const cell = grid.size / 8;
  const left = grid.x + column * cell;
  const top = grid.y + row * cell;
  const out = new Uint8ClampedArray(size * size * 4);
  const subSamples = 3;

  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) {
      const sums = [0, 0, 0];

      for (let sy = 0; sy < subSamples; sy++) {
        for (let sx = 0; sx < subSamples; sx++) {
          const x = left + ((tx + (sx + 0.5) / subSamples) / size) * cell - 0.5;
          const y = top + ((ty + (sy + 0.5) / subSamples) / size) * cell - 0.5;

          for (let channel = 0; channel < 3; channel++) {
            sums[channel] += bilinear(image, x, y, channel);
          }
        }
      }

      const offset = (ty * size + tx) * 4;
      for (let channel = 0; channel < 3; channel++) {
        out[offset + channel] = sums[channel] / (subSamples * subSamples);
      }
      out[offset + 3] = 255;
    }
  }

  return out;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const largestComponent = (mask: Uint8Array, size: number): Uint8Array => {
  const labels = new Int32Array(mask.length);
  let bestLabel = 0;
  let bestCount = 0;
  let label = 0;

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;

    label++;
    let count = 0;
    const stack = [start];
    labels[start] = label;

    while (stack.length) {
      const index = stack.pop() as number;
      count++;
      const x = index % size;
      const y = Math.floor(index / size);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;

          const next = ny * size + nx;
          if (mask[next] && !labels[next]) {
            labels[next] = label;
            stack.push(next);
          }
        }
      }
    }

    if (count > bestCount) {
      bestCount = count;
      bestLabel = label;
    }
  }

  const result = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (labels[i] === bestLabel && bestLabel) result[i] = 1;
  }
  return result;
};

const fillHoles = (mask: Uint8Array, size: number): Uint8Array => {
  const outside = new Uint8Array(mask.length);
  const stack: number[] = [];

  const push = (index: number) => {
    if (!mask[index] && !outside[index]) {
      outside[index] = 1;
      stack.push(index);
    }
  };

  for (let i = 0; i < size; i++) {
    push(i);
    push((size - 1) * size + i);
    push(i * size);
    push(i * size + size - 1);
  }

  while (stack.length) {
    const index = stack.pop() as number;
    const x = index % size;
    const y = Math.floor(index / size);

    if (x > 0) push(index - 1);
    if (x < size - 1) push(index + 1);
    if (y > 0) push(index - size);
    if (y < size - 1) push(index + size);
  }

  const filled = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) filled[i] = outside[i] ? 0 : 1;
  return filled;
};

const boundingBox = (mask: Uint8Array, size: number) => {
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!mask[y * size + x]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX < 0 ? undefined : { minX, minY, maxX, maxY };
};

export const describeShape = (
  mask: Uint8Array,
  size: number
): ShapeDescriptor | undefined => {
  const box = boundingBox(mask, size);
  if (!box) return undefined;

  const width = box.maxX - box.minX + 1;
  const height = box.maxY - box.minY + 1;
  const shape = new Float32Array(SHAPE_SIZE * SHAPE_SIZE);

  for (let sy = 0; sy < SHAPE_SIZE; sy++) {
    const y0 = box.minY + (sy / SHAPE_SIZE) * height;
    const y1 = box.minY + ((sy + 1) / SHAPE_SIZE) * height;

    for (let sx = 0; sx < SHAPE_SIZE; sx++) {
      const x0 = box.minX + (sx / SHAPE_SIZE) * width;
      const x1 = box.minX + ((sx + 1) / SHAPE_SIZE) * width;

      let covered = 0;
      let total = 0;
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
        for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
          const weight =
            (Math.min(x + 1, x1) - Math.max(x, x0)) *
            (Math.min(y + 1, y1) - Math.max(y, y0));
          if (weight <= 0) continue;

          total += weight;
          if (mask[y * size + x]) covered += weight;
        }
      }

      shape[sy * SHAPE_SIZE + sx] = total ? covered / total : 0;
    }
  }

  return { shape, aspect: width / height, heightFraction: height / size };
};

export const analyzeCell = (
  rgba: Uint8ClampedArray,
  size = CELL_SIZE
): CellAnalysis => {
  const ringR: number[] = [];
  const ringG: number[] = [];
  const ringB: number[] = [];
  const interior = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const edgeDistance = Math.min(x, y, size - 1 - x, size - 1 - y);

      if (edgeDistance < RING_WIDTH) {
        ringR.push(rgba[offset]);
        ringG.push(rgba[offset + 1]);
        ringB.push(rgba[offset + 2]);
      } else {
        interior[y * size + x] = 1;
      }
    }
  }

  const background = [median(ringR), median(ringG), median(ringB)];
  const foreground = new Uint8Array(size * size);
  let interiorCount = 0;

  for (let i = 0; i < foreground.length; i++) {
    if (!interior[i]) continue;
    interiorCount++;

    const offset = i * 4;
    const distance = Math.hypot(
      rgba[offset] - background[0],
      rgba[offset + 1] - background[1],
      rgba[offset + 2] - background[2]
    );
    if (distance > FOREGROUND_DISTANCE) foreground[i] = 1;
  }

  const piece = fillHoles(largestComponent(foreground, size), size);
  const count = piece.reduce((sum, value) => sum + value, 0);
  const foregroundFraction = count / interiorCount;
  const box = boundingBox(piece, size);

  const looksLikePiece =
    foregroundFraction >= EMPTY_FRACTION &&
    !!box &&
    (box.maxY - box.minY + 1) / size >= MIN_PIECE_HEIGHT &&
    (box.maxX - box.minX + 1) / size >= MIN_PIECE_WIDTH;

  if (!looksLikePiece) return { empty: true, foregroundFraction };

  const luminances: number[] = [];
  const innerLuminances: number[] = [];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const index = y * size + x;
      if (!piece[index]) continue;

      const offset = index * 4;
      const luminance =
        (0.299 * rgba[offset] +
          0.587 * rgba[offset + 1] +
          0.114 * rgba[offset + 2]) /
        255;
      luminances.push(luminance);

      const surrounded =
        piece[index - 1] &&
        piece[index + 1] &&
        piece[index - size] &&
        piece[index + size];
      if (surrounded) innerLuminances.push(luminance);
    }
  }

  const sample = innerLuminances.length >= 8 ? innerLuminances : luminances;
  const lightFraction =
    sample.filter((value) => value > LIGHT_PIXEL).length / sample.length;

  return {
    empty: false,
    color: lightFraction > WHITE_LIGHT_FRACTION ? "w" : "b",
    descriptor: describeShape(piece, size),
    foregroundFraction,
  };
};
