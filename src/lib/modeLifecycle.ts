import { atom } from "jotai";
import {
  gameAtom as playGameAtom,
  gameEndAtom as playGameEndAtom,
  isGameInProgressAtom as playInProgressAtom,
} from "@/sections/play/states";
import { hasPersistedPlayDraft } from "@/sections/play/usePlayRecovery";
import { arenaStartedAtom, arenaRunningAtom } from "@/sections/arena/states";
import { arrangeModeAtom } from "@/sections/analysis/states";
import {
  analysisFullRequestAtom,
  arrangeHistoryAtom,
} from "@/sections/analysis/sessionAtoms";

export type ActiveModeId =
  | "play"
  | "arena"
  | "analysis"
  | "editor"
  | "puzzles"
  | "openings"
  | "vision"
  | "scan";

/** True when Play has an active game in memory or an unfinished persisted draft. */
export const playActiveSessionAtom = atom((get) => {
  if (get(playInProgressAtom)) return true;
  if (get(playGameAtom).history().length > 0 || !!get(playGameEndAtom))
    return true;
  return hasPersistedPlayDraft();
});

/** True when Arena has a match currently open (running, paused, or finished). */
export const arenaActiveSessionAtom = atom(
  (get) => get(arenaStartedAtom) || get(arenaRunningAtom)
);

/** True when Board Editor has unsaved edits in memory. */
export const editorDirtySessionAtom = atom(
  (get) => get(arrangeModeAtom) && get(arrangeHistoryAtom).past.length > 0
);

/** True when full-game Analysis is actively running. */
export const analysisBusySessionAtom = atom(
  (get) => !!get(analysisFullRequestAtom)
);

/** Summary map used by NavMenu to show live-session indicators across modes. */
export const activeModeIndicatorsAtom = atom<
  Partial<Record<ActiveModeId, boolean>>
>((get) => ({
  play: get(playInProgressAtom) || hasPersistedPlayDraft(),
  arena: get(arenaStartedAtom),
  editor: get(editorDirtySessionAtom),
  analysis: get(analysisBusySessionAtom),
}));
