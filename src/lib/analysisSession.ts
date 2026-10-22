import { loadGameFromText } from "@/lib/pgn";
import {
  EditablePosition,
  parseFenLoose,
  positionToFen,
} from "@/lib/editorPosition";
import { EngineName, MoveClassification } from "@/types/enums";
import { GameEval } from "@/types/eval";
import { Chess } from "chess.js";
import { chessPath, isChessPrefix } from "@/lib/chessHistory";

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

interface AnalysisPath {
  root: string;
  moves: string[];
  sans: string[];
}
const linePaths = new Map<string, AnalysisPath>();
let cachedCharacters = 0;
const gamePath = chessPath;
export const analysisLinePath = (line: AnalysisLine): AnalysisPath => {
  const cached = linePaths.get(line.pgn);
  if (cached) return cached;
  const result = gamePath(loadGameFromText(line.pgn));
  linePaths.set(line.pgn, result);
  cachedCharacters += line.pgn.length;
  while (linePaths.size > 256 || cachedCharacters > 8_000_000) {
    const key = linePaths.keys().next().value!;
    linePaths.delete(key);
    cachedCharacters -= key.length;
  }
  return result;
};
const pathIsPrefix = (a: AnalysisPath, b: AnalysisPath) =>
  a.root === b.root &&
  a.moves.length <= b.moves.length &&
  a.moves.every((move, index) => move === b.moves[index]);
export const isAnalysisPrefix = isChessPrefix;

export const sessionLine = (session: AnalysisSession) =>
  session.branches.find((line) => line.id === session.selectedLineId) ??
  session.main;

export const replayAnalysis = (line: AnalysisLine, ply?: number): Chess => {
  const game = loadGameFromText(line.pgn);
  if (ply !== undefined) {
    const length = game.history().length;
    if (!Number.isInteger(ply) || ply < 0 || ply > length) {
      throw new Error("Invalid analysis replay position.");
    }
    for (let current = length; current > ply; current--) game.undo();
  }
  return game;
};

/** Recording policy is independent of selection and access to remembered lines. */
export const captureAnalysisBoard = (
  session: AnalysisSession,
  board: Chess,
  storeBranches: boolean
): AnalysisSession => {
  const selected = sessionLine(session);
  const lines = [selected, session.main, ...session.branches];
  const boardPath = gamePath(board);
  const prefix = (storeBranches ? lines : [selected]).find((line) =>
    pathIsPrefix(boardPath, analysisLinePath(line))
  );
  if (prefix) {
    // A comment edit has the same move path as navigation. Merge into the full
    // line without losing its future moves or comments beyond the cursor.
    const full = replayAnalysis(prefix);
    const savedComments = new Map(
      full.getComments().map(({ fen, comment }) => [fen, comment])
    );
    const changedComments = board
      .getComments()
      .some(({ fen, comment }) => savedComments.get(fen) !== comment);
    if (storeBranches && changedComments) {
      const comments = new Map(
        [...full.getComments(), ...board.getComments()].map(
          ({ fen, comment }) => [fen, comment]
        )
      );
      const moves = full.history({ verbose: true });
      while (full.undo()) {
        /* Keep headers and rebuild comments on the complete path. */
      }
      if (comments.has(full.fen())) full.setComment(comments.get(full.fen())!);
      for (const move of moves) {
        full.move(move);
        if (comments.has(full.fen()))
          full.setComment(comments.get(full.fen())!);
      }
    }
    const updated = { ...prefix, pgn: full.pgn() };
    return {
      ...session,
      main: prefix.id === "main" ? updated : session.main,
      branches: session.branches.map((line) =>
        line.id === prefix.id ? updated : line
      ),
      selectedLineId: prefix.id,
      cursorPly: board.history().length,
      updatedAt: new Date().toISOString(),
    };
  }
  if (!storeBranches) return session;
  const extension = lines.find((line) =>
    pathIsPrefix(analysisLinePath(line), boardPath)
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
  // An unrelated root is a new session, never a variation of this game.
  if (analysisLinePath(session.main).root !== boardPath.root) return session;
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
  replayAnalysis(sessionLine(session), session.cursorPly);
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
