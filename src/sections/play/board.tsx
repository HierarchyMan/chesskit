import Board from "@/components/board";
import { useChessActions } from "@/hooks/useChessActions";
import { usePlayersData } from "@/hooks/usePlayersData";
import { uciMoveParams } from "@/lib/chess";
import { getBotMove } from "@/lib/engine/botMove";
import { CHALLENGE_STRENGTH } from "@/lib/engine/strength";
import { fullStrengthMsAtom } from "@/lib/engine/engineSettings";
import { UciEngine } from "@/lib/engine/uciEngine";
import { sleep } from "@/lib/helpers";
import { Color } from "@/types/enums";
import { playSetupPosition } from "@/lib/setupPosition";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect, useMemo } from "react";
import { usePlayOverlay } from "./usePlayOverlay";
import {
  boardFlippedAtom,
  botStrengthAtom,
  botThinkingAtom,
  challengeIdAtom,
  clocksAtom,
  gameAtom,
  gameEndAtom,
  isGameInProgressAtom,
  playerColorAtom,
  startingPositionAtom,
  oddsAtom,
} from "./states";

interface Props {
  engine: UciEngine | null;
  boardSize?: number;
  setup?: boolean;
  overlay: ReturnType<typeof usePlayOverlay>;
}

export default function BoardContainer({
  engine,
  boardSize,
  setup = false,
  overlay,
}: Props) {
  const store = useStore();
  const game = useAtomValue(gameAtom);
  const gameEnd = useAtomValue(gameEndAtom);
  const { white, black } = usePlayersData(gameAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const startingText = useAtomValue(startingPositionAtom);
  const odds = useAtomValue(oddsAtom);
  const preview = useMemo(
    () =>
      playSetupPosition(
        startingText,
        odds,
        playerColor === Color.White ? Color.Black : Color.White
      ),
    [startingText, odds, playerColor]
  );
  const flipped = useAtomValue(boardFlippedAtom);
  const isGameInProgress = useAtomValue(isGameInProgressAtom);
  const setBotThinking = useSetAtom(botThinkingAtom);
  const { playMove } = useChessActions(gameAtom);

  const gameFen = game.fen();
  const isGameFinished = game.isGameOver();
  const isBotTurn = game.turn() !== playerColor;

  useEffect(() => {
    if (!engine || !isGameInProgress || isGameFinished || !isBotTurn) return;

    let cancelled = false;

    const playBotMove = async () => {
      setBotThinking(true);

      const minimumThinkTime = sleep(350 + Math.random() * 450);
      const botClock =
        store.get(clocksAtom)?.[playerColor === Color.White ? "b" : "w"];

      try {
        const move = await getBotMove(
          engine,
          gameFen,
          store.get(challengeIdAtom)
            ? CHALLENGE_STRENGTH
            : store.get(botStrengthAtom),
          {
            clockMs: botClock,
            fullStrengthMs: store.get(fullStrengthMsAtom),
          }
        );
        await minimumThinkTime;

        if (!cancelled && move) playMove(uciMoveParams(move));
      } catch (error) {
        if (!cancelled) console.error(error);
      } finally {
        if (!cancelled) setBotThinking(false);
      }
    };
    playBotMove();

    return () => {
      cancelled = true;
      setBotThinking(false);
      engine.stopAllCurrentJobs();
    };
  }, [gameFen, isGameInProgress, isGameFinished, isBotTurn, engine]); // eslint-disable-line react-hooks/exhaustive-deps

  const orientation = flipped
    ? playerColor === Color.White
      ? Color.Black
      : Color.White
    : playerColor;

  return (
    <Board
      id="PlayBoard"
      canPlay={isGameInProgress ? playerColor : false}
      gameAtom={gameAtom}
      gameEnd={gameEnd}
      previewFen={setup ? preview.fen : undefined}
      boardSize={boardSize}
      whitePlayer={white}
      blackPlayer={black}
      boardOrientation={orientation}
      currentPositionAtom={overlay.positionAtom}
      arrows={isGameInProgress ? overlay.engine.arrows : []}
      clocksAtom={clocksAtom}
    />
  );
}
