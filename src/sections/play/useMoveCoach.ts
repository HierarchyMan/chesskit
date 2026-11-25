import { useEffectiveCoachGrading } from "@/hooks/useEffectiveEngineSettings";
import { useEngineState } from "@/hooks/useEngine";
import { engineFeatureLabel } from "@/lib/engine/featureEngines";
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

/** One evaluator owns board grades and coach feedback. It is separate from
 * bot/advice engines and survives bot replies without cancelling a grade.
 * A new game or engine retires the whole evaluation owner. */
export const useMoveCoach = (enabled: boolean, visible = true) => {
  const game = useAtomValue(gameAtom);
  const gameId = useAtomValue(gameIdAtom);
  const player = useAtomValue(playerColorAtom);
  const engineName = useFeatureEngineName("coach");
  const { depth, multiPv } = useEffectiveCoachGrading();
  const engineState = useEngineState(
    enabled ? engineName : undefined,
    engineFeatureLabel("coach")
  );
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
          depth,
          multiPv,
          useCloudEval: false,
        }),
      (value) =>
        setUpdate((prev) => {
          const sameContext = prev.source === engine && prev.gameId === gameId;
          const merged = sameContext
            ? new Map([...prev.evaluations, ...value.evaluations])
            : value.evaluations;
          return { ...value, evaluations: merged, source: engine, gameId };
        })
    );
    session.current = current;
    return () => {
      current.dispose();
      session.current = null;
      void engine.stopAllCurrentJobs().catch(() => undefined);
    };
  }, [enabled, engine, engineName, gameId, depth, multiPv]);

  useEffect(() => {
    if (!enabled) return;
    if (visible) session.current?.update(game, true, true);
    else session.current?.pause();
  }, [game, gameId, enabled, visible, engine, engineName, depth, multiPv]);

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
