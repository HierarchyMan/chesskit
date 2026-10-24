import { MoveClassification } from "@/types/enums";

/**
 * Everything that changes what the engine's arrows show, other than which
 * arrows are switched on. These belong to the user, so none of them is fixed in
 * the code that uses it: they are read from here, stored in Settings, and
 * handed to the functions that need them.
 */

/** How large a threat must be before it is drawn. */
export type ThreatSensitivity = "cautious" | "balanced" | "alert";

/** The lowest grade of move for which the better move is drawn. */
export type MissedFrom = "okay" | "inaccuracy" | "mistake" | "blunder";

export interface ArrowTuning {
  /** Search depth to wait for before the engine's moves are drawn. */
  settleDepth: number;
  threatSensitivity: ThreatSensitivity;
  /** How many threats are drawn at most. */
  threatsShown: number;
  /** Search depth of the pass-the-turn search that finds threats. */
  threatDepth: number;
  missedFrom: MissedFrom;
}

// The wait-for depth is the lowest at which the drawn move is sound on every
// engine, and the threat gains are the ones that hold on every engine: both are
// measured by the scripts described in docs/engine-arrows.md.
export const ARROW_TUNING_DEFAULTS: ArrowTuning = {
  settleDepth: 9,
  threatSensitivity: "balanced",
  threatsShown: 2,
  threatDepth: 12,
  missedFrom: "inaccuracy",
};

export const SETTLE_DEPTH_RANGE = { min: 4, max: 14 } as const;
export const THREATS_SHOWN_RANGE = { min: 1, max: 3 } as const;
export const THREAT_DEPTH_RANGE = { min: 6, max: 20 } as const;

/**
 * Winning chances, in percentage points, that the opponent must gain by moving
 * first over what the position is worth now. A developing move or an attack on
 * a defended piece gains a few points; winning a piece or mating gains far more.
 * The values come from scripts/verify-threats.mjs, which measures them on every
 * engine the app offers.
 */
export const THREAT_GAIN: Record<ThreatSensitivity, number> = {
  cautious: 25,
  balanced: 15,
  alert: 8,
};

export const THREAT_SENSITIVITY_LABELS: Record<
  ThreatSensitivity,
  { label: string; help: string }
> = {
  cautious: {
    label: "Cautious",
    help: "Only threats that win a piece or more, or mate.",
  },
  balanced: {
    label: "Balanced",
    help: "Threats that win material, and mates.",
  },
  alert: {
    label: "Alert",
    help: "Also smaller threats, such as winning a pawn or the exchange.",
  },
};

export const MISSED_FROM_LABELS: Record<MissedFrom, string> = {
  okay: "Any move that was not the best",
  inaccuracy: "Inaccuracies and worse",
  mistake: "Mistakes and worse",
  blunder: "Blunders only",
};

/** The grades that earn a better-move arrow, for each lowest grade. */
export const MISSED_GRADES: Record<MissedFrom, MoveClassification[]> = {
  okay: [
    MoveClassification.Okay,
    MoveClassification.Inaccuracy,
    MoveClassification.Mistake,
    MoveClassification.Blunder,
  ],
  inaccuracy: [
    MoveClassification.Inaccuracy,
    MoveClassification.Mistake,
    MoveClassification.Blunder,
  ],
  mistake: [MoveClassification.Mistake, MoveClassification.Blunder],
  blunder: [MoveClassification.Blunder],
};

const inRange = (
  value: unknown,
  range: { min: number; max: number }
): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= range.min &&
  value <= range.max;

export const isArrowTuning = (value: unknown): value is ArrowTuning => {
  if (typeof value !== "object" || value === null) return false;
  const tuning = value as Record<string, unknown>;
  return (
    inRange(tuning.settleDepth, SETTLE_DEPTH_RANGE) &&
    typeof tuning.threatSensitivity === "string" &&
    tuning.threatSensitivity in THREAT_GAIN &&
    inRange(tuning.threatsShown, THREATS_SHOWN_RANGE) &&
    inRange(tuning.threatDepth, THREAT_DEPTH_RANGE) &&
    typeof tuning.missedFrom === "string" &&
    tuning.missedFrom in MISSED_GRADES
  );
};
