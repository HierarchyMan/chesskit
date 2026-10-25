import { useEngineArrows } from "@/components/board/useEngineArrows";
import { usePositionEval } from "@/hooks/usePositionEval";
import { playerNamer } from "@/lib/arrows/legend";
import {
  ARROW_CAPABILITIES,
  FORMAL_CAPABILITIES,
  effectivePrefs,
} from "@/lib/arrows/prefs";
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
  playerColorAtom,
} from "./states";
import { useMoveCoach } from "./useMoveCoach";

/** One suggestion owner supplies both the board and its inspector controls. */
export function usePlayOverlay() {
  const game = useAtomValue(gameAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const isInProgress = useAtomValue(isGameInProgressAtom);
  const activeMode = useAtomValue(activeGameModeAtom);
  const activeCoach = useAtomValue(activeCoachAtom);
  const gameId = useAtomValue(gameIdAtom);
  const gameEnd = useAtomValue(gameEndAtom);
  const hasGame = isInProgress || game.history().length > 0 || !!gameEnd;
  const coach = useMoveCoach(
    activeMode === "casual" && activeCoach && gameId > 0 && hasGame
  );
  const positionAtom = useMemo(() => atom(coach.position), [coach.position]);
  const hints = useAtomValue(hintArrowsAtom);
  const capabilities =
    activeMode === "formal" ? FORMAL_CAPABILITIES : ARROW_CAPABILITIES.play;
  const wanted = effectivePrefs(useAtomValue(playArrowPrefsAtom), capabilities);
  const advice = usePositionEval({
    feature: "advice",
    fen: game.fen(),
    enabled:
      isInProgress && wanted.enabled && (wanted.moves > 0 || wanted.threats),
    active: game.turn() === playerColor && !game.isGameOver(),
    lines: Math.max(2, wanted.moves),
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
  const engine = useEngineArrows({
    position: advice,
    fen: game.fen(),
    prefsAtom: playArrowPrefsAtom,
    capabilities,
    extra: hints,
    feedback,
  });
  const nameOf = useMemo(() => playerNamer(playerColor), [playerColor]);
  return {
    engine,
    capabilities,
    nameOf,
    turn: game.turn(),
    coach,
    positionAtom,
  };
}
