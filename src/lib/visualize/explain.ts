import { Chess, Color, Move, PieceSymbol, Square } from "chess.js";

export type MoveTag =
  | "capture"
  | "check"
  | "mate"
  | "fork"
  | "hanging"
  | "threat"
  | "castle"
  | "promotion"
  | "develop";

export interface MoveDescription {
  text: string;
  tags: MoveTag[];
  capturedValue: number;
}

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const KNIGHT_OFFSETS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const KING_OFFSETS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const DIAGONALS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const STRAIGHTS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const FILES = "abcdefgh";
const CENTER_SQUARES = ["d4", "e4", "d5", "e5", "c4", "c5"];
const BACK_RANK: Record<Color, string> = { w: "1", b: "8" };

const opposite = (color: Color): Color => (color === "w" ? "b" : "w");
const colorName = (color: Color): string => (color === "w" ? "White" : "Black");

const toSquare = (file: number, rank: number): Square | undefined =>
  file >= 0 && file < 8 && rank >= 0 && rank < 8
    ? (`${FILES[file]}${rank + 1}` as Square)
    : undefined;

const withArticle = (piece: PieceSymbol): string =>
  `${["a", "e", "i", "o", "u"].includes(PIECE_NAMES[piece][0]) ? "an" : "a"} ${PIECE_NAMES[piece]}`;

export const joinClauses = (clauses: string[]): string => {
  if (clauses.length <= 1) return clauses.join("");
  return `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`;
};

export const pieceAttacks = (game: Chess, square: Square): Square[] => {
  const piece = game.get(square);
  if (!piece) return [];

  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  const attacked: Square[] = [];

  const addStep = (offsets: number[][]) => {
    for (const [df, dr] of offsets) {
      const target = toSquare(file + df, rank + dr);
      if (target) attacked.push(target);
    }
  };

  const addRays = (directions: number[][]) => {
    for (const [df, dr] of directions) {
      let f = file + df;
      let r = rank + dr;
      let target = toSquare(f, r);

      while (target) {
        attacked.push(target);
        if (game.get(target)) break;

        f += df;
        r += dr;
        target = toSquare(f, r);
      }
    }
  };

  switch (piece.type) {
    case "n":
      addStep(KNIGHT_OFFSETS);
      break;
    case "k":
      addStep(KING_OFFSETS);
      break;
    case "p": {
      const direction = piece.color === "w" ? 1 : -1;
      addStep([
        [1, direction],
        [-1, direction],
      ]);
      break;
    }
    case "b":
      addRays(DIAGONALS);
      break;
    case "r":
      addRays(STRAIGHTS);
      break;
    case "q":
      addRays([...DIAGONALS, ...STRAIGHTS]);
      break;
  }

  return attacked;
};

const realAttackers = (
  game: Chess,
  square: Square,
  byColor: Color
): Square[] => {
  const defended = game.attackers(square, opposite(byColor)).length > 0;

  return game
    .attackers(square, byColor)
    .filter((from) => !(game.get(from)?.type === "k" && defended));
};

const cheapestAttacker = (
  game: Chess,
  square: Square,
  byColor: Color
): PieceSymbol | undefined =>
  realAttackers(game, square, byColor)
    .map((from) => game.get(from)?.type)
    .filter((type): type is PieceSymbol => type !== undefined)
    .sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b])[0];

const isVulnerable = (
  game: Chess,
  square: Square,
  owner: Color
): { vulnerable: boolean; byPiece?: PieceSymbol; defended: boolean } => {
  const piece = game.get(square);
  if (!piece || piece.type === "k")
    return { vulnerable: false, defended: true };

  const byPiece = cheapestAttacker(game, square, opposite(owner));
  const defended = game.attackers(square, owner).length > 0;
  if (!byPiece) return { vulnerable: false, defended };

  return {
    vulnerable: !defended || PIECE_VALUES[byPiece] < PIECE_VALUES[piece.type],
    byPiece,
    defended,
  };
};

export const vulnerablePieces = (game: Chess, owner: Color): Set<Square> => {
  const result = new Set<Square>();

  for (const row of game.board()) {
    for (const cell of row) {
      if (
        cell &&
        cell.color === owner &&
        isVulnerable(game, cell.square, owner).vulnerable
      ) {
        result.add(cell.square);
      }
    }
  }

  return result;
};

const describePieceOn = (game: Chess, square: Square): string => {
  const piece = game.get(square);
  return piece ? `${PIECE_NAMES[piece.type]} on ${square}` : square;
};

export const describeMove = (
  fenBefore: string,
  uci: string
): MoveDescription => {
  const before = new Chess(fenBefore);
  const after = new Chess(fenBefore);
  const move: Move = after.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4, 5) || undefined,
  });

  const mover = move.color;
  const opponent = opposite(mover);
  const isMate = after.isCheckmate();
  const tags: MoveTag[] = [];
  const participles: string[] = [];
  const warnings: string[] = [];
  const pieceName = PIECE_NAMES[move.piece];
  const capturedValue = move.captured ? PIECE_VALUES[move.captured] : 0;

  let action: string;
  if (move.isKingsideCastle() || move.isQueensideCastle()) {
    tags.push("castle");
    action = `castles ${move.isKingsideCastle() ? "kingside" : "queenside"}`;
    participles.push("tucking the king away");
  } else if (move.captured) {
    tags.push("capture");
    const target = move.isEnPassant()
      ? "a pawn en passant"
      : `the ${PIECE_NAMES[move.captured]} on ${move.to}`;
    action = `captures ${target} with the ${pieceName}`;

    if (!isMate) {
      const recapturer = cheapestAttacker(after, move.to, opponent);
      if (!recapturer) {
        participles.push("winning it for free");
      } else if (
        PIECE_VALUES[move.piece] > capturedValue &&
        move.piece !== "k"
      ) {
        warnings.push(
          `the ${pieceName} on ${move.to} can be taken back, which loses material`
        );
      } else {
        participles.push("offering a trade because it can be recaptured");
      }
    }
  } else if (move.promotion) {
    action = `promotes the pawn on ${move.to} to ${withArticle(move.promotion)}`;
  } else {
    action = `moves the ${pieceName} to ${move.to}`;
  }

  if (move.promotion) {
    tags.push("promotion");
    if (move.captured)
      participles.push(`promoting to ${withArticle(move.promotion)}`);
  }

  if (isMate) {
    tags.push("mate");
    participles.push("delivering checkmate");
  } else if (after.inCheck()) {
    tags.push("check");
    participles.push("giving check");
  }

  const movedPiece = after.get(move.to);
  const movedInfo = isVulnerable(after, move.to, mover);

  if (movedPiece && movedPiece.type !== "k" && !isMate) {
    const targets = pieceAttacks(after, move.to)
      .map((square) => ({ square, piece: after.get(square) }))
      .filter(
        (entry) =>
          entry.piece &&
          entry.piece.color === opponent &&
          (entry.piece.type === "k" ||
            PIECE_VALUES[entry.piece.type] > PIECE_VALUES[movedPiece.type] ||
            after.attackers(entry.square, opponent).length === 0)
      );

    if (targets.length >= 2 && !movedInfo.vulnerable) {
      tags.push("fork");
      const names = targets
        .slice(0, 3)
        .map(
          (entry) => `the ${PIECE_NAMES[entry.piece!.type]} on ${entry.square}`
        );
      participles.push(`forking ${joinClauses(names)}`);
    }
  }

  if (!isMate) {
    const hangingBefore = vulnerablePieces(before, mover);
    const exposed = [...vulnerablePieces(after, mover)].filter(
      (square) => square === move.to || !hangingBefore.has(square)
    );
    const alreadyWarnedAboutMovedPiece = warnings.length > 0;

    for (const square of exposed) {
      if (square === move.to && alreadyWarnedAboutMovedPiece) continue;

      const info = isVulnerable(after, square, mover);
      if (!info.vulnerable) continue;

      const name = describePieceOn(after, square);
      tags.push("hanging");
      warnings.push(
        info.defended && info.byPiece
          ? `the ${name} can be won by a ${PIECE_NAMES[info.byPiece]}`
          : `the ${name} is left unprotected`
      );
      break;
    }
  }

  if (!isMate && !tags.includes("fork")) {
    const threatsBefore = vulnerablePieces(before, opponent);
    const newThreats = [...vulnerablePieces(after, opponent)].filter(
      (square) => !threatsBefore.has(square)
    );

    if (newThreats.length) {
      tags.push("threat");
      participles.push(
        `attacking the ${describePieceOn(after, newThreats[0])}`
      );
    }
  }

  const fullMove = Number(fenBefore.split(" ")[5]) || 1;
  if (!tags.length && fullMove <= 10) {
    if (["n", "b"].includes(move.piece) && move.from[1] === BACK_RANK[mover]) {
      tags.push("develop");
      participles.push("developing a piece toward the center");
    } else if (move.piece === "p" && CENTER_SQUARES.includes(move.to)) {
      tags.push("develop");
      participles.push("claiming space in the center");
    }
  }

  let text = `${colorName(mover)} ${action}`;
  if (participles.length) text += `, ${joinClauses(participles)}`;
  text += ".";
  if (warnings.length) text += ` But ${joinClauses(warnings)}.`;

  return { text, tags, capturedValue };
};
