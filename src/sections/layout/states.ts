import { storedAtom } from "@/lib/storedAtom";
import { atom } from "jotai";

export const navExpandedAtom = storedAtom<boolean>(
  "nav-expanded",
  true,
  (value): value is boolean => typeof value === "boolean"
);

export const settingsOpenAtom = atom(false);
export const importDialogAtom = atom<{
  open: boolean;
  initialText?: string;
  initialImage?: string;
}>({ open: false });
export const commandPaletteOpenAtom = atom(false);
