import { MoveSide, TopMove, getFenForSide, linesToTopMoves } from "@/lib/engine/topMoves";
import { UciEngine } from "@/lib/engine/uciEngine";
import { useCallback, useRef, useState } from "react";

export interface TopMovesState {
  status: "idle" | "loading" | "done" | "error";
  moves: TopMove[];
  queryFen?: string;
  message?: string;
}

interface Options {
  engine: UciEngine | null;
  depth?: number;
  count?: number;
}

export const useTopMoves = ({ engine, depth = 14, count = 3 }: Options) => {
  const [state, setState] = useState<TopMovesState>({
    status: "idle",
    moves: [],
  });
  const requestId = useRef(0);

  const clear = useCallback(() => {
    requestId.current++;
    setState({ status: "idle", moves: [] });
  }, []);

  const request = useCallback(
    async (fen: string, side: MoveSide) => {
      const id = ++requestId.current;

      const sideFen = getFenForSide(fen, side);
      if ("error" in sideFen) {
        setState({ status: "error", moves: [], message: sideFen.error });
        return;
      }

      setState({ status: "loading", moves: [], queryFen: sideFen.fen });
      if (!engine?.getIsReady()) return;

      try {
        const result = await engine.evaluatePositionWithUpdate({
          fen: sideFen.fen,
          depth,
          multiPv: Math.max(2, count),
          useCloudEval: false,
          setPartialEval: (partial) => {
            if (requestId.current !== id) return;

            setState({
              status: "loading",
              moves: linesToTopMoves(sideFen.fen, partial.lines, count),
              queryFen: sideFen.fen,
            });
          },
        });
        if (requestId.current !== id) return;

        setState({
          status: "done",
          moves: linesToTopMoves(sideFen.fen, result.lines, count),
          queryFen: sideFen.fen,
        });
      } catch (error) {
        if (requestId.current !== id) return;

        console.error(error);
        setState({
          status: "error",
          moves: [],
          message: "The engine could not evaluate this position.",
        });
      }
    },
    [engine, depth, count]
  );

  return { ...state, request, clear };
};
