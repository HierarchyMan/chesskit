import { projectArenaAnalysis } from "@/lib/engine/arenaAnalysis";
import { buildMoveStory, MoveStory } from "@/lib/visualize/moveStory";
import { MoveClassification } from "@/types/enums";
import { PositionEval } from "@/types/eval";
import { Chess, Move } from "chess.js";

export interface CoachFeedback {
  key: string;
  plyIndex: number;
  status: "evaluating" | "done" | "error";
  playedSan: string;
  move: Move;
  before?: PositionEval;
  classification?: MoveClassification;
  story?: MoveStory;
}

export interface PlayEvaluationSnapshot {
  gameId: number;
  source: object;
  evaluations: ReadonlyMap<string, PositionEval>;
}

const EMPTY = new Map<string, PositionEval>();

/** Board grades describe the latest move of either colour. Coach prose stays
 * on the player's latest move after the bot replies. Both consume the same
 * evaluations, scoped to this game and engine instance. */
export function projectPlayFeedback({
  game,
  gameId,
  player,
  enabled,
  engine,
  snapshot,
  error,
}: {
  game: Chess;
  gameId: number;
  player: "w" | "b";
  enabled: boolean;
  engine: object | null;
  snapshot?: PlayEvaluationSnapshot;
  error?: string;
}) {
  const valid =
    enabled && snapshot?.gameId === gameId && snapshot.source === engine;
  const { position, moves } = projectArenaAnalysis(
    game,
    valid ? snapshot.evaluations : EMPTY,
    enabled
  );
  // A neutral marker means grading is pending, never disabled or failed.
  if (!enabled || (error && !position.eval?.moveClassification)) {
    position.lastMove = undefined;
  }
  if (!enabled) return { position, moves: [], playerMoveIndex: -1 };
  let playerMoveIndex = moves.length - 1;
  while (playerMoveIndex >= 0 && moves[playerMoveIndex].move.color !== player)
    playerMoveIndex--;
  const entry = moves[playerMoveIndex];
  if (!entry) return { position, moves, playerMoveIndex };
  const classification = entry.after?.moveClassification;
  const done = !!entry.before && !!entry.after && !!classification;
  const feedback: CoachFeedback = {
    key: `${gameId}|${entry.key}`,
    plyIndex: playerMoveIndex,
    playedSan: entry.move.san,
    move: entry.move,
    before: entry.before,
    classification,
    status: done ? "done" : error ? "error" : "evaluating",
    story: done
      ? buildMoveStory({
          fenBefore: entry.move.before,
          playedUci: entry.move.lan,
          beforeLines: entry.before!.lines,
          afterLines: entry.after!.lines,
        })
      : undefined,
  };
  return { position, moves, playerMoveIndex, feedback };
}
