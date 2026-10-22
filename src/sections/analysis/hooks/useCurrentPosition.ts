import {
  boardAtom,
  currentPositionAtom,
  engineDepthAtom,
  engineMultiPvAtom,
  gameAtom,
  gameEvalAtom,
  savedEvalsAtom,
  useCloudEvalAtom,
} from "@/sections/analysis/states";
import { CurrentPosition, PositionEval } from "@/types/eval";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { getEvaluateGameParams } from "@/lib/chess";
import { getMovesClassification } from "@/lib/engine/helpers/moveClassification";
import { openingForPlacement } from "@/lib/openingIndex";
import { UciEngine } from "@/lib/engine/uciEngine";
import { isAnalysisPrefix } from "@/lib/analysisSession";
import { terminalEvaluation } from "@/lib/engine/terminalEvaluation";
import { analysisPositionErrorAtom } from "../sessionAtoms";

export const useCurrentPosition = (
  engine: UciEngine | null,
  enabled = true
) => {
  const [currentPosition, setCurrentPosition] = useAtom(currentPositionAtom);
  const gameEval = useAtomValue(gameEvalAtom);
  const game = useAtomValue(gameAtom);
  const board = useAtomValue(boardAtom);
  const depth = useAtomValue(engineDepthAtom);
  const multiPv = useAtomValue(engineMultiPvAtom);
  const [savedEvals, setSavedEvals] = useAtom(savedEvalsAtom);
  const useCloudEval = useAtomValue(useCloudEvalAtom);
  const setError = useSetAtom(analysisPositionErrorAtom);

  useEffect(() => {
    let isCurrent = true;
    setError(null);
    const boardHistory = board.history({ verbose: true });
    const position: CurrentPosition = {
      lastMove: boardHistory.at(-1),
    };

    const gameHistory = game.history();

    if (isAnalysisPrefix(board, game)) {
      position.currentMoveIdx = boardHistory.length;

      if (
        gameEval?.positions.length === gameHistory.length + 1 &&
        gameEval.positions[boardHistory.length]?.lines.length
      ) {
        const evalIndex = boardHistory.length;

        position.eval = {
          ...gameEval.positions[evalIndex],
          lines: gameEval.positions[evalIndex].lines.slice(0, multiPv),
        };
        position.lastEval =
          evalIndex > 0
            ? {
                ...gameEval.positions[evalIndex - 1],
                lines: gameEval.positions[evalIndex - 1].lines.slice(
                  0,
                  multiPv
                ),
              }
            : undefined;
      }
    }

    const terminal = terminalEvaluation(board, depth);
    if (terminal) position.eval = { ...position.eval, ...terminal };

    if (!position.eval?.opening) {
      for (const move of boardHistory.slice().reverse()) {
        const moveFen = move.after.split(" ")[0];
        const opening = openingForPlacement(moveFen);
        if (opening) {
          position.opening = opening.name;
          break;
        }
      }
    }

    setCurrentPosition(position);

    if (
      enabled &&
      (!position.eval ||
        (terminal && boardHistory.length > 0 && !position.lastEval)) &&
      engine?.getIsReady() &&
      engine.name
    ) {
      const getFenEngineEval = async (
        fen: string,
        setPartialEval?: (positionEval: PositionEval) => void
      ) => {
        if (!engine.getIsReady()) {
          throw new Error("Engine not ready");
        }
        const savedEval = savedEvals[fen];
        if (
          savedEval &&
          savedEval.engine === engine.name &&
          (savedEval.lines?.length ?? 0) >= multiPv &&
          (savedEval.lines[0].depth ?? 0) >= depth
        ) {
          const positionEval: PositionEval = {
            ...savedEval,
            lines: savedEval.lines.slice(0, multiPv),
          };
          setPartialEval?.(positionEval);
          return positionEval;
        }

        const rawPositionEval = await engine.evaluatePositionWithUpdate({
          fen,
          depth,
          multiPv,
          setPartialEval,
          useCloudEval,
        });

        if (!isCurrent || !engine.getIsReady()) return rawPositionEval;
        if (!rawPositionEval.lines.length)
          throw new Error("The analysis engine returned no evaluation.");
        setSavedEvals((prev) => ({
          ...prev,
          [fen]: { ...rawPositionEval, engine: engine.name },
        }));

        return rawPositionEval;
      };

      const getPositionEval = async () => {
        const setPartialEval = (positionEval: PositionEval) => {
          if (!isCurrent) return;
          setCurrentPosition({ ...position, eval: positionEval });
        };
        const rawPositionEval =
          terminal ?? (await getFenEngineEval(board.fen(), setPartialEval));

        if (!isCurrent || !engine.getIsReady()) return;
        if (boardHistory.length === 0) {
          setCurrentPosition({ ...position, eval: rawPositionEval });
          return;
        }

        const params = getEvaluateGameParams(board);
        const fens = params.fens.slice(board.turn() === "w" ? -3 : -4);
        const uciMoves = params.uciMoves.slice(board.turn() === "w" ? -2 : -3);

        if (!isCurrent) return;
        const lastRawEval = await getFenEngineEval(fens.slice(-2)[0]);
        const rawPositions: PositionEval[] = fens.map((_, idx) => {
          if (idx === fens.length - 2) return lastRawEval;
          if (idx === fens.length - 1) return rawPositionEval;
          return {
            lines: [
              {
                pv: [],
                depth: 0,
                multiPv: 1,
                cp: 1,
              },
            ],
          };
        });

        const positionsWithMoveClassification = getMovesClassification(
          rawPositions,
          uciMoves,
          fens
        );

        if (!isCurrent) return;
        setCurrentPosition({
          ...position,
          eval: positionsWithMoveClassification.slice(-1)[0],
          lastEval: positionsWithMoveClassification.slice(-2)[0],
        });
      };

      void getPositionEval().catch((error) => {
        if (isCurrent && engine.getIsReady()) {
          setError(
            error instanceof Error ? error.message : "Position analysis failed."
          );
          console.error("Position analysis failed", error);
        }
      });
    }

    return () => {
      isCurrent = false;
      if (engine?.getIsReady()) {
        void engine.stopAllCurrentJobs().catch((error) => console.error(error));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameEval, board, game, engine, depth, multiPv, useCloudEval, enabled]);

  return currentPosition;
};
