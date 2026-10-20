import { ToolbarButton } from "@/components/ToolbarButton";
import { useAtomValue } from "jotai";
import { useLoadAnalysisGame } from "../hooks/useLoadAnalysisGame";
import { boardAtom, gameAtom } from "../states";

export default function ClearMovesButton() {
  const game = useAtomValue(gameAtom);
  const board = useAtomValue(boardAtom);
  const { clearMoves } = useLoadAnalysisGame();

  const hasMoves = game.history().length > 0 || board.history().length > 0;

  return (
    <ToolbarButton
      tooltip="Clear the moves and keep this position as the new start"
      onClick={clearMoves}
      icon="mdi:eraser-variant"
      disabled={!hasMoves}
    />
  );
}
