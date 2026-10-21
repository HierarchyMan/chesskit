import {
  ceilsNumber,
  getHarmonicMean,
  getStandardDeviation,
  getWeightedMean,
} from "@/lib/math";
import { Accuracy, PositionEval } from "@/types/eval";
import { getPositionWinPercentage } from "./winPercentage";

export const computeAccuracy = (
  positions: PositionEval[],
  startsWithBlack = false
): Accuracy => {
  const positionsWinPercentage = positions.map(getPositionWinPercentage);

  const weights = getAccuracyWeights(positionsWinPercentage);

  const movesAccuracy = getMovesAccuracy(
    positionsWinPercentage,
    startsWithBlack
  );

  const whiteAccuracy = getPlayerAccuracy(
    movesAccuracy,
    weights,
    startsWithBlack ? 1 : 0
  );
  const blackAccuracy = getPlayerAccuracy(
    movesAccuracy,
    weights,
    startsWithBlack ? 0 : 1
  );

  return {
    white: whiteAccuracy,
    black: blackAccuracy,
  };
};

const getPlayerAccuracy = (
  movesAccuracy: number[],
  weights: number[],
  remainder: number
): number | null => {
  const playerAccuracies = movesAccuracy.filter(
    (_, index) => index % 2 === remainder
  );
  const playerWeights = weights.filter((_, index) => index % 2 === remainder);
  if (!playerAccuracies.length) return null;

  const weightedMean = getWeightedMean(playerAccuracies, playerWeights);
  const harmonicMean = getHarmonicMean(
    playerAccuracies.map((a) => Math.max(a, 10))
  );

  return (weightedMean + harmonicMean) / 2;
};

const getAccuracyWeights = (movesWinPercentage: number[]): number[] => {
  const windowSize = ceilsNumber(
    Math.ceil(movesWinPercentage.length / 10),
    2,
    8
  );

  const windows: number[][] = [];
  const halfWindowSize = Math.round(windowSize / 2);

  for (let i = 1; i < movesWinPercentage.length; i++) {
    const startIdx = i - halfWindowSize;
    const endIdx = i + halfWindowSize;

    if (startIdx < 0) {
      windows.push(movesWinPercentage.slice(0, windowSize));
      continue;
    }

    if (endIdx > movesWinPercentage.length) {
      windows.push(movesWinPercentage.slice(-windowSize));
      continue;
    }

    windows.push(movesWinPercentage.slice(startIdx, endIdx));
  }

  const weights = windows.map((window) => {
    const std = getStandardDeviation(window);
    return ceilsNumber(std, 0.5, 12);
  });

  return weights;
};

const getMovesAccuracy = (
  movesWinPercentage: number[],
  startsWithBlack: boolean
): number[] =>
  movesWinPercentage.slice(1).map((winPercent, index) => {
    const lastWinPercent = movesWinPercentage[index];
    const isWhiteMove = index % 2 === (startsWithBlack ? 1 : 0);
    const winDiff = isWhiteMove
      ? Math.max(0, lastWinPercent - winPercent)
      : Math.max(0, winPercent - lastWinPercent);

    // Source: https://github.com/lichess-org/lila/blob/a320a93b68dabee862b8093b1b2acdfe132b9966/modules/analyse/src/main/AccuracyPercent.scala#L44
    const rawAccuracy =
      103.1668100711649 * Math.exp(-0.04354415386753951 * winDiff) -
      3.166924740191411;

    return Math.min(100, Math.max(0, rawAccuracy + 1));
  });
