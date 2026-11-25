import { Stack } from "@mui/material";
import { useAtomValue } from "jotai";
import { boardAtom } from "../states";
import { useAnalysisNavigation } from "../hooks/useAnalysisNavigation";
import FlipBoardButton from "./flipBoardButton";
import NextMoveButton from "./nextMoveButton";
import GoToLastPositionButton from "./goToLastPositionButton";
import AutoPlayButton from "./autoPlayButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { ToolbarButton } from "@/components/ToolbarButton";

/**
 * The one row that moves through the game: back, play, forward, and flip. It
 * sits beneath the board, so the board's own controls stay with the position
 * they act on, whatever the side panel is showing.
 */
export default function BoardNavigation() {
  const board = useAtomValue(boardAtom);
  const navigate = useAnalysisNavigation();
  const resetBoard = () => navigate("start");
  const undoBoardMove = () => navigate("previous");

  const boardHistory = board.history();

  useKeyboardShortcut("ArrowLeft", (event) => {
    if (boardHistory.length) {
      event.preventDefault();
      undoBoardMove();
    }
  });
  useKeyboardShortcut(["ArrowUp", "Home"], (event) => {
    if (boardHistory.length) {
      event.preventDefault();
      resetBoard();
    }
  });

  return (
    <Stack
      data-board-shortcuts
      direction="row"
      justifyContent="center"
      alignItems="center"
      gap={0.5}
      width="100%"
      sx={{ height: 44, minHeight: 44, maxHeight: 44, flexShrink: 0 }}
    >
      <ToolbarButton
        tooltip="Back to start (↑ / Home)"
        onClick={() => resetBoard()}
        icon="mdi:skip-previous"
        disabled={boardHistory.length === 0}
      />

      <ToolbarButton
        tooltip="Previous move (←)"
        onClick={() => undoBoardMove()}
        icon="mdi:chevron-left"
        disabled={boardHistory.length === 0}
        iconHeight={28}
      />

      <AutoPlayButton />

      <NextMoveButton />

      <GoToLastPositionButton />

      <FlipBoardButton />
    </Stack>
  );
}
