/**
 * How pieces and other board motion are animated. The user picks one of these;
 * "system" hands the decision to the operating system's reduced-motion setting,
 * every other choice ignores it.
 */
export type PieceMotion = "system" | "off" | "fast" | "normal" | "slow";

export const DEFAULT_PIECE_MOTION: PieceMotion = "normal";

/** How long a piece slides at "normal", on every board that animates. */
export const PIECE_SLIDE_MS = 200;

/** How much longer or shorter a board's own base duration runs. */
export const MOTION_SCALE: Record<Exclude<PieceMotion, "system">, number> = {
  off: 0,
  fast: 0.6,
  normal: 1,
  slow: 1.7,
};

export const PIECE_MOTION_CHOICES: { id: PieceMotion; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "fast", label: "Fast" },
  { id: "slow", label: "Slow" },
  { id: "off", label: "Off" },
  { id: "system", label: "Follow the system's reduced-motion setting" },
];

export const isPieceMotion = (value: unknown): value is PieceMotion =>
  value === "system" ||
  (typeof value === "string" && Object.keys(MOTION_SCALE).includes(value));

/** The multiplier for the chosen mode, given whether the system asks for less motion. */
export const motionScale = (
  mode: PieceMotion,
  systemReducesMotion: boolean
): number => {
  if (mode === "system") return systemReducesMotion ? 0 : MOTION_SCALE.normal;
  return MOTION_SCALE[mode];
};

/** A board's own duration in milliseconds, scaled to the chosen mode. */
export const scaledMotionMs = (
  baseMs: number,
  mode: PieceMotion,
  systemReducesMotion: boolean
): number => Math.round(baseMs * motionScale(mode, systemReducesMotion));
