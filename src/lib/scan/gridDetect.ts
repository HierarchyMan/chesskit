export interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface GridRect {
  x: number;
  y: number;
  size: number;
}

interface Gray {
  values: Float32Array;
  width: number;
  height: number;
}

const MAX_SEARCH_DIMENSION = 360;
const MIN_SCORE = 0.1;

export const toGray = (image: RawImage): Gray => {
  const values = new Float32Array(image.width * image.height);

  for (let i = 0; i < values.length; i++) {
    const offset = i * 4;
    values[i] =
      (0.299 * image.data[offset] +
        0.587 * image.data[offset + 1] +
        0.114 * image.data[offset + 2]) /
      255;
  }

  return { values, width: image.width, height: image.height };
};

const downscale = (
  gray: Gray,
  maxDimension: number
): Gray & { factor: number } => {
  const factor = Math.max(1, Math.max(gray.width, gray.height) / maxDimension);
  if (factor === 1) return { ...gray, factor: 1 };

  const width = Math.floor(gray.width / factor);
  const height = Math.floor(gray.height / factor);
  const values = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * factor);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * factor));

    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * factor);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * factor));

      let sum = 0;
      let count = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          sum += gray.values[yy * gray.width + xx];
          count++;
        }
      }
      values[y * width + x] = sum / count;
    }
  }

  return { values, width, height, factor };
};

const buildIntegral = (gray: Gray): Float64Array => {
  const stride = gray.width + 1;
  const integral = new Float64Array(stride * (gray.height + 1));

  for (let y = 0; y < gray.height; y++) {
    let rowSum = 0;
    for (let x = 0; x < gray.width; x++) {
      rowSum += gray.values[y * gray.width + x];
      integral[(y + 1) * stride + x + 1] =
        integral[y * stride + x + 1] + rowSum;
    }
  }

  return integral;
};

const boxMean = (
  integral: Float64Array,
  stride: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number => {
  const sum =
    integral[y1 * stride + x1] -
    integral[y0 * stride + x1] -
    integral[y1 * stride + x0] +
    integral[y0 * stride + x0];

  return sum / ((x1 - x0) * (y1 - y0));
};

const vertexResponse = (
  integral: Float64Array,
  stride: number,
  x: number,
  y: number,
  s: number
): number => {
  const topLeft = boxMean(integral, stride, x - s, y - s, x, y);
  const topRight = boxMean(integral, stride, x, y - s, x + s, y);
  const bottomLeft = boxMean(integral, stride, x - s, y, x, y + s);
  const bottomRight = boxMean(integral, stride, x, y, x + s, y + s);

  return topLeft + bottomRight - topRight - bottomLeft;
};

const OUTSIDE_PENALTY = 0.8;
const BOUNDARY_WEIGHT = 1.5;

const boundaryContrast = (
  integral: Float64Array,
  stride: number,
  width: number,
  height: number,
  x0: number,
  y0: number,
  s: number
): number => {
  const thickness = Math.max(2, Math.round(s * 0.35));
  const size = 8 * s;
  const contrasts: number[] = [];

  const compare = (
    inside: [number, number, number, number],
    outside: [number, number, number, number]
  ) => {
    if (
      outside[0] < 0 ||
      outside[1] < 0 ||
      outside[2] > width ||
      outside[3] > height
    ) {
      return;
    }

    contrasts.push(
      Math.abs(
        boxMean(integral, stride, ...inside) -
          boxMean(integral, stride, ...outside)
      )
    );
  };

  compare(
    [x0, y0, x0 + size, y0 + thickness],
    [x0, y0 - thickness, x0 + size, y0]
  );
  compare(
    [x0, y0 + size - thickness, x0 + size, y0 + size],
    [x0, y0 + size, x0 + size, y0 + size + thickness]
  );
  compare(
    [x0, y0, x0 + thickness, y0 + size],
    [x0 - thickness, y0, x0, y0 + size]
  );
  compare(
    [x0 + size - thickness, y0, x0 + size, y0 + size],
    [x0 + size, y0, x0 + size + thickness, y0 + size]
  );

  return contrasts.length
    ? contrasts.reduce((sum, value) => sum + value, 0) / contrasts.length
    : 0;
};

const alternation = (
  response: Float32Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  s: number,
  positions: [number, number][]
): number => {
  let total = 0;
  let count = 0;

  for (const [i, j] of positions) {
    const x = x0 + i * s;
    const y = y0 + j * s;
    count++;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;

    total += ((i + j) % 2 === 0 ? 1 : -1) * response[y * width + x];
  }

  return count ? total / count : 0;
};

const INTERIOR: [number, number][] = [];
const OUTSIDE: [number, number][] = [];
for (let j = 1; j <= 7; j++) {
  for (let i = 1; i <= 7; i++) INTERIOR.push([i, j]);
}
for (let k = 1; k <= 7; k++) {
  OUTSIDE.push([-1, k], [9, k], [k, -1], [k, 9]);
}

const scoreGrid = (
  response: Float32Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  s: number
): number => {
  const inside = Math.abs(
    alternation(response, width, height, x0, y0, s, INTERIOR)
  );
  const outside = Math.abs(
    alternation(response, width, height, x0, y0, s, OUTSIDE)
  );

  return Math.max(0, inside - OUTSIDE_PENALTY * outside);
};

const refineAtFullResolution = (
  gray: Gray,
  guess: GridRect,
  reach: number
): GridRect => {
  const integral = buildIntegral(gray);
  const stride = gray.width + 1;
  const guessCell = guess.size / 8;
  let best = { score: -1, x: guess.x, y: guess.y, cell: guessCell };

  for (let cell = guessCell - reach; cell <= guessCell + reach; cell += 0.5) {
    const s = Math.round(cell);
    if (s < 4) continue;

    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const x0 = Math.round(guess.x + dx);
        const y0 = Math.round(guess.y + dy);
        if (
          x0 < 0 ||
          y0 < 0 ||
          x0 + 8 * s > gray.width ||
          y0 + 8 * s > gray.height
        ) {
          continue;
        }

        let total = 0;
        for (let j = 1; j <= 7; j++) {
          for (let i = 1; i <= 7; i++) {
            const sign = (i + j) % 2 ? -1 : 1;
            total +=
              sign *
              vertexResponse(integral, stride, x0 + i * s, y0 + j * s, s);
          }
        }

        if (Math.abs(total) > best.score) {
          best = { score: Math.abs(total), x: x0, y: y0, cell: s };
        }
      }
    }
  }

  return { x: best.x, y: best.y, size: best.cell * 8 };
};

export const findBestBoardGrid = (
  image: RawImage
): { grid: GridRect; score: number } | undefined => {
  const full = toGray(image);
  const small = downscale(full, MAX_SEARCH_DIMENSION);
  const { width, height } = small;

  const integral = buildIntegral(small);
  const stride = width + 1;

  const minCell = Math.max(5, Math.floor((Math.max(width, height) * 0.2) / 8));
  const maxCell = Math.floor(Math.min(width, height) / 8);

  let best = { score: 0, alternation: 0, x: 0, y: 0, s: 0 };

  for (
    let s = minCell;
    s <= maxCell;
    s = Math.max(s + 1, Math.round(s * 1.04))
  ) {
    const response = new Float32Array(width * height);
    for (let y = s; y < height - s; y++) {
      for (let x = s; x < width - s; x++) {
        response[y * width + x] = vertexResponse(integral, stride, x, y, s);
      }
    }

    for (let y0 = 0; y0 + 8 * s <= height; y0++) {
      for (let x0 = 0; x0 + 8 * s <= width; x0++) {
        const alternationScore = scoreGrid(response, width, height, x0, y0, s);
        if (alternationScore < best.score * 0.4) continue;

        const score =
          alternationScore +
          BOUNDARY_WEIGHT *
            boundaryContrast(integral, stride, width, height, x0, y0, s);
        if (score > best.score) {
          best = { score, alternation: alternationScore, x: x0, y: y0, s };
        }
      }
    }
  }

  if (best.s === 0) return undefined;

  const factor = small.factor;
  const guess: GridRect = {
    x: best.x * factor,
    y: best.y * factor,
    size: best.s * 8 * factor,
  };

  return {
    grid: refineAtFullResolution(full, guess, Math.ceil(factor * 2) + 1),
    score: best.alternation,
  };
};

export const detectBoardGrid = (image: RawImage): GridRect | undefined => {
  const found = findBestBoardGrid(image);
  return found && found.score >= MIN_SCORE ? found.grid : undefined;
};
