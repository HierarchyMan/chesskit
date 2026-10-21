import {
  AnalysisSession,
  captureAnalysisBoard,
  evaluationMatches,
  newAnalysisSession,
  replayAnalysis,
  sessionLine,
} from "@/lib/analysisSession";
import { getGameSignature } from "@/lib/chess";
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

export const analysisSessionAtom = atom<AnalysisSession | null>(null);
export const analysisReadyAtom = atom(false);
export const analysisSaveStateAtom = atom<{
  status: "loading" | "saving" | "saved" | "error";
  error?: string;
}>({ status: "loading" });
export const analysisSaveRequestAtom = atom(0);
export const analysisSessionsRevisionAtom = atom(0);
export const analysisSourceErrorAtom = atom<string | null>(null);
export const analysisFullRequestAtom = atom<{
  id: string;
  target: string;
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
  (get, set, session: AnalysisSession) => {
    const branches = get(branchPreferenceAtom);
    const line = sessionLine(session, branches);
    const cursorPly =
      !branches && session.selectedLineId !== "main" ? 0 : session.cursorPly;
    const current = { ...session, selectedLineId: line.id, cursorPly };
    set(analysisSessionAtom, current);
    set(gameAtom, replayAnalysis(line));
    set(boardValueAtom, replayAnalysis(line, cursorPly));
    set(evaluationValueAtom, line.evaluation);
    set(currentPositionAtom, {});
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
  (get, set, enabled: boolean) => {
    set(branchPreferenceAtom, enabled);
    const session = get(analysisSessionAtom);
    if (!enabled && session?.selectedLineId !== "main" && session) {
      set(restoreAnalysisSessionAtom, {
        ...session,
        selectedLineId: "main",
        cursorPly: 0,
      });
    }
  }
);

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
    const line = sessionLine(captured, get(branchPreferenceAtom));
    const full = replayAnalysis(line);
    if (getGameSignature(full) !== getGameSignature(get(gameAtom))) {
      set(gameAtom, full);
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
    const line = sessionLine(session, get(branchPreferenceAtom));
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
