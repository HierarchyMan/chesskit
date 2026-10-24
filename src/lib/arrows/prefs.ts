export type ArrowMode = "analysis" | "play" | "arena";

/** What a user chose for the engine's arrows. Their own drawings are never switched off. */
export interface ArrowPrefs {
  /** The master switch for every engine arrow. */
  enabled: boolean;
  /** How many of the engine's best moves to draw; 0 draws none. */
  moves: number;
  /** How many further moves of the engine's line to draw after the best move. */
  ahead: number;
  /** The better move the last move missed, when it deserved one. */
  missed: boolean;
  /** Real threats the opponent would carry out if it were their turn. */
  threats: boolean;
}

/** What a mode can offer; the rest is not shown and never acted on. */
export interface ArrowCapabilities {
  maxMoves: number;
  maxAhead: number;
  missed: boolean;
  threats: boolean;
}

export const ARROW_CAPABILITIES: Record<ArrowMode, ArrowCapabilities> = {
  analysis: { maxMoves: 5, maxAhead: 4, missed: true, threats: true },
  play: { maxMoves: 5, maxAhead: 4, missed: true, threats: true },
  // The arena's evaluator searches three lines at a fixed depth.
  arena: { maxMoves: 3, maxAhead: 0, missed: false, threats: false },
};

/** A formal game gives no advice before a move; feedback after it stays. */
export const FORMAL_CAPABILITIES: ArrowCapabilities = {
  maxMoves: 0,
  maxAhead: 0,
  missed: true,
  threats: false,
};

/**
 * Analysis is for finding moves, so it starts with the best one. Playing is
 * for finding them yourself, so nothing is suggested before you move; the
 * move you just made is graded afterwards. Threats cost a second search, so
 * they wait to be asked for.
 */
export const ARROW_DEFAULTS: Record<ArrowMode, ArrowPrefs> = {
  analysis: {
    enabled: true,
    moves: 1,
    ahead: 0,
    missed: true,
    threats: false,
  },
  play: { enabled: true, moves: 0, ahead: 0, missed: true, threats: false },
  arena: { enabled: true, moves: 1, ahead: 0, missed: false, threats: false },
};

const isCount = (value: unknown, max: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= max;

export const isArrowPrefs = (value: unknown): value is ArrowPrefs => {
  if (typeof value !== "object" || value === null) return false;
  const prefs = value as Record<string, unknown>;
  return (
    typeof prefs.enabled === "boolean" &&
    isCount(prefs.moves, 10) &&
    isCount(prefs.ahead, 10) &&
    typeof prefs.missed === "boolean" &&
    typeof prefs.threats === "boolean"
  );
};

/** The choices that apply under a mode's capabilities. */
export const effectivePrefs = (
  prefs: ArrowPrefs,
  capabilities: ArrowCapabilities
): ArrowPrefs => ({
  enabled: prefs.enabled,
  moves: Math.min(prefs.moves, capabilities.maxMoves),
  ahead: Math.min(prefs.ahead, capabilities.maxAhead),
  missed: prefs.missed && capabilities.missed,
  threats: prefs.threats && capabilities.threats,
});

/** The best move switch of earlier versions, which the Moves slider replaces. */
export const migrateBestMoveSwitch = (
  mode: ArrowMode,
  legacyBestMove: boolean | undefined
): ArrowPrefs => {
  const defaults = ARROW_DEFAULTS[mode];
  if (legacyBestMove === undefined) return defaults;
  return {
    ...defaults,
    moves: legacyBestMove ? Math.max(1, defaults.moves) : 0,
  };
};
