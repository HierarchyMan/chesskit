import { Icon } from "@iconify/react";
import {
  engineDepthAtom,
  engineMultiPvAtom,
  engineNameAtom,
  engineWorkersNbAtom,
  evaluationProgressAtom,
  gameAtom,
  gameEvalAtom,
  savedEvalsAtom,
} from "../states";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { getEvaluateGameParams, getGameSignature } from "@/lib/chess";
import {
  analysisSessionAtom,
  analysisSourceErrorAtom,
  analysisFullRequestAtom,
  analysisTargetKey,
} from "../sessionAtoms";
import { loadGameFromText } from "@/lib/pgn";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { Button, Tooltip } from "@mui/material";
import { logAnalyticsEvent } from "@/lib/firebase";
import { SavedEvals } from "@/types/eval";
import { useEffect, useCallback } from "react";
import { usePlayersData } from "@/hooks/usePlayersData";
import { useAnalysisEngine } from "../engineContext";

interface Props {
  label?: string;
  fullWidth?: boolean;
}

export default function AnalyzeButton({ label, fullWidth = false }: Props) {
  const store = useStore();
  const setError = useSetAtom(analysisSourceErrorAtom);
  const activeRequest = useAtomValue(analysisFullRequestAtom);
  const engineName = useAtomValue(engineNameAtom);
  const engineState = useAnalysisEngine();
  const engine = engineState.engine;
  const engineWorkersNb = useAtomValue(engineWorkersNbAtom);
  const [evaluationProgress, setEvaluationProgress] = useAtom(
    evaluationProgressAtom
  );
  const engineDepth = useAtomValue(engineDepthAtom);
  const engineMultiPv = useAtomValue(engineMultiPvAtom);
  const { setGameEval, gameFromUrl } = useGameDatabase();
  const [gameEval, setEval] = useAtom(gameEvalAtom);
  const game = useAtomValue(gameAtom);
  const setSavedEvals = useSetAtom(savedEvalsAtom);
  const { white, black } = usePlayersData(gameAtom);

  const hasMoves = game.history().length > 0;
  const engineReady = !!engine?.getIsReady();
  const readyToAnalyse = engineReady && hasMoves && !evaluationProgress;

  const handleAnalyze = useCallback(async () => {
    if (store.get(analysisFullRequestAtom)) return;
    if (!game.history().length) return;
    const params = getEvaluateGameParams(game);
    if (
      !engine?.getIsReady() ||
      params.fens.length === 0 ||
      evaluationProgress
    ) {
      return;
    }

    const sessionId = store.get(analysisSessionAtom)?.id;
    const signature = getGameSignature(game);
    const requestId = crypto.randomUUID();
    store.set(analysisFullRequestAtom, {
      id: requestId,
      target: analysisTargetKey(store.get(analysisSessionAtom), game),
      engine,
    });
    const isCurrentRequest = () =>
      store.get(analysisFullRequestAtom)?.id === requestId &&
      store.get(analysisSessionAtom)?.id === sessionId &&
      getGameSignature(store.get(gameAtom)) === signature &&
      store.get(engineNameAtom) === engineName;
    setError(null);
    try {
      const newGameEval = await engine.evaluateGame({
        ...params,
        depth: engineDepth,
        multiPv: engineMultiPv,
        setEvaluationProgress: (value) => {
          if (isCurrentRequest()) setEvaluationProgress(value);
        },
        playersRatings: {
          white: white?.rating,
          black: black?.rating,
        },
        workersNb: engineWorkersNb,
      });

      if (!isCurrentRequest()) return;
      setEval(newGameEval);
      setEvaluationProgress(0);

      if (
        gameFromUrl &&
        getGameSignature(loadGameFromText(gameFromUrl.pgn)) === signature
      ) {
        await setGameEval(gameFromUrl.id, newGameEval, gameFromUrl.pgn);
      }
      if (!isCurrentRequest()) return;

      const gameSavedEvals: SavedEvals = params.fens.reduce((acc, fen, idx) => {
        acc[fen] = { ...newGameEval.positions[idx], engine: engineName };
        return acc;
      }, {} as SavedEvals);
      setSavedEvals((prev) => ({
        ...prev,
        ...gameSavedEvals,
      }));

      logAnalyticsEvent("analyze_game", {
        engine: engineName,
        depth: engineDepth,
        multiPv: engineMultiPv,
        nbPositions: params.fens.length,
      });
    } catch (error) {
      if (isCurrentRequest())
        setError(
          error instanceof Error ? error.message : "Game analysis failed."
        );
    } finally {
      if (store.get(analysisFullRequestAtom)?.id === requestId) {
        store.set(analysisFullRequestAtom, null);
        setEvaluationProgress(0);
      }
    }
  }, [
    engine,
    engineName,
    engineWorkersNb,
    game,
    engineDepth,
    engineMultiPv,
    evaluationProgress,
    setEvaluationProgress,
    setEval,
    gameFromUrl,
    setGameEval,
    setSavedEvals,
    white.rating,
    black.rating,
    store,
    setError,
  ]);

  useEffect(() => {
    setEvaluationProgress(0);
  }, [engine, setEvaluationProgress]);

  const isDisabled = !activeRequest && !readyToAnalyse;
  const tooltip = activeRequest
    ? "Stop full game analysis"
    : !hasMoves
      ? "Play or load moves to analyze"
      : !engineReady
        ? "Waiting for engine to start…"
        : gameEval
          ? "Re-run full game analysis"
          : "Run full game analysis";

  const idleLabel = label ?? (gameEval ? "Re-analyze" : "Analyze");

  return (
    <Tooltip title={tooltip} disableInteractive>
      <span style={{ display: fullWidth ? "block" : "inline-flex" }}>
        <Button
          fullWidth={fullWidth}
          variant={activeRequest ? "outlined" : "contained"}
          color={activeRequest ? "error" : "primary"}
          size="small"
          startIcon={
            <Icon
              icon={activeRequest ? "mdi:stop" : "mdi:chart-line"}
              height={16}
            />
          }
          onClick={() => {
            if (activeRequest) {
              store.set(analysisFullRequestAtom, null);
              setEvaluationProgress(0);
              engineState.retry();
            } else void handleAnalyze();
          }}
          disabled={isDisabled}
          sx={{
            minHeight: 32,
            px: 1.25,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {activeRequest
            ? `Stop${evaluationProgress ? ` (${Math.round(evaluationProgress)}%)` : ""}`
            : idleLabel}
        </Button>
      </span>
    </Tooltip>
  );
}
