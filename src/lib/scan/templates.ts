import { openDB } from "idb";
import { PIECE_SETS } from "@/constants";
import { Chess, PieceSymbol, Square } from "chess.js";
import { describeShape } from "./cell";
import { ShapeTemplate, normalizeTemplateHeights } from "./classify";

const TEMPLATE_RENDER_SIZE = 64;
const PIECE_LETTERS: PieceSymbol[] = ["p", "n", "b", "r", "q", "k"];
const COLORS = ["w", "b"] as const;
const BATCH_SIZE = 24;

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export const loadPieceImage = (
  set: string,
  code: string
): Promise<HTMLImageElement> => {
  const src = `/piece/${set}/${code}.svg`;
  const cached = imageCache.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });

  imageCache.set(src, promise);
  return promise;
};

const maskFromImage = (image: HTMLImageElement): Uint8Array => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEMPLATE_RENDER_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available");

  context.drawImage(image, 0, 0, TEMPLATE_RENDER_SIZE, TEMPLATE_RENDER_SIZE);
  const { data } = context.getImageData(
    0,
    0,
    TEMPLATE_RENDER_SIZE,
    TEMPLATE_RENDER_SIZE
  );

  const mask = new Uint8Array(TEMPLATE_RENDER_SIZE * TEMPLATE_RENDER_SIZE);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  return mask;
};

let cachedTemplates: Promise<ShapeTemplate[]> | undefined;

export const loadShapeTemplates = (
  onProgress?: (done: number, total: number) => void
): Promise<ShapeTemplate[]> => {
  if (cachedTemplates) return cachedTemplates;

  cachedTemplates = (async () => {
    const jobs = PIECE_SETS.flatMap((set) =>
      COLORS.flatMap((color) =>
        PIECE_LETTERS.map((type) => ({ set, color, type }))
      )
    );

    // Cache the exact browser-rendered Float32 descriptors, rather than substituting
    // descriptors rasterised on a different OS/browser. Asset content invalidates them.
    const cacheKey = `${process.env.NEXT_PUBLIC_PIECE_VERSION}:descriptor-v1:${navigator.userAgent}`;
    const cacheDb = await openDB("chesskit-scan-templates", 1, {
      upgrade(db) {
        db.createObjectStore("descriptors");
      },
    }).catch(() => undefined);
    const saved = (await cacheDb
      ?.get("descriptors", cacheKey)
      .catch(() => undefined)) as ShapeTemplate[] | undefined;
    if (
      saved?.length === jobs.length &&
      saved.every((item) => item.shape instanceof Float32Array)
    ) {
      cacheDb?.close();
      onProgress?.(jobs.length, jobs.length);
      return saved;
    }

    const templates: ShapeTemplate[] = [];
    let done = 0;

    for (let start = 0; start < jobs.length; start += BATCH_SIZE) {
      const batch = jobs.slice(start, start + BATCH_SIZE);

      await Promise.all(
        batch.map(async ({ set, color, type }) => {
          try {
            const image = await loadPieceImage(
              set,
              `${color}${type.toUpperCase()}`
            );
            const descriptor = describeShape(
              maskFromImage(image),
              TEMPLATE_RENDER_SIZE
            );
            if (descriptor) templates.push({ ...descriptor, type, set });
          } catch (error) {
            console.warn(error);
          }
        })
      );

      done += batch.length;
      onProgress?.(done, jobs.length);
    }

    const normalised = normalizeTemplateHeights(templates);
    if (cacheDb) {
      if (normalised.length === jobs.length) {
        const transaction = cacheDb.transaction("descriptors", "readwrite");
        try {
          await transaction.store.clear();
          await transaction.store.put(normalised, cacheKey);
          await transaction.done;
        } catch {
          /* Optional cache must never prevent recognition. */
        }
      }
      cacheDb.close();
    }
    return normalised;
  })().catch((error) => {
    cachedTemplates = undefined;
    throw error;
  });

  return cachedTemplates;
};

export interface RenderBoardOptions {
  fen: string;
  set: string;
  cell: number;
  light: string;
  dark: string;
  coordinates?: boolean;
  highlight?: Square[];
  whiteAtBottom?: boolean;
}

export const renderBoardCanvas = async ({
  fen,
  set,
  cell,
  light,
  dark,
  coordinates = false,
  highlight = [],
  whiteAtBottom = true,
}: RenderBoardOptions): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = cell * 8;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");

  const game = new Chess(fen);
  const files = "abcdefgh";

  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const file = whiteAtBottom ? column : 7 - column;
      const rank = whiteAtBottom ? 8 - row : row + 1;
      const square = `${files[file]}${rank}` as Square;

      context.fillStyle = (row + column) % 2 ? dark : light;
      context.fillRect(column * cell, row * cell, cell, cell);

      if (highlight.includes(square)) {
        context.fillStyle = "rgba(255, 213, 65, 0.45)";
        context.fillRect(column * cell, row * cell, cell, cell);
      }

      const piece = game.get(square);
      if (piece) {
        const image = await loadPieceImage(
          set,
          `${piece.color}${piece.type.toUpperCase()}`
        );
        context.drawImage(image, column * cell, row * cell, cell, cell);
      }

      if (coordinates) {
        context.font = `${Math.round(cell * 0.2)}px sans-serif`;
        context.fillStyle = (row + column) % 2 ? light : dark;
        if (column === 0)
          context.fillText(
            String(rank),
            column * cell + 2,
            row * cell + cell * 0.22
          );
        if (row === 7)
          context.fillText(
            files[file],
            (column + 1) * cell - cell * 0.18,
            (row + 1) * cell - 3
          );
      }
    }
  }

  return canvas;
};

const SAMPLE_THEMES = [
  ["#f0d9b5", "#b58863"],
  ["#eeeed2", "#769656"],
  ["#dee3e6", "#8ca2ad"],
];

const SAMPLE_SETS = [
  "cburnett",
  "merida",
  "alpha",
  "cardinal",
  "staunty",
  "fresca",
];

export const createSampleBoardImage = async (): Promise<string> => {
  const game = new Chess();
  const plies = 14 + Math.floor(Math.random() * 40);
  for (let i = 0; i < plies && !game.isGameOver(); i++) {
    const moves = game.moves();
    game.move(moves[Math.floor(Math.random() * moves.length)]);
  }

  const [light, dark] =
    SAMPLE_THEMES[Math.floor(Math.random() * SAMPLE_THEMES.length)];
  const set = SAMPLE_SETS[Math.floor(Math.random() * SAMPLE_SETS.length)];
  const cell = 60;

  const board = await renderBoardCanvas({
    fen: game.fen(),
    set,
    cell,
    light,
    dark,
    coordinates: true,
    whiteAtBottom: Math.random() < 0.75,
  });

  const page = document.createElement("canvas");
  page.width = board.width + 340;
  page.height = board.height + 120;
  const context = page.getContext("2d") as CanvasRenderingContext2D;
  context.fillStyle = "#302e2b";
  context.fillRect(0, 0, page.width, page.height);
  context.fillStyle = "#4a4845";
  context.fillRect(page.width - 260, 40, 220, page.height - 80);
  context.fillStyle = "#8a8884";
  for (let i = 0; i < 9; i++)
    context.fillRect(page.width - 240, 70 + i * 28, 90 + (i % 3) * 25, 9);
  context.drawImage(board, 40, 60);

  return page.toDataURL("image/png");
};
