import Board from "@/components/board";
import { useBoardLayout } from "@/hooks/useBoardLayout";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { Color } from "@/types/enums";
import { Box } from "@mui/material";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { Arrow, Square } from "react-chessboard/dist/chessboard/types";
import PuzzlePanel from "./puzzlePanel";
import { puzzleGameAtom } from "./states";
import { usePuzzleTrainer } from "./usePuzzleTrainer";

const SIDE_PANEL_WIDTH = 420;
const LAST_MOVE_COLOR = "rgba(255, 170, 0, 0.55)";
const HINT_COLOR = "#22ac38";

const toArrow = (uci: string, color: string): Arrow => [
  uci.slice(0, 2) as Square,
  uci.slice(2, 4) as Square,
  color,
];

export default function PuzzlesPage() {
  const trainer = usePuzzleTrainer();
  const game = useAtomValue(puzzleGameAtom);
  const { boardSize, sideBySide } = useBoardLayout({
    sidePanelWidth: SIDE_PANEL_WIDTH,
    extraWidth: 40,
  });

  const { puzzle, phase, arrowMove, solver } = trainer;
  const atStart = game.history().length === 0;
  const solved = phase === "solved";

  const arrows = useMemo(() => {
    const list: Arrow[] = [];
    if (puzzle?.lastMove && atStart) {
      list.push(toArrow(puzzle.lastMove, LAST_MOVE_COLOR));
    }
    if (arrowMove) list.push(toArrow(arrowMove, HINT_COLOR));
    return list;
  }, [puzzle, atStart, arrowMove]);

  useKeyboardShortcut("h", trainer.askHint, phase === "solving");
  useKeyboardShortcut(["n", "ArrowRight"], trainer.next, solved);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: sideBySide ? "row" : "column" },
        justifyContent: "center",
        alignItems: { xs: "center", sm: sideBySide ? "flex-start" : "center" },
        gap: 4,
      }}
    >
      <Board
        id="PuzzleBoard"
        canPlay={phase === "solving" ? (solver as Color) : false}
        gameAtom={puzzleGameAtom}
        boardSize={boardSize}
        whitePlayer={{ name: solver === "w" ? "You" : "Opponent" }}
        blackPlayer={{ name: solver === "b" ? "You" : "Opponent" }}
        boardOrientation={solver === "w" ? Color.White : Color.Black}
        extraArrows={arrows}
      />

      <Box
        sx={{
          width: { xs: "100%", sm: sideBySide ? SIDE_PANEL_WIDTH : "100%" },
          maxWidth: "100%",
        }}
      >
        <PuzzlePanel trainer={trainer} />
      </Box>
    </Box>
  );
}
