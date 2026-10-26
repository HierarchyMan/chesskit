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
// An interrupted search is repeated this many times before the move is reported as failed.
const MAX_SEARCH_ATTEMPTS = 3;

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

/**
 * The moves a finished search rates, as scores for the side to move.
 *
 * A search that ends on a clock stops inside an iteration, so its lines do not
 * share one depth: a line left over from an earlier iteration can name a move
 * that the later one refuted, or the same move as a newer line. Only the lines
 * of the deepest iteration count, and each move counts once. Bounds are not
 * scores. The engine's own best move always counts, since a stop inside the
 * re-search of that move leaves no exact line for it.
 */
export const searchCandidates = (
  lines: LineEval[],
  turn: "w" | "b",
  bestMove: string | undefined,
  legalMoves: string[]
): ScoredMove[] => {
  const exact = lines.filter((line) => line.pv.length > 0 && !line.bound);
  const deepest = Math.max(0, ...exact.map((line) => line.depth));
  const candidates: ScoredMove[] = [];
  for (const line of exact) {
    if (line.depth !== deepest) continue;
    if (candidates.some((candidate) => candidate.uci === line.pv[0])) continue;
    candidates.push({ uci: line.pv[0], cp: scoreFromLine(line, turn) });
  }

  if (
    bestMove &&
    legalMoves.includes(bestMove) &&
    !candidates.some((candidate) => candidate.uci === bestMove)
  ) {
    const top = candidates.length
      ? Math.max(...candidates.map((candidate) => candidate.cp))
      : 0;
    candidates.push({ uci: bestMove, cp: top });
  }
  return candidates;
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
  // A forced move needs no search.
  if (legalMoves.length === 1) {
    return { uci: legalMoves[0], lines: [], candidates: [] };
  }

  const ownMoves = !!getEngineModel(engine.name).playsOwnMoves;
  const plan = planBotMove(engine, strength, moveOptions);
  const multiPv = Math.max(
    2,
    candidateCount,
    plan.kind === "sampled" ? plan.multiPv : 0
  );

  const turn = game.turn();

  for (let attempt = 0; attempt < MAX_SEARCH_ATTEMPTS; attempt++) {
    const result = await engine.evaluatePositionWithUpdate({
      fen,
      depth: ownMoves ? 1 : plan.depth,
      multiPv,
      useCloudEval: false,
      elo: plan.kind === "native" ? plan.elo : undefined,
      movetimeMs:
        !ownMoves && plan.kind === "best" ? plan.movetimeMs : undefined,
    });

    const candidates = ownMoves
      ? result.lines
          .filter((line) => line.pv.length > 0)
          .map((line) => ({ uci: line.pv[0], cp: scoreFromLine(line, turn) }))
      : searchCandidates(result.lines, turn, result.bestMove, legalMoves);

    let uci: string | undefined;
    if (ownMoves) {
      // Lines are sorted by score, so a joke engine's own pick is its "bestmove".
      uci = result.bestMove ?? candidates[0]?.uci;
    } else if (plan.kind === "sampled") {
      uci = pickSampledMove(candidates, legalMoves, plan, strength.elo, random);
    } else {
      uci = pickWithVariety(candidates, variety, random);
    }

    // A search that was interrupted comes back with no lines. The engine's own
    // "bestmove" is still its real choice; an arbitrary legal move never is.
    if (!uci && result.bestMove && legalMoves.includes(result.bestMove)) {
      uci = result.bestMove;
    }

    if (uci && legalMoves.includes(uci)) {
      return { uci, lines: result.lines, candidates };
    }
  }

  throw new Error("The engine returned no usable move.");
};
