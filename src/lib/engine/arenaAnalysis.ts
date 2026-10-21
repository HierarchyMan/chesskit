import { getMovesClassification } from "@/lib/engine/helpers/moveClassification";
import { CurrentPosition, PositionEval } from "@/types/eval";
import { Chess, Move } from "chess.js";

export const ARENA_ANALYSIS_DEPTH = 12;
export const ARENA_ANALYSIS_LINES = 3;

export interface ArenaMoveAnalysis {
  key: string;
  move: Move;
  before?: PositionEval;
  after?: PositionEval;
}

export const arenaMoveKey = (move: Move, index: number) =>
  `${index}:${move.before}:${move.lan}`;

// Use the full game here: repetition cannot be detected from a FEN alone.
export const arenaTerminalEval = (game: Chess): PositionEval | undefined => {
  if (!game.isGameOver()) return undefined;
  return {
    lines: [
      {
        pv: [],
        depth: ARENA_ANALYSIS_DEPTH,
        multiPv: 1,
        ...(game.isCheckmate()
          ? { mate: game.turn() === "w" ? -1 : 1 }
          : { cp: 0 }),
      },
    ],
  };
};

export const projectArenaAnalysis = (
  game: Chess,
  evaluations: ReadonlyMap<string, PositionEval>,
  annotate: boolean
): { position: CurrentPosition; moves: ArenaMoveAnalysis[] } => {
  const history = game.history({ verbose: true });
  const terminal = arenaTerminalEval(game);
  const current = terminal ?? evaluations.get(game.fen());
  const moves = history.map((move, index): ArenaMoveAnalysis => {
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

    return { key: arenaMoveKey(move, index), move, before, after: classified };
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
