import Board from "@/components/board";
import CascadeBar from "@/components/board/cascadeBar";
import { useChessActions } from "@/hooks/useChessActions";
import { usePlayersData } from "@/hooks/usePlayersData";
import { uciMoveParams } from "@/lib/chess";
import { useInBoardCascade } from "@/lib/coachCascade";
import { getBotMove } from "@/lib/engine/botMove";
import { CHALLENGE_STRENGTH } from "@/lib/engine/strength";
import {
  botReplyDelayMs,
  botReplySpeedAtom,
  fullStrengthMsAtom,
} from "@/lib/engine/engineSettings";
import { UciEngine } from "@/lib/engine/uciEngine";
import { sleep } from "@/lib/helpers";
import { Color } from "@/types/enums";
import { playSetupPosition } from "@/lib/setupPosition";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { replayChess } from "@/lib/chessHistory";
import CoachStage from "./coachStage";
import { usePlayOverlay } from "./usePlayOverlay";
import {
  activeGameModeAtom,
  boardFlippedAtom,
  botErrorAtom,
  botRetryTickAtom,
  botStrengthAtom,
  botThinkingAtom,
  challengeIdAtom,
  clocksAtom,
  gameAtom,
  gameEndAtom,
  gameIdAtom,
  isGameInProgressAtom,
  playArrowsWithCoachAtom,
  playCascadeActiveAtom,
  playEvalBarAtom,
  playerColorAtom,
  startingPositionAtom,
  oddsAtom,
  reviewPlyAtom,
  playPremovesAtom,
  activeTimeControlAtom,
} from "./states";

interface Props {
  engine: UciEngine | null;
  boardSize?: number;
  setup?: boolean;
  overlay: ReturnType<typeof usePlayOverlay>;
  coachSlot: HTMLDivElement | null;
}

export default function BoardContainer({
  engine,
  boardSize,
  setup = false,
  overlay,
  coachSlot,
}: Props) {
  const store = useStore();
  const game = useAtomValue(gameAtom);
  const gameId = useAtomValue(gameIdAtom);
  const gameEnd = useAtomValue(gameEndAtom);
  const reviewPly = useAtomValue(reviewPlyAtom);
  const premoves = useAtomValue(playPremovesAtom);
  const timeControl = useAtomValue(activeTimeControlAtom);
  const review = useMemo(() => {
    const length = game.history().length;
    return reviewPly !== null && reviewPly >= 0 && reviewPly < length
      ? replayChess(game, reviewPly)
      : null;
  }, [game, reviewPly]);
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
  const activeMode = useAtomValue(activeGameModeAtom);
  const evalBarEnabled = useAtomValue(playEvalBarAtom);
  const arrowsWithCoach = useAtomValue(playArrowsWithCoachAtom);
  const botRetryTick = useAtomValue(botRetryTickAtom);
  const setBotThinking = useSetAtom(botThinkingAtom);
  const setBotError = useSetAtom(botErrorAtom);
  const setCascadeActive = useSetAtom(playCascadeActiveAtom);
  const { playMove, goToMove } = useChessActions(gameAtom);

  const gameFen = game.fen();
  const isGameFinished = game.isGameOver();
  const isBotTurn = game.turn() !== playerColor;

  const cascade = useInBoardCascade(`${gameId}|${gameFen}`);
  const demonstrating = cascade.projection.active;

  useEffect(() => {
    setCascadeActive(demonstrating);
    return () => setCascadeActive(false);
  }, [demonstrating, setCascadeActive]);

  const handleShowWhy = useCallback(() => {
    const fb = overlay.coach.feedback;
    if (!fb?.story) return;
    const ply = overlay.coach.playerMoveIndex;
    cascade.start(fb.story, {
      branch: "played",
      exitLabel: "Back to game",
      onTryAgain:
        overlay.interactiveCoach.isMistake && ply >= 0
          ? () => goToMove(ply, game)
          : undefined,
    });
  }, [
    overlay.coach,
    overlay.interactiveCoach.isMistake,
    cascade,
    goToMove,
    game,
  ]);

  const drWolfDrivesBot = overlay.interactiveCoach.drWolfDrivesBot;

  useEffect(() => {
    if (
      !engine ||
      !isGameInProgress ||
      isGameFinished ||
      !isBotTurn ||
      demonstrating ||
      drWolfDrivesBot
    )
      return;

    let cancelled = false;

    const playBotMove = async () => {
      setBotError(null);
      setBotThinking(true);

      const minimumThinkTime = sleep(
        botReplyDelayMs(store.get(botReplySpeedAtom))
      );
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

        if (
          !cancelled &&
          move &&
          store.get(isGameInProgressAtom) &&
          store.get(gameIdAtom) === gameId
        ) {
          playMove(uciMoveParams(move), game);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setBotError(
            error instanceof Error
              ? error.message
              : "The bot could not make a move."
          );
        }
      } finally {
        if (!cancelled) setBotThinking(false);
      }
    };
    playBotMove();

    return () => {
      cancelled = true;
      setBotThinking(false);
      void engine.stopAllCurrentJobs().catch(() => undefined);
    };
  }, [
    game,
    gameFen,
    gameId,
    isGameInProgress,
    isGameFinished,
    isBotTurn,
    demonstrating,
    drWolfDrivesBot,
    engine,
    playMove,
    playerColor,
    setBotThinking,
    setBotError,
    botRetryTick,
    store,
  ]);

  const orientation = flipped
    ? playerColor === Color.White
      ? Color.Black
      : Color.White
    : playerColor;

  const showCoachStage = !setup && overlay.coachEnabled;

  const coachStage =
    showCoachStage && coachSlot
      ? createPortal(
          <CoachStage
            key={gameId}
            moveCoach={overlay.coach}
            interactive={overlay.interactiveCoach}
            cascade={cascade.projection}
            onShowWhy={handleShowWhy}
            onCascadeTogglePlay={cascade.togglePlay}
            onCascadePrev={cascade.stepPrev}
            onCascadeNext={cascade.stepNext}
            onCascadeReplay={cascade.replay}
            onCascadeSwitchBranch={cascade.switchBranch}
            onCascadeExit={cascade.stop}
            onCascadeTryAgain={cascade.tryAgain}
          />,
          coachSlot
        )
      : null;

  const boardHeader =
    demonstrating && !coachStage ? (
      <CascadeBar
        cascade={cascade.projection}
        onTogglePlay={cascade.togglePlay}
        onPrev={cascade.stepPrev}
        onNext={cascade.stepNext}
        onReplay={cascade.replay}
        onSwitchBranch={cascade.switchBranch}
        onExit={cascade.stop}
        onTryAgain={cascade.tryAgain}
      />
    ) : undefined;

  return (
    <>
      <Board
        id="PlayBoard"
        gameIdentity={gameId}
        canPlay={
          isGameInProgress &&
          !demonstrating &&
          !review &&
          !overlay.interactiveCoach.choices.length
            ? playerColor
            : false
        }
        premoves={premoves}
        threatMarks={
          (!showCoachStage || arrowsWithCoach) && overlay.engine.prefs.threats
        }
        gameAtom={gameAtom}
        gameEnd={gameEnd}
        previewFen={
          demonstrating
            ? cascade.projection.previewFen
            : (review?.fen() ?? (setup ? preview.fen : undefined))
        }
        lastMove={
          demonstrating
            ? cascade.projection.lastMove
            : review?.history({ verbose: true }).at(-1)
        }
        boardSize={boardSize}
        whitePlayer={white}
        blackPlayer={black}
        boardOrientation={orientation}
        currentPositionAtom={overlay.positionAtom}
        showEvaluationBar={!setup && activeMode === "casual" && evalBarEnabled}
        reserveEvaluationBar
        arrows={
          demonstrating
            ? cascade.projection.arrows
            : isGameInProgress && !review
              ? overlay.engine.arrows
              : []
        }
        highlights={
          demonstrating
            ? cascade.projection.highlights
            : showCoachStage && !review
              ? overlay.interactiveCoach.highlights
              : undefined
        }
        effect={
          !demonstrating && showCoachStage && !review
            ? overlay.interactiveCoach.effect
            : undefined
        }
        demonstrationFrame={demonstrating}
        header={boardHeader}
        clocksAtom={timeControl.minutes > 0 ? clocksAtom : undefined}
      />
      {coachStage}
    </>
  );
}
