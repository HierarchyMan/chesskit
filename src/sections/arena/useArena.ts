import { LastMoveCue } from "@/components/board/cues";
import { engineLabel } from "@/constants";
import { useChessActions } from "@/hooks/useChessActions";
import { EngineState, useEngineState } from "@/hooks/useEngine";
import { setGameHeaders, uciMoveParams } from "@/lib/chess";
import { replayChess } from "@/lib/chessHistory";
import { BotChoice, getBotChoice } from "@/lib/engine/botChoice";
import { effectiveStrength } from "@/lib/engine/botMove";
import { BotStrength } from "@/lib/engine/strength";
import { getGameResult } from "@/lib/gameResult";
import { playSoundFromMove } from "@/lib/sounds";
import { Chess, Square } from "chess.js";
import { setupPosition } from "@/lib/setupPosition";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { fullStrengthMsAtom } from "@/lib/engine/engineSettings";
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
  const name = engineLabel(side.engine).small;
  const strength = effectiveStrength(side.engine, side.strength);

  if (!strength) return name;
  if (strength.mode === "elo") return `${name} (${strength.elo})`;
  if (strength.mode === "depth") return `${name} (depth ${strength.depth})`;
  return name;
};

export const useArena = () => {
  const store = useStore();
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

  const whiteEngine = useEngineState(white.engine, "Arena: White");
  const blackEngine = useEngineState(black.engine, "Arena: Black");
  const [proposal, setProposal] = useState<Proposal>({ status: "idle" });
  const [matchId, setMatchId] = useState(1);
  const [reviewPly, setReviewPly] = useState<number | null>(null);

  const fen = game.fen();
  const turn = game.turn();
  const isOver = game.isGameOver();
  const history = game.history({ verbose: true });
  const totalPlies = history.length;
  const mover = turn === "w" ? white : black;
  const moverState: EngineState = turn === "w" ? whiteEngine : blackEngine;
  const moverEngine = moverState.engine;

  const varietyRef = useRef(variety);
  const strengthRef = useRef<BotStrength>(mover.strength);
  useEffect(() => {
    varietyRef.current = variety;
    strengthRef.current = mover.strength;
  });

  // Clamp reviewPly if moves were undone or reset.
  const clampedReviewPly =
    reviewPly !== null && reviewPly < totalPlies
      ? Math.max(0, reviewPly)
      : null;
  const isReviewing = clampedReviewPly !== null;
  const displayPly = clampedReviewPly ?? totalPlies;

  const reviewState = useMemo(() => {
    if (clampedReviewPly === null) return null;
    const snapshot = replayChess(game, clampedReviewPly);
    const last = snapshot.history({ verbose: true }).at(-1);
    const lastMove: LastMoveCue | undefined = last
      ? { from: last.from as Square, to: last.to as Square }
      : undefined;
    const evalForPly =
      clampedReviewPly === 0
        ? analysis.moves[0]?.before
        : analysis.moves[clampedReviewPly - 1]?.after;
    return {
      fen: snapshot.fen(),
      lastMove,
      position: {
        eval: evalForPly,
        lastMove: last,
        currentMoveIdx: clampedReviewPly,
      },
    };
  }, [clampedReviewPly, game, analysis.moves]);

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
      fullStrengthMs: store.get(fullStrengthMsAtom),
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
    store,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setData(reviewState ? reviewState.position : analysis.position);
  }, [analysis.position, reviewState, setData]);

  const goToPly = useCallback(
    (ply: number | null) => {
      if (ply === null || ply >= totalPlies) {
        setReviewPly(null);
        return;
      }
      const target = Math.max(0, ply);
      setRunning(false);
      setReviewPly(target);
      if (target > 0) {
        const move = history[target - 1];
        if (move) playSoundFromMove(move);
      }
    },
    [history, setRunning, totalPlies]
  );

  const stepReview = useCallback(
    (delta: number) => {
      const target = displayPly + delta;
      if (target >= totalPlies) {
        setReviewPly(null);
        return;
      }
      goToPly(Math.max(0, target));
    },
    [displayPly, goToPly, totalPlies]
  );

  const acceptProposal = useCallback(() => {
    if (proposal.status !== "ready" || proposal.fen !== fen) return;
    setReviewPly(null);
    playMove(uciMoveParams(proposal.choice.uci), game);
  }, [proposal, fen, playMove, game]);

  const playCandidate = useCallback(
    (uci: string) => {
      setRunning(false);
      setReviewPly(null);
      return playMove(uciMoveParams(uci), game);
    },
    [playMove, game, setRunning]
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

  const notePlayerChange = (nextWhite: ArenaSide, nextBlack: ArenaSide) => {
    const effect = playerChangeEffect({
      started,
      over: game.isGameOver(),
      moveCount: game.history().length,
    });

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
      setReviewPly(null);
      setMatchId((id) => id + 1);
      setRunning(false);
      setStarted(true);
    },
    [reset, setStartFen, setRunning, setStarted]
  );

  const start = useCallback(
    (fromFen?: string) => {
      const position = setupPosition(fromFen ?? startFen);
      if (position.error) return;
      beginMatch(white, black, position.fen);
    },
    [beginMatch, white, black, startFen]
  );

  const stop = useCallback(() => {
    setRunning(false);
    setStarted(false);
    setReviewPly(null);
    setEditingPlayers(false);
    setMatchId((id) => id + 1);
    reset({ fen: setupPosition(startFen).fen, noHeaders: true });
  }, [startFen, reset, setRunning, setStarted, setEditingPlayers]);

  const takeBack = useCallback(() => {
    setRunning(false);
    setReviewPly(null);
    undoMove();
  }, [setRunning, undoMove]);

  const swapSides = () => {
    setWhiteSide(black);
    setBlackSide(white);
    notePlayerChange(black, white);
  };

  const rematch = useCallback(() => {
    setWhiteSide(black);
    setBlackSide(white);
    beginMatch(black, white, startFen);
  }, [black, white, startFen, beginMatch, setWhiteSide, setBlackSide]);

  const result = useMemo(() => getGameResult(game, null), [game]);

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
    matchId,
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
    isReviewing,
    displayPly,
    totalPlies,
    reviewFen: reviewState?.fen,
    reviewLastMove: reviewState?.lastMove,
    goToPly,
    stepReview,
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
