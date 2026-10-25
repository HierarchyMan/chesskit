import { Button, Menu, MenuItem, Tooltip } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtomValue, useSetAtom } from "jotai";
import { boardAtom, currentPositionAtom } from "../../states";
import { positionFor } from "@/lib/currentPosition";
import {
  buildContinuationStory,
  buildMoveStory,
} from "@/lib/visualize/moveStory";
import { moveStoryAtom } from "@/lib/moveStoryState";
import { useRef, useState } from "react";

export default function VisualizeContinuation() {
  const board = useAtomValue(boardAtom);
  const position = positionFor(useAtomValue(currentPositionAtom), board.fen());
  const openStory = useSetAtom(moveStoryAtom);
  const line = position.eval?.lines[0];
  const ready = !!line?.pv.length && !board.isGameOver();
  const playedReady =
    !!position.lastMove &&
    !!position.lastEval?.lines.length &&
    !!position.eval?.lines.length;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <Tooltip
      title={
        ready || playedReady
          ? "Preview the current continuation or the played move without changing your study"
          : "Available when the engine has a continuation for this position"
      }
    >
      <span>
        <Button
          size="small"
          variant="outlined"
          ref={button}
          disabled={!ready && !playedReady}
          aria-haspopup="menu"
          aria-expanded={!!anchor}
          startIcon={<Icon icon="mdi:eye-outline" height={18} />}
          endIcon={<Icon icon="mdi:chevron-down" height={16} />}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ minHeight: 36, borderRadius: "6px" }}
        >
          Visualize
        </Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          <MenuItem
            disabled={!ready}
            onClick={() => {
              setAnchor(null);
              if (line)
                openStory({
                  open: true,
                  trigger: button.current ?? undefined,
                  story: buildContinuationStory(board.fen(), line),
                });
            }}
          >
            Current continuation
          </MenuItem>
          <MenuItem
            disabled={!playedReady}
            onClick={() => {
              setAnchor(null);
              const move = position.lastMove;
              if (move && position.lastEval && position.eval)
                openStory({
                  open: true,
                  trigger: button.current ?? undefined,
                  classification: position.eval.moveClassification,
                  story: buildMoveStory({
                    fenBefore: move.before,
                    playedUci: move.lan,
                    beforeLines: position.lastEval.lines,
                    afterLines: position.eval.lines,
                  }),
                });
            }}
          >
            Played move and alternatives
          </MenuItem>
        </Menu>
      </span>
    </Tooltip>
  );
}
