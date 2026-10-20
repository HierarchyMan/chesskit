import { Chess, Square, validateFen } from "chess.js";

export type PieceCode =
  | "wP"
  | "wN"
  | "wB"
  | "wR"
  | "wQ"
  | "wK"
  | "bP"
  | "bN"
  | "bB"
  | "bR"
  | "bQ"
  | "bK";

export interface Castling {
  K: boolean;
  Q: boolean;
  k: boolean;
  q: boolean;
}

export interface EditablePosition {
  pieces: Partial<Record<Square, PieceCode>>;
  turn: "w" | "b";
  castling: Castling;
  enPassant: Square | null;
  halfmove: number;
  fullmove: number;
}

export interface PositionValidation {
  ok: boolean;
  problems: string[];
  warnings: string[];
}

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";

export const PIECE_ORDER: PieceCode[] = [
  "wK",
  "wQ",
  "wR",
  "wB",
  "wN",
  "wP",
  "bK",
  "bQ",
  "bR",
  "bB",
  "bN",
  "bP",
];

const FILES = "abcdefgh";

const squareAt = (file: number, rank: number): Square =>
  `${FILES[file]}${rank}` as Square;

const toCode = (char: string): PieceCode => {
  const color = char === char.toUpperCase() ? "w" : "b";
  return `${color}${char.toUpperCase()}` as PieceCode;
};

const toChar = (code: PieceCode): string =>
  code[0] === "w" ? code[1] : code[1].toLowerCase();

export const positionFromFen = (fen: string): EditablePosition => {
  const [
    placement,
    turn = "w",
    castling = "-",
    enPassant = "-",
    halfmove = "0",
    fullmove = "1",
  ] = fen.trim().split(/\s+/);

  const pieces: EditablePosition["pieces"] = {};
  placement.split("/").forEach((row, rowIndex) => {
    let file = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        file += Number(char);
      } else {
        pieces[squareAt(file, 8 - rowIndex)] = toCode(char);
        file++;
      }
    }
  });

  return {
    pieces,
    turn: turn === "b" ? "b" : "w",
    castling: {
      K: castling.includes("K"),
      Q: castling.includes("Q"),
      k: castling.includes("k"),
      q: castling.includes("q"),
    },
    enPassant: enPassant === "-" ? null : (enPassant as Square),
    halfmove: Number(halfmove) || 0,
    fullmove: Math.max(1, Number(fullmove) || 1),
  };
};

export const positionToFen = (position: EditablePosition): string => {
  const rows: string[] = [];

  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;

    for (let file = 0; file < 8; file++) {
      const piece = position.pieces[squareAt(file, rank)];
      if (piece) {
        if (empty) row += empty;
        empty = 0;
        row += toChar(piece);
      } else {
        empty++;
      }
    }

    rows.push(row + (empty || ""));
  }

  const castling =
    (position.castling.K ? "K" : "") +
      (position.castling.Q ? "Q" : "") +
      (position.castling.k ? "k" : "") +
      (position.castling.q ? "q" : "") || "-";

  return [
    rows.join("/"),
    position.turn,
    castling,
    position.enPassant ?? "-",
    position.halfmove,
    position.fullmove,
  ].join(" ");
};

export const getCastlingAvailability = (
  pieces: EditablePosition["pieces"]
): Castling => ({
  K: pieces.e1 === "wK" && pieces.h1 === "wR",
  Q: pieces.e1 === "wK" && pieces.a1 === "wR",
  k: pieces.e8 === "bK" && pieces.h8 === "bR",
  q: pieces.e8 === "bK" && pieces.a8 === "bR",
});

export const getValidEnPassantSquares = (
  position: EditablePosition
): Square[] => {
  const { pieces, turn } = position;
  const squares: Square[] = [];

  const ownPawn: PieceCode = turn === "w" ? "wP" : "bP";
  const enemyPawn: PieceCode = turn === "w" ? "bP" : "wP";
  const targetRank = turn === "w" ? 6 : 3;
  const pawnRank = turn === "w" ? 5 : 4;
  const originRank = turn === "w" ? 7 : 2;

  for (let file = 0; file < 8; file++) {
    const target = squareAt(file, targetRank);
    const pawn = squareAt(file, pawnRank);
    const origin = squareAt(file, originRank);

    if (pieces[pawn] !== enemyPawn || pieces[target] || pieces[origin])
      continue;

    const neighbours = [file - 1, file + 1]
      .filter((neighbour) => neighbour >= 0 && neighbour < 8)
      .map((neighbour) => pieces[squareAt(neighbour, pawnRank)]);

    if (neighbours.includes(ownPawn)) squares.push(target);
  }

  return squares;
};

export const sanitizePosition = (
  position: EditablePosition
): EditablePosition => {
  const available = getCastlingAvailability(position.pieces);
  const validEnPassant = getValidEnPassantSquares(position);

  return {
    ...position,
    castling: {
      K: position.castling.K && available.K,
      Q: position.castling.Q && available.Q,
      k: position.castling.k && available.k,
      q: position.castling.q && available.q,
    },
    enPassant:
      position.enPassant && validEnPassant.includes(position.enPassant)
        ? position.enPassant
        : null,
  };
};

const kingSquares = (pieces: EditablePosition["pieces"], king: PieceCode) =>
  (Object.entries(pieces) as [Square, PieceCode][])
    .filter(([, piece]) => piece === king)
    .map(([square]) => square);

export const validatePosition = (
  position: EditablePosition
): PositionValidation => {
  const problems: string[] = [];
  const warnings: string[] = [];
  const entries = Object.entries(position.pieces) as [Square, PieceCode][];

  const whiteKings = kingSquares(position.pieces, "wK");
  const blackKings = kingSquares(position.pieces, "bK");
  if (whiteKings.length !== 1 || blackKings.length !== 1) {
    problems.push("Each side needs exactly one king.");
  }

  if (
    entries.some(
      ([square, piece]) =>
        piece[1] === "P" && (square[1] === "1" || square[1] === "8")
    )
  ) {
    problems.push("Pawns can't stand on the first or eighth rank.");
  }

  for (const color of ["w", "b"] as const) {
    const own = entries.filter(([, piece]) => piece[0] === color);
    const name = color === "w" ? "White" : "Black";

    if (own.filter(([, piece]) => piece[1] === "P").length > 8) {
      problems.push(`${name} can't have more than eight pawns.`);
    }
    if (own.length > 16) {
      problems.push(`${name} can't have more than sixteen pieces.`);
    }
  }

  if (whiteKings.length === 1 && blackKings.length === 1) {
    const [white] = whiteKings;
    const [black] = blackKings;
    const fileGap = Math.abs(FILES.indexOf(white[0]) - FILES.indexOf(black[0]));
    const rankGap = Math.abs(Number(white[1]) - Number(black[1]));

    if (Math.max(fileGap, rankGap) <= 1) {
      problems.push("The kings can't be next to each other.");
    }
  }

  if (!problems.length) {
    const sanitized = sanitizePosition(position);
    const fen = positionToFen(sanitized);

    const fenCheck = validateFen(fen);
    if (!fenCheck.ok) {
      problems.push(fenCheck.error ?? "This position isn't valid.");
    } else {
      const otherTurn = position.turn === "w" ? "b" : "w";
      const fields = fen.split(" ");
      fields[1] = otherTurn;
      fields[3] = "-";

      try {
        if (new Chess(fields.join(" ")).inCheck()) {
          problems.push(
            `${otherTurn === "w" ? "White" : "Black"} is in check, but it is ${position.turn === "w" ? "White" : "Black"}'s turn to move.`
          );
        }

        const game = new Chess(fen);
        if (game.isCheckmate())
          warnings.push("This position is already checkmate.");
        else if (game.isStalemate())
          warnings.push("This position is already stalemate.");
        else if (game.isInsufficientMaterial()) {
          warnings.push("There isn't enough material left to checkmate.");
        }
      } catch {
        problems.push("This position isn't valid.");
      }
    }
  }

  return { ok: problems.length === 0, problems, warnings };
};

const swapColor = (code: PieceCode): PieceCode =>
  `${code[0] === "w" ? "b" : "w"}${code[1]}` as PieceCode;

export const mirrorColors = (position: EditablePosition): EditablePosition => {
  const pieces: EditablePosition["pieces"] = {};

  for (const [square, piece] of Object.entries(position.pieces) as [
    Square,
    PieceCode,
  ][]) {
    const mirrored = squareAt(FILES.indexOf(square[0]), 9 - Number(square[1]));
    pieces[mirrored] = swapColor(piece);
  }

  return {
    pieces,
    turn: position.turn === "w" ? "b" : "w",
    castling: {
      K: position.castling.k,
      Q: position.castling.q,
      k: position.castling.K,
      q: position.castling.Q,
    },
    enPassant: position.enPassant
      ? squareAt(
          FILES.indexOf(position.enPassant[0]),
          9 - Number(position.enPassant[1])
        )
      : null,
    halfmove: position.halfmove,
    fullmove: position.fullmove,
  };
};

export const placePiece = (
  position: EditablePosition,
  square: Square,
  piece: PieceCode | null
): EditablePosition => {
  const pieces = { ...position.pieces };

  if (piece) pieces[square] = piece;
  else delete pieces[square];

  return sanitizePosition({ ...position, pieces });
};

export const movePiece = (
  position: EditablePosition,
  from: Square,
  to: Square
): EditablePosition => {
  const piece = position.pieces[from];
  if (!piece || from === to) return position;

  const pieces = { ...position.pieces };
  delete pieces[from];
  pieces[to] = piece;

  return sanitizePosition({ ...position, pieces });
};

export const POSITION_PRESETS: { id: string; label: string; fen: string }[] = [
  { id: "start", label: "Starting position", fen: START_FEN },
  { id: "empty", label: "Empty board", fen: EMPTY_FEN },
  {
    id: "kings",
    label: "Just the kings",
    fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
  },
  {
    id: "kpk",
    label: "King and pawn vs king",
    fen: "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1",
  },
  {
    id: "krk",
    label: "King and rook vs king",
    fen: "8/8/8/4k3/8/8/8/R3K3 w Q - 0 1",
  },
  {
    id: "kqk",
    label: "King and queen vs king",
    fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1",
  },
  {
    id: "lucena",
    label: "Lucena position",
    fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
  },
  {
    id: "philidor",
    label: "Philidor position",
    fen: "4k3/R7/8/4PK2/r7/8/8/8 b - - 0 1",
  },
];

export const parseFenLoose = (text: string): EditablePosition | undefined => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const [placement] = trimmed.split(/\s+/);
  const rows = placement.split("/");
  if (rows.length !== 8) return undefined;

  for (const row of rows) {
    if (!/^[pnbrqkPNBRQK1-8]+$/.test(row)) return undefined;

    const width = [...row].reduce(
      (sum, char) => sum + (/\d/.test(char) ? Number(char) : 1),
      0
    );
    if (width !== 8) return undefined;
  }

  return sanitizePosition(positionFromFen(trimmed));
};
