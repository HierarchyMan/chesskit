import { DEFAULT_ENGINE } from "@/constants";
import { createAnalysisOptionAtoms } from "@/lib/analysisOptions";
import { createArrowPrefsAtom } from "@/lib/arrows/prefsAtom";
import { BotStrength } from "@/lib/engine/strength";
import { storedAtom } from "@/lib/storedAtom";
import { chessPathKey } from "@/lib/chessHistory";
import { createPositionArrowsAtom } from "@/lib/engine/topMoves";
import { EngineId, EngineName } from "@/types/enums";
import { isEngineId } from "@/lib/engine/models";
import { CurrentPosition } from "@/types/eval";
import { Chess } from "chess.js";
import { atom } from "jotai";

export interface ArenaSide {
  engine: EngineId;
  strength: BotStrength;
}

export const ARENA_SPEEDS = [
  { label: "Fast", ms: 300 },
  { label: "Normal", ms: 1000 },
  { label: "Slow", ms: 2500 },
] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isArenaSide = (value: unknown): value is ArenaSide =>
  isObject(value) &&
  isEngineId(value.engine) &&
  isObject(value.strength) &&
  typeof value.strength.elo === "number" &&
  typeof value.strength.depth === "number";

export const arenaWhiteAtom = storedAtom<ArenaSide>(
  "arena-white",
  {
    engine: DEFAULT_ENGINE,
    strength: { mode: "max", elo: 2500, depth: 12 },
  },
  isArenaSide
);

export const arenaBlackAtom = storedAtom<ArenaSide>(
  "arena-black",
  {
    engine: EngineName.Reckless,
    strength: { mode: "max", elo: 2500, depth: 12 },
  },
  isArenaSide
);

export const arenaSpeedAtom = storedAtom<number>(
  "arena-speed",
  1000,
  (value): value is number => typeof value === "number" && value >= 0
);

export const arenaVarietyAtom = storedAtom<number>(
  "arena-variety",
  0.15,
  (value): value is number =>
    typeof value === "number" && value >= 0 && value <= 1
);

// Storage keys are the arena's own, so changing Analysis never changes the arena.
export const arenaAnalysisOptionAtoms = createAnalysisOptionAtoms(
  {
    evaluation: "arena-show-evaluation",
    annotations: "arena-show-annotations",
  },
  { evaluation: true, annotations: false }
);

export const arenaArrowPrefsAtom = createArrowPrefsAtom("arena");

export const arenaGameAtom = atom(new Chess());
const arenaArrowPositionKeyAtom = atom((get) =>
  chessPathKey(get(arenaGameAtom))
);
export const arenaProposalArrowsAtom = createPositionArrowsAtom(
  arenaArrowPositionKeyAtom
);
export const arenaDataAtom = atom<CurrentPosition>({});
export const arenaStartedAtom = atom(false);
export const arenaRunningAtom = atom(false);
export const arenaFlippedAtom = atom(false);
export const arenaEditingPlayersAtom = atom(false);
export const arenaStartFenAtom = atom<string | undefined>(undefined);
export const arenaSavedGameIdAtom = atom<number | null>(null);
