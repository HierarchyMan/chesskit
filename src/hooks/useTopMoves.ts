import { MoveSide } from "@/lib/engine/topMoves";
import {
  TopMovesRequest,
  TopMovesSnapshot,
  requestTopMoves,
  topMovesFor,
} from "@/lib/engine/topMovesRequest";
import { UciEngine } from "@/lib/engine/uciEngine";
import { useEffect, useMemo, useRef, useState } from "react";

interface Options {
  engine: UciEngine | null;
  fen: string;
  side: MoveSide;
  positionKey?: string;
  depth?: number;
  count?: number;
}

export const useTopMoves = ({
  engine,
  fen,
  side,
  positionKey,
  depth = 14,
  count = 3,
}: Options) => {
  const request = useMemo<TopMovesRequest>(
    () => ({ engine, fen, side, positionKey, depth, count }),
    [engine, fen, side, positionKey, depth, count]
  );
  const latestRequest = useRef(request);
  latestRequest.current = request;
  const [snapshot, setSnapshot] = useState<TopMovesSnapshot>();

  useEffect(() => {
    let active = true;
    void requestTopMoves(
      request,
      setSnapshot,
      () => active && latestRequest.current === request
    );
    return () => {
      active = false;
      // This engine belongs to this panel; do not keep a hidden search alive.
      void engine?.stopAllCurrentJobs().catch(() => undefined);
    };
  }, [request, engine]);

  return topMovesFor(snapshot, request);
};
