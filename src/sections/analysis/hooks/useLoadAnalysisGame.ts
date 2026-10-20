import { useChessActions } from "@/hooks/useChessActions";
import { getGameSignature } from "@/lib/chess";
import { fenToPgn, loadGameFromText } from "@/lib/pgn";
import { GameEval } from "@/types/eval";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";
import {
  boardAtom,
  boardOrientationAtom,
  gameAtom,
  gameEvalAtom,
} from "../states";

export const useLoadAnalysisGame = () => {
  const game = useAtomValue(gameAtom);
  const board = useAtomValue(boardAtom);
  const orientation = useAtomValue(boardOrientationAtom);
  const { setPgn: setGamePgn } = useChessActions(gameAtom);
  const { resetToStartingPosition: resetBoard } = useChessActions(boardAtom);
  const setEval = useSetAtom(gameEvalAtom);
  const setBoardOrientation = useSetAtom(boardOrientationAtom);

  const currentSignature = useMemo(() => getGameSignature(game), [game]);

  const loadPgn = useCallback(
    (pgn: string, newOrientation?: boolean, gameEval?: GameEval) => {
      const gameFromPgn = loadGameFromText(pgn);
      if (currentSignature === getGameSignature(gameFromPgn)) return;

      resetBoard(pgn);
      setEval(gameEval);
      setGamePgn(pgn);
      setBoardOrientation(newOrientation ?? true);
    },
    [currentSignature, resetBoard, setGamePgn, setEval, setBoardOrientation]
  );

  const loadFen = useCallback(
    (fen: string) => loadPgn(fenToPgn(fen), orientation),
    [loadPgn, orientation]
  );

  const clearMoves = useCallback(() => loadFen(board.fen()), [loadFen, board]);

  return { loadPgn, loadFen, clearMoves };
};
