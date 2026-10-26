export interface ThemeInfo {
  label: string;
  /** What the idea is, in a sentence a learner can act on. */
  explain?: string;
  /** A nudge toward the idea that does not name the move. */
  hint?: string;
}

/** Ideas a solver can look for. Other themes describe the puzzle, not the idea. */
const MOTIFS: Record<string, ThemeInfo> = {
  fork: {
    label: "Fork",
    explain:
      "One piece attacks two or more enemy pieces at once, so the opponent can only save one of them.",
    hint: "Look for a move that attacks two things at once.",
  },
  pin: {
    label: "Pin",
    explain:
      "A piece cannot move without exposing a more valuable piece, or the king, behind it.",
    hint: "Is an enemy piece lined up in front of something more valuable?",
  },
  skewer: {
    label: "Skewer",
    explain:
      "A valuable piece is attacked and has to step aside, which exposes the piece behind it.",
    hint: "Attack a valuable piece that has another piece behind it on the same line.",
  },
  discoveredAttack: {
    label: "Discovered attack",
    explain:
      "Moving one piece uncovers an attack by the piece behind it, so two things are threatened at once.",
    hint: "Which of your pieces is standing in the way of another one's line?",
  },
  discoveredCheck: {
    label: "Discovered check",
    explain:
      "Moving a piece uncovers a check from another, leaving the moved piece free to do damage.",
    hint: "Which of your pieces is hiding a check?",
  },
  doubleCheck: {
    label: "Double check",
    explain:
      "Two pieces give check at once. The king has to move, because a single capture or block cannot answer both.",
    hint: "Can one move give check with two pieces together?",
  },
  hangingPiece: {
    label: "Hanging piece",
    explain: "A piece is left undefended, so it can simply be taken.",
    hint: "Is any enemy piece undefended?",
  },
  trappedPiece: {
    label: "Trapped piece",
    explain:
      "A piece is attacked and every square it could flee to is covered.",
    hint: "Is an enemy piece short of safe squares?",
  },
  capturingDefender: {
    label: "Capturing the defender",
    explain:
      "Take the piece that guards another, and the one it was guarding falls too.",
    hint: "Which enemy piece is doing the defending, and can it be taken?",
  },
  deflection: {
    label: "Deflection",
    explain:
      "Drag an enemy piece away from a job it has, such as guarding a square or a piece.",
    hint: "Which enemy piece is busy guarding something, and can it be forced away?",
  },
  attraction: {
    label: "Attraction",
    explain:
      "Lure an enemy piece, often the king, onto a square where it can be attacked.",
    hint: "Can a sacrifice pull a piece onto a worse square?",
  },
  clearance: {
    label: "Clearance",
    explain:
      "Move a piece away, often with a threat, to open a line or a square for another piece.",
    hint: "Which of your pieces needs a square or a line that is occupied?",
  },
  interference: {
    label: "Interference",
    explain:
      "Place a piece between two enemy pieces that were protecting each other.",
    hint: "Can you cut the line between two enemy defenders?",
  },
  intermezzo: {
    label: "In-between move",
    explain:
      "Instead of the expected recapture, play a forcing move first, then recapture.",
    hint: "Is there a check or a capture to play before the obvious reply?",
  },
  quietMove: {
    label: "Quiet move",
    explain:
      "The winning move is neither a check nor a capture. It sets up a threat the opponent cannot meet.",
    hint: "The best move may not be forcing. Look for a threat that cannot be stopped.",
  },
  xRayAttack: {
    label: "X-ray",
    explain: "A piece attacks or defends through an enemy piece along a line.",
    hint: "Look along a line that passes through an enemy piece.",
  },
  zugzwang: {
    label: "Zugzwang",
    explain:
      "Every move the opponent has makes their position worse, and passing is not allowed.",
    hint: "Which waiting move leaves the opponent with only bad moves?",
  },
  sacrifice: {
    label: "Sacrifice",
    explain: "Give up material on purpose to win more, or to checkmate.",
    hint: "Consider giving something up for a forcing continuation.",
  },
  exposedKing: {
    label: "Exposed king",
    explain:
      "The enemy king has little cover, so checks and threats come fast.",
    hint: "The enemy king is short of shelter. Look at the checks.",
  },
  kingsideAttack: {
    label: "Kingside attack",
    explain: "An attack against the king when it has castled short.",
    hint: "Bring pieces and checks to the side the king castled on.",
  },
  queensideAttack: {
    label: "Queenside attack",
    explain: "An attack against the king when it has castled long.",
    hint: "Bring pieces and checks to the side the king castled on.",
  },
  advancedPawn: {
    label: "Advanced pawn",
    explain:
      "A pawn far up the board ties down the enemy and threatens to promote.",
    hint: "Look at the pawn closest to promotion.",
  },
  promotion: {
    label: "Promotion",
    explain: "Push a pawn to the last rank and turn it into a stronger piece.",
    hint: "Can a pawn reach the last rank?",
  },
  underPromotion: {
    label: "Underpromotion",
    explain:
      "Promote to a rook, bishop or knight instead of a queen, because it works better here.",
    hint: "A queen may not be the best piece to promote to.",
  },
  enPassant: {
    label: "En passant",
    explain: "A pawn takes another that has just moved two squares past it.",
    hint: "A pawn has just moved two squares. Can you take it as it passed?",
  },
  castling: {
    label: "Castling",
    explain: "Castling is part of the winning idea.",
    hint: "Castling may be the move.",
  },
  defensiveMove: {
    label: "Defensive move",
    explain: "The only move that holds the position together.",
    hint: "You are the one under threat. What must you stop?",
  },
  smotheredMate: {
    label: "Smothered mate",
    explain: "A knight checkmates a king that is boxed in by its own pieces.",
    hint: "A knight check can mate a king with no room to move.",
  },
  backRankMate: {
    label: "Back-rank mate",
    explain:
      "Checkmate along the first or last rank, where the king is boxed in by its own pawns.",
    hint: "The enemy king has no escape squares behind its pawns.",
  },
  anastasiaMate: { label: "Anastasia's mate" },
  arabianMate: { label: "Arabian mate" },
  bodenMate: { label: "Boden's mate" },
  doubleBishopMate: { label: "Double bishop mate" },
  dovetailMate: { label: "Dovetail mate" },
  hookMate: { label: "Hook mate" },
  attackingF2F7: {
    label: "Attacking f2 or f7",
    explain:
      "The squares next to the king at f2 and f7 are guarded only by the king early on.",
    hint: "Look at the pawn in front of the king's side.",
  },
};

const GOALS: Record<string, ThemeInfo> = {
  mate: { label: "Checkmate" },
  crushing: { label: "Crushing", explain: "You can win decisive material." },
  advantage: { label: "Advantage", explain: "You can gain a clear advantage." },
  equality: { label: "Equality", explain: "You can hold the balance." },
};

const PHASES: Record<string, string> = {
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
  pawnEndgame: "Pawn endgame",
  rookEndgame: "Rook endgame",
  bishopEndgame: "Bishop endgame",
  knightEndgame: "Knight endgame",
  queenEndgame: "Queen endgame",
  queenRookEndgame: "Queen and rook endgame",
};

/** Describe the puzzle's size or source rather than anything to learn from it. */
const DESCRIPTIVE = new Set([
  "mix",
  "oneMove",
  "short",
  "long",
  "veryLong",
  "master",
  "masterVsMaster",
  "superGM",
]);

const MATE_IN = /^mateIn(\d+)$/;

/** "kingsideAttack" becomes "Kingside attack"; a phrase that is already one is left alone. */
export const prettifyTheme = (id: string): string => {
  if (id.includes(" ")) return id;
  const words = id.replace(/([a-z])([A-Z0-9])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const mateDepth = (id: string): number | undefined => {
  const depth = MATE_IN.exec(id)?.[1];
  return depth ? Number(depth) : undefined;
};

export const themeInfo = (id: string): ThemeInfo => {
  const depth = mateDepth(id);
  if (depth) {
    return {
      label: `Mate in ${depth}`,
      explain: `There is a forced checkmate in ${depth}. Every move of the line is forcing, so the opponent's replies are limited.`,
      hint:
        depth === 1
          ? "Checkmate is available this move. Look at every check."
          : `There is a forced checkmate in ${depth}. Start with the checks.`,
    };
  }

  return (
    MOTIFS[id] ??
    GOALS[id] ?? {
      label: PHASES[id] ?? prettifyTheme(id),
    }
  );
};

/** Themes that name an idea to look for, most useful first. */
export const puzzleMotifs = (themes: readonly string[]) =>
  themes
    .filter((id) => MATE_IN.test(id) || id in MOTIFS)
    .map((id) => ({ id, ...themeInfo(id) }));

/** Themes worth showing as chips once a puzzle is done. */
export const displayThemes = (themes: readonly string[]) =>
  themes
    .filter((id) => !DESCRIPTIVE.has(id))
    .map((id) => ({ id, ...themeInfo(id) }));
