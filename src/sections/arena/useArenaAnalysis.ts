import { useEngineState } from "@/hooks/useEngine";
import { getBestMoveHint } from "@/lib/bestMoveHint";
import { moveLineUciToSan } from "@/lib/chess";
import {
  ARENA_ANALYSIS_DEPTH,
  ARENA_ANALYSIS_LINES,
  ArenaAnalysisSession,
  ArenaAnalysisUpdate,
  getArenaAccuracy,
  getArenaOpening,
  projectArenaAnalysis,
} from "@/lib/engine/arenaAnalysis";
import { engineNameAtom } from "@/sections/analysis/states";
import { UciEngine } from "@/lib/engine/uciEngine";
import { Chess } from "chess.js";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import { arenaAnalysisOptionAtoms } from "./states";

export function useArenaAnalysis(game: Chess, started: boolean) {
  const showEvaluation = useAtomValue(arenaAnalysisOptionAtoms.evaluation);
  const showAnnotations = useAtomValue(arenaAnalysisOptionAtoms.annotations);
  const showBestMove = useAtomValue(arenaAnalysisOptionAtoms.bestMove);
  const engineName = useAtomValue(engineNameAtom);
  const enabled =
    started && (showEvaluation || showAnnotations || showBestMove);
  const engineState = useEngineState(enabled ? engineName : undefined);
  const [update, setUpdate] = useState<
    ArenaAnalysisUpdate & { source?: UciEngine }
  >({
    evaluations: new Map(),
    busy: false,
  });
  const session = useRef<ArenaAnalysisSession | null>(null);
  const engine = engineState.engine;

  useEffect(() => {
    setUpdate({ evaluations: new Map(), busy: false });
    if (!engine || engine.name !== engineName || !enabled) return;

    const current = new ArenaAnalysisSession(
      (fen) =>
        engine.evaluatePositionWithUpdate({
          fen,
          depth: ARENA_ANALYSIS_DEPTH,
          multiPv: ARENA_ANALYSIS_LINES,
          useCloudEval: false,
        }),
      (value) => setUpdate({ ...value, source: engine })
    );
    session.current = current;
    return () => {
      current.dispose();
      session.current = null;
      // This instance belongs only to the evaluator, never either player.
      void engine.stopAllCurrentJobs();
    };
  }, [engine, engineName, enabled]);

  useEffect(() => {
    if (enabled) session.current?.update(game, showAnnotations, showBestMove);
  }, [game, enabled, engine, engineName, showAnnotations, showBestMove]);

  const hasCurrentSource =
    enabled && update.source === engine && engine?.name === engineName;

  const projection = useMemo(
    () =>
      projectArenaAnalysis(
        game,
        hasCurrentSource ? update.evaluations : new Map(),
        enabled && showAnnotations
      ),
    [game, update.evaluations, hasCurrentSource, enabled, showAnnotations]
  );

  const { moves, position } = projection;

  const accuracy = useMemo(() => getArenaAccuracy(moves), [moves]);
  const opening = useMemo(() => getArenaOpening(moves), [moves]);

  // Same rule as the board arrow, so the text never names a move the arrow hides.
  const betterMove = useMemo(() => {
    const uci = getBestMoveHint(position);
    if (!uci || !position.lastMove) return undefined;
    return moveLineUciToSan(position.lastMove.before)(uci);
  }, [position]);

  return {
    position,
    moves,
    accuracy,
    opening,
    betterMove,
    enabled,
    showEvaluation,
    showAnnotations,
    showBestMove,
    engineName,
    engineState,
    busy: hasCurrentSource && update.busy,
    error: enabled
      ? (engineState.error ?? (hasCurrentSource ? update.error : undefined))
      : undefined,
    retry: engineState.retry,
  };
}
