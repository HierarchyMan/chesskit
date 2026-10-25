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
import { AnalysisOverlay } from "../hooks/useAnalysisOverlay";
import BoardNavigation from "../panelToolbar/boardNavigation";
import { recordedDrawAtEnd } from "@/lib/boardDraw";
import { useMemo } from "react";

interface Props {
  overlay: AnalysisOverlay;
}

export default function BoardContainer({ overlay }: Props) {
  const boardOrientation = useAtomValue(boardOrientationAtom);
  const showEvaluationBar = useAtomValue(analysisOptionAtoms.evaluation);
  const { white, black } = usePlayersData(gameAtom);
  const board = useAtomValue(boardAtom);
  const full = useAtomValue(gameAtom);
  const recordedDraw = useMemo(
    () => recordedDrawAtEnd(board, full),
    [board, full]
  );

  const viewpoint = boardOrientation ? Color.White : Color.Black;

  return (
    <Board
      id="AnalysisBoard"
      canPlay={true}
      gameAtom={boardAtom}
      recordedDraw={recordedDraw}
      whitePlayer={white}
      blackPlayer={black}
      boardOrientation={viewpoint}
      currentPositionAtom={currentPositionAtom}
      showPlayerMoveIconAtom={analysisOptionAtoms.annotations}
      showEvaluationBar={showEvaluationBar}
      resetEvaluationWhenPending
      arrows={overlay.arrows}
      footer={<BoardNavigation />}
    />
  );
}
