import { DEFAULT_ENGINE } from "@/constants";
import { getRecommendedWorkersNb } from "@/lib/engine/worker";
import { storedAtom } from "@/lib/storedAtom";
import { EngineName } from "@/types/enums";
import { CurrentPosition, GameEval, SavedEvals } from "@/types/eval";
import {
  START_FEN,
  EditablePosition,
  PieceCode,
  positionFromFen,
} from "@/lib/editorPosition";
import { MoveSide } from "@/lib/engine/topMoves";
import { Chess } from "chess.js";
import { atom } from "jotai";
import { Arrow } from "react-chessboard/dist/chessboard/types";
import { atomWithStorage } from "jotai/utils";

export const gameEvalAtom = atom<GameEval | undefined>(undefined);
export const gameAtom = atom(new Chess());
export const boardAtom = atom(new Chess());
export const currentPositionAtom = atom<CurrentPosition>({});

export const boardOrientationAtom = atom(true);
export const boardArrowsAtom = atom<Arrow[]>([]);
export const topMovesOpenAtom = atom(false);
export const topMovesSideAtom = atom<MoveSide>("mover");
export const autoPlayAtom = atom(false);

export type ArrangeBrush = "hand" | "erase" | PieceCode;

export const arrangeModeAtom = atom(false);
export const editablePositionAtom = atom<EditablePosition>(
  positionFromFen(START_FEN)
);
export const arrangeBrushAtom = atom<ArrangeBrush>("hand");
export const arrangeStartFenAtom = atom<string | null>(null);

const isEngineName = (value: unknown): value is EngineName =>
  Object.values(EngineName).includes(value as EngineName);

const isNumberBetween =
  (min: number, max: number) =>
  (value: unknown): value is number =>
    typeof value === "number" && value >= min && value <= max;

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

export const showBestMoveArrowAtom = storedAtom(
  "show-arrow-best-move",
  true,
  isBoolean
);
export const showPlayerMoveIconAtom = storedAtom(
  "show-icon-player-move",
  true,
  isBoolean
);

export const engineNameAtom = storedAtom<EngineName>(
  "engine-name",
  DEFAULT_ENGINE,
  isEngineName
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
export const useCloudEvalAtom = storedAtom("use-cloud-eval", true, isBoolean);
export const engineWorkersNbAtom = atomWithStorage(
  "engineWorkersNb",
  getRecommendedWorkersNb()
);
export const evaluationProgressAtom = atom(0);

export const savedEvalsAtom = atom<SavedEvals>({});
