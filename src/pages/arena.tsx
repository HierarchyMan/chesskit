import Board from "@/components/board";
import StoryControls from "@/components/board/storyControls";
import { useInBoardCascade } from "@/lib/coachCascade";
import { chessPathKey } from "@/lib/chessHistory";
import { ArrowOverlayControls } from "@/components/board/arrowOverlay";
import { useEngineArrows } from "@/components/board/useEngineArrows";
import { colorNamer } from "@/lib/arrows/legend";
import { ARROW_CAPABILITIES } from "@/lib/arrows/prefs";
import { PageTitle } from "@/components/pageTitle";
import BoardWorkspace from "@/components/boardWorkspace";
import { useHandoff } from "@/hooks/useHandoff";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import ArenaSidePanel from "@/sections/arena/sidePanel";
import {
  arenaAnalysisOptionAtoms,
  arenaArrowPrefsAtom,
  arenaDataAtom,
  arenaFlippedAtom,
  arenaGameAtom,
  arenaProposalArrowsAtom,
  arenaQueuedSourceAtom,
} from "@/sections/arena/states";
import { sideLabel, useArena } from "@/sections/arena/useArena";
import { BoardArrow } from "@/lib/arrows/types";
import { Handoff } from "@/lib/handoff";
import { Color } from "@/types/enums";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { setupPosition } from "@/lib/setupPosition";
import { useMemo, useState } from "react";

const NO_ARROWS: BoardArrow[] = [];

export default function Arena() {
  const arena = useArena();
  const [flipped, setFlipped] = useAtom(arenaFlippedAtom);
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
  const proposals =
    arena.started && !arena.isOver && !arena.isReviewing ? arrows : NO_ARROWS;
  const displayedFen = arena.reviewFen ?? game.fen();
  const engine = useEngineArrows({
    position,
    fen: displayedFen,
    prefsAtom: arenaArrowPrefsAtom,
    capabilities: ARROW_CAPABILITIES.arena,
    extra: proposals,
  });

  const setQueuedSource = useSetAtom(arenaQueuedSourceAtom);
  const [pendingHandoff, setPendingHandoff] = useState<Extract<
    Handoff,
    { kind: "fen" }
  > | null>(null);

  useHandoff(["fen"], (handoff) => {
    if (arena.started) {
      arena.setRunning(false);
      setPendingHandoff(handoff);
    } else {
      arena.setStartFen(handoff.fen);
      setQueuedSource(null);
    }
  });

  useKeyboardShortcut(
    " ",
    (event) => {
      event.preventDefault();
      arena.setRunning(!arena.running);
    },
    arena.started && !arena.isOver && !story.projection.active
  );
  useKeyboardShortcut(
    "ArrowLeft",
    () => arena.stepReview(-1),
    arena.started && arena.totalPlies > 0 && !story.projection.active
  );
  useKeyboardShortcut(
    "ArrowRight",
    () => arena.stepReview(1),
    arena.started && arena.isReviewing && !story.projection.active
  );
  useKeyboardShortcut(
    "Home",
    () => arena.goToPly(0),
    arena.started && arena.totalPlies > 0 && !story.projection.active
  );
  useKeyboardShortcut(
    "End",
    () => arena.goToPly(null),
    arena.started && arena.isReviewing && !story.projection.active
  );
  useKeyboardShortcut(
    "a",
    () => engine.update({ enabled: !engine.prefs.enabled }),
    arena.started
  );
  const arenaArrowDigits = useMemo(
    () =>
      Array.from(
        { length: ARROW_CAPABILITIES.arena.maxMoves },
        (_, i) => `${i + 1}`
      ),
    []
  );
  useKeyboardShortcut(
    arenaArrowDigits,
    (event) => engine.update({ enabled: true, moves: Number(event.key) }),
    arena.started && ARROW_CAPABILITIES.arena.maxMoves > 0
  );
  useKeyboardShortcut(
    "x",
    () => engine.update({ enabled: true, threats: !engine.prefs.threats }),
    arena.started && ARROW_CAPABILITIES.arena.threats
  );

  useKeyboardShortcut(
    ["f", "F"],
    () => setFlipped((value) => !value),
    arena.started
  );

  return (
    <>
      <PageTitle title="Chesskit Engine Arena" />
      <BoardWorkspace
        inspectorMinWidth={400}
        inspectorLabel="Arena controls"
        board={
          <Board
            id="ArenaBoard"
            gameIdentity={arena.matchId}
            canPlay={
              arena.started &&
              !arena.isOver &&
              !arena.isReviewing &&
              !story.projection.active
            }
            gameAtom={arenaGameAtom}
            previewFen={
              story.projection.previewFen ??
              (!arena.started ? preview.fen : arena.reviewFen)
            }
            lastMove={
              story.projection.active
                ? story.projection.lastMove
                : arena.reviewLastMove
            }
            highlights={story.projection.highlights}
            demonstrationFrame={story.projection.active}
            whitePlayer={{ name: sideLabel(arena.white) }}
            blackPlayer={{ name: sideLabel(arena.black) }}
            boardOrientation={orientation}
            currentPositionAtom={arenaDataAtom}
            showEvaluationBar={arena.started && arena.analysis.showEvaluation}
            reserveEvaluationBar
            showPlayerMoveIconAtom={arenaAnalysisOptionAtoms.annotations}
            onWheelStep={
              arena.started && arena.totalPlies > 0 && !story.projection.active
                ? (dir) => arena.stepReview(dir)
                : undefined
            }
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
          <ArenaSidePanel
            arena={arena}
            story={story}
            storyControls={<StoryControls story={story} />}
            onArrows={setArrows}
            overlayControls={
              arena.started ? (
                <ArrowOverlayControls
                  prefs={engine.prefs}
                  capabilities={ARROW_CAPABILITIES.arena}
                  onChange={engine.update}
                  arrows={engine.arrows}
                  nameOf={colorNamer}
                  turn={displayedFen.split(" ")[1] === "b" ? "b" : "w"}
                  onFocus={engine.setFocus}
                />
              ) : undefined
            }
          />
        }
      />

      <Dialog
        open={!!pendingHandoff}
        onClose={() => setPendingHandoff(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Arena match already open</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A custom board arrived from{" "}
            {pendingHandoff?.source ?? "another page"}. You can replace the
            current match now, or queue this board so your next match inherits
            it.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 0.75, px: 2.5, pb: 2 }}>
          <Button onClick={() => setPendingHandoff(null)}>
            Keep current match
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              if (!pendingHandoff) return;
              arena.setStartFen(pendingHandoff.fen);
              setQueuedSource(pendingHandoff.source ?? "another mode");
              setPendingHandoff(null);
            }}
          >
            Use for next match
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              if (!pendingHandoff) return;
              arena.setStartFen(pendingHandoff.fen);
              setQueuedSource(null);
              arena.stop();
              setPendingHandoff(null);
            }}
          >
            Start new match now
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
