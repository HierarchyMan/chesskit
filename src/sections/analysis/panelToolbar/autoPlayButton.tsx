import { ToolbarButton } from "@/components/ToolbarButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import { autoPlayAtom } from "../states";
import { useNextMove } from "./nextMoveButton";

const STEP_MS = 1100;

export default function AutoPlayButton() {
  const [playing, setPlaying] = useAtom(autoPlayAtom);
  const { canGoNext, goNext, plies } = useNextMove();
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

  useKeyboardShortcut(" ", (event) => {
    event.preventDefault();
    if (canGoNext) setPlaying((value) => !value);
  });

  return (
    <ToolbarButton
      tooltip={playing ? "Pause (Space)" : "Play the game forward (Space)"}
      onClick={() => setPlaying((value) => !value)}
      icon={playing ? "mdi:pause" : "mdi:play"}
      disabled={!canGoNext && !playing}
    />
  );
}
