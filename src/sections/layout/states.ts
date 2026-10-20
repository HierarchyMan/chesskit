import { storedAtom } from "@/lib/storedAtom";
import { atom } from "jotai";

// null means the user never chose, so the menu follows the window width.
export const navPreferenceAtom = storedAtom<boolean | null>(
  "nav-expanded",
  null,
  (value): value is boolean | null =>
    value === null || typeof value === "boolean"
);

export const settingsOpenAtom = atom(false);
export const importDialogAtom = atom<{
  open: boolean;
  initialText?: string;
  initialImage?: string;
}>({ open: false });
export const commandPaletteOpenAtom = atom(false);
