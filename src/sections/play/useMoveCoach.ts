import { useEngineState } from "@/hooks/useEngine";
import { useFeatureEngineName } from "@/hooks/useFeatureEngineName";
import {
  ArenaAnalysisSession,
  ArenaAnalysisUpdate,
} from "@/lib/engine/arenaAnalysis";
import { UciEngine } from "@/lib/engine/uciEngine";
import { projectPlayFeedback } from "@/lib/playFeedback";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { gameAtom, gameIdAtom, playerColorAtom } from "./states";

const COACH_DEPTH = 12;
const COACH_LINES = 3;

/** One evaluator owns board grades and coach feedback. It is separate from
 * bot/advice engines and survives bot replies without cancelling a grade.
 * A new game or engine retires the whole evaluation owner. */
export const useMoveCoach = (enabled: boolean) => {
  const game = useAtomValue(gameAtom);
  const gameId = useAtomValue(gameIdAtom);
  const player = useAtomValue(playerColorAtom);
  const engineName = useFeatureEngineName("coach");
  const engineState = useEngineState(enabled ? engineName : undefined);
  const engine = engineState.engine;
  const [update, setUpdate] = useState<
    ArenaAnalysisUpdate & { source?: UciEngine; gameId?: number }
  >({ evaluations: new Map(), busy: false });
  const session = useRef<ArenaAnalysisSession | null>(null);

  useEffect(() => {
    if (!enabled || !engine || engine.name !== engineName) return;
    const current = new ArenaAnalysisSession(
      (fen) =>
        engine.evaluatePositionWithUpdate({
          fen,
          depth: COACH_DEPTH,
          multiPv: COACH_LINES,
          useCloudEval: false,
        }),
      (value) => setUpdate({ ...value, source: engine, gameId })
    );
    session.current = current;
    return () => {
      current.dispose();
      session.current = null;
      void engine.stopAllCurrentJobs().catch(() => undefined);
    };
  }, [enabled, engine, engineName, gameId]);

  useEffect(() => {
    if (enabled) session.current?.update(game, true, true);
  }, [game, gameId, enabled, engine, engineName]);

  const ownsSnapshot =
    update.source === engine &&
    update.gameId === gameId &&
    engine?.name === engineName;
  const error = enabled
    ? (engineState.error ?? (ownsSnapshot ? update.error : undefined))
    : undefined;
  const projection = useMemo(
    () =>
      projectPlayFeedback({
        game,
        gameId,
        player,
        enabled,
        engine,
        snapshot:
          ownsSnapshot && update.source
            ? { ...update, source: update.source, gameId }
            : undefined,
        error,
      }),
    [game, gameId, player, enabled, engine, ownsSnapshot, update, error]
  );

  return { ...projection, engineState, error };
};
