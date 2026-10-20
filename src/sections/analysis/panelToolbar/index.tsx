import { Stack, useMediaQuery } from "@mui/material";
import { useAtomValue } from "jotai";
import { boardAtom } from "../states";
import { useChessActions } from "@/hooks/useChessActions";
import FlipBoardButton from "./flipBoardButton";
import NextMoveButton from "./nextMoveButton";
import GoToLastPositionButton from "./goToLastPositionButton";
import SaveButton from "./saveButton";
import AutoPlayButton from "./autoPlayButton";
import TopMovesButton from "./topMovesButton";
import ClearMovesButton from "./clearMovesButton";
import MoreMenu from "./moreMenu";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { ToolbarButton } from "@/components/ToolbarButton";
import { CopyPgnButton } from "./copyPgnButton";

export default function PanelToolBar() {
  const board = useAtomValue(boardAtom);
  const { resetToStartingPosition: resetBoard, undoMove: undoBoardMove } =
    useChessActions(boardAtom);

  const boardHistory = board.history();

  useKeyboardShortcut("ArrowLeft", () => {
    if (boardHistory.length) undoBoardMove();
  });
  useKeyboardShortcut("ArrowDown", () => {
    if (boardHistory.length) resetBoard();
  });

  const isSmOrGreater = useMediaQuery((theme) => theme.breakpoints.up("sm"));

  const navigation = (
    <>
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
    </>
  );

  const tools = (
    <>
      <FlipBoardButton />
      <TopMovesButton />
      <ClearMovesButton />
      <CopyPgnButton />
      <SaveButton />
      <MoreMenu />
    </>
  );

  return (
    <Stack width="100%" gap={0.5}>
      <Stack
        direction="row"
        justifyContent={{ xs: "space-around", md: "center" }}
        alignItems="center"
        gap={{ xs: undefined, md: isSmOrGreater ? 1.5 : 0 }}
        width="100%"
      >
        {navigation}
        {isSmOrGreater && tools}
      </Stack>

      {!isSmOrGreater && (
        <Stack
          direction="row"
          justifyContent="space-around"
          alignItems="center"
          width="100%"
        >
          {tools}
        </Stack>
      )}
    </Stack>
  );
}
