import { fenToPgn, loadGameFromText } from "@/lib/pgn";
import { GameEval } from "@/types/eval";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";
import { loadAnalysisGameAtom } from "../sessionAtoms";
import { useRouter } from "next/router";
import { boardAtom, boardOrientationAtom, arrangeModeAtom } from "../states";

export const useLoadAnalysisGame = () => {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const board = useAtomValue(boardAtom);
  const orientation = useAtomValue(boardOrientationAtom);
  const load = useSetAtom(loadAnalysisGameAtom);
  const setArrange = useSetAtom(arrangeModeAtom);
  const setBoardOrientation = useSetAtom(boardOrientationAtom);

  const commitPgn = useCallback(
    (
      pgn: string,
      newOrientation?: boolean,
      gameEval?: GameEval,
      sourceGameId?: number
    ) => {
      const gameFromPgn = loadGameFromText(pgn);
      load({
        game: gameFromPgn,
        pgn,
        orientation: newOrientation,
        evaluation: gameEval,
        sourceGameId,
      });
      setBoardOrientation(newOrientation ?? true);
      setArrange(false);
    },
    [load, setBoardOrientation, setArrange]
  );

  const loadPgn = useCallback(
    (...params: Parameters<typeof commitPgn>) => {
      commitPgn(...params);
      const currentRouter = routerRef.current;
      if (Object.keys(currentRouter.query).length)
        void currentRouter.replace(
          { pathname: currentRouter.pathname, query: {} },
          undefined,
          { shallow: true, scroll: false }
        );
    },
    [commitPgn]
  );

  const loadFen = useCallback(
    (fen: string, goToAnalysis = false) => {
      commitPgn(fenToPgn(fen), orientation);
      const pathname = goToAnalysis ? "/analysis" : router.pathname;
      if (pathname !== router.pathname || Object.keys(router.query).length)
        void router.replace({ pathname, query: {} }, undefined, {
          shallow: pathname === router.pathname,
          scroll: false,
        });
    },
    [commitPgn, orientation, router]
  );

  const clearMoves = useCallback(() => loadFen(board.fen()), [loadFen, board]);

  return { loadPgn, loadFen, clearMoves };
};
