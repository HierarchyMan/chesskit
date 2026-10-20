import Board from "@/components/board";
import { useChessActions } from "@/hooks/useChessActions";
import { useGameData } from "@/hooks/useGameData";
import { usePlayersData } from "@/hooks/usePlayersData";
import { uciMoveParams } from "@/lib/chess";
import { getBotMove } from "@/lib/engine/botMove";
import { maxDepthForTime } from "@/lib/engine/strength";
import { UciEngine } from "@/lib/engine/uciEngine";
import { sleep } from "@/lib/helpers";
import { Color } from "@/types/enums";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect } from "react";
import {
  boardFlippedAtom,
  botStrengthAtom,
  botThinkingAtom,
  clocksAtom,
  gameAtom,
  gameDataAtom,
  hintArrowsAtom,
  isGameInProgressAtom,
  playerColorAtom,
} from "./states";

interface Props {
  engine: UciEngine | null;
  boardSize: number;
}

export default function BoardContainer({ engine, boardSize }: Props) {
  const store = useStore();
  const game = useAtomValue(gameAtom);
  const { white, black } = usePlayersData(gameAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const flipped = useAtomValue(boardFlippedAtom);
  const hintArrows = useAtomValue(hintArrowsAtom);
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
      const botClock = store.get(clocksAtom)?.[
        playerColor === Color.White ? "b" : "w"
      ];

      try {
        const move = await getBotMove(
          engine,
          gameFen,
          store.get(botStrengthAtom),
          { maxDepth: maxDepthForTime(botClock) }
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

  useGameData(gameAtom, gameDataAtom);

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
      boardSize={boardSize}
      whitePlayer={white}
      blackPlayer={black}
      boardOrientation={orientation}
      currentPositionAtom={gameDataAtom}
      extraArrows={hintArrows}
      clocksAtom={clocksAtom}
    />
  );
}
