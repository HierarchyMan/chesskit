import {
  AnalysisLine,
  AnalysisSession,
  migrateLegacyAnalysisSession,
  validateAnalysisSession,
} from "@/lib/analysisSession";
import {
  addStudyPath,
  parseStudyPgn,
  StudyPath,
  StudyTree,
  writeStudyPath,
} from "@/lib/studyTree";
import { GameEval } from "@/types/eval";

interface StoredLine extends StudyPath {
  id: string;
  cursorPly?: number;
  evaluationReportId?: string;
  reportIds: string[];
  aliases?: string[];
}
interface StoredReport extends StudyPath {
  id: string;
  evaluation: GameEval;
}
export type CompactAnalysisSession = Omit<
  AnalysisSession,
  "version" | "main" | "branches"
> & {
  version: 2;
  tree: StudyTree;
  main: StoredLine;
  branches: StoredLine[];
  reports: StoredReport[];
};
export type StoredAnalysisSession = AnalysisSession | CompactAnalysisSession;

/** Durable data contains each move edge once. PGNs are only a UI compatibility projection. */
export const encodeAnalysisSession = (
  session: AnalysisSession
): CompactAnalysisSession => {
  const parsed = parseStudyPgn(session.main.pgn);
  const tree = parsed.tree;
  const reports: StoredReport[] = [];
  const addLine = (line: AnalysisLine): StoredLine => {
    const reportIds: string[] = [];
    for (const report of line.reports ?? []) {
      if (reports.some((saved) => saved.id === report.id))
        throw new Error("Duplicate report identity.");
      reports.push({
        ...addStudyPath(tree, report.pgn),
        id: report.id,
        evaluation: report.evaluation,
      });
      reportIds.push(report.id);
    }
    const path = addStudyPath(tree, line.pgn);
    let evaluationReportId: string | undefined;
    if (line.evaluation) {
      const matching = reports.find(
        (report) =>
          report.endpoint === path.endpoint &&
          JSON.stringify(report.evaluation) === JSON.stringify(line.evaluation)
      );
      evaluationReportId = matching?.id ?? `${line.id}:current`;
      if (!matching)
        reports.push({
          ...path,
          id: evaluationReportId,
          evaluation: line.evaluation,
        });
    }
    return {
      ...path,
      id: line.id,
      cursorPly: line.cursorPly,
      aliases: line.aliases,
      reportIds,
      evaluationReportId,
    };
  };
  const main = addLine(session.main);
  const branches = session.branches.map(addLine);
  return { ...session, version: 2, tree, main, branches, reports };
};

export const decodeAnalysisSession = (
  stored: StoredAnalysisSession
): AnalysisSession => {
  if (stored.version === 1) {
    validateAnalysisSession(stored);
    return migrateLegacyAnalysisSession(stored);
  }
  if (
    stored.version !== 2 ||
    !stored.tree?.nodes ||
    !Array.isArray(stored.reports)
  )
    throw new Error("Unsupported analysis session format.");
  const reports = new Map(stored.reports.map((report) => [report.id, report]));
  if (reports.size !== stored.reports.length)
    throw new Error("Duplicate report identity.");
  const line = (record: StoredLine): AnalysisLine => {
    const current = record.evaluationReportId
      ? reports.get(record.evaluationReportId)
      : undefined;
    if (
      record.evaluationReportId &&
      (!current || current.endpoint !== record.endpoint)
    )
      throw new Error("Invalid current analysis report.");
    const history = record.reportIds.map((id) => {
      const report = reports.get(id);
      if (!report) throw new Error("Missing analysis report.");
      return {
        id,
        pgn: writeStudyPath(stored.tree, report),
        evaluation: report.evaluation,
      };
    });
    return {
      id: record.id,
      pgn: writeStudyPath(stored.tree, record),
      ...(record.aliases ? { aliases: record.aliases } : {}),
      ...(record.cursorPly !== undefined
        ? { cursorPly: record.cursorPly }
        : {}),
      ...(current ? { evaluation: current.evaluation } : {}),
      ...(history.length ? { reports: history } : {}),
    };
  };
  const { tree: _tree, reports: _reports, ...metadata } = stored;
  void _tree;
  void _reports;
  const session: AnalysisSession = {
    ...metadata,
    version: 1,
    main: line(stored.main),
    branches: stored.branches.map(line),
  };
  validateAnalysisSession(session);
  return session;
};
