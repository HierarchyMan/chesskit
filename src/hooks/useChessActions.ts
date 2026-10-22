import { getGameFromPgn, setGameHeaders } from "@/lib/chess";
import { loadGameFromText } from "@/lib/pgn";
import { playIllegalMoveSound, playSoundFromMove } from "@/lib/sounds";
import { Player } from "@/types/game";
import { Chess, Move, DEFAULT_POSITION } from "chess.js";
import { PrimitiveAtom, useAtom, useStore } from "jotai";
import { chessPathKey, replayChess } from "@/lib/chessHistory";
import { useCallback } from "react";

export interface resetGameParams {
  fen?: string;
  white?: Player;
  black?: Player;
  noHeaders?: boolean;
}

export const useChessActions = (chessAtom: PrimitiveAtom<Chess>) => {
  const [, setGame] = useAtom(chessAtom);
  const store = useStore();

  const setPgn = useCallback(
    (pgn: string) => {
      setGame(loadGameFromText(pgn));
    },
    [setGame]
  );

  const reset = useCallback(
    (params?: resetGameParams) => {
      const newGame = new Chess(params?.fen);
      if (!params?.noHeaders) setGameHeaders(newGame, params);
      setGame(newGame);
    },
    [setGame]
  );

  const copyGame = useCallback(() => {
    const game = store.get(chessAtom);
    const newGame = new Chess();

    if (game.history().length === 0) {
      const pgnSplitted = game.pgn().split("]");
      if (
        ["1-0", "0-1", "1/2-1/2", "*"].includes(
          pgnSplitted.at(-1)?.trim() ?? ""
        )
      ) {
        newGame.loadPgn(pgnSplitted.slice(0, -1).join("]") + "]");
        return newGame;
      }
    }

    return loadGameFromText(game.pgn());
  }, [store, chessAtom]);

  const resetToStartingPosition = useCallback(
    (pgn?: string) => {
      const newGame = pgn ? getGameFromPgn(pgn) : copyGame();
      newGame.load(newGame.getHeaders().FEN || DEFAULT_POSITION, {
        preserveHeaders: true,
      });
      setGame(newGame);
    },
    [copyGame, setGame]
  );

  const playMove = useCallback(
    (
      params: {
        from: string;
        to: string;
        promotion?: string;
        comment?: string;
      },
      expectedGame?: Chess
    ): Move | null => {
      const newGame = copyGame();
      if (expectedGame && chessPathKey(newGame) !== chessPathKey(expectedGame))
        return null;

      try {
        const { comment, ...move } = params;
        const result = newGame.move(move);
        if (comment) newGame.setComment(comment);

        setGame(newGame);
        playSoundFromMove(result);
        return result;
      } catch {
        playIllegalMoveSound();
        return null;
      }
    },
    [copyGame, setGame]
  );

  const addMoves = useCallback(
    (moves: string[], expectedGame?: Chess) => {
      const newGame = copyGame();
      if (expectedGame && chessPathKey(newGame) !== chessPathKey(expectedGame))
        return;

      try {
        let lastMove: Move | null = null;
        for (const move of moves) lastMove = newGame.move(move);
        setGame(newGame);
        if (lastMove) playSoundFromMove(lastMove);
      } catch {
        // A stale/invalid engine line must not partly mutate the board or crash.
        playIllegalMoveSound();
      }
    },
    [copyGame, setGame]
  );

  const undoMove = useCallback(() => {
    const newGame = copyGame();
    const move = newGame.undo();
    if (move) playSoundFromMove(move);
    setGame(newGame);
  }, [copyGame, setGame]);

  const setComment = useCallback(
    (comment: string) => {
      const newGame = copyGame();
      newGame.setComment(comment);
      setGame(newGame);
    },
    [copyGame, setGame]
  );

  const goToMove = useCallback(
    (moveIdx: number, fullGame: Chess) => {
      const movesNb = fullGame.history().length;
      if (!Number.isInteger(moveIdx) || moveIdx < 0 || moveIdx > movesNb)
        return;
      const newGame = replayChess(fullGame, moveIdx);
      setGame(newGame);
      const audibleMove =
        newGame.history({ verbose: true }).at(-1) ??
        fullGame.history({ verbose: true })[0];
      if (audibleMove) playSoundFromMove(audibleMove);
    },
    [setGame]
  );

  return {
    setPgn,
    reset,
    playMove,
    undoMove,
    goToMove,
    resetToStartingPosition,
    addMoves,
    setComment,
  };
};
