import { useAtomValue } from "jotai";
import { boardAtom, gameAtom } from "../states";
import { useChessActions } from "@/hooks/useChessActions";
import { ToolbarButton } from "@/components/ToolbarButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export default function GoToLastPositionButton() {
  const { setPgn: setBoardPgn } = useChessActions(boardAtom);
  const game = useAtomValue(gameAtom);
  const board = useAtomValue(boardAtom);

  const isButtonDisabled =
    game.history().length === 0 ||
    board.history().join() === game.history().join();

  const goToLastPosition = () => {
    if (isButtonDisabled) return;
    setBoardPgn(game.pgn());
  };

  useKeyboardShortcut("ArrowUp", goToLastPosition);

  return (
    <ToolbarButton
      tooltip="Final position (↑)"
      onClick={goToLastPosition}
      icon="ri:skip-forward-line"
      disabled={isButtonDisabled}
    />
  );
}
