import { EngineId } from "@/types/enums";
import { Chess } from "chess.js";
import { engineMaxElo, getEngineModel } from "./models";
import { DEFAULT_FULL_STRENGTH_MS } from "./engineSettings";
import {
  BotStrength,
  MovePlan,
  StrengthProfile,
  maxDepthForTime,
  maxMovetimeForClock,
  pickSampledMove,
  planMove,
  scoreFromLine,
} from "./strength";
import { UciEngine } from "./uciEngine";

export interface BotMoveOptions {
  random?: () => number;
  // The bot's remaining clock time, when the game has a clock.
  clockMs?: number;
  // Think time per move at full strength.
  fullStrengthMs?: number;
}

/** The strength range of a running engine: what it advertised, and its rating. */
export const strengthProfileFor = (
  engine: UciEngine,
  fullStrengthMs = DEFAULT_FULL_STRENGTH_MS
): StrengthProfile => ({
  nativeElo: engine.capabilities.elo,
  maxElo: engineMaxElo(engine.name),
  fullStrengthMs,
});

/** The plan for one move, shortened to what the clock allows. */
export const planBotMove = (
  engine: UciEngine,
  strength: BotStrength,
  { clockMs, fullStrengthMs }: BotMoveOptions = {}
): MovePlan => {
  const plan = planMove(strength, strengthProfileFor(engine, fullStrengthMs));
  const maxDepth = maxDepthForTime(clockMs);
  const maxMovetime = maxMovetimeForClock(clockMs);
  const depth = Math.max(1, Math.min(plan.depth, maxDepth ?? plan.depth));
  if (plan.kind === "best" && plan.movetimeMs) {
    return {
      ...plan,
      depth,
      movetimeMs: Math.min(plan.movetimeMs, maxMovetime ?? plan.movetimeMs),
    };
  }
  return { ...plan, depth };
};

export const legalUciMoves = (fen: string): string[] =>
  new Chess(fen)
    .moves({ verbose: true })
    .map((move) => move.from + move.to + (move.promotion ?? ""));

export const getBotMove = async (
  engine: UciEngine,
  fen: string,
  strength: BotStrength,
  options: BotMoveOptions = {}
): Promise<string | undefined> => {
  const { random = Math.random } = options;

  // Joke engines choose their own moves; strength settings do not apply to them.
  if (getEngineModel(engine.name).playsOwnMoves) {
    return engine.getEngineNextMove(fen, undefined, 1);
  }

  const plan = planBotMove(engine, strength, options);

  if (plan.kind === "native") {
    return engine.getEngineNextMove(fen, plan.elo, plan.depth);
  }

  if (plan.kind === "best") {
    return engine.getEngineNextMove(
      fen,
      undefined,
      plan.depth,
      plan.movetimeMs
    );
  }

  const legalMoves = legalUciMoves(fen);
  if (legalMoves.length <= 1) return legalMoves[0];

  const result = await engine.evaluatePositionWithUpdate({
    fen,
    depth: plan.depth,
    multiPv: plan.multiPv,
    useCloudEval: false,
  });

  const turn = new Chess(fen).turn();
  const candidates = result.lines
    .filter((line) => line.pv.length > 0)
    .map((line) => ({ uci: line.pv[0], cp: scoreFromLine(line, turn) }));

  return pickSampledMove(candidates, legalMoves, plan, strength.elo, random);
};

/**
 * The strength as it applies to one engine, for labels: the top of its Elo
 * range reads as full strength, and joke engines have none (undefined).
 */
export const effectiveStrength = (
  name: EngineId,
  strength: BotStrength
): BotStrength | undefined => {
  if (getEngineModel(name).playsOwnMoves) return undefined;
  if (strength.mode !== "elo") return strength;
  return strength.elo >= engineMaxElo(name)
    ? { ...strength, mode: "max" }
    : strength;
};
