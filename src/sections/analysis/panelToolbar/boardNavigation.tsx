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

  useKeyboardShortcut("ArrowLeft", () => {
    if (boardHistory.length) undoBoardMove();
  });
  useKeyboardShortcut("ArrowDown", () => {
    if (boardHistory.length) resetBoard();
  });

  return (
    <Stack
      direction="row"
      justifyContent="center"
      alignItems="center"
      gap={{ xs: 0, sm: 1.5 }}
      width="100%"
    >
      <ToolbarButton
        tooltip="Back to start (↓)"
        onClick={() => resetBoard()}
        icon="ri:skip-back-line"
        disabled={boardHistory.length === 0}
      />

      <ToolbarButton
        tooltip="Previous move (←)"
        onClick={() => undoBoardMove()}
        icon="ri:arrow-left-s-line"
        disabled={boardHistory.length === 0}
        iconHeight={30}
      />

      <AutoPlayButton />

      <NextMoveButton />

      <GoToLastPositionButton />

      <FlipBoardButton />
    </Stack>
  );
}
