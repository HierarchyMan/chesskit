import Board from "@/components/board";
import StoryControls from "@/components/board/storyControls";
import { useInBoardCascade } from "@/lib/coachCascade";
import { chessPathKey } from "@/lib/chessHistory";
import { useAtomValue } from "jotai";
import BoardWorkspace from "@/components/boardWorkspace";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { Color } from "@/types/enums";
import { Box } from "@mui/material";
import { useMemo } from "react";
import { arrowFromUci } from "@/lib/arrows/uci";
import { BoardArrow } from "@/lib/arrows/types";
import PuzzlePanel from "./puzzlePanel";
import { puzzleGameAtom } from "./states";
import { usePuzzleTrainer } from "./usePuzzleTrainer";

const SIDE_PANEL_WIDTH = 420;

export default function PuzzlesPage() {
  const trainer = usePuzzleTrainer();
  const game = useAtomValue(puzzleGameAtom);
  const story = useInBoardCascade(`${trainer.motionKey}|${chessPathKey(game)}`);

  const { puzzle, phase, arrowMove, arrowSide, solver } = trainer;
  const solved = phase === "solved";

  const arrows = useMemo(() => {
    const list: BoardArrow[] = [];
    if (arrowMove) {
      list.push(arrowFromUci(arrowMove, { kind: "best", side: arrowSide }));
    }
    return list;
  }, [arrowMove, arrowSide]);

  useKeyboardShortcut(["h", "H"], trainer.askHint, phase === "solving");
  useKeyboardShortcut(
    [" ", "ArrowRight"],
    (event) => {
      event.preventDefault();
      trainer.advance();
    },
    trainer.waiting
  );
  useKeyboardShortcut(
    ["n", "N", " ", "Enter"],
    (event) => {
      event.preventDefault();
      trainer.next();
    },
    solved &&
      !story.projection.active &&
      !(trainer.source === "mistakes" && trainer.mistakeCount < 2)
  );
  useKeyboardShortcut("ArrowLeft", () => trainer.review("previous"), solved);
  useKeyboardShortcut("ArrowRight", () => trainer.review("next"), solved);
  useKeyboardShortcut("Home", () => trainer.review("start"), solved);
  useKeyboardShortcut("End", () => trainer.review("end"), solved);

  return (
    <BoardWorkspace
      inspectorMinWidth={SIDE_PANEL_WIDTH}
      inspectorLabel="Puzzle controls"
      board={
        <Board
          id="PuzzleBoard"
          canPlay={
            story.projection.active
              ? false
              : (trainer.movableSide as Color | false)
          }
          previewFen={story.projection.previewFen}
          highlights={story.projection.highlights}
          demonstrationFrame={story.projection.active}
          gameAtom={puzzleGameAtom}
          whitePlayer={{ name: solver === "w" ? "You" : "Opponent" }}
          blackPlayer={{ name: solver === "b" ? "You" : "Opponent" }}
          boardOrientation={solver === "w" ? Color.White : Color.Black}
          arrows={story.projection.active ? story.projection.arrows : arrows}
          lastMove={
            story.projection.active
              ? story.projection.lastMove
              : trainer.lastMove
          }
          hintSquare={
            puzzle && !story.projection.active ? trainer.hintSquare : undefined
          }
          verdict={story.projection.active ? undefined : trainer.verdict}
          motionKey={trainer.motionKey}
        />
      }
      inspector={
        <Box
          data-inspector-scroller
          sx={{
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollbarGutter: "stable",
          }}
        >
          <PuzzlePanel
            trainer={trainer}
            onShowStory={(value) =>
              story.start(value, { exitLabel: "Back to puzzle" })
            }
            storyControls={<StoryControls story={story} />}
          />
        </Box>
      }
    />
  );
}
