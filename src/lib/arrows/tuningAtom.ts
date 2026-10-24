import { storedAtom } from "@/lib/storedAtom";
import { ARROW_TUNING_DEFAULTS, ArrowTuning, isArrowTuning } from "./tuning";

export const arrowTuningAtom = storedAtom<ArrowTuning>(
  "arrow-tuning",
  ARROW_TUNING_DEFAULTS,
  isArrowTuning
);
