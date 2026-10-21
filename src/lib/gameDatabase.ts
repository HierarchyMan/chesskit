import { AnalysisSession } from "@/lib/analysisSession";
import { Game } from "@/types/game";
import { DBSchema, openDB } from "idb";

export type AnalysisSessionSummary = Pick<
  AnalysisSession,
  "id" | "title" | "updatedAt"
> & { branchCount: number };
const sessionSummary = (session: AnalysisSession): AnalysisSessionSummary => ({
  id: session.id,
  title: session.title,
  updatedAt: session.updatedAt,
  branchCount: session.branches.length,
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

export interface GameDatabaseSchema extends DBSchema {
  games: { value: Game; key: number };
  gameSummaries: { value: GameSummary; key: number };
  analysisSessions: { value: AnalysisSession; key: string };
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
    database = openDB<GameDatabaseSchema>("games", 4, {
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
export const saveAnalysisSession = (session: AnalysisSession) => {
  const task = saveQueue
    .catch(() => undefined)
    .then(async () => {
      const db = await getGameDatabase();
      const transaction = db.transaction(
        ["analysisSessions", "analysisSessionSummaries"],
        "readwrite"
      );
      try {
        const existing = await transaction
          .objectStore("analysisSessions")
          .get(session.id);
        const expected = Math.max(
          session.revision ?? 0,
          localRevisions.get(session.id) ?? 0
        );
        if (existing && (existing.revision ?? 0) !== expected) {
          throw new Error(
            "This session changed in another tab. Save your current work as a new session to keep both versions."
          );
        }
        const revision = (existing?.revision ?? 0) + 1;
        const saved = { ...session, revision };
        await transaction.objectStore("analysisSessions").put(saved);
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

export const listAnalysisSessions = async () =>
  (await (await getGameDatabase()).getAll("analysisSessions")).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );

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
export const getAnalysisSession = async (id: string) =>
  (await getGameDatabase()).get("analysisSessions", id);

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
