import { Chess } from "chess.js";
import { BotMoveOptions, planBotMove } from "./botMove";
import { getEngineModel } from "./models";
import { LineEval } from "@/types/eval";
import {
  BotStrength,
  ScoredMove,
  pickSampledMove,
  scoreFromLine,
} from "./strength";
import { UciEngine } from "./uciEngine";

export interface BotChoice {
  uci: string;
  lines: LineEval[];
  candidates: ScoredMove[];
}

export const MAX_VARIETY_MARGIN_CP = 150;

export const pickWithVariety = (
  candidates: ScoredMove[],
  variety: number,
  random: () => number = Math.random
): string | undefined => {
  if (!candidates.length) return undefined;

  const sorted = [...candidates].sort((a, b) => b.cp - a.cp);
  const margin = Math.max(0, Math.min(1, variety)) * MAX_VARIETY_MARGIN_CP;
  const pool = sorted.filter((move) => move.cp >= sorted[0].cp - margin);

  return pool[Math.floor(random() * pool.length)].uci;
};

export const getBotChoice = async (
  engine: UciEngine,
  fen: string,
  strength: BotStrength,
  {
    candidateCount = 3,
    variety = 0,
    random = Math.random,
    ...moveOptions
  }: {
    candidateCount?: number;
    variety?: number;
    random?: () => number;
  } & BotMoveOptions = {}
): Promise<BotChoice | undefined> => {
  const game = new Chess(fen);
  const legalMoves = game
    .moves({ verbose: true })
    .map((move) => move.from + move.to + (move.promotion ?? ""));
  if (!legalMoves.length) return undefined;

  const ownMoves = !!getEngineModel(engine.name).playsOwnMoves;
  const plan = planBotMove(engine, strength, moveOptions);
  const multiPv = Math.max(
    2,
    candidateCount,
    plan.kind === "sampled" ? plan.multiPv : 0
  );

  const result = await engine.evaluatePositionWithUpdate({
    fen,
    depth: ownMoves ? 1 : plan.depth,
    multiPv,
    useCloudEval: false,
    elo: plan.kind === "native" ? plan.elo : undefined,
    movetimeMs: !ownMoves && plan.kind === "best" ? plan.movetimeMs : undefined,
  });

  const turn = game.turn();
  const candidates = result.lines
    .filter((line) => line.pv.length > 0)
    .map((line) => ({ uci: line.pv[0], cp: scoreFromLine(line, turn) }));

  let uci: string | undefined;
  if (ownMoves) {
    // Lines are sorted by score, so a joke engine's own pick is its "bestmove".
    uci = result.bestMove ?? candidates[0]?.uci;
  } else if (plan.kind === "sampled") {
    uci = pickSampledMove(candidates, legalMoves, plan, strength.elo, random);
  } else {
    uci = pickWithVariety(candidates, variety, random);
  }

  return {
    uci: uci ?? legalMoves[0],
    lines: result.lines,
    candidates,
  };
};
