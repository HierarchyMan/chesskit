import { storedAtom } from "@/lib/storedAtom";
import {
  ArrowMode,
  ArrowPrefs,
  isArrowPrefs,
  migrateBestMoveSwitch,
} from "./prefs";

const LEGACY_KEYS: Partial<Record<ArrowMode, string>> = {
  analysis: "show-arrow-best-move",
  arena: "arena-show-best-move",
};

const readLegacyBestMove = (mode: ArrowMode): boolean | undefined => {
  const key = LEGACY_KEYS[mode];
  if (!key || typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem(key);
    const value = raw === null ? undefined : JSON.parse(raw);
    return typeof value === "boolean" ? value : undefined;
  } catch {
    return undefined;
  }
};

/** Each mode keeps its own choices, so changing one never changes another. */
export const createArrowPrefsAtom = (mode: ArrowMode) =>
  storedAtom<ArrowPrefs>(
    `arrow-prefs-${mode}`,
    migrateBestMoveSwitch(mode, readLegacyBestMove(mode)),
    isArrowPrefs
  );
