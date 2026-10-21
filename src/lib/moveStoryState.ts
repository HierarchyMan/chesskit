import { atom } from "jotai";
import type { MoveStory } from "./visualize/moveStory";
import type { MoveClassification } from "@/types/enums";

export interface MoveStoryDialogState {
  open: boolean;
  story?: MoveStory;
  classification?: MoveClassification;
  loading?: boolean;
  error?: string;
}

export const moveStoryAtom = atom<MoveStoryDialogState>({ open: false });
