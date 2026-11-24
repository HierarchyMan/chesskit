import Board from "@/components/board";
import StoryControls from "@/components/board/storyControls";
import { useInBoardCascade } from "@/lib/coachCascade";
import { chessPathKey } from "@/lib/chessHistory";
import ArrowOverlay from "@/components/board/arrowOverlay";
import { useEngineArrows } from "@/components/board/useEngineArrows";
import { colorNamer } from "@/lib/arrows/legend";
import { ARROW_CAPABILITIES } from "@/lib/arrows/prefs";
import { PageTitle } from "@/components/pageTitle";
import BoardWorkspace from "@/components/boardWorkspace";
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
import { setupPosition } from "@/lib/setupPosition";
import { useMemo } from "react";

const NO_ARROWS: BoardArrow[] = [];

export default function Arena() {
  const arena = useArena();
  const flipped = useAtomValue(arenaFlippedAtom);
  const arrows = useAtomValue(arenaProposalArrowsAtom);
  const setArrows = useSetAtom(arenaProposalArrowsAtom);
  const game = useAtomValue(arenaGameAtom);
  const story = useInBoardCascade(chessPathKey(game));
  const position = useAtomValue(arenaDataAtom);
  const preview = useMemo(
    () => setupPosition(arena.startFen),
    [arena.startFen]
  );
  const orientation = flipped ? Color.Black : Color.White;
  const proposals = arena.started && !arena.isOver ? arrows : NO_ARROWS;
  const engine = useEngineArrows({
    position,
    fen: game.fen(),
    prefsAtom: arenaArrowPrefsAtom,
    capabilities: ARROW_CAPABILITIES.arena,
    extra: proposals,
  });

  useHandoff(["fen"], ({ fen }) => {
    arena.setStartFen(fen);
  });

  return (
    <>
      <PageTitle title="Chesskit Engine Arena" />
      <BoardWorkspace
        inspectorMinWidth={400}
        inspectorLabel="Arena controls"
        board={
          <Board
            id="ArenaBoard"
            canPlay={arena.started && !arena.isOver && !story.projection.active}
            gameAtom={arenaGameAtom}
            previewFen={
              story.projection.previewFen ??
              (!arena.started ? preview.fen : undefined)
            }
            lastMove={story.projection.lastMove}
            highlights={story.projection.highlights}
            demonstrationFrame={story.projection.active}
            whitePlayer={{ name: sideLabel(arena.white) }}
            blackPlayer={{ name: sideLabel(arena.black) }}
            boardOrientation={orientation}
            currentPositionAtom={arenaDataAtom}
            showEvaluationBar={arena.started && arena.analysis.showEvaluation}
            showPlayerMoveIconAtom={arenaAnalysisOptionAtoms.annotations}
            arrows={
              story.projection.active
                ? story.projection.arrows
                : arena.started
                  ? engine.arrows
                  : NO_ARROWS
            }
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
            <ArenaSidePanel
              arena={arena}
              story={story}
              storyControls={<StoryControls story={story} />}
              onArrows={setArrows}
              overlays={
                arena.started ? (
                  <Box sx={{ px: 1.5 }}>
                    <ArrowOverlay
                      view="inspector"
                      prefs={engine.prefs}
                      capabilities={ARROW_CAPABILITIES.arena}
                      onChange={engine.update}
                      arrows={engine.arrows}
                      nameOf={colorNamer}
                      turn={game.turn()}
                      onFocus={engine.setFocus}
                    />
                  </Box>
                ) : undefined
              }
            />
          </Box>
        }
      />
    </>
  );
}
