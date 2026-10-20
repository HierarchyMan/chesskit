import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PieceSymbol } from "chess.js";
import {
  CELL_SIZE,
  analyzeCell,
  describeShape,
  sampleCell,
} from "@/lib/scan/cell";
import {
  ShapeTemplate,
  buildScanPosition,
  normalizeTemplateHeights,
  classifyCells,
  detectWhiteAtBottom,
} from "@/lib/scan/classify";

type Box = [number, number, number, number];

const SHAPES: Record<PieceSymbol, Box[]> = {
  p: [
    [13, 12, 19, 18],
    [10, 18, 22, 22],
    [8, 22, 24, 27],
  ],
  n: [
    [10, 7, 22, 13],
    [10, 13, 17, 24],
    [8, 24, 24, 28],
  ],
  b: [
    [14, 5, 18, 9],
    [12, 9, 20, 14],
    [9, 14, 23, 22],
    [7, 22, 25, 27],
  ],
  r: [
    [8, 6, 11, 10],
    [14, 6, 18, 10],
    [21, 6, 24, 10],
    [8, 10, 24, 14],
    [11, 14, 21, 23],
    [7, 23, 25, 28],
  ],
  q: [
    [7, 3, 10, 8],
    [12, 5, 14, 9],
    [15, 1, 17, 8],
    [18, 5, 20, 9],
    [22, 3, 25, 8],
    [9, 8, 23, 13],
    [13, 13, 19, 22],
    [8, 22, 24, 28],
  ],
  k: [
    [15, 2, 17, 9],
    [12, 4, 20, 6],
    [10, 9, 22, 22],
    [8, 22, 24, 28],
  ],
};

const maskOf = (
  type: PieceSymbol,
  scale = 1,
  shiftX = 0,
  shiftY = 0
): Uint8Array => {
  const mask = new Uint8Array(CELL_SIZE * CELL_SIZE);
  const centre = CELL_SIZE / 2;

  for (const [x0, y0, x1, y1] of SHAPES[type]) {
    const fx0 = Math.round((x0 - centre) * scale + centre + shiftX);
    const fx1 = Math.round((x1 - centre) * scale + centre + shiftX);
    const fy0 = Math.round((y0 - centre) * scale + centre + shiftY);
    const fy1 = Math.round((y1 - centre) * scale + centre + shiftY);

    for (let y = fy0; y < fy1; y++) {
      for (let x = fx0; x < fx1; x++) {
        if (x >= 0 && y >= 0 && x < CELL_SIZE && y < CELL_SIZE)
          mask[y * CELL_SIZE + x] = 1;
      }
    }
  }

  return mask;
};

const templates: ShapeTemplate[] = normalizeTemplateHeights(
  (["p", "n", "b", "r", "q", "k"] as PieceSymbol[]).map((type) => ({
    type,
    set: "toy",
    ...(describeShape(maskOf(type), CELL_SIZE) as NonNullable<
      ReturnType<typeof describeShape>
    >),
  }))
);

const LIGHT: [number, number, number] = [240, 217, 181];
const DARK: [number, number, number] = [181, 136, 99];

const renderCell = (
  type: PieceSymbol | null,
  color: "w" | "b",
  background: [number, number, number],
  options: {
    scale?: number;
    shiftX?: number;
    shiftY?: number;
    label?: boolean;
  } = {}
) => {
  const rgba = new Uint8ClampedArray(CELL_SIZE * CELL_SIZE * 4);
  const fill = color === "w" ? 245 : 25;
  const mask = type
    ? maskOf(type, options.scale, options.shiftX, options.shiftY)
    : new Uint8Array(CELL_SIZE * CELL_SIZE);

  for (let i = 0; i < CELL_SIZE * CELL_SIZE; i++) {
    const useFill = mask[i] === 1;
    rgba[i * 4] = useFill ? fill : background[0];
    rgba[i * 4 + 1] = useFill ? fill : background[1];
    rgba[i * 4 + 2] = useFill ? fill : background[2];
    rgba[i * 4 + 3] = 255;
  }

  if (options.label) {
    for (let y = 24; y < 29; y++) {
      for (let x = 2; x < 6; x++) {
        const o = (y * CELL_SIZE + x) * 4;
        rgba[o] = rgba[o + 1] = rgba[o + 2] = 60;
      }
    }
  }

  return rgba;
};

describe("analyzeCell", () => {
  it("treats a plain square as empty on both square colours", () => {
    assert.equal(analyzeCell(renderCell(null, "w", LIGHT)).empty, true);
    assert.equal(analyzeCell(renderCell(null, "w", DARK)).empty, true);
  });

  it("ignores a small coordinate label in the corner", () => {
    assert.equal(
      analyzeCell(renderCell(null, "w", LIGHT, { label: true })).empty,
      true
    );
  });

  it("finds a piece and its colour on either background", () => {
    for (const background of [LIGHT, DARK]) {
      const white = analyzeCell(renderCell("r", "w", background));
      const black = analyzeCell(renderCell("r", "b", background));

      assert.equal(white.empty, false);
      assert.equal(white.color, "w");
      assert.equal(black.color, "b");
    }
  });

  it("finds a piece even when a label is also present", () => {
    const cell = analyzeCell(renderCell("q", "b", DARK, { label: true }));
    assert.equal(cell.empty, false);
    assert.equal(cell.color, "b");
  });
});

describe("classifyCells", () => {
  const classifyOne = (
    type: PieceSymbol,
    options: Parameters<typeof renderCell>[3] = {}
  ) => {
    const cells = [
      analyzeCell(renderCell("k", "w", DARK)),
      analyzeCell(renderCell(type, "w", LIGHT, options)),
    ];
    return classifyCells(cells, templates)[1].piece;
  };

  it("recognises each piece type", () => {
    for (const type of ["n", "b", "r", "q"] as PieceSymbol[]) {
      assert.equal(classifyOne(type), `w${type.toUpperCase()}`);
    }
  });

  it("copes with a different size and a small offset", () => {
    for (const type of ["n", "b", "r", "q"] as PieceSymbol[]) {
      assert.equal(
        classifyOne(type, { scale: 0.85, shiftX: 1, shiftY: -1 }),
        `w${type.toUpperCase()}`
      );
    }
  });

  it("keeps exactly one king per colour", () => {
    const cells = [
      analyzeCell(renderCell("k", "w", LIGHT)),
      analyzeCell(renderCell("q", "w", DARK)),
      analyzeCell(renderCell("k", "b", LIGHT)),
    ];
    const result = classifyCells(cells, templates).map((cell) => cell.piece);

    assert.deepEqual(result, ["wK", "wQ", "bK"]);
  });

  it("never leaves a pawn on the first or last row", () => {
    const cells = Array.from({ length: 64 }, () =>
      analyzeCell(renderCell(null, "w", LIGHT))
    );
    cells[0] = analyzeCell(renderCell("p", "b", LIGHT));
    cells[60] = analyzeCell(renderCell("p", "w", DARK));

    const result = classifyCells(cells, templates);
    assert.notEqual(result[0].piece?.[1], "P");
    assert.notEqual(result[60].piece?.[1], "P");
  });
});

describe("orientation and position", () => {
  const fromPlacement = (rows: string[]) =>
    rows
      .join("")
      .split("")
      .map((char) => {
        if (char === ".") return { piece: null, confidence: 1 } as const;
        const color = char === char.toUpperCase() ? "w" : "b";
        return {
          piece: `${color}${char.toUpperCase()}` as never,
          confidence: 1,
        };
      });

  const start = [
    "rnbqkbnr",
    "pppppppp",
    "........",
    "........",
    "........",
    "........",
    "PPPPPPPP",
    "RNBQKBNR",
  ];

  it("reads a board with white at the bottom", () => {
    const classified = fromPlacement(start);
    assert.equal(detectWhiteAtBottom(classified), true);
    assert.equal(
      buildScanPosition(classified, true).fen,
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  it("notices when the board is shown from black's side and maps it correctly", () => {
    const flipped = start
      .map((row) => row.split("").reverse().join(""))
      .reverse();
    const classified = fromPlacement(flipped);

    assert.equal(detectWhiteAtBottom(classified), false);
    assert.equal(
      buildScanPosition(classified, false).fen,
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  it("drops castling rights that the pieces cannot support", () => {
    const rows = [
      "....k...",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "R...K...",
    ];
    const position = buildScanPosition(fromPlacement(rows), true);

    assert.equal(position.fen, "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1");
  });
});

describe("sampleCell", () => {
  it("copies a square out of a larger picture", () => {
    const width = 160;
    const data = new Uint8ClampedArray(width * width * 4).fill(255);
    for (let y = 40; y < 80; y++) {
      for (let x = 40; x < 80; x++) {
        const o = (y * width + x) * 4;
        data[o] = 0;
        data[o + 1] = 0;
        data[o + 2] = 0;
      }
    }

    const image = { data, width, height: width };
    const grid = { x: 0, y: 0, size: 160 };
    const centre = (16 * CELL_SIZE + 16) * 4;

    assert.equal(sampleCell(image, grid, 2, 2)[centre], 0);
    assert.equal(sampleCell(image, grid, 5, 5)[centre], 255);
  });
});

describe("full scan pipeline", () => {
  const FEN_PLACEMENT =
    "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R";

  const drawBoard = (
    placement: string,
    cell: number,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number
  ) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 45;
      data[i * 4 + 1] = 48;
      data[i * 4 + 2] = 55;
      data[i * 4 + 3] = 255;
    }

    const rows = placement
      .split("/")
      .map((row) => row.replace(/\d/g, (digit) => ".".repeat(Number(digit))));

    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        const background = (row + column) % 2 ? DARK : LIGHT;
        const char = rows[row][column];
        const cellPixels = renderCell(
          char === "." ? null : (char.toLowerCase() as PieceSymbol),
          char === char.toUpperCase() ? "w" : "b",
          background
        );

        for (let y = 0; y < cell; y++) {
          for (let x = 0; x < cell; x++) {
            const sourceX = Math.min(
              CELL_SIZE - 1,
              Math.floor((x / cell) * CELL_SIZE)
            );
            const sourceY = Math.min(
              CELL_SIZE - 1,
              Math.floor((y / cell) * CELL_SIZE)
            );
            const from = (sourceY * CELL_SIZE + sourceX) * 4;
            const to =
              ((offsetY + row * cell + y) * width +
                offsetX +
                column * cell +
                x) *
              4;
            data[to] = cellPixels[from];
            data[to + 1] = cellPixels[from + 1];
            data[to + 2] = cellPixels[from + 2];
          }
        }
      }
    }

    return { data, width, height };
  };

  it("finds the board and reads the position", async () => {
    const { detectBoardGrid } = await import("@/lib/scan/gridDetect");
    const { scanBoard } = await import("@/lib/scan/scanBoard");
    const image = drawBoard(FEN_PLACEMENT, 56, 140, 30, 760, 520);

    const grid = detectBoardGrid(image);
    assert.ok(grid);

    const outcome = scanBoard(image, templates, grid);
    assert.equal(outcome.position.fen.split(" ")[0], FEN_PLACEMENT);
  });
});
