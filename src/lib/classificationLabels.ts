import { MoveClassification } from "@/types/enums";

/** Display names are independent of the stable keys in saved evaluations. */
export const CLASSIFICATION_NAMES: Record<MoveClassification, string> = {
  [MoveClassification.Opening]: "Opening",
  [MoveClassification.Forced]: "Forced",
  [MoveClassification.Splendid]: "Brilliant",
  [MoveClassification.Perfect]: "Great",
  [MoveClassification.Best]: "Best",
  [MoveClassification.Excellent]: "Excellent",
  [MoveClassification.Okay]: "Okay",
  [MoveClassification.Inaccuracy]: "Inaccuracy",
  [MoveClassification.Mistake]: "Mistake",
  [MoveClassification.Blunder]: "Blunder",
};
export const classificationName = (classification: string) =>
  CLASSIFICATION_NAMES[classification as MoveClassification] ?? classification;

export const CLASSIFICATION_PHRASES: Record<MoveClassification, string> = {
  [MoveClassification.Opening]: "an opening move",
  [MoveClassification.Forced]: "forced",
  [MoveClassification.Splendid]: "brilliant !!",
  [MoveClassification.Perfect]: "great !",
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
