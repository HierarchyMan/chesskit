/**
 * The two hues of the engine's arrows. Who moves is the hue: the side to move
 * on the displayed position takes one, the other side the other. They belong to
 * the user, so the style functions read them from here, they are stored in
 * Settings, and they are handed to whatever draws an arrow.
 */
export interface ArrowPalette {
  /** The side to move on the displayed position. */
  toMove: string;
  /** The other side. */
  other: string;
}

// Blue and orange stay apart for every common kind of colour blindness, which
// red and green do not, and neither collides with the green and red of the
// move grades drawn on the squares.
export const ARROW_PALETTE_DEFAULTS: ArrowPalette = {
  toMove: "#0067B4",
  other: "#CE6400",
};

/** Hues offered as one-tap choices. The first two are the defaults. */
export const ARROW_HUE_PRESETS: readonly { label: string; hex: string }[] = [
  { label: "Blue", hex: "#0067B4" },
  { label: "Orange", hex: "#CE6400" },
  { label: "Sky", hex: "#56B4E9" },
  { label: "Teal", hex: "#009E73" },
  { label: "Gold", hex: "#E69F00" },
  { label: "Red", hex: "#C0392B" },
  { label: "Pink", hex: "#CC79A7" },
  { label: "Purple", hex: "#7B3FA0" },
];

/** Two hues closer than this, as a contrast ratio, are hard to tell apart. */
export const MIN_HUE_SEPARATION = 1.5;

const HEX = /^#[0-9a-f]{6}$/i;

export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && HEX.test(value);

export const sameHue = (first: string, second: string): boolean =>
  first.toLowerCase() === second.toLowerCase();

export const isArrowPalette = (value: unknown): value is ArrowPalette => {
  if (typeof value !== "object" || value === null) return false;
  const palette = value as Record<string, unknown>;
  return isHexColor(palette.toMove) && isHexColor(palette.other);
};
