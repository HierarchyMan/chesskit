import { loadGameFromText } from "@/lib/pgn";
import {
  EditablePosition,
  parseFenLoose,
  positionToFen,
} from "@/lib/editorPosition";
import { EngineName, MoveClassification } from "@/types/enums";
import { GameEval } from "@/types/eval";
import { Chess } from "chess.js";

export interface AnalysisLine {
  id: string;
  pgn: string;
  evaluation?: GameEval;
}

export interface AnalysisSession {
  version: 1;
  revision?: number;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceGameId?: number;
  sourcePgn?: string;
  main: AnalysisLine;
  branches: AnalysisLine[];
  selectedLineId: string;
  cursorPly: number;
  orientation: boolean;
  draft?: EditablePosition;
  draftInput?: string;
}

export const newAnalysisSession = (
  game: Chess = new Chess(),
  sourceGameId?: number
): AnalysisSession => {
  const now = new Date().toISOString();
  const headers = game.getHeaders();
  return {
    version: 1,
    id: crypto.randomUUID(),
    title:
      headers.White && headers.White !== "?"
        ? `${headers.White} – ${headers.Black ?? "Black"}`
        : "Analysis session",
    createdAt: now,
    updatedAt: now,
    sourceGameId,
    sourcePgn: sourceGameId !== undefined ? game.pgn() : undefined,
    main: { id: "main", pgn: game.pgn() },
    branches: [],
    selectedLineId: "main",
    cursorPly: 0,
    orientation: true,
  };
};

const historyKey = (game: Chess) =>
  game.history({ verbose: true }).map((m) => m.lan);
export const isAnalysisPrefix = (prefix: Chess, full: Chess): boolean => {
  if (
    (prefix.getHeaders().FEN ?? new Chess().fen()) !==
    (full.getHeaders().FEN ?? new Chess().fen())
  )
    return false;
  const a = historyKey(prefix),
    b = historyKey(full);
  return a.length <= b.length && a.every((move, index) => move === b[index]);
};

export const sessionLine = (session: AnalysisSession, storeBranches: boolean) =>
  (storeBranches
    ? session.branches.find((line) => line.id === session.selectedLineId)
    : undefined) ?? session.main;

export const replayAnalysis = (line: AnalysisLine, ply?: number): Chess => {
  const game = loadGameFromText(line.pgn);
  if (ply !== undefined) {
    if (!Number.isInteger(ply) || ply < 0 || ply > game.history().length) {
      throw new Error("Invalid analysis replay position.");
    }
    while (game.history().length > ply) game.undo();
  }
  return game;
};

/** Off means no explored alternative, cursor, or evaluation is persisted. */
export const captureAnalysisBoard = (
  session: AnalysisSession,
  board: Chess,
  storeBranches: boolean
): AnalysisSession => {
  const selected = sessionLine(session, storeBranches);
  const lines = storeBranches
    ? [selected, session.main, ...session.branches]
    : [session.main];
  const prefix = lines.find((line) =>
    isAnalysisPrefix(board, replayAnalysis(line))
  );
  if (prefix) {
    return {
      ...session,
      selectedLineId: prefix.id,
      cursorPly: board.history().length,
      updatedAt: new Date().toISOString(),
    };
  }
  const extension = lines.find((line) =>
    isAnalysisPrefix(replayAnalysis(line), board)
  );
  if (extension) {
    const updated = { ...extension, pgn: board.pgn(), evaluation: undefined };
    return {
      ...session,
      main: extension.id === "main" ? updated : session.main,
      branches: session.branches.map((line) =>
        line.id === extension.id ? updated : line
      ),
      selectedLineId: extension.id,
      cursorPly: board.history().length,
      updatedAt: new Date().toISOString(),
    };
  }
  if (!storeBranches) return session;
  // An unrelated root is a new session, never a variation of this game.
  if (!isAnalysisPrefix(replayAnalysis(session.main, 0), board)) return session;
  const branch = { id: crypto.randomUUID(), pgn: board.pgn() };
  return {
    ...session,
    branches: [...session.branches, branch],
    selectedLineId: branch.id,
    cursorPly: board.history().length,
    updatedAt: new Date().toISOString(),
  };
};

export const clearAnalysisBranches = (
  session: AnalysisSession
): AnalysisSession => ({
  ...session,
  branches: [],
  selectedLineId: "main",
  cursorPly: Math.min(
    session.cursorPly,
    replayAnalysis(session.main).history().length
  ),
  updatedAt: new Date().toISOString(),
});

export const evaluationMatches = (
  evaluation: GameEval | undefined,
  game: Chess
) =>
  !!evaluation &&
  (evaluation.accuracy?.white === null ||
    Number.isFinite(evaluation.accuracy?.white)) &&
  (evaluation.accuracy?.black === null ||
    Number.isFinite(evaluation.accuracy?.black)) &&
  Object.values(EngineName).includes(evaluation.settings?.engine) &&
  Number.isFinite(evaluation.settings?.depth) &&
  Number.isFinite(evaluation.settings?.multiPv) &&
  Array.isArray(evaluation.positions) &&
  evaluation.positions.length === game.history().length + 1 &&
  evaluation.positions.every(
    (position) =>
      !!position &&
      Array.isArray(position.lines) &&
      position.lines.length > 0 &&
      (!position.moveClassification ||
        Object.values(MoveClassification).includes(
          position.moveClassification
        )) &&
      position.lines.every(
        (line) =>
          !!line &&
          (Number.isFinite(line.cp) || Number.isFinite(line.mate)) &&
          Number.isFinite(line.depth) &&
          Array.isArray(line.pv) &&
          line.pv.every((move) => typeof move === "string")
      )
  );

export const analysisSessionBackup = (session: AnalysisSession): string =>
  JSON.stringify({ format: "chesskit-analysis-session", session }, null, 2);

export const copyAnalysisSession = (
  session: AnalysisSession
): AnalysisSession => {
  const now = new Date().toISOString();
  return {
    ...session,
    id: crypto.randomUUID(),
    revision: undefined,
    createdAt: now,
    updatedAt: now,
  };
};

/** Validate every replay before accepting a backup; never partially import it. */
export const parseAnalysisSessionBackup = (text: string): AnalysisSession => {
  if (text.length > 20_000_000)
    throw new Error("The session backup is too large.");
  const parsed = JSON.parse(text);
  if (parsed?.format !== "chesskit-analysis-session")
    throw new Error("Not a Chesskit analysis-session backup.");
  const session = parsed.session as AnalysisSession;
  validateAnalysisSession(session);
  return session;
};

export const validateAnalysisSession = (session: AnalysisSession): void => {
  if (
    !session ||
    session.version !== 1 ||
    typeof session.id !== "string" ||
    !session.id ||
    typeof session.title !== "string" ||
    !session.title.trim() ||
    typeof session.createdAt !== "string" ||
    typeof session.updatedAt !== "string" ||
    typeof session.orientation !== "boolean" ||
    session.main?.id !== "main" ||
    !Array.isArray(session.branches) ||
    session.branches.length > 2000
  ) {
    throw new Error("Invalid analysis session.");
  }
  const ids = new Set<string>();
  const root = replayAnalysis(session.main, 0);
  for (const line of [session.main, ...session.branches]) {
    if (
      typeof line.id !== "string" ||
      ids.has(line.id) ||
      typeof line.pgn !== "string"
    ) {
      throw new Error("Invalid or duplicate analysis line.");
    }
    ids.add(line.id);
    const game = replayAnalysis(line);
    if (!isAnalysisPrefix(root, game))
      throw new Error("Analysis branches have different starting positions.");
    if (line.evaluation && !evaluationMatches(line.evaluation, game))
      throw new Error("Invalid saved evaluation.");
  }
  if (!ids.has(session.selectedLineId))
    throw new Error("Unknown selected analysis line.");
  replayAnalysis(sessionLine(session, true), session.cursorPly);
  if (session.draft) {
    const draft = session.draft;
    if (
      !["w", "b"].includes(draft.turn) ||
      !Number.isInteger(draft.fullmove) ||
      draft.fullmove < 1 ||
      !parseFenLoose(positionToFen(draft))
    ) {
      throw new Error("Invalid saved board arrangement.");
    }
  }
  if (
    session.draftInput !== undefined &&
    typeof session.draftInput !== "string"
  )
    throw new Error("Invalid saved FEN draft.");
};
