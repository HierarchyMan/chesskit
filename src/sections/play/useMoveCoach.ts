import { useEngineState } from "@/hooks/useEngine";
import { getIsStalemate, getWhoIsCheckmated } from "@/lib/chess";
import { getMovesClassification } from "@/lib/engine/helpers/moveClassification";
import { UciEngine } from "@/lib/engine/uciEngine";
import { MoveStory, buildMoveStory } from "@/lib/visualize/moveStory";
import { useFeatureEngineName } from "@/hooks/useFeatureEngineName";
import { Color, MoveClassification } from "@/types/enums";
import { PositionEval } from "@/types/eval";
import { Move } from "chess.js";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { gameAtom, playerColorAtom } from "./states";

const COACH_DEPTH = 12;
const COACH_LINES = 3;

export interface CoachFeedback {
  key: string;
  plyIndex: number;
  status: "evaluating" | "done" | "error";
  playedSan: string;
  /** The move that was graded, and the evaluation of the position it was made in. */
  move: Move;
  before?: PositionEval;
  classification?: MoveClassification;
  story?: MoveStory;
}

/** The coach's verdict on the player's latest move, for the board to draw. */
export const coachFeedbackAtom = atom<CoachFeedback | undefined>(undefined);

const evaluate = async (
  engine: UciEngine,
  fen: string,
  cache: Map<string, PositionEval>
): Promise<PositionEval> => {
  const cached = cache.get(fen);
  if (cached) return cached;

  const mated = getWhoIsCheckmated(fen);
  let result: PositionEval;

  if (mated) {
    result = {
      lines: [{ pv: [], depth: 0, multiPv: 1, mate: mated === "w" ? -1 : 1 }],
    };
  } else if (getIsStalemate(fen)) {
    result = { lines: [{ pv: [], depth: 0, multiPv: 1, cp: 0 }] };
  } else {
    result = await engine.evaluatePositionWithUpdate({
      fen,
      depth: COACH_DEPTH,
      multiPv: COACH_LINES,
      useCloudEval: false,
    });
  }

  cache.set(fen, result);
  return result;
};

export const useMoveCoach = (enabled: boolean) => {
  const game = useAtomValue(gameAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const engineName = useFeatureEngineName("coach");
  const engineState = useEngineState(enabled ? engineName : undefined);
  const [feedbackByKey, setFeedbackByKey] = useState<
    Record<string, CoachFeedback>
  >({});
  const cacheRef = useRef(new Map<string, PositionEval>());
  const startedRef = useRef(new Set<string>());
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const history = useMemo(() => game.history({ verbose: true }), [game]);

  const lastPlayerIndex = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].color === (playerColor === Color.White ? "w" : "b"))
        return i;
    }
    return -1;
  }, [history, playerColor]);

  const lastPlayerMove: Move | undefined =
    lastPlayerIndex >= 0 ? history[lastPlayerIndex] : undefined;
  const key = lastPlayerMove
    ? `${lastPlayerIndex}:${lastPlayerMove.after}`
    : undefined;
  const engine = engineState.engine;

  useEffect(() => {
    if (!enabled || !engine || !lastPlayerMove || !key) return;
    if (startedRef.current.has(key)) return;
    startedRef.current.add(key);

    const move = lastPlayerMove;
    const plyIndex = lastPlayerIndex;
    const update = (feedback: CoachFeedback) =>
      setFeedbackByKey((current) => ({ ...current, [feedback.key]: feedback }));

    update({ key, plyIndex, status: "evaluating", playedSan: move.san, move });

    queueRef.current = queueRef.current.then(async () => {
      try {
        const before = await evaluate(engine, move.before, cacheRef.current);
        const after = await evaluate(engine, move.after, cacheRef.current);

        const uci = move.from + move.to + (move.promotion ?? "");
        const classification = getMovesClassification(
          [before, after],
          [uci],
          [move.before, move.after]
        )[1].moveClassification;

        update({
          key,
          plyIndex,
          status: "done",
          playedSan: move.san,
          move,
          before,
          classification,
          story: buildMoveStory({
            fenBefore: move.before,
            playedUci: uci,
            beforeLines: before.lines,
            afterLines: after.lines,
          }),
        });
      } catch (error) {
        console.error(error);
        startedRef.current.delete(key);
        update({ key, plyIndex, status: "error", playedSan: move.san, move });
      }
    });
  }, [enabled, engine, lastPlayerMove, lastPlayerIndex, key]);

  const feedback = key ? feedbackByKey[key] : undefined;

  const publish = useSetAtom(coachFeedbackAtom);
  useEffect(() => {
    publish(feedback);
    return () => publish(undefined);
  }, [feedback, publish]);

  return {
    feedback,
    engineState,
    playerMoveIndex: lastPlayerIndex,
  };
};
