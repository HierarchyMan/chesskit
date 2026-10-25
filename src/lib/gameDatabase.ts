import { AnalysisSession } from "@/lib/analysisSession";
import {
  decodeAnalysisSession,
  encodeAnalysisSession,
  StoredAnalysisSession,
} from "@/lib/analysisSessionCodec";
import { Game } from "@/types/game";
import { DBSchema, openDB } from "idb";

export type AnalysisSessionSummary = Pick<
  AnalysisSession,
  "id" | "title" | "updatedAt"
> & { branchCount: number };
const sessionSummary = (
  session: StoredAnalysisSession
): AnalysisSessionSummary => ({
  id: session.id,
  title: session.title,
  updatedAt: session.updatedAt,
  branchCount: Array.isArray(session.branches) ? session.branches.length : 0,
});

export type GameSummary = Omit<Game, "pgn" | "eval"> & {
  hasEvaluation: boolean;
};
export const gameSummary = ({
  pgn: _pgn,
  eval: evaluation,
  ...metadata
}: Game): GameSummary => {
  void _pgn; // The projection deliberately excludes the full PGN payload.
  return { ...metadata, hasEvaluation: !!evaluation };
};

type AnalysisSessionState = Pick<
  AnalysisSession,
  | "id"
  | "title"
  | "updatedAt"
  | "revision"
  | "selectedLineId"
  | "cursorPly"
  | "orientation"
  | "draft"
  | "draftInput"
> & { contentToken: string; lineCursors: Record<string, number | undefined> };
const withSessionState = (
  record: StoredAnalysisSession,
  state?: AnalysisSessionState
): StoredAnalysisSession => {
  if (!state || (state.revision ?? 0) < (record.revision ?? 0)) return record;
  const { contentToken: _token, lineCursors, ...fields } = state;
  void _token;
  const result = {
    ...record,
    ...fields,
    main: record.main
      ? { ...record.main, cursorPly: lineCursors[record.main.id] }
      : record.main,
    branches: Array.isArray(record.branches)
      ? record.branches.map((line) => ({
          ...line,
          cursorPly: lineCursors[line.id],
        }))
      : record.branches,
  } as StoredAnalysisSession; // Only shared view fields change; each line keeps its stored format.
  if (result.draft === undefined) delete result.draft;
  if (result.draftInput === undefined) delete result.draftInput;
  return result;
};

export interface GameDatabaseSchema extends DBSchema {
  games: { value: Game; key: number };
  gameSummaries: { value: GameSummary; key: number };
  analysisSessions: {
    value: StoredAnalysisSession;
    key: string;
    indexes: { byIdentityRevision: [string, number] };
  };
  analysisSessionStates: { value: AnalysisSessionState; key: string };
  analysisSessionArchives: { value: AnalysisSession; key: string };
  analysisSessionSummaries: { value: AnalysisSessionSummary; key: string };
}

let summaryCache: AnalysisSessionSummary[] | undefined;
let summaryRead: Promise<AnalysisSessionSummary[]> | undefined;
let summaryEpoch = 0;
let channel: BroadcastChannel | undefined;
const invalidateSummaries = () => {
  summaryCache = undefined;
  summaryEpoch++;
};

let database: ReturnType<typeof openDB<GameDatabaseSchema>> | undefined;
export const getGameDatabase = () => {
  if (!database) {
    if (
      !channel &&
      typeof window !== "undefined" &&
      typeof BroadcastChannel !== "undefined"
    ) {
      channel = new BroadcastChannel("chesskit-session-metadata");
      channel.onmessage = invalidateSummaries;
    }
    database = openDB<GameDatabaseSchema>("games", 7, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains("games")) {
          db.createObjectStore("games", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("gameSummaries")) {
          const summaries = db.createObjectStore("gameSummaries", {
            keyPath: "id",
          });
          void (async () => {
            let cursor = await transaction.objectStore("games").openCursor();
            while (cursor) {
              await summaries.put(gameSummary(cursor.value));
              cursor = await cursor.continue();
            }
          })();
        }
        if (!db.objectStoreNames.contains("analysisSessions")) {
          db.createObjectStore("analysisSessions", { keyPath: "id" });
        }
        const sessions = transaction.objectStore("analysisSessions");
        if (!sessions.indexNames.contains("byIdentityRevision")) {
          sessions.createIndex("byIdentityRevision", ["id", "revision"]);
        }
        if (!db.objectStoreNames.contains("analysisSessionStates")) {
          db.createObjectStore("analysisSessionStates", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("analysisSessionArchives")) {
          db.createObjectStore("analysisSessionArchives", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("analysisSessionSummaries")) {
          const summaries = db.createObjectStore("analysisSessionSummaries", {
            keyPath: "id",
          });
          // Project metadata during the upgrade transaction; all original records remain intact.
          void (async () => {
            let cursor = await transaction
              .objectStore("analysisSessions")
              .openCursor();
            while (cursor) {
              await summaries.put(sessionSummary(cursor.value));
              cursor = await cursor.continue();
            }
          })();
        }
      },
      blocking() {
        void database?.then((db) => db.close());
        database = undefined;
        invalidateSummaries();
      },
      terminated() {
        database = undefined;
        invalidateSummaries();
      },
    });
    void database.catch(() => {
      database = undefined;
    });
  }
  return database;
};

// Shared across remounts: an older pending write cannot overtake a newer save.
let saveQueue: Promise<unknown> = Promise.resolve();
const localRevisions = new Map<string, number>();
export const saveAnalysisSession = (
  session: AnalysisSession,
  options?: {
    contentToken: string;
    stateOnly: boolean;
  }
) => {
  const contentToken = options?.contentToken ?? crypto.randomUUID();
  const task = saveQueue
    .catch(() => undefined)
    .then(async () => {
      const db = await getGameDatabase();
      const transaction = db.transaction(
        [
          "analysisSessions",
          "analysisSessionStates",
          "analysisSessionSummaries",
          "analysisSessionArchives",
        ],
        "readwrite"
      );
      try {
        const existingState = await transaction
          .objectStore("analysisSessionStates")
          .get(session.id);
        // Read the content revision through keys, without cloning its tree or
        // evaluation payload into JS on every navigation/editor-state update.
        const contentKey = await transaction
          .objectStore("analysisSessions")
          .index("byIdentityRevision")
          .openKeyCursor(
            IDBKeyRange.bound(
              [session.id, 0],
              [session.id, Number.MAX_SAFE_INTEGER]
            )
          );
        const contentRevision = contentKey?.key[1];
        const stateOnly = !!(
          options?.stateOnly &&
          contentRevision !== undefined &&
          existingState?.contentToken === contentToken
        );
        const existing = stateOnly
          ? undefined
          : await transaction.objectStore("analysisSessions").get(session.id);
        const currentRevision = Math.max(
          existing?.revision ?? 0,
          contentRevision ?? 0,
          existingState?.revision ?? 0
        );
        const expected = Math.max(
          session.revision ?? 0,
          localRevisions.get(session.id) ?? 0
        );
        if (
          (existing || contentRevision !== undefined) &&
          currentRevision !== expected
        ) {
          throw new Error(
            "This session changed in another tab. Save your current work as a new session to keep both versions."
          );
        }
        const revision = currentRevision + 1;
        const saved = { ...session, revision };
        // Keep the original legacy payload in the same atomic transaction as
        // its first compact save. A quota failure leaves the old record intact.
        if (
          existing?.version === 1 &&
          !(await transaction
            .objectStore("analysisSessionArchives")
            .get(session.id))
        )
          await transaction
            .objectStore("analysisSessionArchives")
            .put(existing);
        // A pending full save may have failed. Its token must be present before
        // any later cursor-only save can skip content; otherwise write it now.
        if (!stateOnly)
          await transaction
            .objectStore("analysisSessions")
            .put(encodeAnalysisSession(saved));
        await transaction.objectStore("analysisSessionStates").put({
          id: saved.id,
          title: saved.title,
          updatedAt: saved.updatedAt,
          revision,
          selectedLineId: saved.selectedLineId,
          cursorPly: saved.cursorPly,
          orientation: saved.orientation,
          draft: saved.draft,
          draftInput: saved.draftInput,
          contentToken,
          lineCursors: Object.fromEntries(
            [saved.main, ...saved.branches].map((line) => [
              line.id,
              line.cursorPly,
            ])
          ),
        });
        await transaction
          .objectStore("analysisSessionSummaries")
          .put(sessionSummary(saved));
        await transaction.done;
        localRevisions.set(session.id, revision);
        summaryEpoch++;
        if (summaryCache)
          summaryCache = [
            ...summaryCache.filter((item) => item.id !== saved.id),
            sessionSummary(saved),
          ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        channel?.postMessage(saved.id);
        return saved;
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          /* It may already be aborted. */
        }
        await transaction.done.catch(() => undefined);
        throw error;
      }
    });
  saveQueue = task;
  return task;
};

export const listAnalysisSessions = async (source?: {
  gameId: number;
  pgn: string;
}) => {
  const db = await getGameDatabase();
  const transaction = db.transaction([
    "analysisSessions",
    "analysisSessionStates",
  ]);
  const [records, states] = await Promise.all([
    transaction.objectStore("analysisSessions").getAll(),
    transaction.objectStore("analysisSessionStates").getAll(),
  ]);
  const byId = new Map(states.map((state) => [state.id, state]));
  const sessions: AnalysisSession[] = [];
  for (const record of records) {
    if (
      source &&
      (record.sourceGameId !== source.gameId || record.sourcePgn !== source.pgn)
    )
      continue;
    try {
      sessions.push(
        decodeAnalysisSession(withSessionState(record, byId.get(record.id)))
      );
    } catch {
      // An unreadable record stays intact and downloadable in the library;
      // it must not prevent opening unrelated sessions or saved games.
    }
  }
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const listAnalysisSessionSummaries = async (): Promise<
  AnalysisSessionSummary[]
> => {
  if (summaryCache) return summaryCache;
  if (summaryRead) return summaryRead;
  const epoch = summaryEpoch;
  summaryRead = (async () => {
    const rows = await (
      await getGameDatabase()
    ).getAll("analysisSessionSummaries");
    summaryRead = undefined;
    if (epoch !== summaryEpoch) return listAnalysisSessionSummaries();
    summaryCache = rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaryCache;
  })().catch((error) => {
    summaryRead = undefined;
    throw error;
  });
  return summaryRead;
};
export const getStoredAnalysisSession = async (id: string) => {
  const transaction = (await getGameDatabase()).transaction([
    "analysisSessions",
    "analysisSessionStates",
  ]);
  const [record, state] = await Promise.all([
    transaction.objectStore("analysisSessions").get(id),
    transaction.objectStore("analysisSessionStates").get(id),
  ]);
  return record ? withSessionState(record, state) : undefined;
};
export const getAnalysisSession = async (id: string) => {
  const record = await getStoredAnalysisSession(id);
  return record ? decodeAnalysisSession(record) : undefined;
};
export const getOriginalAnalysisSession = async (id: string) =>
  (await getGameDatabase()).get("analysisSessionArchives", id);
export const hasOriginalAnalysisSession = async (id: string) =>
  (await (await getGameDatabase()).getKey("analysisSessionArchives", id)) !==
  undefined;

// Data and its projection commit together; a quota/error cannot leave a phantom row.
export const addGameRecord = async (
  db: Awaited<ReturnType<typeof getGameDatabase>>,
  record: Omit<Game, "id">
) => {
  const transaction = db.transaction(["games", "gameSummaries"], "readwrite");
  try {
    const id = await transaction.objectStore("games").add(record as Game);
    await transaction
      .objectStore("gameSummaries")
      .put(gameSummary({ ...record, id }));
    await transaction.done;
    return id;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      /* Already aborted. */
    }
    await transaction.done.catch(() => undefined);
    throw error;
  }
};
