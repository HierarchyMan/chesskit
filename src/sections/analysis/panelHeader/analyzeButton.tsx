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
import { LoadingButton } from "@mui/lab";
import { logAnalyticsEvent } from "@/lib/firebase";
import { SavedEvals } from "@/types/eval";
import { useEffect, useCallback } from "react";
import { usePlayersData } from "@/hooks/usePlayersData";
import { useAnalysisEngine } from "../engineContext";

export default function AnalyzeButton() {
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

  const readyToAnalyse =
    engine?.getIsReady() && game.history().length > 0 && !evaluationProgress;

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

  // Live position analysis is automatic; a full-line analysis is explicit so
  // exploring a new continuation does not restart a game-wide search each move.

  return (
    <LoadingButton
      variant="contained"
      size="small"
      startIcon={
        <Icon
          icon={
            activeRequest ? "mdi:stop" : "streamline:magnifying-glass-solid"
          }
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
      disabled={!activeRequest && !readyToAnalyse}
      sx={{ minHeight: 36, borderRadius: "6px", whiteSpace: "nowrap" }}
    >
      {activeRequest
        ? `Stop${evaluationProgress ? ` (${Math.round(evaluationProgress)}%)` : " analysis"}`
        : gameEval
          ? "Analyze again"
          : "Analyze line"}
    </LoadingButton>
  );
}
