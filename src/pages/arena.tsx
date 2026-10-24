import Board from "@/components/board";
import ArrowOverlay from "@/components/board/arrowOverlay";
import { useEngineArrows } from "@/components/board/useEngineArrows";
import { colorNamer } from "@/lib/arrows/legend";
import { ARROW_CAPABILITIES } from "@/lib/arrows/prefs";
import { PageTitle } from "@/components/pageTitle";
import { useBoardLayout } from "@/hooks/useBoardLayout";
import { useHandoff } from "@/hooks/useHandoff";
import ArenaSidePanel from "@/sections/arena/sidePanel";
import {
  arenaAnalysisOptionAtoms,
  arenaArrowPrefsAtom,
  arenaDataAtom,
  arenaFlippedAtom,
  arenaGameAtom,
  arenaProposalArrowsAtom,
} from "@/sections/arena/states";
import { sideLabel, useArena } from "@/sections/arena/useArena";
import { BoardArrow } from "@/lib/arrows/types";
import { Color } from "@/types/enums";
import { Box } from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";

const SIDE_PANEL_WIDTH = 460;
const NO_ARROWS: BoardArrow[] = [];

export default function Arena() {
  const arena = useArena();
  const flipped = useAtomValue(arenaFlippedAtom);
  const arrows = useAtomValue(arenaProposalArrowsAtom);
  const setArrows = useSetAtom(arenaProposalArrowsAtom);
  const game = useAtomValue(arenaGameAtom);
  const position = useAtomValue(arenaDataAtom);
  const orientation = flipped ? Color.Black : Color.White;
  const proposals = arena.started && !arena.isOver ? arrows : NO_ARROWS;
  const engine = useEngineArrows({
    position,
    fen: game.fen(),
    prefsAtom: arenaArrowPrefsAtom,
    capabilities: ARROW_CAPABILITIES.arena,
    extra: proposals,
  });
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
        flexDirection: { xs: "column", sm: sideBySide ? "row" : "column" },
        justifyContent: "center",
        alignItems: { xs: "center", sm: sideBySide ? "flex-start" : "center" },
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
        boardOrientation={orientation}
        currentPositionAtom={arenaDataAtom}
        showEvaluationBar={arena.started && arena.analysis.showEvaluation}
        resetEvaluationWhenPending
        showPlayerMoveIconAtom={arenaAnalysisOptionAtoms.annotations}
        arrows={arena.started ? engine.arrows : NO_ARROWS}
        header={
          arena.started && (
            <ArrowOverlay
              view="compact"
              prefs={engine.prefs}
              capabilities={ARROW_CAPABILITIES.arena}
              onChange={engine.update}
              arrows={engine.arrows}
              nameOf={colorNamer}
              turn={game.turn()}
              onFocus={engine.setFocus}
            />
          )
        }
      />

      <Box
        sx={{
          width: { xs: "100%", sm: sideBySide ? SIDE_PANEL_WIDTH : "100%" },
          maxWidth: "100%",
        }}
      >
        <ArenaSidePanel arena={arena} onArrows={setArrows} />
      </Box>
    </Box>
  );
}
