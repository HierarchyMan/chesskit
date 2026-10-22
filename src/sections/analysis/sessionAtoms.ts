import {
  AnalysisSession,
  captureAnalysisBoard,
  evaluationMatches,
  newAnalysisSession,
  replayAnalysis,
  sessionLine,
  isAnalysisPrefix,
} from "@/lib/analysisSession";
import { getGameSignature } from "@/lib/chess";
import { navigateChess, ReplayAction, replayState } from "@/lib/chessHistory";
import { storedAtom } from "@/lib/storedAtom";
import { CurrentPosition, GameEval } from "@/types/eval";
import { Chess } from "chess.js";
import {
  EditablePosition,
  positionFromFen,
  START_FEN,
} from "@/lib/editorPosition";
import { atom } from "jotai";
import { Arrow } from "react-chessboard/dist/chessboard/types";
import type { UciEngine } from "@/lib/engine/uciEngine";

export const analysisSessionAtom = atom<AnalysisSession | null>(null);
export const analysisReadyAtom = atom(false);
export const analysisSaveStateAtom = atom<{
  status: "loading" | "saving" | "saved" | "error";
  error?: string;
}>({ status: "loading" });
export const analysisSaveRequestAtom = atom(0);
export const analysisSessionsRevisionAtom = atom(0);
export const analysisSourceErrorAtom = atom<string | null>(null);
export const analysisPositionErrorAtom = atom<string | null>(null);
export const analysisFullRequestAtom = atom<{
  id: string;
  target: string;
  engine: UciEngine;
} | null>(null);

export const analysisTargetKey = (
  session: AnalysisSession | null,
  game: Chess
) => `${session?.id ?? ""}:${getGameSignature(game)}`;
const branchPreferenceAtom = storedAtom(
  "analysis-store-branches",
  false,
  (value): value is boolean => typeof value === "boolean"
);

export const gameAtom = atom(new Chess());
export const arrangeModeAtom = atom(false);
export const editablePositionAtom = atom<EditablePosition>(
  positionFromFen(START_FEN)
);
export const arrangeFenDraftAtom = atom<string | null>(null);
export const boardOrientationAtom = atom(true);
const boardValueAtom = atom(new Chess());
const evaluationValueAtom = atom<GameEval | undefined>(undefined);
export const currentPositionAtom = atom<CurrentPosition>({});
export const evaluationProgressAtom = atom(0);
export const autoPlayAtom = atom(false);
export const boardArrowsAtom = atom<Arrow[]>([]);

export const restoreAnalysisSessionAtom = atom(
  null,
  (_get, set, session: AnalysisSession) => {
    const line = sessionLine(session);
    const cursorPly = session.cursorPly;
    const current = { ...session, selectedLineId: line.id, cursorPly };
    set(analysisSessionAtom, current);
    set(gameAtom, replayAnalysis(line));
    set(boardValueAtom, replayAnalysis(line, cursorPly));
    set(evaluationValueAtom, line.evaluation);
    set(currentPositionAtom, {});
    set(analysisPositionErrorAtom, null);
    set(evaluationProgressAtom, 0);
    set(autoPlayAtom, false);
    set(boardArrowsAtom, []);
    set(boardOrientationAtom, session.orientation);
    set(arrangeModeAtom, !!session.draft);
    set(arrangeFenDraftAtom, session.draftInput ?? null);
    if (session.draft) set(editablePositionAtom, session.draft);
  }
);

export const storeAnalysisBranchesAtom = atom(
  (get) => get(branchPreferenceAtom),
  (_get, set, enabled: boolean) => {
    set(branchPreferenceAtom, enabled);
  }
);
// Retain the old export/key for existing consumers and stored preferences.
export const rememberAnalysisAtom = storeAnalysisBranchesAtom;

export const boardAtom = atom(
  (get) => get(boardValueAtom),
  (get, set, update: Chess | ((previous: Chess) => Chess)) => {
    const board =
      typeof update === "function" ? update(get(boardValueAtom)) : update;
    set(boardValueAtom, board);
    const session = get(analysisSessionAtom);
    if (!session) return;
    const captured = captureAnalysisBoard(
      session,
      board,
      get(branchPreferenceAtom)
    );
    if (captured === session) return;
    set(analysisSessionAtom, captured);
    const line = sessionLine(captured);
    const full = replayAnalysis(line);
    const changedPath =
      getGameSignature(full) !== getGameSignature(get(gameAtom));
    if (full.pgn() !== get(gameAtom).pgn()) set(gameAtom, full);
    if (changedPath) {
      set(evaluationValueAtom, line.evaluation);
      set(evaluationProgressAtom, 0);
    }
  }
);

export const gameEvalAtom = atom(
  (get) => get(evaluationValueAtom),
  (
    get,
    set,
    update:
      | GameEval
      | undefined
      | ((previous: GameEval | undefined) => GameEval | undefined)
  ) => {
    const evaluation =
      typeof update === "function" ? update(get(evaluationValueAtom)) : update;
    if (evaluation && !evaluationMatches(evaluation, get(gameAtom))) return;
    set(evaluationValueAtom, evaluation);
    const session = get(analysisSessionAtom);
    if (!session) return;
    const line = sessionLine(session);
    set(analysisSessionAtom, {
      ...session,
      main: line.id === "main" ? { ...line, evaluation } : session.main,
      branches: session.branches.map((branch) =>
        branch.id === line.id ? { ...branch, evaluation } : branch
      ),
      updatedAt: new Date().toISOString(),
    });
  }
);

export const analysisReplayStateAtom = atom((get) =>
  replayState(get(boardAtom), get(gameAtom))
);

/** A transient exploration is still copyable and visible while recording is off. */
export const displayedAnalysisGameAtom = atom((get) => {
  const board = get(boardAtom);
  const game = get(gameAtom);
  return isAnalysisPrefix(board, game) ? game : board;
});

export const navigateAnalysisAtom = atom(
  null,
  (get, set, action: ReplayAction) => {
    const board = get(boardAtom);
    const next = navigateChess(board, get(gameAtom), action);
    if (next === board) return undefined;
    set(boardAtom, next);
    return (
      next.history({ verbose: true }).at(-1) ??
      board.history({ verbose: true })[0]
    );
  }
);

export const loadAnalysisGameAtom = atom(
  null,
  (
    _get,
    set,
    params: {
      game: Chess;
      orientation?: boolean;
      evaluation?: GameEval;
      sourceGameId?: number;
    }
  ) => {
    const session = newAnalysisSession(params.game, params.sourceGameId);
    session.orientation = params.orientation ?? true;
    session.main.evaluation = evaluationMatches(params.evaluation, params.game)
      ? params.evaluation
      : undefined;
    set(restoreAnalysisSessionAtom, session);
  }
);
