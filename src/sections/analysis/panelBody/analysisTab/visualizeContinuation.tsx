import { IconButton, Button, Tooltip } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  analysisCascadeStoryAtom,
  boardAtom,
  currentPositionAtom,
} from "../../states";
import { positionFor } from "@/lib/currentPosition";
import { buildContinuationStory } from "@/lib/visualize/moveStory";

export default function VisualizeContinuation({
  compact = true,
}: {
  compact?: boolean;
}) {
  const board = useAtomValue(boardAtom);
  const position = positionFor(useAtomValue(currentPositionAtom), board.fen());
  const showStory = useSetAtom(analysisCascadeStoryAtom);
  const line = position.eval?.lines[0];
  const ready = !!line?.pv.length && !board.isGameOver();

  const handleClick = () => {
    if (line) showStory(buildContinuationStory(board.fen(), line));
  };

  if (compact) {
    return (
      <Tooltip
        title={
          ready ? "Show top engine line on board" : "Waiting for an engine line"
        }
        disableInteractive
      >
        <span>
          <IconButton
            size="small"
            disabled={!ready}
            onClick={handleClick}
            aria-label="Show top engine line on board"
            sx={{
              width: 26,
              height: 26,
              borderRadius: 1,
              color: "text.secondary",
              "&:hover": { color: "primary.main", bgcolor: "action.hover" },
            }}
          >
            <Icon icon="mdi:eye-outline" height={16} />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={
        ready
          ? "Play the engine line on this board"
          : "Waiting for an engine line"
      }
      disableInteractive
    >
      <span>
        <Button
          size="small"
          variant="outlined"
          disabled={!ready}
          startIcon={<Icon icon="mdi:eye-outline" height={16} />}
          onClick={handleClick}
        >
          Show line
        </Button>
      </span>
    </Tooltip>
  );
}
