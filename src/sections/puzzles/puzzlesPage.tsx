import Board from "@/components/board";
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

  const { puzzle, phase, arrowMove, arrowSide, solver } = trainer;
  const solved = phase === "solved";

  const arrows = useMemo(() => {
    const list: BoardArrow[] = [];
    if (arrowMove) {
      list.push(arrowFromUci(arrowMove, { kind: "best", side: arrowSide }));
    }
    return list;
  }, [arrowMove, arrowSide]);

  useKeyboardShortcut("h", trainer.askHint, phase === "solving");
  useKeyboardShortcut(
    [" ", "ArrowRight"],
    (event) => {
      event.preventDefault();
      trainer.advance();
    },
    trainer.waiting
  );
  useKeyboardShortcut("n", trainer.next, solved);
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
          canPlay={trainer.movableSide as Color | false}
          gameAtom={puzzleGameAtom}
          whitePlayer={{ name: solver === "w" ? "You" : "Opponent" }}
          blackPlayer={{ name: solver === "b" ? "You" : "Opponent" }}
          boardOrientation={solver === "w" ? Color.White : Color.Black}
          arrows={arrows}
          lastMove={trainer.lastMove}
          hintSquare={puzzle ? trainer.hintSquare : undefined}
          verdict={trainer.verdict}
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
          <PuzzlePanel trainer={trainer} />
        </Box>
      }
    />
  );
}
