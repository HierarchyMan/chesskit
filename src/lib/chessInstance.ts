import { Chess, validateFen } from "chess.js";

const EDGE_PAWNS_ERROR = "Invalid FEN: some pawns are on the edge rows";

const placementRanks = (fen: string): string[] =>
  (fen.trim().split(/\s+/)[0] ?? "").split("/");

/** True when White has a pawn on rank 1 or Black has a pawn on rank 8 (playable in Horde / Fairy-Stockfish). */
export const fenHasStartingRankPawns = (fen: string): boolean => {
  const ranks = placementRanks(fen);
  if (ranks.length !== 8) return false;
  return ranks[0].includes("p") || ranks[7].includes("P");
};

/** True when a pawn is already sitting on its own promotion rank (White on rank 8, Black on rank 1). */
export const fenHasPromotionRankPawns = (fen: string): boolean => {
  const ranks = placementRanks(fen);
  if (ranks.length !== 8) return false;
  return ranks[0].includes("P") || ranks[7].includes("p");
};

/** True when any pawn stands on rank 1 or rank 8 (rejected by standard Stockfish 16–19). */
export const fenHasBackRankPawns = (fen: string): boolean =>
  fenHasStartingRankPawns(fen) || fenHasPromotionRankPawns(fen);

/**
 * Validates a FEN like chess.js, except White pawns on rank 1 and Black pawns
 * on rank 8 are permitted (starting-rank pawns move forward cleanly in chess.js
 * and Fairy-Stockfish, while promotion-rank pawns remain rejected).
 */
export const validateFenPermissive = (
  fen: string
): { ok: boolean; error?: string } => {
  const strict = validateFen(fen);
  if (strict.ok) return strict;

  if (
    strict.error !== EDGE_PAWNS_ERROR ||
    fenHasPromotionRankPawns(fen) ||
    !fenHasStartingRankPawns(fen)
  ) {
    return strict;
  }

  const fields = fen.trim().split(/\s+/);
  const ranks = fields[0].split("/");
  if (ranks.length !== 8) return strict;

  ranks[0] = ranks[0].replace(/p/g, "n");
  ranks[7] = ranks[7].replace(/P/g, "N");
  fields[0] = ranks.join("/");

  return validateFen(fields.join(" "));
};

/** Creates a Chess instance, allowing starting-rank pawns (wP on rank 1, bP on rank 8). */
export const createChess = (fen?: string): Chess => {
  if (!fen) return new Chess();
  if (validateFen(fen).ok) return new Chess(fen);
  if (validateFenPermissive(fen).ok) {
    return new Chess(fen, { skipValidation: true });
  }
  return new Chess(fen);
};

/** Loads a FEN into an existing Chess instance, allowing starting-rank pawns. */
export const loadFenPermissive = (
  game: Chess,
  fen: string,
  options?: { preserveHeaders?: boolean }
): void => {
  if (!validateFen(fen).ok && validateFenPermissive(fen).ok) {
    game.load(fen, { ...options, skipValidation: true });
    return;
  }
  game.load(fen, options);
};

/** Loads a PGN into a new Chess instance, allowing starting-rank pawns in a [FEN] header. */
export const loadPgnPermissive = (pgn: string): Chess => {
  const game = new Chess();
  const originalLoad = game.load.bind(game);
  game.load = (fen, options) => {
    if (!validateFen(fen).ok && validateFenPermissive(fen).ok) {
      return originalLoad(fen, { ...options, skipValidation: true });
    }
    return originalLoad(fen, options);
  };
  try {
    game.loadPgn(pgn);
  } finally {
    game.load = originalLoad;
  }
  return game;
};
