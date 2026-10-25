import { loadGameFromText, normalizePgn } from "@/lib/pgn";
import {
  decodeAnalysisSession,
  encodeAnalysisSession,
} from "@/lib/analysisSessionCodec";
import {
  EditablePosition,
  parseFenLoose,
  positionToFen,
} from "@/lib/editorPosition";
import { MoveClassification } from "@/types/enums";
import { isEngineId } from "./engine/models";
import { GameEval } from "@/types/eval";
import { Chess } from "chess.js";
import { chessPath, isChessPrefix } from "@/lib/chessHistory";
import {
  addStudyPath,
  parseStudyPgn,
  writeStudyPath,
  writeStudyTree,
  studyNodePath,
  studyFromGame,
} from "@/lib/studyTree";

export interface AnalysisReport {
  id: string;
  pgn: string;
  evaluation: GameEval;
}

export interface AnalysisLine {
  id: string;
  pgn: string;
  evaluation?: GameEval;
  reports?: AnalysisReport[];
  cursorPly?: number;
  aliases?: string[];
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
  editableMain?: boolean;
}

/** React session snapshots are immutable. Cursor/draft/metadata changes can be
 * persisted separately without serializing the unchanged tree and reports. */
export const sameAnalysisContent = (a: AnalysisSession, b: AnalysisSession) => {
  const sameLine = (left: AnalysisLine, right: AnalysisLine) =>
    left.id === right.id &&
    left.pgn === right.pgn &&
    left.evaluation === right.evaluation &&
    left.reports === right.reports &&
    left.aliases === right.aliases;
  return (
    a.id === b.id &&
    a.version === b.version &&
    a.createdAt === b.createdAt &&
    a.sourceGameId === b.sourceGameId &&
    a.sourcePgn === b.sourcePgn &&
    a.editableMain === b.editableMain &&
    sameLine(a.main, b.main) &&
    a.branches.length === b.branches.length &&
    a.branches.every((line, index) => sameLine(line, b.branches[index]))
  );
};

export const newAnalysisSession = (
  game: Chess = new Chess(),
  sourceGameId?: number,
  sourcePgn?: string
): AnalysisSession => {
  const now = new Date().toISOString();
  const headers = game.getHeaders();
  const session: AnalysisSession = {
    version: 1,
    id: crypto.randomUUID(),
    title:
      headers.White && headers.White !== "?"
        ? `${headers.White} – ${headers.Black ?? "Black"}`
        : "Analysis session",
    createdAt: now,
    updatedAt: now,
    sourceGameId,
    sourcePgn:
      sourcePgn ?? (sourceGameId !== undefined ? game.pgn() : undefined),
    main: { id: "main", pgn: game.pgn() },
    branches: [],
    selectedLineId: "main",
    cursorPly: 0,
    orientation: true,
    editableMain: game.history().length === 0 && sourceGameId === undefined,
  };
  if (sourcePgn) {
    const study = parseStudyPgn(normalizePgn(sourcePgn));
    session.main.pgn = writeStudyPath(study.tree, study.main);
    const seen = new Set([study.main.endpoint]);
    session.branches = study.variations
      .filter((path) => {
        if (seen.has(path.endpoint)) return false;
        seen.add(path.endpoint);
        return true;
      })
      .map((path) => ({
        id: crypto.randomUUID(),
        pgn: writeStudyPath(study.tree, path),
      }));
  }
  return session;
};

/** Reports have their own target snapshot; extending a line never destroys them. */
export const retainAnalysisReport = (line: AnalysisLine): AnalysisLine => {
  if (!line.evaluation) return line;
  const reports = line.reports ?? [];
  if (
    reports.some(
      (report) =>
        report.pgn === line.pgn && report.evaluation === line.evaluation
    )
  )
    return line;
  return {
    ...line,
    reports: [
      ...reports,
      { id: crypto.randomUUID(), pgn: line.pgn, evaluation: line.evaluation },
    ],
  };
};

/** Old evaluated prefixes were stored as separate branches. Collapse only
 * compatible prefixes, retaining every report and the former line identities. */
export const migrateLegacyAnalysisSession = (
  session: AnalysisSession
): AnalysisSession => {
  const targets = new Map<string, string>();
  const branches = session.branches.map((line) => ({ ...line }));
  for (const line of branches) {
    const path = analysisLinePath(line);
    const candidates = branches.filter(
      (other) =>
        other.id !== line.id &&
        path.moves.length < analysisLinePath(other).moves.length &&
        pathIsPrefix(path, analysisLinePath(other))
    );
    // Ambiguous forks remain separate: migration must not guess ownership.
    if (!candidates.length) continue;
    const deepest = candidates.sort(
      (a, b) =>
        analysisLinePath(b).moves.length - analysisLinePath(a).moves.length
    )[0];
    if (
      candidates.some(
        (candidate) =>
          !pathIsPrefix(analysisLinePath(candidate), analysisLinePath(deepest))
      )
    )
      continue;
    const comments = replayAnalysis(line).getComments();
    const laterComments = new Map(
      replayAnalysis(deepest)
        .getComments()
        .map((comment) => [comment.fen, comment.comment])
    );
    if (
      !line.evaluation &&
      comments.some(
        (comment) => laterComments.get(comment.fen) !== comment.comment
      )
    )
      continue;
    const archived = retainAnalysisReport(line);
    const existing = new Set(
      (deepest.reports ?? []).map((report) => report.id)
    );
    deepest.reports = [
      ...(deepest.reports ?? []),
      ...(archived.reports ?? []).filter((report) => !existing.has(report.id)),
    ];
    deepest.aliases = [
      ...(deepest.aliases ?? []),
      line.id,
      ...(line.aliases ?? []),
    ];
    targets.set(line.id, deepest.id);
  }
  if (!targets.size) return session;
  const resolve = (id: string): string =>
    targets.has(id) ? resolve(targets.get(id)!) : id;
  return {
    ...session,
    branches: branches.filter((line) => !targets.has(line.id)),
    selectedLineId: resolve(session.selectedLineId),
  };
};

export const exportAnalysisStudy = (session: AnalysisSession): string => {
  const parsed = parseStudyPgn(session.main.pgn);
  for (const line of session.branches) {
    const path = addStudyPath(parsed.tree, line.pgn);
    for (const [id, annotations] of Object.entries(path.annotations)) {
      for (const value of annotations)
        if (!parsed.tree.nodes[id].annotations.includes(value))
          parsed.tree.nodes[id].annotations.push(value);
    }
  }
  return writeStudyTree(parsed.tree, parsed.main.headers);
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

export const selectAnalysisLine = (
  session: AnalysisSession,
  id: string
): AnalysisSession => {
  const lines = [session.main, ...session.branches];
  const next = lines.find((line) => line.id === id);
  if (!next) return session;
  const current = sessionLine(session);
  const currentPath = analysisLinePath(current);
  const nextPath = analysisLinePath(next);
  let common = 0;
  while (
    common < currentPath.moves.length &&
    currentPath.moves[common] === nextPath.moves[common]
  )
    common++;
  const cursorPly = Math.min(
    next.cursorPly ?? Math.min(nextPath.moves.length, common + 1),
    nextPath.moves.length
  );
  const saveCursor = (line: AnalysisLine) =>
    line.id === current.id ? { ...line, cursorPly: session.cursorPly } : line;
  return {
    ...session,
    main: saveCursor(session.main),
    branches: session.branches.map(saveCursor),
    selectedLineId: id,
    cursorPly,
  };
};

export const analysisLineLabel = (
  session: AnalysisSession,
  line: AnalysisLine,
  index: number
) => {
  const main = analysisLinePath(session.main);
  const path = analysisLinePath(line);
  let fork = 0;
  while (fork < main.moves.length && main.moves[fork] === path.moves[fork])
    fork++;
  const root = path.root.split(" ");
  const absolutePly =
    (Number(root[5]) - 1) * 2 + (root[1] === "b" ? 1 : 0) + fork;
  const number = `${Math.floor(absolutePly / 2) + 1}${absolutePly % 2 ? "..." : "."}`;
  return `Variation ${index + 1} · ${number} ${path.sans.slice(fork, fork + 3).join(" ")}${path.sans.length > fork + 3 ? " …" : ""}`;
};

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
    let editedPgn = prefix.pgn;
    if (storeBranches && changedComments) {
      const comments = new Map(
        [...full.getComments(), ...board.getComments()].map(
          ({ fen, comment }) => [fen, comment]
        )
      );
      const study = parseStudyPgn(prefix.pgn);
      const replay = new Chess(study.tree.rootFen);
      for (const node of [
        study.tree.nodes.root,
        ...studyNodePath(study.tree, study.main.endpoint),
      ]) {
        if (node.uci) replay.move(node.uci);
        const comment = comments.get(replay.fen());
        if (comment !== undefined)
          study.main.annotations[node.id] = [
            ...(study.main.annotations[node.id] ?? []).filter(
              (value) => !value.startsWith("{")
            ),
            `{${comment}}`,
          ];
      }
      editedPgn = writeStudyPath(study.tree, study.main);
    }
    const updated = {
      ...prefix,
      pgn: editedPgn,
      cursorPly: boardPath.moves.length,
    };
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
  const extension = lines
    .filter((line) => {
      const path = analysisLinePath(line);
      // Source games remain immutable. Invented main lines and alternatives
      // grow in place regardless of whether a prior prefix was evaluated.
      const editable =
        line.id !== "main" ||
        session.editableMain === true ||
        (path.moves.length === 0 &&
          session.branches.length === 0 &&
          !line.evaluation);
      return editable && pathIsPrefix(path, boardPath);
    })
    .sort(
      (a, b) =>
        analysisLinePath(b).moves.length - analysisLinePath(a).moves.length
    )[0];
  if (extension) {
    const updated = {
      ...retainAnalysisReport(extension),
      pgn: continuationPgn(board, extension),
      evaluation: undefined,
      cursorPly: boardPath.moves.length,
    };
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
  const branch = {
    id: crypto.randomUUID(),
    pgn: continuationPgn(board, sessionLine(session)),
    cursorPly: boardPath.moves.length,
  };
  return {
    ...session,
    branches: [...session.branches, branch],
    selectedLineId: branch.id,
    cursorPly: board.history().length,
    updatedAt: new Date().toISOString(),
  };
};

/** An exploration does not inherit the source game's final result. */
const continuationPgn = (board: Chess, previous?: AnalysisLine) => {
  const study = studyFromGame(board);
  if (previous) {
    const old = parseStudyPgn(previous.pgn);
    for (const [id, annotations] of Object.entries(old.main.annotations)) {
      if (!study.tree.nodes[id]) continue;
      const current = study.main.annotations[id] ?? [];
      study.main.annotations[id] = [
        ...annotations.filter(
          (value) =>
            value.startsWith("$") ||
            !current.some((entry) => entry.startsWith("{"))
        ),
        ...current,
      ];
    }
  }
  study.main.headers.Result = board.isCheckmate()
    ? board.turn() === "w"
      ? "0-1"
      : "1-0"
    : board.isDraw()
      ? "1/2-1/2"
      : "*";
  delete study.main.headers.Termination;
  return writeStudyPath(study.tree, study.main);
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
  isEngineId(evaluation.settings?.engine) &&
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
  JSON.stringify(
    {
      format: "chesskit-analysis-session",
      session: encodeAnalysisSession(session),
    },
    null,
    2
  );

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
  const session = decodeAnalysisSession(parsed.session);
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
    if (
      line.reports &&
      (!Array.isArray(line.reports) || line.reports.length > 2000)
    )
      throw new Error("Invalid analysis reports.");
    for (const report of line.reports ?? []) {
      if (
        typeof report.id !== "string" ||
        !evaluationMatches(report.evaluation, replayAnalysis(report))
      )
        throw new Error("Invalid saved analysis report.");
      if (!isAnalysisPrefix(root, replayAnalysis(report)))
        throw new Error("Analysis report has a different starting position.");
    }
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
