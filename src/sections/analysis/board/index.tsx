import { useAtomValue } from "jotai";
import {
  analysisOptionAtoms,
  boardAtom,
  boardOrientationAtom,
  currentPositionAtom,
  gameAtom,
} from "../states";
import { Color } from "@/types/enums";
import Board from "@/components/board";
import { usePlayersData } from "@/hooks/usePlayersData";
import { useAnalysisBoardSize } from "../hooks/useAnalysisBoardSize";
import { AnalysisOverlay } from "../hooks/useAnalysisOverlay";
import BoardNavigation from "../panelToolbar/boardNavigation";
import AnalysisOverlayPanel from "../overlayPanel";

interface Props {
  overlay: AnalysisOverlay;
  /** Beside the board the overlay is in the side panel; stacked, it sits above the board. */
  overlayInspector: boolean;
}

export default function BoardContainer({ overlay, overlayInspector }: Props) {
  const boardSize = useAnalysisBoardSize();
  const boardOrientation = useAtomValue(boardOrientationAtom);
  const showEvaluationBar = useAtomValue(analysisOptionAtoms.evaluation);
  const { white, black } = usePlayersData(gameAtom);

  const viewpoint = boardOrientation ? Color.White : Color.Black;

  return (
    <Board
      id="AnalysisBoard"
      boardSize={boardSize}
      canPlay={true}
      gameAtom={boardAtom}
      whitePlayer={white}
      blackPlayer={black}
      boardOrientation={viewpoint}
      currentPositionAtom={currentPositionAtom}
      showPlayerMoveIconAtom={analysisOptionAtoms.annotations}
      showEvaluationBar={showEvaluationBar}
      resetEvaluationWhenPending
      arrows={overlay.arrows}
      header={
        overlayInspector ? undefined : (
          <AnalysisOverlayPanel overlay={overlay} view="compact" />
        )
      }
      footer={<BoardNavigation />}
    />
  );
}
