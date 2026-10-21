import { ENGINE_LABELS } from "@/constants";
import { useChessActions } from "@/hooks/useChessActions";
import { EngineState, useEngineState } from "@/hooks/useEngine";
import { setGameHeaders, uciMoveParams } from "@/lib/chess";
import { BotChoice, getBotChoice } from "@/lib/engine/botChoice";
import { BotStrength } from "@/lib/engine/strength";
import { getGameResult } from "@/lib/gameResult";
import { Chess } from "chess.js";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArenaSide,
  arenaBlackAtom,
  arenaDataAtom,
  arenaGameAtom,
  arenaRunningAtom,
  arenaSpeedAtom,
  arenaStartFenAtom,
  arenaStartedAtom,
  arenaVarietyAtom,
  arenaWhiteAtom,
} from "./states";
import { useArenaAnalysis } from "./useArenaAnalysis";

export type Proposal =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | { status: "thinking"; fen: string }
  | { status: "ready"; fen: string; choice: BotChoice }
  | { status: "error"; message: string };

export const sideLabel = (side: ArenaSide): string => {
  const name = ENGINE_LABELS[side.engine].small;
  const { strength } = side;

  if (strength.mode === "elo") return `${name} (${strength.elo})`;
  if (strength.mode === "depth") return `${name} (depth ${strength.depth})`;
  return name;
};

export const useArena = () => {
  const game = useAtomValue(arenaGameAtom);
  const setData = useSetAtom(arenaDataAtom);
  const [white, setWhite] = useAtom(arenaWhiteAtom);
  const [black, setBlack] = useAtom(arenaBlackAtom);
  const [started, setStarted] = useAtom(arenaStartedAtom);
  const [running, setRunning] = useAtom(arenaRunningAtom);
  const [startFen, setStartFen] = useAtom(arenaStartFenAtom);
  const speed = useAtomValue(arenaSpeedAtom);
  const variety = useAtomValue(arenaVarietyAtom);
  const { playMove, undoMove, reset } = useChessActions(arenaGameAtom);
  const analysis = useArenaAnalysis(game, started);

  const whiteEngine = useEngineState(white.engine);
  const blackEngine = useEngineState(black.engine);
  const [proposal, setProposal] = useState<Proposal>({ status: "idle" });

  const fen = game.fen();
  const turn = game.turn();
  const isOver = game.isGameOver();
  const mover = turn === "w" ? white : black;
  const moverState: EngineState = turn === "w" ? whiteEngine : blackEngine;
  const moverEngine = moverState.engine;

  const varietyRef = useRef(variety);
  const strengthRef = useRef<BotStrength>(mover.strength);
  useEffect(() => {
    varietyRef.current = variety;
    strengthRef.current = mover.strength;
  });

  const strengthKey = JSON.stringify(mover.strength);

  useEffect(() => {
    if (!started || isOver) {
      setProposal({ status: "idle" });
      return;
    }

    if (moverState.status === "error") {
      setProposal({
        status: "error",
        message: moverState.error ?? "The engine did not start.",
      });
      return;
    }

    if (!moverEngine) {
      setProposal({ status: "loading", message: "Loading the engine…" });
      return;
    }

    let cancelled = false;
    setProposal({ status: "thinking", fen });

    getBotChoice(moverEngine, fen, strengthRef.current, {
      candidateCount: 4,
      variety: varietyRef.current,
    })
      .then((choice) => {
        if (cancelled) return;
        setProposal(
          choice
            ? { status: "ready", fen, choice }
            : { status: "error", message: "No legal move was found." }
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setProposal({ status: "error", message: "The engine failed to move." });
      });

    return () => {
      cancelled = true;
      moverEngine.stopAllCurrentJobs();
    };
  }, [
    fen,
    started,
    isOver,
    moverEngine,
    moverState.status,
    moverState.error,
    strengthKey,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setData(analysis.position);
  }, [analysis.position, setData]);

  const acceptProposal = useCallback(() => {
    if (proposal.status !== "ready" || proposal.fen !== fen) return;
    playMove(uciMoveParams(proposal.choice.uci));
  }, [proposal, fen, playMove]);

  const playCandidate = useCallback(
    (uci: string) => playMove(uciMoveParams(uci)),
    [playMove]
  );

  const acceptRef = useRef(acceptProposal);
  useEffect(() => {
    acceptRef.current = acceptProposal;
  });

  useEffect(() => {
    if (!running) return;

    if (isOver) {
      setRunning(false);
      return;
    }

    if (proposal.status !== "ready" || proposal.fen !== fen) return;

    const timer = setTimeout(() => acceptRef.current(), speed);
    return () => clearTimeout(timer);
  }, [running, isOver, proposal, fen, speed, setRunning]);

  const start = useCallback(
    (fromFen?: string) => {
      const fenToUse = fromFen ?? startFen;
      reset({
        fen: fenToUse,
        white: { name: sideLabel(white) },
        black: { name: sideLabel(black) },
      });
      setStartFen(fenToUse);
      setRunning(false);
      setStarted(true);
    },
    [startFen, white, black, reset, setStartFen, setRunning, setStarted]
  );

  const stop = useCallback(() => {
    setRunning(false);
    setStarted(false);
    reset({ fen: startFen, noHeaders: true });
  }, [startFen, reset, setRunning, setStarted]);

  const takeBack = useCallback(() => {
    setRunning(false);
    undoMove();
  }, [setRunning, undoMove]);

  const swapSides = useCallback(() => {
    const currentWhite = white;
    setWhite(black);
    setBlack(currentWhite);
  }, [white, black, setWhite, setBlack]);

  const result = useMemo(() => getGameResult(game, null), [game]);

  const finishedGame = useCallback((): Chess => {
    const copy = new Chess();
    copy.loadPgn(game.pgn());
    setGameHeaders(copy, {
      white: { name: sideLabel(white) },
      black: { name: sideLabel(black) },
      ended: result.over
        ? { result: result.result, termination: result.reason }
        : undefined,
    });
    return copy;
  }, [game, white, black, result]);

  return {
    game,
    analysis,
    white,
    black,
    setWhite,
    setBlack,
    whiteEngine,
    blackEngine,
    started,
    running,
    setRunning,
    proposal,
    mover,
    moverState,
    turn,
    isOver,
    result,
    acceptProposal,
    playCandidate,
    start,
    stop,
    takeBack,
    swapSides,
    finishedGame,
    startFen,
    setStartFen,
  };
};

export type Arena = ReturnType<typeof useArena>;
