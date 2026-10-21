import Board from "@/components/board";
import { PageTitle } from "@/components/pageTitle";
import { useBoardLayout } from "@/hooks/useBoardLayout";
import { useHandoff } from "@/hooks/useHandoff";
import ArenaSidePanel from "@/sections/arena/sidePanel";
import {
  arenaDataAtom,
  arenaFlippedAtom,
  arenaGameAtom,
  arenaShowAnnotationsAtom,
} from "@/sections/arena/states";
import { sideLabel, useArena } from "@/sections/arena/useArena";
import { Color } from "@/types/enums";
import { Box } from "@mui/material";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { Arrow } from "react-chessboard/dist/chessboard/types";

const SIDE_PANEL_WIDTH = 460;

export default function Arena() {
  const arena = useArena();
  const flipped = useAtomValue(arenaFlippedAtom);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const { boardSize, sideBySide } = useBoardLayout({
    sidePanelWidth: SIDE_PANEL_WIDTH,
    extraWidth: arena.started && arena.analysis.showEvaluation ? 40 : 0,
  });

  useHandoff(["fen"], ({ fen }) => {
    arena.setStartFen(fen);
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: sideBySide ? "row" : "column",
        justifyContent: "center",
        alignItems: sideBySide ? "flex-start" : "center",
        gap: 4,
      }}
    >
      <PageTitle title="Chesskit Engine Arena" />

      <Board
        id="ArenaBoard"
        canPlay={arena.started && !arena.isOver}
        gameAtom={arenaGameAtom}
        boardSize={boardSize}
        whitePlayer={{ name: sideLabel(arena.white) }}
        blackPlayer={{ name: sideLabel(arena.black) }}
        boardOrientation={flipped ? Color.Black : Color.White}
        currentPositionAtom={arenaDataAtom}
        showEvaluationBar={arena.started && arena.analysis.showEvaluation}
        resetEvaluationWhenPending
        showPlayerMoveIconAtom={arenaShowAnnotationsAtom}
        showBestMoveArrow={
          arena.started &&
          arena.analysis.showBestMove &&
          arena.analysis.position.lastEval?.bestMove !==
            arena.analysis.position.lastMove?.lan
        }
        extraArrows={arrows}
      />

      <Box
        sx={{
          width: sideBySide ? SIDE_PANEL_WIDTH : "100%",
          maxWidth: "100%",
        }}
      >
        <ArenaSidePanel arena={arena} onArrows={setArrows} />
      </Box>
    </Box>
  );
}
