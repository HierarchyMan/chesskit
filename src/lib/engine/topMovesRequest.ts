import { PositionEval } from "@/types/eval";
import { MoveSide, TopMove, getFenForSide, linesToTopMoves } from "./topMoves";
import type { UciEngine } from "./uciEngine";

export interface TopMovesState {
  status: "idle" | "loading" | "done" | "error";
  moves: TopMove[];
  queryFen?: string;
  message?: string;
}

export interface TopMovesRequest {
  engine: Pick<UciEngine, "getIsReady" | "evaluatePositionWithUpdate"> | null;
  fen: string;
  side: MoveSide;
  positionKey?: string;
  depth: number;
  count: number;
}

export interface TopMovesSnapshot extends TopMovesState {
  request: TopMovesRequest;
}

const PENDING: TopMovesState = { status: "loading", moves: [] };

/** A changed context hides the previous result in the very first render. */
export const topMovesFor = (
  snapshot: TopMovesSnapshot | undefined,
  request: TopMovesRequest
): TopMovesState => (snapshot?.request === request ? snapshot : PENDING);

/** Every partial, final and error belongs to one live request context. */
export const requestTopMoves = async (
  request: TopMovesRequest,
  publish: (snapshot: TopMovesSnapshot) => void,
  isCurrent: () => boolean
): Promise<void> => {
  const { engine, fen, side, depth, count } = request;
  const update = (state: TopMovesState) => {
    if (isCurrent()) publish({ ...state, request });
  };
  const sideFen = getFenForSide(fen, side);
  if ("error" in sideFen) {
    update({ status: "error", moves: [], message: sideFen.error });
    return;
  }

  update({ status: "loading", moves: [], queryFen: sideFen.fen });
  if (!isCurrent() || !engine?.getIsReady()) return;

  const show = (status: "loading" | "done", result: PositionEval) =>
    update({
      status,
      moves: linesToTopMoves(sideFen.fen, result.lines, count),
      queryFen: sideFen.fen,
    });
  try {
    const result = await engine.evaluatePositionWithUpdate({
      fen: sideFen.fen,
      depth,
      multiPv: Math.max(2, count),
      useCloudEval: false,
      setPartialEval: (partial) => show("loading", partial),
    });
    show("done", result);
  } catch {
    update({
      status: "error",
      moves: [],
      message: "The engine could not evaluate this position.",
    });
  }
};
