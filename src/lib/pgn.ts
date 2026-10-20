import { Chess, validateFen } from "chess.js";

export interface ParsedGame {
  index: number;
  pgn: string;
  white: string;
  black: string;
  result: string;
  date: string;
  event: string;
  movesNb: number;
  error?: string;
}

export type DetectedInput =
  | { kind: "pgn"; games: ParsedGame[] }
  | { kind: "fen"; fen: string }
  | { kind: "lichess"; id: string; orientation?: "white" | "black" }
  | { kind: "unknown" };

const TAG_LINE = /^\s*\[\s*\w+\s+".*"\s*\]\s*$/;
const COMMENT_SPLIT = /(\{[^}]*\}|;[^\n]*)/;
const HEADERLESS_GAME_BREAK = /(1-0|0-1|1\/2-1\/2|\*)\s+(?=1\s*\.)/g;

const FIGURINES: Record<string, string> = {
  "♔": "K",
  "♕": "Q",
  "♖": "R",
  "♗": "B",
  "♘": "N",
  "♙": "",
  "♚": "K",
  "♛": "Q",
  "♜": "R",
  "♝": "B",
  "♞": "N",
  "♟": "",
};

const LICHESS_RESERVED_PATHS = new Set([
  "training",
  "practice",
  "analysis",
  "insights",
  "streamer",
  "learn",
  "editor",
]);

const cleanNewlines = (text: string): string =>
  text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

export const splitPgnGames = (text: string): string[] => {
  const lines = cleanNewlines(text).split("\n");
  const chunks: string[][] = [];
  let current: string[] = [];
  let hasMovetext = false;

  for (const line of lines) {
    if (TAG_LINE.test(line)) {
      if (hasMovetext) {
        chunks.push(current);
        current = [];
        hasMovetext = false;
      }
    } else if (line.trim()) {
      hasMovetext = true;
    }
    current.push(line);
  }
  chunks.push(current);

  return chunks
    .map((chunk) => chunk.join("\n").trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      const hasTags = chunk.split("\n").some((line) => TAG_LINE.test(line));
      if (hasTags) return [chunk];

      return chunk
        .replace(HEADERLESS_GAME_BREAK, "$1\u0000")
        .split("\u0000")
        .map((part) => part.trim())
        .filter(Boolean);
    });
};

const normalizeMovetextSegment = (segment: string): string =>
  segment
    .replace(/[‐-―−]/g, "-")
    .replace(/×/g, "x")
    .replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, (symbol) => FIGURINES[symbol])
    .replace(/(^|[\s.)])0-0-0(?=$|[\s+#!?])/g, "$1O-O-O")
    .replace(/(^|[\s.)])0-0(?=$|[\s+#!?])/g, "$1O-O")
    .replace(/\s*e\.p\./gi, "");

export const normalizePgn = (pgn: string): string => {
  const lines = cleanNewlines(pgn).split("\n");
  const firstMovetextLine = lines.findIndex(
    (line) => line.trim() && !TAG_LINE.test(line)
  );

  if (firstMovetextLine === -1) return lines.join("\n");

  const headers = lines.slice(0, firstMovetextLine);
  const movetext = lines
    .slice(firstMovetextLine)
    .join("\n")
    .split(COMMENT_SPLIT)
    .map((part, index) => (index % 2 === 0 ? normalizeMovetextSegment(part) : part))
    .join("");

  return [...headers, movetext].join("\n");
};

const firstLine = (message: string): string => message.split("\n")[0].trim();

export const loadGameFromText = (text: string): Chess => {
  const cleaned = cleanNewlines(text).trim();
  const attempts = [cleaned, normalizePgn(cleaned)];
  let firstError: unknown;

  for (const attempt of attempts) {
    try {
      const game = new Chess();
      game.loadPgn(attempt);
      return game;
    } catch (error) {
      firstError ??= error;
    }
  }

  throw new Error(
    firstError instanceof Error
      ? firstLine(firstError.message)
      : "Unable to read this PGN"
  );
};

const headerValue = (value: string | null | undefined): string =>
  value && value !== "?" && value !== "????.??.??" ? value : "";

const parseSingleGame = (raw: string, index: number): ParsedGame => {
  try {
    const game = loadGameFromText(raw);
    const headers = game.getHeaders();

    return {
      index,
      pgn: game.pgn(),
      white: headerValue(headers.White) || "White",
      black: headerValue(headers.Black) || "Black",
      result: headerValue(headers.Result) || "*",
      date: headerValue(headers.Date),
      event: headerValue(headers.Event),
      movesNb: game.history().length,
    };
  } catch (error) {
    return {
      index,
      pgn: raw,
      white: "?",
      black: "?",
      result: "*",
      date: "",
      event: "",
      movesNb: 0,
      error: error instanceof Error ? error.message : "Unreadable game",
    };
  }
};

export const parseGames = (text: string): ParsedGame[] =>
  splitPgnGames(text).map(parseSingleGame);

export const normalizeFen = (text: string): string | undefined => {
  const fields = text.trim().split(/\s+/);
  if (fields.length < 1 || fields.length > 6) return undefined;

  const [placement, turn = "w", castling = "-", enPassant = "-"] = fields;
  const halfmove = fields[4] ?? "0";
  const fullmove = fields[5] ?? "1";
  if (placement.split("/").length !== 8) return undefined;

  const fen = [placement, turn, castling, enPassant, halfmove, fullmove].join(
    " "
  );

  return validateFen(fen).ok ? fen : undefined;
};

export const parseLichessUrl = (
  text: string
): { id: string; orientation?: "white" | "black" } | undefined => {
  const match = text
    .trim()
    .match(
      /^(?:https?:\/\/)?(?:www\.)?lichess\.org\/([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:\/(white|black))?(?:[/?#].*)?$/
    );
  if (!match) return undefined;

  const id = match[1];
  if (LICHESS_RESERVED_PATHS.has(id.toLowerCase())) return undefined;

  return { id, orientation: match[2] as "white" | "black" | undefined };
};

export const detectInput = (text: string): DetectedInput => {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2_000_000) return { kind: "unknown" };

  const lichess = parseLichessUrl(trimmed);
  if (lichess) return { kind: "lichess", ...lichess };

  if (!trimmed.includes("\n")) {
    const fen = normalizeFen(trimmed);
    if (fen) return { kind: "fen", fen };
  }

  const hasPgnMarkers =
    /\[\s*\w+\s+"/.test(trimmed) || /(^|\s)1\s*\./.test(trimmed);
  const looksLikeBareMoves = /^[\w\s+#=\-.!?/*]+$/.test(trimmed);
  if (!hasPgnMarkers && !looksLikeBareMoves) return { kind: "unknown" };

  const games = parseGames(trimmed).filter(
    (game) => hasPgnMarkers || (!game.error && game.movesNb >= 2)
  );
  if (!games.length || games.every((game) => game.error)) {
    return { kind: "unknown" };
  }

  return { kind: "pgn", games };
};
