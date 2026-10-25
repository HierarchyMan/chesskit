import { Chess } from "chess.js";
import { LineEval } from "@/types/eval";
import {
  getLineEvalLabel,
  getMaterialDifference,
  uciMoveParams,
} from "../chess";
import { getLineWinPercentage } from "../engine/helpers/winPercentage";
import { MoveTag, describeMove } from "./explain";

export const MAX_CASCADE_PLIES = 10;
export const MIN_CASCADE_PLIES = 2;
const SIGNIFICANT_LOSS_PAWNS = 0.7;
const MATERIAL_EXPLAINS_LOSS = 0.7;
const BETTER_LINE_PLIES = 6;
const POSITIONAL_MIN_PLIES = 4;

export type CascadeEndReason =
  | "mate"
  | "material"
  | "settled"
  | "limit"
  | "line-ended";

export interface StoryStep {
  index: number;
  fen: string;
  uci?: string;
  san?: string;
  color?: "w" | "b";
  note: string;
  tags: MoveTag[];
  capturedValue: number;
  moverBalance: number;
}

export interface StoryLine {
  steps: StoryStep[];
  autoEnd: number;
  endReason: CascadeEndReason;
  evalLabel: string;
  moverWinPercentage: number;
}

export interface MoveStory {
  kind?: "continuation";
  fenBefore: string;
  mover: "w" | "b";
  playedSan: string;
  bestSan?: string;
  played: StoryLine;
  better?: StoryLine;
  winBefore: number;
  winAfter: number;
  lossPawns: number;
  summary: string[];
}

export interface StoryInput {
  fenBefore: string;
  playedUci: string;
  beforeLines: LineEval[];
  afterLines: LineEval[];
}

export const humanEvalLabel = (line: LineEval | undefined): string => {
  if (!line) return "?";
  if (line.mate !== undefined) {
    return `${line.mate > 0 ? "White" : "Black"} mates in ${Math.abs(line.mate)}`;
  }

  return getLineEvalLabel(line);
};

const toMoverPercentage = (line: LineEval | undefined, mover: "w" | "b") => {
  if (!line) return 50;
  const white = getLineWinPercentage(line);
  return mover === "w" ? white : 100 - white;
};

const toMoverPawns = (line: LineEval | undefined, mover: "w" | "b") => {
  if (!line || line.cp === undefined) return undefined;
  return ((mover === "w" ? 1 : -1) * line.cp) / 100;
};

const moverBalanceOf = (fen: string, mover: "w" | "b") =>
  (mover === "w" ? 1 : -1) * getMaterialDifference(fen);

const buildSteps = (
  fenBefore: string,
  moves: string[],
  mover: "w" | "b"
): StoryStep[] => {
  const game = new Chess(fenBefore);
  const steps: StoryStep[] = [
    {
      index: 0,
      fen: fenBefore,
      note: "The position before the move.",
      tags: [],
      capturedValue: 0,
      moverBalance: moverBalanceOf(fenBefore, mover),
    },
  ];

  for (const uci of moves) {
    const fenBeforeMove = game.fen();
    let description;
    let move;

    try {
      description = describeMove(fenBeforeMove, uci);
      move = game.move(uciMoveParams(uci));
    } catch {
      break;
    }

    steps.push({
      index: steps.length,
      fen: game.fen(),
      uci,
      san: move.san,
      color: move.color,
      note: description.text,
      tags: description.tags,
      capturedValue: description.capturedValue,
      moverBalance: moverBalanceOf(game.fen(), mover),
    });
  }

  return steps;
};

const isQuiet = (step: StoryStep): boolean =>
  !step.tags.some((tag) =>
    ["capture", "check", "mate", "promotion"].includes(tag)
  );

export const findCascadeEnd = (
  steps: StoryStep[],
  options: { lossPawns: number; minPlies?: number; maxPlies?: number }
): { autoEnd: number; endReason: CascadeEndReason } => {
  const minPlies = options.minPlies ?? MIN_CASCADE_PLIES;
  const maxPlies = options.maxPlies ?? MAX_CASCADE_PLIES;
  const lastIndex = steps.length - 1;
  const hardLimit = Math.min(lastIndex, 1 + maxPlies);
  const startBalance = steps[0].moverBalance;

  for (let i = 2; i <= hardLimit; i++) {
    const step = steps[i];

    if (step.tags.includes("mate")) {
      return { autoEnd: i, endReason: "mate" };
    }

    const pliesAfterMove = i - 1;
    if (pliesAfterMove < minPlies || !isQuiet(step)) continue;

    const swing = step.moverBalance - startBalance;
    const significant = options.lossPawns >= SIGNIFICANT_LOSS_PAWNS;

    if (significant) {
      if (swing <= -MATERIAL_EXPLAINS_LOSS * options.lossPawns) {
        return { autoEnd: i, endReason: "material" };
      }

      const isMateLoss = options.lossPawns >= 99;
      if (!isMateLoss && pliesAfterMove >= POSITIONAL_MIN_PLIES) {
        return { autoEnd: i, endReason: "settled" };
      }
      continue;
    }

    return { autoEnd: i, endReason: "settled" };
  }

  return {
    autoEnd: hardLimit,
    endReason: lastIndex < 1 + maxPlies ? "line-ended" : "limit",
  };
};

const describeAdvantage = (percentage: number): string => {
  if (percentage >= 90) return "winning";
  if (percentage >= 75) return "much better";
  if (percentage >= 60) return "better";
  if (percentage >= 55) return "slightly better";
  if (percentage > 45) return "about equal";
  if (percentage > 40) return "slightly worse";
  if (percentage > 25) return "worse";
  if (percentage > 10) return "much worse";
  return "losing";
};

const colorName = (color: "w" | "b") => (color === "w" ? "White" : "Black");

const pawnsLabel = (pawns: number): string => {
  const amount = Math.abs(pawns);
  if (amount >= 7.5) return "a queen";
  if (amount >= 4.5) return "a rook";
  if (amount >= 2.5) return "a minor piece";
  if (amount >= 1.5) return "two pawns";
  return "a pawn";
};

export const buildMoveStory = ({
  fenBefore,
  playedUci,
  beforeLines,
  afterLines,
}: StoryInput): MoveStory => {
  const mover = new Chess(fenBefore).turn();
  const bestBefore = beforeLines[0];
  const bestAfter = afterLines[0];

  const bestUci = bestBefore?.pv[0];
  const isBestMove = bestUci === playedUci;

  const winBefore = toMoverPercentage(bestBefore, mover);
  const winAfter = toMoverPercentage(bestAfter, mover);
  const pawnsBefore = toMoverPawns(bestBefore, mover);
  const pawnsAfter = toMoverPawns(bestAfter, mover);

  const mateAgainst =
    bestAfter?.mate !== undefined &&
    (mover === "w" ? bestAfter.mate < 0 : bestAfter.mate > 0);
  const missedMate =
    bestBefore?.mate !== undefined &&
    (mover === "w" ? bestBefore.mate > 0 : bestBefore.mate < 0) &&
    !(
      bestAfter?.mate !== undefined &&
      (mover === "w" ? bestAfter.mate > 0 : bestAfter.mate < 0)
    );

  let lossPawns =
    pawnsBefore !== undefined && pawnsAfter !== undefined
      ? Math.max(0, pawnsBefore - pawnsAfter)
      : 0;
  if (mateAgainst || missedMate) lossPawns = Math.max(lossPawns, 99);

  const playedMoves = [playedUci, ...(bestAfter?.pv ?? [])].slice(
    0,
    1 + MAX_CASCADE_PLIES
  );
  const playedSteps = buildSteps(fenBefore, playedMoves, mover);
  const playedEnd = findCascadeEnd(playedSteps, { lossPawns });

  const played: StoryLine = {
    steps: playedSteps,
    ...playedEnd,
    evalLabel: humanEvalLabel(bestAfter),
    moverWinPercentage: winAfter,
  };

  let better: StoryLine | undefined;
  if (!isBestMove && bestBefore?.pv.length) {
    const betterSteps = buildSteps(
      fenBefore,
      bestBefore.pv.slice(0, 1 + BETTER_LINE_PLIES),
      mover
    );
    better = {
      steps: betterSteps,
      ...findCascadeEnd(betterSteps, {
        lossPawns: 0,
        maxPlies: BETTER_LINE_PLIES,
      }),
      evalLabel: humanEvalLabel(bestBefore),
      moverWinPercentage: winBefore,
    };
  }

  const playedSan = playedSteps[1]?.san ?? playedUci;
  const bestSan = better?.steps[1]?.san;

  const summary = buildSummary({
    mover,
    playedSan,
    bestSan,
    played,
    better,
    winBefore,
    winAfter,
    isBestMove,
    mateAgainst,
    missedMate,
    mateDistance: Math.abs(bestAfter?.mate ?? bestBefore?.mate ?? 0),
    bestBefore,
    bestAfter,
  });

  return {
    fenBefore,
    mover,
    playedSan,
    bestSan,
    played,
    better,
    winBefore,
    winAfter,
    lossPawns,
    summary,
  };
};

/** A preview of an existing PV, with the evaluation of its starting position.
 * It does not pretend to have independently evaluated the positions after it. */
export const buildContinuationStory = (
  fenBefore: string,
  line: LineEval
): MoveStory => {
  const mover = new Chess(fenBefore).turn();
  const steps = buildSteps(
    fenBefore,
    line.pv.slice(0, 1 + MAX_CASCADE_PLIES),
    mover
  );
  const win = toMoverPercentage(line, mover);
  return {
    kind: "continuation",
    fenBefore,
    mover,
    playedSan: steps[1]?.san ?? "Continuation",
    played: {
      steps,
      ...findCascadeEnd(steps, { lossPawns: 0 }),
      evalLabel: humanEvalLabel(line),
      moverWinPercentage: win,
    },
    winBefore: win,
    winAfter: win,
    lossPawns: 0,
    summary: [
      "Explore the engine's current top continuation. These moves are a forecast; either side can choose a different move.",
    ],
  };
};

const buildSummary = ({
  mover,
  playedSan,
  bestSan,
  played,
  better,
  winBefore,
  winAfter,
  isBestMove,
  mateAgainst,
  missedMate,
  mateDistance,
  bestBefore,
  bestAfter,
}: {
  mover: "w" | "b";
  playedSan: string;
  bestSan?: string;
  played: StoryLine;
  better?: StoryLine;
  winBefore: number;
  winAfter: number;
  isBestMove: boolean;
  mateAgainst: boolean;
  missedMate: boolean;
  mateDistance: number;
  bestBefore?: LineEval;
  bestAfter?: LineEval;
}): string[] => {
  const side = colorName(mover);

  if (isBestMove) {
    return [`${playedSan} is the engine's top choice here.`];
  }

  const lines: string[] = [];
  const beforeLabel = humanEvalLabel(bestBefore);
  const afterLabel = humanEvalLabel(bestAfter);

  lines.push(
    `${side}'s position goes from ${describeAdvantage(winBefore)} (${beforeLabel}) to ${describeAdvantage(winAfter)} (${afterLabel}) after ${playedSan}.`
  );

  const lastShown = played.steps[played.autoEnd];
  const startBalance = played.steps[0].moverBalance;
  const swing = lastShown ? lastShown.moverBalance - startBalance : 0;
  const movesShown = Math.max(1, played.autoEnd - 1);

  if (mateAgainst) {
    lines.push(
      `It allows ${colorName(mover === "w" ? "b" : "w")} to force checkmate in ${mateDistance}.`
    );
  } else if (missedMate) {
    lines.push(`It lets a forced checkmate in ${mateDistance} slip away.`);
  } else if (swing <= -1) {
    lines.push(
      `Within ${movesShown} ${movesShown === 1 ? "move" : "moves"}, ${side} ends up ${pawnsLabel(swing)} down.`
    );
  } else if (swing >= 1) {
    lines.push(
      `${side} wins material in the sequence, but the engine still finds the other side better placed afterwards.`
    );
  } else {
    lines.push(
      "No material is lost, but the position gets worse: the other side improves its pieces or gains lasting pressure."
    );
  }

  if (better && bestSan) {
    const betterNote = better.steps[1]?.note;
    lines.push(
      `Better was ${bestSan}. ${betterNote ?? ""} That keeps the position ${describeAdvantage(better.moverWinPercentage)} (${better.evalLabel}).`.trim()
    );
  }

  return lines;
};

export const CASCADE_END_TEXT: Record<CascadeEndReason, string> = {
  mate: "The line ends in checkmate.",
  material:
    "The material loss is complete here, and the position is quiet again.",
  settled: "The position settles here: nothing forcing is left to show.",
  limit: "That is the furthest the engine looks ahead in this view.",
  "line-ended": "The engine's line ends here.",
};
