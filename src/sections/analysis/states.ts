import { DEFAULT_ENGINE } from "@/constants";
import { createAnalysisOptionAtoms } from "@/lib/analysisOptions";
import { createArrowPrefsAtom } from "@/lib/arrows/prefsAtom";
import { storedAtom } from "@/lib/storedAtom";
import { EngineId } from "@/types/enums";
import { isAnalysisEngineId } from "@/lib/engine/models";
import { SavedEvals } from "@/types/eval";
import { PieceCode } from "@/lib/editorPosition";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export {
  gameAtom,
  boardAtom,
  gameEvalAtom,
  currentPositionAtom,
  autoPlayAtom,
  boardArrowsAtom,
  analysisBoardKeyAtom,
  topMovesSideAtom,
  evaluationProgressAtom,
  arrangeModeAtom,
  editablePositionAtom,
  arrangeFenDraftAtom,
  boardOrientationAtom,
} from "./sessionAtoms";

export const topMovesOpenAtom = atom(false);

export type ArrangeBrush = "hand" | "erase" | PieceCode;

export const arrangeBrushAtom = atom<ArrangeBrush>("hand");
export const arrangeStartFenAtom = atom<string | null>(null);

const isNumberBetween =
  (min: number, max: number) =>
  (value: unknown): value is number =>
    typeof value === "number" && value >= min && value <= max;

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

// The annotations key predates the shared options, so saved choices keep working.
export const analysisOptionAtoms = createAnalysisOptionAtoms(
  {
    evaluation: "show-evaluation-bar",
    annotations: "show-icon-player-move",
  },
  { evaluation: true, annotations: true }
);

export const analysisArrowPrefsAtom = createArrowPrefsAtom("analysis");

export const engineNameAtom = storedAtom<EngineId>(
  "engine-name",
  DEFAULT_ENGINE,
  isAnalysisEngineId
);
export const engineDepthAtom = storedAtom(
  "engine-depth",
  14,
  isNumberBetween(1, 40)
);
export const engineMultiPvAtom = storedAtom(
  "engine-multi-pv",
  3,
  isNumberBetween(2, 6)
);
export const useCloudEvalAtom = storedAtom("use-cloud-eval", false, isBoolean);
export const engineWorkersNbAtom = atomWithStorage("engineWorkersNb", 8);

export const savedEvalsAtom = atom<SavedEvals>({});
