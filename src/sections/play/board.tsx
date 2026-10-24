import Board from "@/components/board";
import ArrowOverlay from "@/components/board/arrowOverlay";
import { useEngineArrows } from "@/components/board/useEngineArrows";
import { usePositionEval } from "@/hooks/usePositionEval";
import { playerNamer } from "@/lib/arrows/legend";
import {
  ARROW_CAPABILITIES,
  FORMAL_CAPABILITIES,
  effectivePrefs,
} from "@/lib/arrows/prefs";
import { useChessActions } from "@/hooks/useChessActions";
import { useGameData } from "@/hooks/useGameData";
import { usePlayersData } from "@/hooks/usePlayersData";
import { uciMoveParams } from "@/lib/chess";
import { getBotMove } from "@/lib/engine/botMove";
import { CHALLENGE_STRENGTH, maxDepthForTime } from "@/lib/engine/strength";
import { UciEngine } from "@/lib/engine/uciEngine";
import { sleep } from "@/lib/helpers";
import { Color } from "@/types/enums";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect, useMemo } from "react";
import { coachFeedbackAtom } from "./useMoveCoach";
import {
  activeGameModeAtom,
  boardFlippedAtom,
  botStrengthAtom,
  botThinkingAtom,
  challengeIdAtom,
  clocksAtom,
  gameAtom,
  gameDataAtom,
  hintArrowsAtom,
  isGameInProgressAtom,
  playArrowPrefsAtom,
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

  // A formal game gives no advice before a move, only feedback after it.
  const activeMode = useAtomValue(activeGameModeAtom);
  const capabilities =
    activeMode === "formal" ? FORMAL_CAPABILITIES : ARROW_CAPABILITIES.play;
  const wanted = effectivePrefs(useAtomValue(playArrowPrefsAtom), capabilities);
  // The engine stays loaded while the user wants suggestions or threats, and
  // searches only when it is their move: that is the one worth advising on.
  const advice = usePositionEval({
    feature: "advice",
    fen: gameFen,
    enabled:
      isGameInProgress &&
      wanted.enabled &&
      (wanted.moves > 0 || wanted.threats),
    active: !isBotTurn && !isGameFinished,
    lines: Math.max(2, wanted.moves),
  });

  // The coach grades the player's move; its better move stays on the board
  // through the bot's reply, which is when the player is deciding again.
  const coach = useAtomValue(coachFeedbackAtom);
  const feedback = useMemo(() => {
    if (coach?.status !== "done" || !coach.before || !coach.classification) {
      return undefined;
    }
    const movesSince = game.history().length - 1 - coach.plyIndex;
    if (movesSince !== 0 && movesSince !== 1) return undefined;
    return {
      move: coach.move,
      before: coach.before,
      classification: coach.classification,
    };
  }, [coach, game]);

  const engineArrows = useEngineArrows({
    position: advice,
    fen: gameFen,
    prefsAtom: playArrowPrefsAtom,
    capabilities,
    extra: hintArrows,
    feedback,
  });

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
  const nameOf = useMemo(() => playerNamer(playerColor), [playerColor]);

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
      arrows={engineArrows.arrows}
      clocksAtom={clocksAtom}
      header={
        isGameInProgress && (
          <ArrowOverlay
            view="compact"
            prefs={engineArrows.prefs}
            capabilities={capabilities}
            onChange={engineArrows.update}
            arrows={engineArrows.arrows}
            nameOf={nameOf}
            turn={game.turn()}
            onFocus={engineArrows.setFocus}
          />
        )
      }
    />
  );
}
