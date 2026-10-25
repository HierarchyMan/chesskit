import { formatGameToDatabase } from "@/lib/chess";
import { GameEval } from "@/types/eval";
import { Game } from "@/types/game";
import { Chess } from "chess.js";
import { IDBPDatabase } from "idb";
import {
  GameDatabaseSchema,
  GameSummary,
  gameSummary,
  addGameRecord,
  getGameDatabase,
} from "@/lib/gameDatabase";
import { atom, createStore, useAtomValue, useStore } from "jotai";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

const gamesAtom = atom<Game[]>([]);
const gamesLoadedAtom = atom(false);
const summariesAtom = atom<GameSummary[]>([]);
const summariesLoadedAtom = atom(false);
const summaryReads = new WeakMap<Store, Promise<void>>();
const recentGamesAtom = atom<GameSummary[]>([]);
const recentLoadedAtom = atom(false);
type Store = ReturnType<typeof createStore>;
const reads = new WeakMap<Store, Promise<void>>();
const recentReads = new WeakMap<Store, Promise<void>>();
// Retain refresh-on-navigation for edits made in another tab, without rereading
// an unchanged library on every remount in this tab.
let externalRevision = 0;
let changesChannel: BroadcastChannel | undefined;
const fullRevision = new WeakMap<Store, number>();
const recentRevision = new WeakMap<Store, number>();
const summaryRevision = new WeakMap<Store, number>();
function gameChangesChannel() {
  if (
    !changesChannel &&
    typeof window !== "undefined" &&
    typeof BroadcastChannel !== "undefined"
  ) {
    changesChannel = new BroadcastChannel("chesskit-game-changes");
    changesChannel.onmessage = () => {
      externalRevision++;
    };
  }
  return changesChannel;
}
async function readGames(store: Store) {
  if (
    store.get(gamesLoadedAtom) &&
    fullRevision.get(store) === externalRevision
  )
    return;
  const revision = externalRevision;
  let pending = reads.get(store);
  if (!pending) {
    pending = getGameDatabase()
      .then((db) => db.getAll("games"))
      .then((games) => {
        store.set(gamesAtom, games);
        store.set(gamesLoadedAtom, true);
        fullRevision.set(store, revision);
      })
      .finally(() => reads.delete(store));
    reads.set(store, pending);
  }
  await pending;
}
async function readRecent(store: Store) {
  if (
    store.get(recentLoadedAtom) &&
    recentRevision.get(store) === externalRevision
  )
    return;
  const revision = externalRevision;
  let pending = recentReads.get(store);
  if (!pending) {
    pending = (async () => {
      const db = await getGameDatabase();
      const games: GameSummary[] = [];
      let cursor = await db
        .transaction("gameSummaries")
        .store.openCursor(null, "prev");
      while (cursor && games.length < 4) {
        games.push(cursor.value);
        cursor = await cursor.continue();
      }
      store.set(recentGamesAtom, games);
      store.set(recentLoadedAtom, true);
      recentRevision.set(store, revision);
    })().finally(() => recentReads.delete(store));
    recentReads.set(store, pending);
  }
  await pending;
}
async function beforeMutation(store: Store) {
  await Promise.all([
    reads.get(store),
    recentReads.get(store),
    summaryReads.get(store),
  ]);
}
function mergeGames(store: Store, changed: Game[], deleted?: number) {
  gameChangesChannel()?.postMessage("changed");
  const ids = new Set(changed.map((game) => game.id));
  if (store.get(gamesLoadedAtom))
    store.set(
      gamesAtom,
      [
        ...store
          .get(gamesAtom)
          .filter((game) => game.id !== deleted && !ids.has(game.id)),
        ...changed,
      ].sort((a, b) => a.id - b.id)
    );
  const summaries = changed.map(gameSummary);
  if (store.get(summariesLoadedAtom))
    store.set(
      summariesAtom,
      [
        ...store
          .get(summariesAtom)
          .filter((game) => game.id !== deleted && !ids.has(game.id)),
        ...summaries,
      ].sort((a, b) => a.id - b.id)
    );
  if (store.get(recentLoadedAtom))
    store.set(
      recentGamesAtom,
      [
        ...store
          .get(recentGamesAtom)
          .filter((game) => game.id !== deleted && !ids.has(game.id)),
        ...summaries,
      ]
        .sort((a, b) => b.id - a.id)
        .slice(0, 4)
    );
  if (deleted !== undefined) {
    store.set(recentLoadedAtom, false);
    void readRecent(store);
  }
}
export function useRecentGames() {
  const store = useStore();
  const games = useAtomValue(recentGamesAtom);
  useEffect(() => {
    gameChangesChannel();
    void readRecent(store).catch(console.error);
  }, [store]);
  return games;
}

export const useGameDatabase = (shouldFetchGames?: boolean) => {
  const [db, setDb] = useState<IDBPDatabase<GameDatabaseSchema> | null>(null);
  const store = useStore();
  const games = useAtomValue(gamesAtom);
  const gamesLoaded = useAtomValue(gamesLoadedAtom);
  const [gameFromUrl, setGameFromUrl] = useState<Game | undefined>(undefined);

  useEffect(() => {
    const initDatabase = async () => {
      const db = await getGameDatabase();
      if (current) setDb(db);
    };
    let current = true;
    void initDatabase().catch((error) =>
      console.error("Unable to open game storage", error)
    );
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    gameChangesChannel();
    if (shouldFetchGames) void readGames(store).catch(console.error);
  }, [shouldFetchGames, store]);

  const addGame = useCallback(
    async (game: Chess, originalPgn?: string) => {
      if (!db) throw new Error("Database not initialized");

      await beforeMutation(store);
      const gameToAdd = formatGameToDatabase(game, originalPgn);
      const gameId = await addGameRecord(db, gameToAdd);

      mergeGames(store, [{ ...gameToAdd, id: gameId }]);
      return gameId;
    },
    [db, store]
  );

  const addGames = useCallback(
    async (pgns: string[]) => {
      if (!db) throw new Error("Database not initialized");
      const { processOffThread } = await import("@/lib/processing");
      const records = await processOffThread("records", pgns);
      await beforeMutation(store);
      const saved: Game[] = [];
      const errors: string[] = [];
      // Preserve per-game success/failure semantics, but publish only once for the batch.
      for (const record of records) {
        try {
          const id = await addGameRecord(db, record);
          saved.push({ ...record, id });
        } catch (error) {
          errors.push(String(error));
        }
      }
      mergeGames(store, saved);
      return { saved: saved.length, errors };
    },
    [db, store]
  );

  const setGameEval = useCallback(
    async (gameId: number, evaluation: GameEval, expectedPgn?: string) => {
      if (!db) throw new Error("Database not initialized");

      await beforeMutation(store);
      const transaction = db.transaction(
        ["games", "gameSummaries"],
        "readwrite"
      );
      const game = await transaction.objectStore("games").get(gameId);
      if (!game) throw new Error("Game not found");
      if (expectedPgn !== undefined && game.pgn !== expectedPgn)
        throw new Error(
          "The saved game changed before its evaluation could be stored."
        );
      await transaction.objectStore("games").put({ ...game, eval: evaluation });
      await transaction
        .objectStore("gameSummaries")
        .put(gameSummary({ ...game, eval: evaluation }));
      await transaction.done;

      mergeGames(store, [{ ...game, eval: evaluation }]);
    },
    [db, store]
  );

  const getGame = useCallback(
    async (gameId: number) => {
      if (!db) return undefined;

      return db.get("games", gameId);
    },
    [db]
  );

  const deleteGame = useCallback(
    async (gameId: number) => {
      if (!db) throw new Error("Database not initialized");

      await beforeMutation(store);
      const transaction = db.transaction(
        ["games", "gameSummaries"],
        "readwrite"
      );
      await Promise.all([
        transaction.objectStore("games").delete(gameId),
        transaction.objectStore("gameSummaries").delete(gameId),
      ]);
      await transaction.done;
      mergeGames(store, [], gameId);
    },
    [db, store]
  );

  const router = useRouter();
  const { gameId } = router.query;

  useEffect(() => {
    let current = true;
    setGameFromUrl(undefined);
    switch (typeof gameId) {
      case "string":
        if (/^\d+$/.test(gameId))
          void getGame(Number(gameId))
            .then((game) => {
              if (current) setGameFromUrl(game);
            })
            .catch((error) =>
              console.error("Unable to load saved game", error)
            );
        break;
      default:
        setGameFromUrl(undefined);
    }
    return () => {
      current = false;
    };
  }, [gameId, setGameFromUrl, getGame]);

  const isReady = db !== null;

  return {
    addGame,
    addGames,
    setGameEval,
    getGame,
    deleteGame,
    games,
    gamesLoaded,
    isReady,
    gameFromUrl,
  };
};

export function useGameSummaries() {
  const database = useGameDatabase(false);
  const store = useStore();
  const games = useAtomValue(summariesAtom);
  useEffect(() => {
    gameChangesChannel();
    if (
      store.get(summariesLoadedAtom) &&
      summaryRevision.get(store) === externalRevision
    )
      return;
    const revision = externalRevision;
    let pending = summaryReads.get(store);
    if (!pending) {
      pending = getGameDatabase()
        .then((db) => db.getAll("gameSummaries"))
        .then((rows) => {
          store.set(summariesAtom, rows);
          store.set(summariesLoadedAtom, true);
          summaryRevision.set(store, revision);
        })
        .finally(() => summaryReads.delete(store));
      summaryReads.set(store, pending);
    }
    void pending.catch(console.error);
  }, [store]);
  return { ...database, games };
}
