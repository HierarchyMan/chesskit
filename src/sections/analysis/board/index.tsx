import { useAtomValue } from "jotai";
import {
  boardArrowsAtom,
  boardAtom,
  boardOrientationAtom,
  currentPositionAtom,
  gameAtom,
  showBestMoveArrowAtom,
  showPlayerMoveIconAtom,
} from "../states";
import { Color } from "@/types/enums";
import Board from "@/components/board";
import { usePlayersData } from "@/hooks/usePlayersData";
import { useAnalysisBoardSize } from "../hooks/useAnalysisBoardSize";

export default function BoardContainer() {
  const boardSize = useAnalysisBoardSize();
  const boardOrientation = useAtomValue(boardOrientationAtom);
  const showBestMoveArrow = useAtomValue(showBestMoveArrowAtom);
  const extraArrows = useAtomValue(boardArrowsAtom);
  const { white, black } = usePlayersData(gameAtom);

  return (
    <Board
      id="AnalysisBoard"
      boardSize={boardSize}
      canPlay={true}
      gameAtom={boardAtom}
      whitePlayer={white}
      blackPlayer={black}
      boardOrientation={boardOrientation ? Color.White : Color.Black}
      currentPositionAtom={currentPositionAtom}
      showBestMoveArrow={showBestMoveArrow}
      showPlayerMoveIconAtom={showPlayerMoveIconAtom}
      showEvaluationBar={true}
      resetEvaluationWhenPending
      extraArrows={extraArrows}
    />
  );
}
