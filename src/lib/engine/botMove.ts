import { hasNativeEloLimit } from "@/constants";
import { Chess } from "chess.js";
import {
  BotStrength,
  pickSampledMove,
  planMove,
  scoreFromLine,
} from "./strength";
import { UciEngine } from "./uciEngine";

export interface BotMoveOptions {
  random?: () => number;
  maxDepth?: number;
}

export const getBotMove = async (
  engine: UciEngine,
  fen: string,
  strength: BotStrength,
  { random = Math.random, maxDepth }: BotMoveOptions = {}
): Promise<string | undefined> => {
  const plan = planMove(strength, hasNativeEloLimit(engine.name));
  const cap = (depth: number) => Math.max(1, Math.min(depth, maxDepth ?? depth));

  if (plan.kind === "native") {
    return engine.getEngineNextMove(fen, plan.elo, cap(plan.depth));
  }

  if (plan.kind === "best") {
    return engine.getEngineNextMove(fen, undefined, cap(plan.depth));
  }

  const game = new Chess(fen);
  const legalMoves = game
    .moves({ verbose: true })
    .map((move) => move.from + move.to + (move.promotion ?? ""));
  if (legalMoves.length <= 1) return legalMoves[0];

  const result = await engine.evaluatePositionWithUpdate({
    fen,
    depth: cap(plan.depth),
    multiPv: plan.multiPv,
    useCloudEval: false,
  });

  const turn = game.turn();
  const candidates = result.lines
    .filter((line) => line.pv.length > 0)
    .map((line) => ({ uci: line.pv[0], cp: scoreFromLine(line, turn) }));

  return pickSampledMove(candidates, legalMoves, plan, strength.elo, random);
};
