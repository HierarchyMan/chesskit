import { useEngineArrows } from "@/components/board/useEngineArrows";
import { usePositionEval } from "@/hooks/usePositionEval";
import { useEffectiveAdvice } from "@/hooks/useEffectiveEngineSettings";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { playerNamer } from "@/lib/arrows/legend";
import {
  ARROW_CAPABILITIES,
  FORMAL_CAPABILITIES,
  effectivePrefs,
} from "@/lib/arrows/prefs";
import { replayChess } from "@/lib/chessHistory";
import { UciEngine } from "@/lib/engine/uciEngine";
import { CurrentPosition } from "@/types/eval";
import { atom, useAtomValue } from "jotai";
import { useMemo } from "react";
import {
  activeGameModeAtom,
  activeCoachAtom,
  gameAtom,
  gameIdAtom,
  gameEndAtom,
  hintArrowsAtom,
  isGameInProgressAtom,
  playArrowPrefsAtom,
  playArrowsWithCoachAtom,
  playEvalBarAtom,
  playerColorAtom,
  reviewPlyAtom,
} from "./states";
import { useMoveCoach } from "./useMoveCoach";
import { useInteractiveCoach } from "./useInteractiveCoach";

/** One suggestion owner supplies both the board and its inspector controls. */
export function usePlayOverlay(botEngine: UciEngine | null = null) {
  const game = useAtomValue(gameAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const isInProgress = useAtomValue(isGameInProgressAtom);
  const activeMode = useAtomValue(activeGameModeAtom);
  const activeCoach = useAtomValue(activeCoachAtom);
  const evalBarEnabled = useAtomValue(playEvalBarAtom);
  const arrowsWithCoach = useAtomValue(playArrowsWithCoachAtom);
  const reviewPly = useAtomValue(reviewPlyAtom);
  const gameId = useAtomValue(gameIdAtom);
  const gameEnd = useAtomValue(gameEndAtom);
  const hasGame = isInProgress || game.history().length > 0 || !!gameEnd;
  const isCasual = activeMode === "casual";
  const coachEnabled = isCasual && activeCoach && gameId > 0 && hasGame;
  const evalEnabled = isCasual && evalBarEnabled && gameId > 0 && hasGame;
  const visible = usePageVisibility();
  const { multiPv: adviceLines } = useEffectiveAdvice();
  const coach = useMoveCoach(coachEnabled, visible);
  const interactiveCoach = useInteractiveCoach(coachEnabled, coach, botEngine);

  const livePly = game.history().length;
  const isReviewing =
    reviewPly !== null && reviewPly >= 0 && reviewPly < livePly;
  const displayedFen = useMemo(
    () => (isReviewing ? replayChess(game, reviewPly).fen() : game.fen()),
    [game, isReviewing, reviewPly]
  );

  // Use cached coach evaluation for reviewed plies when available.
  const reviewedCachedEval = useMemo(() => {
    if (!isReviewing) return undefined;
    if (reviewPly === 0) return coach.moves[0]?.before;
    return coach.moves[reviewPly - 1]?.after;
  }, [isReviewing, reviewPly, coach.moves]);

  // Independent lightweight eval bar feed when Coach is off, or when reviewing a ply not yet graded.
  const needsStandaloneEval =
    evalEnabled && (!coachEnabled || (isReviewing && !reviewedCachedEval));
  const standaloneEval = usePositionEval({
    feature: "coach",
    fen: displayedFen,
    enabled: visible && needsStandaloneEval,
    active: !isReviewing ? !game.isGameOver() : true,
    lines: 1,
  });

  const resolvedPosition = useMemo<CurrentPosition>(() => {
    if (isReviewing) {
      if (reviewedCachedEval) {
        return { fen: displayedFen, eval: reviewedCachedEval };
      }
      return standaloneEval;
    }
    if (coachEnabled && coach.position.eval) {
      return coach.position;
    }
    if (evalEnabled && standaloneEval.eval) {
      return standaloneEval;
    }
    return coach.position;
  }, [
    isReviewing,
    reviewedCachedEval,
    displayedFen,
    standaloneEval,
    coachEnabled,
    coach.position,
    evalEnabled,
  ]);

  const positionAtom = useMemo(
    () => atom(resolvedPosition),
    [resolvedPosition]
  );
  const hints = useAtomValue(hintArrowsAtom);
  const capabilities =
    activeMode === "formal" ? FORMAL_CAPABILITIES : ARROW_CAPABILITIES.play;
  const wanted = effectivePrefs(useAtomValue(playArrowPrefsAtom), capabilities);
  const allowEngineArrows = !coachEnabled || arrowsWithCoach;
  const advice = usePositionEval({
    feature: "advice",
    fen: game.fen(),
    enabled:
      visible &&
      isInProgress &&
      allowEngineArrows &&
      wanted.enabled &&
      (wanted.moves > 0 || wanted.threats),
    active: game.turn() === playerColor && !game.isGameOver(),
    lines: adviceLines,
  });
  const verdict = coach.feedback;
  const feedback = useMemo(() => {
    if (
      verdict?.status !== "done" ||
      !verdict.before ||
      !verdict.classification
    )
      return undefined;
    const movesSince = game.history().length - 1 - verdict.plyIndex;
    if (movesSince !== 0 && movesSince !== 1) return undefined;
    return {
      move: verdict.move,
      before: verdict.before,
      classification: verdict.classification,
    };
  }, [verdict, game]);

  const combinedExtraArrows = useMemo(
    () => [...hints, ...interactiveCoach.arrows],
    [hints, interactiveCoach.arrows]
  );

  const engine = useEngineArrows({
    position: advice,
    fen: game.fen(),
    prefsAtom: playArrowPrefsAtom,
    capabilities,
    extra: combinedExtraArrows,
    feedback,
    prioritizeTeaching: coachEnabled && !arrowsWithCoach,
  });
  const nameOf = useMemo(() => playerNamer(playerColor), [playerColor]);
  return {
    engine,
    capabilities,
    nameOf,
    turn: game.turn(),
    coach,
    coachEnabled,
    arrowsWithCoach,
    interactiveCoach,
    positionAtom,
  };
}
