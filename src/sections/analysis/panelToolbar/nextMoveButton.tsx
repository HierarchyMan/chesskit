import { useAtomValue } from "jotai";
import { boardAtom, gameAtom } from "../states";
import { useChessActions } from "@/hooks/useChessActions";
import { useCallback } from "react";
import { ToolbarButton } from "@/components/ToolbarButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export const useNextMove = () => {
  const { playMove: playBoardMove } = useChessActions(boardAtom);
  const game = useAtomValue(gameAtom);
  const board = useAtomValue(boardAtom);

  const gameHistory = game.history();
  const boardHistory = board.history();

  const canGoNext =
    boardHistory.length < gameHistory.length &&
    gameHistory.slice(0, boardHistory.length).join() === boardHistory.join();

  const goNext = useCallback(() => {
    if (!canGoNext) return;

    const nextMoveIndex = boardHistory.length;
    const nextMove = game.history({ verbose: true })[nextMoveIndex];
    if (!nextMove) return;

    const comment = game
      .getComments()
      .find((c) => c.fen === nextMove.after)?.comment;

    playBoardMove({
      from: nextMove.from,
      to: nextMove.to,
      promotion: nextMove.promotion,
      comment,
    });
  }, [canGoNext, boardHistory, game, playBoardMove]);

  return { canGoNext, goNext, plies: boardHistory.length };
};

export default function NextMoveButton() {
  const { canGoNext, goNext } = useNextMove();

  useKeyboardShortcut("ArrowRight", goNext);

  return (
    <ToolbarButton
      tooltip="Next move (→)"
      onClick={goNext}
      icon="ri:arrow-right-s-line"
      disabled={!canGoNext}
      iconHeight={30}
    />
  );
}
