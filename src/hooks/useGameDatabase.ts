import { formatGameToDatabase } from "@/lib/chess";
import { GameEval } from "@/types/eval";
import { Game } from "@/types/game";
import { Chess } from "chess.js";
import { IDBPDatabase } from "idb";
import { GameDatabaseSchema, getGameDatabase } from "@/lib/gameDatabase";
import { atom, useAtom } from "jotai";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

const gamesAtom = atom<Game[]>([]);
const fetchGamesAtom = atom<boolean>(false);

export const useGameDatabase = (shouldFetchGames?: boolean) => {
  const [db, setDb] = useState<IDBPDatabase<GameDatabaseSchema> | null>(null);
  const [games, setGames] = useAtom(gamesAtom);
  const [fetchGames, setFetchGames] = useAtom(fetchGamesAtom);
  const [gameFromUrl, setGameFromUrl] = useState<Game | undefined>(undefined);

  useEffect(() => {
    if (shouldFetchGames !== undefined) {
      setFetchGames(shouldFetchGames);
    }
  }, [shouldFetchGames, setFetchGames]);

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

  const loadGames = useCallback(async () => {
    if (db && fetchGames) {
      const games = await db.getAll("games");
      setGames(games);
    }
  }, [db, fetchGames, setGames]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const addGame = useCallback(
    async (game: Chess) => {
      if (!db) throw new Error("Database not initialized");

      const gameToAdd = formatGameToDatabase(game);
      const gameId = await db.add("games", gameToAdd as Game);

      loadGames();

      return gameId;
    },
    [db, loadGames]
  );

  const setGameEval = useCallback(
    async (gameId: number, evaluation: GameEval, expectedPgn?: string) => {
      if (!db) throw new Error("Database not initialized");

      const transaction = db.transaction("games", "readwrite");
      const game = await transaction.store.get(gameId);
      if (!game) throw new Error("Game not found");
      if (expectedPgn !== undefined && game.pgn !== expectedPgn)
        throw new Error(
          "The saved game changed before its evaluation could be stored."
        );
      await transaction.store.put({ ...game, eval: evaluation });
      await transaction.done;

      loadGames();
    },
    [db, loadGames]
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

      await db.delete("games", gameId);

      loadGames();
    },
    [db, loadGames]
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
    setGameEval,
    getGame,
    deleteGame,
    games,
    isReady,
    gameFromUrl,
  };
};
