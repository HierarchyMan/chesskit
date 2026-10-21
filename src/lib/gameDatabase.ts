import { AnalysisSession } from "@/lib/analysisSession";
import { Game } from "@/types/game";
import { DBSchema, openDB } from "idb";

export interface GameDatabaseSchema extends DBSchema {
  games: { value: Game; key: number };
  analysisSessions: { value: AnalysisSession; key: string };
}

let database: ReturnType<typeof openDB<GameDatabaseSchema>> | undefined;
export const getGameDatabase = () => {
  if (!database) {
    database = openDB<GameDatabaseSchema>("games", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("games")) {
          db.createObjectStore("games", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("analysisSessions")) {
          db.createObjectStore("analysisSessions", { keyPath: "id" });
        }
      },
      blocking() {
        void database?.then((db) => db.close());
        database = undefined;
      },
      terminated() {
        database = undefined;
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
      const transaction = db.transaction("analysisSessions", "readwrite");
      try {
        const existing = await transaction.store.get(session.id);
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
        await transaction.store.put(saved);
        await transaction.done;
        localRevisions.set(session.id, revision);
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
