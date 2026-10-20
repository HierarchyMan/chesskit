import { MoveClassification } from "@/types/enums";

export const CLASSIFICATION_PHRASES: Record<MoveClassification, string> = {
  [MoveClassification.Opening]: "an opening move",
  [MoveClassification.Forced]: "forced",
  [MoveClassification.Splendid]: "splendid !!",
  [MoveClassification.Perfect]: "the only good move !",
  [MoveClassification.Best]: "the best move",
  [MoveClassification.Excellent]: "excellent",
  [MoveClassification.Okay]: "an okay move",
  [MoveClassification.Inaccuracy]: "an inaccuracy",
  [MoveClassification.Mistake]: "a mistake",
  [MoveClassification.Blunder]: "a blunder",
};

export const WORTH_VISUALIZING: MoveClassification[] = [
  MoveClassification.Okay,
  MoveClassification.Inaccuracy,
  MoveClassification.Mistake,
  MoveClassification.Blunder,
];
