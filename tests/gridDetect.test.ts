import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RawImage, detectBoardGrid } from "@/lib/scan/gridDetect";

const createRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const makeImage = (
  width: number,
  height: number,
  background: number
): RawImage => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = background;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
};

const fillRect = (
  image: RawImage,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: [number, number, number]
) => {
  for (let y = y0; y < Math.min(image.height, y0 + h); y++) {
    for (let x = x0; x < Math.min(image.width, x0 + w); x++) {
      const offset = (y * image.width + x) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
    }
  }
};

const drawBoard = (
  image: RawImage,
  x: number,
  y: number,
  cell: number,
  light: [number, number, number],
  dark: [number, number, number],
  random: () => number,
  piecesChance: number
) => {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      fillRect(
        image,
        x + col * cell,
        y + row * cell,
        cell,
        cell,
        (row + col) % 2 ? dark : light
      );

      if (random() < piecesChance) {
        const pad = Math.round(cell * 0.2);
        const shade = random() < 0.5 ? 245 : 30;
        fillRect(
          image,
          x + col * cell + pad,
          y + row * cell + pad,
          cell - 2 * pad,
          cell - 2 * pad,
          [shade, shade, shade]
        );
      }
    }
  }
};

describe("detectBoardGrid", () => {
  it("finds a board that fills a screenshot with other interface elements around it", () => {
    const random = createRandom(7);
    const image = makeImage(900, 600, 40);
    fillRect(image, 0, 0, 180, 600, [60, 60, 66]);
    fillRect(image, 700, 0, 200, 600, [70, 90, 60]);
    for (let i = 0; i < 20; i++) {
      fillRect(
        image,
        700 + Math.floor(random() * 150),
        Math.floor(random() * 560),
        40,
        12,
        [200, 200, 200]
      );
    }
    drawBoard(
      image,
      200,
      50,
      62,
      [240, 217, 181],
      [181, 136, 99],
      random,
      0.45
    );

    const grid = detectBoardGrid(image);
    assert.ok(grid);
    assert.ok(Math.abs(grid.x - 200) <= 3, `x ${grid.x}`);
    assert.ok(Math.abs(grid.y - 50) <= 3, `y ${grid.y}`);
    assert.ok(Math.abs(grid.size - 62 * 8) <= 10, `size ${grid.size}`);
  });

  it("finds a small board inside a large page", () => {
    const random = createRandom(11);
    const image = makeImage(1200, 800, 250);
    drawBoard(
      image,
      640,
      260,
      40,
      [238, 238, 210],
      [118, 150, 86],
      random,
      0.4
    );

    const grid = detectBoardGrid(image);
    assert.ok(grid);
    assert.ok(Math.abs(grid.x - 640) <= 6, `x ${grid.x}`);
    assert.ok(Math.abs(grid.y - 260) <= 6, `y ${grid.y}`);
    assert.ok(Math.abs(grid.size - 320) <= 16, `size ${grid.size}`);
  });

  it("works for low contrast board themes", () => {
    const random = createRandom(3);
    const image = makeImage(500, 500, 30);
    drawBoard(image, 30, 30, 55, [217, 217, 217], [160, 170, 180], random, 0.5);

    const grid = detectBoardGrid(image);
    assert.ok(grid);
    assert.ok(Math.abs(grid.x - 30) <= 3, `x ${grid.x}`);
    assert.ok(Math.abs(grid.size - 440) <= 10, `size ${grid.size}`);
  });

  it("reports nothing for a picture without a board", () => {
    const random = createRandom(5);
    const image = makeImage(400, 300, 120);
    for (let i = 0; i < 30; i++) {
      fillRect(
        image,
        Math.floor(random() * 350),
        Math.floor(random() * 250),
        20 + Math.floor(random() * 80),
        10 + Math.floor(random() * 40),
        [
          Math.floor(random() * 255),
          Math.floor(random() * 255),
          Math.floor(random() * 255),
        ]
      );
    }

    assert.equal(detectBoardGrid(image), undefined);
  });
});
