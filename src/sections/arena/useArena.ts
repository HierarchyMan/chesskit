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
  arenaEditingPlayersAtom,
  arenaGameAtom,
  arenaRunningAtom,
  arenaSpeedAtom,
  arenaStartFenAtom,
  arenaStartedAtom,
  arenaVarietyAtom,
  arenaWhiteAtom,
} from "./states";
import { playerChangeEffect, playerChangeNote } from "./playerChanges";
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
  const [white, setWhiteSide] = useAtom(arenaWhiteAtom);
  const [black, setBlackSide] = useAtom(arenaBlackAtom);
  const [started, setStarted] = useAtom(arenaStartedAtom);
  const [running, setRunning] = useAtom(arenaRunningAtom);
  const [startFen, setStartFen] = useAtom(arenaStartFenAtom);
  const setEditingPlayers = useSetAtom(arenaEditingPlayersAtom);
  const speed = useAtomValue(arenaSpeedAtom);
  const variety = useAtomValue(arenaVarietyAtom);
  const { playMove, undoMove, reset, setComment } =
    useChessActions(arenaGameAtom);
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

  // A player change must never restart the match. Before the first move the
  // game is rebuilt so its headers name the new players; after it, the change
  // is noted on the current position. See playerChangeEffect.
  const notePlayerChange = (nextWhite: ArenaSide, nextBlack: ArenaSide) => {
    const effect = playerChangeEffect({
      started,
      over: game.isGameOver(),
      moveCount: game.history().length,
    });

    // With no moves, the current position is the match's own start. The
    // startFen atom may already point elsewhere, for example after a handoff.
    if (effect === "rebuild-start") {
      reset({
        fen: game.fen(),
        white: { name: sideLabel(nextWhite) },
        black: { name: sideLabel(nextBlack) },
      });
    } else if (effect === "note-position") {
      setComment(playerChangeNote(sideLabel(nextWhite), sideLabel(nextBlack)));
    }
  };

  const setWhite = (side: ArenaSide) => {
    setWhiteSide(side);
    notePlayerChange(side, black);
  };

  const setBlack = (side: ArenaSide) => {
    setBlackSide(side);
    notePlayerChange(white, side);
  };

  const beginMatch = useCallback(
    (matchWhite: ArenaSide, matchBlack: ArenaSide, fen: string | undefined) => {
      reset({
        fen,
        white: { name: sideLabel(matchWhite) },
        black: { name: sideLabel(matchBlack) },
      });
      setStartFen(fen);
      setRunning(false);
      setStarted(true);
    },
    [reset, setStartFen, setRunning, setStarted]
  );

  const start = useCallback(
    (fromFen?: string) => beginMatch(white, black, fromFen ?? startFen),
    [beginMatch, white, black, startFen]
  );

  const stop = useCallback(() => {
    setRunning(false);
    setStarted(false);
    setEditingPlayers(false);
    reset({ fen: startFen, noHeaders: true });
  }, [startFen, reset, setRunning, setStarted, setEditingPlayers]);

  const takeBack = useCallback(() => {
    setRunning(false);
    undoMove();
  }, [setRunning, undoMove]);

  const swapSides = () => {
    setWhiteSide(black);
    setBlackSide(white);
    notePlayerChange(black, white);
  };

  // Passes the swapped players directly. Calling swapSides then start would
  // name the players from this render's closure, before the swap.
  const rematch = useCallback(() => {
    setWhiteSide(black);
    setBlackSide(white);
    beginMatch(black, white, startFen);
  }, [black, white, startFen, beginMatch, setWhiteSide, setBlackSide]);

  const result = useMemo(() => getGameResult(game, null), [game]);

  // The game already carries the headers written when its match began, so a
  // later player change does not rename the saved game.
  const finishedGame = useCallback((): Chess => {
    const copy = new Chess();
    copy.loadPgn(game.pgn());
    setGameHeaders(copy, {
      ended: result.over
        ? { result: result.result, termination: result.reason }
        : undefined,
    });
    return copy;
  }, [game, result]);

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
    rematch,
    finishedGame,
    startFen,
    setStartFen,
  };
};

export type Arena = ReturnType<typeof useArena>;
