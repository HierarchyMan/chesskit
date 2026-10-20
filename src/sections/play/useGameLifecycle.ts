import { useChessClock } from "@/hooks/useChessClock";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { setGameHeaders } from "@/lib/chess";
import { evaluateChallenge, getEndgame } from "@/lib/endgames";
import { getGameResult, getOutcomeFor } from "@/lib/gameResult";
import { markEndgameCompleted, recordGame, statsAtom } from "@/lib/stats";
import { Chess } from "chess.js";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef } from "react";
import {
  challengeIdAtom,
  challengeStatusAtom,
  clocksAtom,
  gameAtom,
  gameEndAtom,
  gameIdAtom,
  isGameInProgressAtom,
  playerColorAtom,
  savedGameIdAtom,
  timeControlAtom,
} from "./states";

export const useGameLifecycle = () => {
  const game = useAtomValue(gameAtom);
  const gameId = useAtomValue(gameIdAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const timeControl = useAtomValue(timeControlAtom);
  const [isInProgress, setIsInProgress] = useAtom(isGameInProgressAtom);
  const [end, setEnd] = useAtom(gameEndAtom);
  const challengeId = useAtomValue(challengeIdAtom);
  const [challengeStatus, setChallengeStatus] = useAtom(challengeStatusAtom);
  const setSavedGameId = useSetAtom(savedGameIdAtom);
  const setStats = useSetAtom(statsAtom);
  const { addGame, isReady: isDatabaseReady } = useGameDatabase();
  const recordedGameId = useRef(0);

  const info = useMemo(() => getGameResult(game, end), [game, end]);

  useChessClock({
    clocksAtom,
    game,
    running: isInProgress,
    gameId,
    initialMs: challengeId ? 0 : timeControl.minutes * 60_000,
    incrementMs: timeControl.increment * 1000,
    onTimeout: (loser) => {
      setEnd({ type: "timeout", loser });
      setIsInProgress(false);
    },
  });

  useEffect(() => {
    if (isInProgress && game.isGameOver()) setIsInProgress(false);
  }, [game, isInProgress, setIsInProgress]);

  useEffect(() => {
    if (isInProgress || !info.over || gameId === 0) return;
    if (recordedGameId.current === gameId || !isDatabaseReady) return;
    recordedGameId.current = gameId;

    if (!challengeId) {
      setStats((stats) => recordGame(stats, getOutcomeFor(info, playerColor)));
    }

    const finished = new Chess();
    finished.loadPgn(game.pgn());
    setGameHeaders(finished, {
      ended: { result: info.result, termination: info.reason },
    });

    addGame(finished)
      .then((id) => setSavedGameId(id))
      .catch((error) =>
        console.error("Could not save the finished game", error)
      );
  }, [
    isInProgress,
    info,
    gameId,
    game,
    playerColor,
    isDatabaseReady,
    addGame,
    setSavedGameId,
    setStats,
    challengeId,
  ]);

  useEffect(() => {
    const endgame = challengeId ? getEndgame(challengeId) : undefined;
    if (!endgame || challengeStatus !== "active") return;

    const status = evaluateChallenge(
      endgame,
      info,
      playerColor,
      game.history().length
    );
    if (status === "active") return;

    setChallengeStatus(status);
    if (status === "complete") {
      setStats((stats) => markEndgameCompleted(stats, endgame.id));
    }
  }, [
    challengeId,
    challengeStatus,
    info,
    playerColor,
    game,
    setChallengeStatus,
    setStats,
  ]);

  return info;
};
