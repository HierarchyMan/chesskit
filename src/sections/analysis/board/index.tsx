import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  analysisCascadeNarrationAtom,
  analysisCascadeStoryAtom,
  analysisHighlightsAtom,
  analysisOptionAtoms,
  boardAtom,
  boardOrientationAtom,
  currentPositionAtom,
  gameAtom,
} from "../states";
import { Color } from "@/types/enums";
import Board from "@/components/board";
import { useWorkspaceLayout } from "@/components/boardWorkspace";
import CascadeBar from "@/components/board/cascadeBar";
import { usePlayersData } from "@/hooks/usePlayersData";
import { AnalysisOverlay } from "../hooks/useAnalysisOverlay";
import BoardNavigation from "../panelToolbar/boardNavigation";
import { recordedDrawAtEnd } from "@/lib/boardDraw";
import { useInBoardCascade } from "@/lib/coachCascade";
import { useCallback, useEffect, useMemo } from "react";
import { useAnalysisNavigation } from "../hooks/useAnalysisNavigation";
import { analysisSessionAtom } from "../sessionAtoms";

interface Props {
  overlay: AnalysisOverlay;
}

export default function BoardContainer({ overlay }: Props) {
  const { sideBySide } = useWorkspaceLayout();
  const sessionId = useAtomValue(analysisSessionAtom)?.id;
  const navigate = useAnalysisNavigation();
  const boardOrientation = useAtomValue(boardOrientationAtom);
  const showEvaluationBar = useAtomValue(analysisOptionAtoms.evaluation);
  const { white, black } = usePlayersData(gameAtom);
  const board = useAtomValue(boardAtom);
  const full = useAtomValue(gameAtom);
  const analysisHighlights = useAtomValue(analysisHighlightsAtom);
  const [requestedStory, setRequestedStory] = useAtom(analysisCascadeStoryAtom);
  const setCascadeNarration = useSetAtom(analysisCascadeNarrationAtom);
  const recordedDraw = useMemo(
    () => recordedDrawAtEnd(board, full),
    [board, full]
  );

  const cascade = useInBoardCascade(board.fen());

  useEffect(() => {
    if (!requestedStory) return;
    cascade.start(requestedStory, { exitLabel: "Back to analysis" });
    setRequestedStory(null);
  }, [requestedStory, cascade, setRequestedStory]);

  const viewpoint = boardOrientation ? Color.White : Color.Black;
  const active = cascade.projection.active;
  const wheelStep = useCallback(
    (direction: 1 | -1) => {
      navigate(direction === 1 ? "next" : "previous");
    },
    [navigate]
  );
  const { branch, stepIndex, maxStep, san, caption } = cascade.projection;

  useEffect(() => {
    if (!active) {
      setCascadeNarration(null);
      return;
    }
    setCascadeNarration({ branch, stepIndex, maxStep, san, caption });
    return () => setCascadeNarration(null);
  }, [active, branch, stepIndex, maxStep, san, caption, setCascadeNarration]);

  return (
    <Board
      id="AnalysisBoard"
      canPlay={!active}
      gameAtom={boardAtom}
      recordedDraw={recordedDraw}
      whitePlayer={white}
      blackPlayer={black}
      boardOrientation={viewpoint}
      currentPositionAtom={currentPositionAtom}
      showPlayerMoveIconAtom={analysisOptionAtoms.annotations}
      showEvaluationBar={showEvaluationBar}
      reserveEvaluationBar
      gameIdentity={sessionId}
      onWheelStep={active ? undefined : wheelStep}
      previewFen={active ? cascade.projection.previewFen : undefined}
      lastMove={active ? cascade.projection.lastMove : undefined}
      arrows={active ? cascade.projection.arrows : overlay.arrows}
      highlights={active ? cascade.projection.highlights : analysisHighlights}
      demonstrationFrame={active}
      footer={
        active ? (
          <CascadeBar
            cascade={cascade.projection}
            onTogglePlay={cascade.togglePlay}
            onPrev={cascade.stepPrev}
            onNext={cascade.stepNext}
            onReplay={cascade.replay}
            onSwitchBranch={cascade.switchBranch}
            onExit={cascade.stop}
            showCaption={false}
          />
        ) : sideBySide ? (
          <BoardNavigation />
        ) : undefined
      }
    />
  );
}
