import { Button, Tooltip } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  analysisCascadeStoryAtom,
  boardAtom,
  currentPositionAtom,
} from "../../states";
import { positionFor } from "@/lib/currentPosition";
import { buildContinuationStory } from "@/lib/visualize/moveStory";

export default function VisualizeContinuation() {
  const board = useAtomValue(boardAtom);
  const position = positionFor(useAtomValue(currentPositionAtom), board.fen());
  const showStory = useSetAtom(analysisCascadeStoryAtom);
  const line = position.eval?.lines[0];
  const ready = !!line?.pv.length && !board.isGameOver();
  return (
    <Tooltip
      title={
        ready
          ? "Play the engine line on this board"
          : "Waiting for an engine line"
      }
    >
      <span>
        <Button
          size="small"
          variant="outlined"
          disabled={!ready}
          startIcon={<Icon icon="mdi:eye-outline" height={18} />}
          onClick={() => {
            if (line) showStory(buildContinuationStory(board.fen(), line));
          }}
          sx={{ minHeight: 36, borderRadius: "6px" }}
        >
          Show line
        </Button>
      </span>
    </Tooltip>
  );
}
