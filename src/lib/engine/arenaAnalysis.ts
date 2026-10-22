import { openings } from "@/data/openings";
import { computeAccuracy } from "@/lib/engine/helpers/accuracy";
import { getMovesClassification } from "@/lib/engine/helpers/moveClassification";
import { Accuracy, CurrentPosition, PositionEval } from "@/types/eval";
import { Chess, Move } from "chess.js";
import { chessPath } from "@/lib/chessHistory";
import { terminalEvaluation } from "./terminalEvaluation";

export const ARENA_ANALYSIS_DEPTH = 12;
export const ARENA_ANALYSIS_LINES = 3;

export interface ArenaMoveAnalysis {
  key: string;
  move: Move;
  before?: PositionEval;
  after?: PositionEval;
}

// Use the full game here: repetition cannot be detected from a FEN alone.
export const arenaTerminalEval = (game: Chess) =>
  terminalEvaluation(game, ARENA_ANALYSIS_DEPTH);

export const projectArenaAnalysis = (
  game: Chess,
  evaluations: ReadonlyMap<string, PositionEval>,
  annotate: boolean
): { position: CurrentPosition; moves: ArenaMoveAnalysis[] } => {
  const history = game.history({ verbose: true });
  const terminal = arenaTerminalEval(game);
  const current = terminal ?? evaluations.get(game.fen());
  const path = chessPath(game);
  let moveKey = path.root;
  const moves = history.map((move, index): ArenaMoveAnalysis => {
    moveKey += `:${move.lan}`;
    const before = evaluations.get(move.before);
    const after =
      index === history.length - 1 ? current : evaluations.get(move.after);
    let classified = after;

    if (annotate && before && after) {
      const previous = history[index - 1];
      const earlier = previous && evaluations.get(previous.before);
      // Include the preceding move when available for recapture detection.
      const positions = earlier ? [earlier, before, after] : [before, after];
      const uciMoves = earlier ? [previous.lan, move.lan] : [move.lan];
      const fens = earlier
        ? [previous.before, move.before, move.after]
        : [move.before, move.after];
      classified = getMovesClassification(positions, uciMoves, fens).at(-1);
    }

    return { key: moveKey, move, before, after: classified };
  });

  const last = moves.at(-1);
  return {
    position: {
      lastMove: last?.move,
      eval: last?.after ?? current,
      lastEval: last?.before,
    },
    moves,
  };
};

/**
 * Accuracy needs every position from the start to the current move, so a
 * single pending evaluation yields null instead of a score built on a gap.
 */
export const getArenaAccuracy = (
  moves: ArenaMoveAnalysis[]
): Accuracy | undefined => {
  const first = moves[0];
  if (!first?.before) return undefined;

  const positions = [first.before, ...moves.map((move) => move.after)];
  if (positions.some((position) => !position)) return undefined;

  return computeAccuracy(positions as PositionEval[], first.move.color === "b");
};

// The first entry wins, matching Analysis, which looks up the first opening
// with a given placement.
const openingNames = new Map<string, string>();
for (const { name, fen } of openings) {
  if (!openingNames.has(fen)) openingNames.set(fen, name);
}

/**
 * The most recent named book position reached in the current history. The
 * classifier's opening label only sees a short window, so it cannot answer
 * this for a game that left its book many moves ago.
 */
export const getArenaOpening = (
  moves: ArenaMoveAnalysis[]
): string | undefined => {
  for (const { move } of moves.slice().reverse()) {
    const name = openingNames.get(move.after.split(" ")[0]);
    if (name) return name;
  }
  return undefined;
};

interface Target {
  game: Chess;
  includeHistory: boolean;
  includePrevious: boolean;
}

export interface ArenaAnalysisUpdate {
  evaluations: ReadonlyMap<string, PositionEval>;
  busy: boolean;
  error?: string;
}

/** One search at a time, without canceling work on every auto-play tick. */
export class ArenaAnalysisSession {
  private target?: Target;
  private busy = false;
  private disposed = false;
  private error?: string;

  constructor(
    private evaluate: (fen: string) => Promise<PositionEval>,
    private publish: (update: ArenaAnalysisUpdate) => void,
    private evaluations = new Map<string, PositionEval>()
  ) {}

  update(game: Chess, includeHistory: boolean, includePrevious: boolean) {
    this.target = { game, includeHistory, includePrevious };
    if (!this.busy && !this.disposed && !this.error) void this.drain();
  }

  dispose() {
    this.disposed = true;
    this.target = undefined;
  }

  private nextFen(): string | undefined {
    if (!this.target) return undefined;
    const { game, includeHistory, includePrevious } = this.target;
    const fen = game.fen();
    const terminal = arenaTerminalEval(game);
    // Keep the live bar current before backfilling the move list.
    if (!terminal && !this.evaluations.has(fen)) return fen;

    const history = game.history({ verbose: true });
    const fens = includeHistory
      ? history.flatMap((move) => [move.before, move.after])
      : includePrevious && history.length
        ? [history[history.length - 1].before]
        : [];
    return fens.find(
      (candidate) =>
        !(terminal && candidate === fen) && !this.evaluations.has(candidate)
    );
  }

  private emit() {
    if (this.disposed) return;
    this.publish({
      evaluations: new Map(this.evaluations),
      busy: this.busy,
      error: this.error,
    });
  }

  private async drain() {
    this.busy = true;
    this.emit();
    try {
      let fen: string | undefined;
      while (!this.disposed && (fen = this.nextFen())) {
        const evaluation =
          arenaTerminalEval(new Chess(fen)) ?? (await this.evaluate(fen));
        if (this.disposed) return;
        const best = evaluation.lines[0];
        if (
          !best ||
          (!Number.isFinite(best.cp) && !Number.isFinite(best.mate))
        ) {
          throw new Error("The analysis engine returned no evaluation.");
        }
        this.evaluations.set(fen, evaluation);
        this.emit();
      }
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : "Move analysis failed.";
    } finally {
      this.busy = false;
      this.emit();
    }
  }
}
