import { storedAtom } from "@/lib/storedAtom";
import {
  ARROW_PALETTE_DEFAULTS,
  ArrowPalette,
  isArrowPalette,
} from "./palette";

export const arrowPaletteAtom = storedAtom<ArrowPalette>(
  "arrow-palette",
  ARROW_PALETTE_DEFAULTS,
  isArrowPalette
);
