import { LineEval, PositionEval } from "@/types/eval";
import { BoardArrow } from "../arrows/types";
import { arrowFromUci } from "../arrows/uci";
import { getLineWinPercentage } from "./helpers/winPercentage";
import { getFenForSide, linesToTopMoves } from "./topMoves";

export interface Threat {
  uci: string;
  /** The opponent's colour: the side that would carry the threat out. */
  side: "w" | "b";
  /** Winning chances the opponent gains by moving first, in percentage points. */
  gain: number;
}

/**
 * A second threat must be about as strong as the first. Lichess draws the other
 * lines of a search only when they are within 0.2 of the best in its scale of
 * winning chances, which is 10 points of this one: a quiet move that gains a
 * little is not a second threat.
 */
export const ALTERNATIVE_THREAT_WITHIN = 10;

export interface ThreatOptions {
  /** Winning chances, in points, the opponent must gain to make a move a threat. */
  minimumGain: number;
  /** How many threats to return at most. */
  limit: number;
}

const winningChances = (line: LineEval, side: "w" | "b") => {
  try {
    const white = getLineWinPercentage(line);
    return side === "w" ? white : 100 - white;
  } catch {
    return undefined;
  }
};

/**
 * The position handed to the opponent, which is what the search for threats
 * runs on: the same board, the other side to move, and no en passant square.
 * It does not exist when the mover is in check, since passing would leave the
 * king capturable, or when the game is over.
 */
export const positionForThreats = (fen: string): string | undefined => {
  const handedOver = getFenForSide(fen, "opponent");
  return "error" in handedOver ? undefined : handedOver.fen;
};

/**
 * A threat is what the opponent would gain by moving first. `main` is the
 * evaluation of the real position and `passed` the evaluation of the same
 * position with the turn handed to the opponent, so the difference is exactly
 * the price of ignoring the move. Only that difference makes a threat real: the
 * opponent's best move in a passed position is often just a sensible move.
 *
 * A line that only keeps an earlier threat alive is not a second threat: with a
 * queen hanging, every quiet move that leaves it hanging scores as well as
 * taking it. So a line is dropped when the opponent later plays, in that line,
 * a move already counted as a threat.
 */
export const findThreats = (
  fen: string,
  main: PositionEval,
  passed: PositionEval,
  { minimumGain, limit }: ThreatOptions
): Threat[] => {
  const handedOver = positionForThreats(fen);
  if (!handedOver || !main.lines[0]) return [];

  const opponent = fen.split(" ")[1] === "w" ? "b" : "w";
  const baseline = winningChances(main.lines[0], opponent);
  if (baseline === undefined) return [];

  const threats: Threat[] = [];
  let strongest: number | undefined;
  for (const move of linesToTopMoves(handedOver, passed.lines)) {
    const line = passed.lines.find((entry) => entry.pv[0] === move.uci);
    const chances = line && winningChances(line, opponent);
    if (chances === undefined) continue;

    // The opponent moves on every other ply of the line, starting with the first.
    const later = move.pvUci.filter((_, ply) => ply > 0 && ply % 2 === 0);
    if (later.some((uci) => threats.some((threat) => threat.uci === uci))) {
      continue;
    }

    const gain = chances - baseline;
    strongest ??= gain;
    if (gain < minimumGain || gain < strongest - ALTERNATIVE_THREAT_WITHIN) {
      continue;
    }
    threats.push({ uci: move.uci, side: opponent, gain });
  }

  return threats.sort((a, b) => b.gain - a.gain).slice(0, limit);
};

export const threatArrows = (threats: readonly Threat[]): BoardArrow[] =>
  threats.map((threat) =>
    arrowFromUci(threat.uci, { kind: "threat", side: threat.side, label: "!" })
  );
