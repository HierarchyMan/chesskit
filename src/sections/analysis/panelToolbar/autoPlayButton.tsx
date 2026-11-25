import { ToolbarButton } from "@/components/ToolbarButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { autoPlayAtom } from "../states";
import { useAnalysisNavigation } from "../hooks/useAnalysisNavigation";
import { useNextMove } from "./nextMoveButton";

const STEP_MS = 1100;

export default function AutoPlayButton() {
  const [playing, setPlaying] = useAtom(autoPlayAtom);
  const { canGoNext, goNext, plies } = useNextMove();
  const navigate = useAnalysisNavigation();
  const goNextRef = useRef(goNext);

  useEffect(() => {
    goNextRef.current = goNext;
  });

  useEffect(() => {
    if (!playing) return;

    if (!canGoNext) {
      setPlaying(false);
      return;
    }

    const timer = setTimeout(() => goNextRef.current(), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, canGoNext, plies, setPlaying]);

  useEffect(() => () => setPlaying(false), [setPlaying]);

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (canGoNext) {
      setPlaying(true);
      return;
    }
    if (plies > 0) {
      navigate("start");
      setPlaying(true);
    }
  }, [playing, canGoNext, plies, navigate, setPlaying]);

  useKeyboardShortcut(" ", (event) => {
    event.preventDefault();
    togglePlay();
  });

  const canPlay = canGoNext || plies > 0;

  return (
    <ToolbarButton
      tooltip={
        playing
          ? "Pause (Space)"
          : !canGoNext && plies > 0
            ? "Replay from start (Space)"
            : "Play forward (Space)"
      }
      onClick={togglePlay}
      icon={playing ? "mdi:pause" : "mdi:play"}
      disabled={!canPlay && !playing}
    />
  );
}
