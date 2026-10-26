import { LastMoveCue, VerdictCue } from "@/components/board/cues";
import { useChessActions } from "@/hooks/useChessActions";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { useMistakes } from "@/hooks/useMistakes";
import { useMotionScale } from "@/hooks/useMotionScale";
import { uciMoveParams } from "@/lib/chess";
import {
  ReplayAction,
  navigateChess,
  replayChess,
  replayState,
} from "@/lib/chessHistory";
import { pickOfflinePuzzle } from "@/lib/offlinePuzzles";
import { PUZZLE_PACE, lineFromGame, pacedMs } from "@/lib/puzzleFlow";
import { buildHints } from "@/lib/puzzleHints";
import {
  Puzzle,
  evaluatePuzzleStep,
  fetchDailyPuzzle,
  fetchLichessPuzzle,
  mistakeToPuzzle,
  puzzleSetup,
  solverColor,
} from "@/lib/puzzles";
import { playIllegalMoveSound, playSoundFromMove } from "@/lib/sounds";
import { recordPuzzle, statsAtom } from "@/lib/stats";
import { Chess, Square } from "chess.js";
import { useAtom, useAtomValue, useStore } from "jotai";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PreferredSource,
  PuzzleSource,
  SEEN_LIMIT,
  preferredSourceAtom,
  puzzleGameAtom,
  puzzleAutoNextAtom,
  puzzleMoveTimeAtom,
  puzzleShowSetupAtom,
  puzzleThemeAtom,
  seenPuzzlesAtom,
} from "./states";

export type Phase =
  | "loading"
  /** The opponent's last move is being played, so the solver sees what changed. */
  | "setup"
  | "solving"
  | "replying"
  | "wrong"
  /** The solution is being played out on the board. */
  | "showing"
  | "solved"
  | "empty";

const GAMES_CHECK_DELAY_MS = 500;

/** The verdict on one move, tied to the ply it was played at. */
interface Judged {
  ply: number;
  from: Square;
  to: Square;
  kind: VerdictCue["kind"];
}

const isSource = (value: unknown): value is PuzzleSource =>
  value === "lichess" ||
  value === "daily" ||
  value === "offline" ||
  value === "mistakes";

export const usePuzzleTrainer = () => {
  const router = useRouter();
  const store = useStore();
  const [game, setGame] = useAtom(puzzleGameAtom);
  const actions = useChessActions(puzzleGameAtom);
  const [stats, setStats] = useAtom(statsAtom);
  const [preferred, setPreferred] = useAtom(preferredSourceAtom);
  const [theme, setTheme] = useAtom(puzzleThemeAtom);
  const [seen, setSeen] = useAtom(seenPuzzlesAtom);
  const showSetup = useAtomValue(puzzleShowSetupAtom);
  const [moveTime, setMoveTime] = useAtom(puzzleMoveTimeAtom);
  const [autoNext, setAutoNext] = useAtom(puzzleAutoNextAtom);
  const motion = useMotionScale();
  const [source, setSourceState] = useState<PuzzleSource | null>(null);
  const { games, isReady, gamesLoaded } = useGameDatabase(
    source === "mistakes"
  );
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [setupPlies, setSetupPlies] = useState(0);
  const [failed, setFailed] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const [mistakeIndex, setMistakeIndex] = useState(0);
  const [gamesChecked, setGamesChecked] = useState(false);
  const [solvedInSession, setSolvedInSession] = useState(0);
  const [judged, setJudged] = useState<Judged | null>(null);
  const [playedSan, setPlayedSan] = useState<string | null>(null);
  const [replySan, setReplySan] = useState<string | null>(null);
  const [solvedGame, setSolvedGame] = useState<Chess | null>(null);
  const [waiting, setWaiting] = useState(false);

  const timers = useRef<number[]>([]);
  const scoredFor = useRef<string | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const actionsRef = useRef(actions);
  const focusApplied = useRef(false);
  const pending = useRef<(() => void) | null>(null);
  const autoNextRef = useRef(autoNext);

  useEffect(() => {
    actionsRef.current = actions;
    autoNextRef.current = autoNext;
  });

  const later = useCallback((action: () => void, delay: number) => {
    timers.current.push(window.setTimeout(action, delay));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    pending.current = null;
  }, []);

  /**
   * Runs the opponent's next step after the user's chosen pause, or, when
   * moves are not automatic, holds it until the user asks for it.
   */
  const queueStep = (action: () => void, delay: number) => {
    if (autoNextRef.current) {
      later(action, delay);
      return;
    }
    pending.current = action;
    setWaiting(true);
  };

  const advance = () => {
    const action = pending.current;
    if (!action) return;
    pending.current = null;
    setWaiting(false);
    action();
  };

  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });

  // Turning automatic moves on releases a step that was waiting for a click.
  useEffect(() => {
    if (!autoNext || !waiting) return;

    const timer = window.setTimeout(
      () => advanceRef.current(),
      pacedMs(PUZZLE_PACE.reply, motion, moveTime)
    );
    return () => window.clearTimeout(timer);
  }, [autoNext, waiting, motion, moveTime]);

  useEffect(
    () => () => {
      clearTimers();
      loadController.current?.abort();
    },
    [clearTimers]
  );

  useEffect(() => {
    if (!isReady || !gamesLoaded) return;

    const timer = window.setTimeout(
      () => setGamesChecked(true),
      GAMES_CHECK_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [isReady, gamesLoaded]);

  const {
    entries: mistakes,
    loading: mistakesLoading,
    error: mistakesError,
  } = useMistakes(games, source === "mistakes");
  const mistakePuzzles = useMemo(
    () =>
      mistakes.flatMap((entry) => {
        const item = mistakeToPuzzle(entry);
        return item ? [{ entry, puzzle: item }] : [];
      }),
    [mistakes]
  );

  const begin = (next: Puzzle, message: string | null = null) => {
    clearTimers();
    if (scoredFor.current !== next.id) scoredFor.current = null;

    const setup = showSetup ? puzzleSetup(next) : undefined;

    setPuzzle(next);
    setAttempt((count) => count + 1);
    setStep(0);
    setFailed(false);
    setHintLevel(0);
    setRevealed(false);
    setRatingDelta(null);
    setNotice(message);
    setJudged(null);
    setPlayedSan(null);
    setReplySan(null);
    setSolvedGame(null);
    setWaiting(false);
    setSetupPlies(setup ? 1 : 0);
    setGame(new Chess(setup ? setup.fen : next.fen));
    setPhase(setup ? "setup" : "solving");

    if (setup) {
      later(
        () => {
          actionsRef.current.playMove(uciMoveParams(setup.uci));
          setPhase("solving");
        },
        pacedMs(PUZZLE_PACE.setup, motion, moveTime)
      );
    }

    if (next.source !== "mistake") {
      setSeen((previous) =>
        [next.id, ...previous.filter((id) => id !== next.id)].slice(
          0,
          SEEN_LIMIT
        )
      );
    }
  };

  const showEmpty = () => {
    setPuzzle(null);
    setNotice(null);
    setSolvedGame(null);
    setWaiting(false);
    setSetupPlies(0);
    setGame(new Chess());
    setPhase("empty");
  };

  const beginOffline = (message: string | null) => {
    const picked = pickOfflinePuzzle(theme, seen);
    if (!picked) {
      showEmpty();
      return;
    }

    const themeNote = picked.themeMatched
      ? null
      : "No bundled puzzle has that theme, so this one is different.";
    begin(
      picked.puzzle,
      [message, themeNote].filter(Boolean).join(" ") || null
    );
  };

  const load = async () => {
    if (!source) return;

    loadController.current?.abort();
    clearTimers();

    if (source === "mistakes") {
      if (mistakesError) {
        setNotice(mistakesError);
        return;
      }
      const item = mistakePuzzles[mistakeIndex % (mistakePuzzles.length || 1)];
      if (item) {
        begin(item.puzzle);
      } else if (gamesChecked && !mistakesLoading) {
        showEmpty();
      } else {
        setPhase("loading");
      }
      return;
    }

    if (source === "offline") {
      beginOffline(null);
      return;
    }

    const controller = new AbortController();
    loadController.current = controller;
    setPhase("loading");

    try {
      const loaded =
        source === "daily"
          ? await fetchDailyPuzzle(controller.signal)
          : await fetchLichessPuzzle(theme, controller.signal);
      if (!controller.signal.aborted) begin(loaded);
    } catch {
      if (controller.signal.aborted) return;
      beginOffline(
        "Lichess could not be reached, so this puzzle is from the bundled set."
      );
    }
  };

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const preferredRef = useRef(preferred);
  useEffect(() => {
    preferredRef.current = preferred;
  });

  const modeParam = isSource(router.query.mode) ? router.query.mode : undefined;

  useEffect(() => {
    if (!router.isReady) return;

    if (modeParam) {
      focusApplied.current = false;
      setMistakeIndex(0);
      setSourceState(modeParam);
    } else {
      setSourceState((current) => current ?? preferredRef.current);
    }
  }, [router.isReady, modeParam]);

  useEffect(() => {
    if (source !== "mistakes" || focusApplied.current) return;

    const focus = router.query.focus;
    if (typeof focus !== "string" || mistakePuzzles.length === 0) return;

    focusApplied.current = true;
    const index = mistakePuzzles.findIndex(
      ({ puzzle: item }) => item.id === `mistake-${focus}`
    );
    if (index > 0) setMistakeIndex(index);
  }, [source, router.query.focus, mistakePuzzles]);

  useEffect(() => {
    loadRef.current();
  }, [
    source,
    theme,
    mistakeIndex,
    mistakePuzzles,
    gamesChecked,
    mistakesLoading,
  ]);

  const setSource = (next: PuzzleSource) => {
    if (next !== "mistakes") setPreferred(next as PreferredSource);
    setMistakeIndex(0);
    setSourceState(next);
  };

  const score = (solved: boolean) => {
    if (!puzzle || puzzle.source === "mistake") return;
    if (puzzle.rating === undefined || scoredFor.current === puzzle.id) return;

    scoredFor.current = puzzle.id;
    const updated = recordPuzzle(stats, puzzle.rating, solved);
    setStats(updated);
    setRatingDelta(updated.puzzles.rating - stats.puzzles.rating);
  };

  const markFailed = () => {
    if (failed) return;
    setFailed(true);
    score(false);
  };

  const finish = (cleanly: boolean) => {
    const alreadyScored = scoredFor.current === puzzle?.id;
    setSolvedGame(store.get(puzzleGameAtom));
    setPhase("solved");

    if (!cleanly) return;
    score(true);
    if (!alreadyScored) setSolvedInSession((count) => count + 1);
  };

  useEffect(() => {
    if (!puzzle || phase !== "solving") return;

    const history = game.history({ verbose: true });
    if (history.length !== setupPlies + step + 1) return;

    const move = history[setupPlies + step];
    const uci = move.from + move.to + (move.promotion ?? "");
    const outcome = evaluatePuzzleStep(puzzle, step, move.before, uci);
    const judgment = { ply: history.length, from: move.from, to: move.to };

    setPlayedSan(move.san);
    setReplySan(null);

    if (outcome.verdict === "wrong") {
      markFailed();
      setJudged({ ...judgment, kind: "wrong" });
      setPhase("wrong");
      playIllegalMoveSound();
      later(
        () => {
          actionsRef.current.undoMove();
          setPhase("solving");
        },
        pacedMs(PUZZLE_PACE.wrong, motion, moveTime)
      );
      return;
    }

    setJudged({ ...judgment, kind: "correct" });
    const clean = !failed && !revealed;

    if (!outcome.reply) {
      setStep(outcome.nextStep);
      finish(clean);
      return;
    }

    const reply = outcome.reply;
    setPhase("replying");
    queueStep(
      () => {
        const played = actionsRef.current.playMove(uciMoveParams(reply));
        setReplySan(played?.san ?? null);
        setStep(outcome.nextStep);
        setHintLevel(0);

        if (outcome.solved) finish(clean);
        else setPhase("solving");
      },
      pacedMs(PUZZLE_PACE.reply, motion, moveTime)
    );
    // Only a new move or phase should be judged; the helpers read fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, phase, step, puzzle, setupPlies]);

  const hints = useMemo(
    () =>
      puzzle && phase === "solving" ? buildHints(puzzle, game.fen(), step) : [],
    [puzzle, phase, game, step]
  );
  const shownHints = hints.slice(0, hintLevel);
  const lastHint = shownHints.at(-1);
  const nextHint = hints[hintLevel];

  const askHint = () => {
    if (phase !== "solving" || !nextHint) return;

    setHintLevel(hintLevel + 1);
    if (nextHint.kind === "move") markFailed();
  };

  /**
   * Shows one move of the solution and lines up the next. The arrow already
   * points at the move, so the user may play it themselves instead of waiting.
   */
  const showMove = (index: number) => {
    if (!puzzle) return;

    const played = actionsRef.current.playMove(
      uciMoveParams(puzzle.solution[index])
    );
    afterShownMove(index, played?.san ?? null, played?.color);
  };

  const afterShownMove = (
    index: number,
    san: string | null,
    color: "w" | "b" | undefined
  ) => {
    if (!puzzle) return;

    setStep(index + 1);
    if (color === solver) setPlayedSan(san);
    else setReplySan(san);

    if (index + 1 >= puzzle.solution.length) finish(false);
    else {
      queueStep(
        () => showMove(index + 1),
        pacedMs(PUZZLE_PACE.solution, motion, moveTime)
      );
    }
  };

  /** Plays the rest of the solution on the board, move by move. */
  const revealSolution = () => {
    if (!puzzle || phase !== "solving") return;

    setRevealed(true);
    markFailed();
    setPhase("showing");
    setJudged(null);
    setHintLevel(0);

    queueStep(
      () => showMove(step),
      pacedMs(PUZZLE_PACE.solution, motion, moveTime)
    );
  };

  // While the solution is shown, a move the user plays on the board counts as
  // the step it is when it is the solution's move, and is wrong otherwise.
  useEffect(() => {
    if (!puzzle || phase !== "showing") return;

    const history = game.history({ verbose: true });
    if (history.length !== setupPlies + step + 1) return;

    const move = history[setupPlies + step];
    const uci = move.from + move.to + (move.promotion ?? "");

    if (uci !== puzzle.solution[step]) {
      // Told as wrong the way a wrong move is while solving, then the shown
      // solution picks up where it was.
      clearTimers();
      setWaiting(false);
      setJudged({
        ply: history.length,
        from: move.from,
        to: move.to,
        kind: "wrong",
      });
      setPlayedSan(move.san);
      setPhase("wrong");
      playIllegalMoveSound();
      later(
        () => {
          actionsRef.current.undoMove();
          setPhase("showing");
          queueStep(
            () => showMove(step),
            pacedMs(PUZZLE_PACE.solution, motion, moveTime)
          );
        },
        pacedMs(PUZZLE_PACE.wrong, motion, moveTime)
      );
      return;
    }

    clearTimers();
    setWaiting(false);
    afterShownMove(step, move.san, move.color);
    // Only a move on the board should be read; the helpers read fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, phase, step, puzzle, setupPlies]);

  const next = () => {
    if (source === "daily") {
      setSource("lichess");
    } else if (source === "mistakes" && mistakePuzzles.length > 1) {
      setMistakeIndex((index) => (index + 1) % mistakePuzzles.length);
    } else {
      loadRef.current();
    }
  };

  const previous = () => {
    if (source !== "mistakes" || mistakePuzzles.length < 2) return;
    setMistakeIndex(
      (index) => (index - 1 + mistakePuzzles.length) % mistakePuzzles.length
    );
  };

  const retry = () => {
    if (puzzle) begin(puzzle, notice);
  };

  const showPosition = (target: Chess) => {
    setGame(target);
    const move = target.history({ verbose: true }).at(-1);
    if (move) playSoundFromMove(move);
  };

  /** Steps through the finished line, move by move. */
  const review = (action: ReplayAction) => {
    if (phase !== "solved" || !solvedGame) return;

    const target = navigateChess(game, solvedGame, action);
    if (target !== game) showPosition(target);
  };

  const goToPly = (ply: number) => {
    if (phase !== "solved" || !solvedGame) return;
    if (ply < 0 || ply > solvedGame.history().length) return;
    if (ply === game.history().length) return;

    showPosition(replayChess(solvedGame, ply));
  };

  const solver = puzzle ? solverColor(puzzle) : "w";
  const plies = game.history().length;
  const nextMoveUci = puzzle?.solution[step];
  const replay = solvedGame ? replayState(game, solvedGame) : undefined;

  const lastMove: LastMoveCue | undefined = (() => {
    if (judged?.kind === "wrong" && judged.ply === plies) {
      return { from: judged.from, to: judged.to, tone: "bad" };
    }
    // Without a setup move in the game, the puzzle names the move it began on.
    if (plies === 0 && setupPlies === 0 && puzzle?.lastMove) {
      return {
        from: puzzle.lastMove.slice(0, 2) as Square,
        to: puzzle.lastMove.slice(2, 4) as Square,
      };
    }
    return undefined;
  })();

  const verdict: VerdictCue | undefined =
    judged && judged.ply === plies
      ? { square: judged.to, kind: judged.kind }
      : undefined;

  // The best-move arrow points at the move about to be made: a hint that gives
  // it away, the solution as it is shown, or, when stepping through the
  // finished line, the move that follows the position on the board.
  const reviewMove =
    phase === "solved" && replay?.canGoNext
      ? solvedGame?.history({ verbose: true })[plies]
      : undefined;
  const arrowMove =
    lastHint?.kind === "move" || phase === "showing"
      ? nextMoveUci
      : reviewMove
        ? reviewMove.from + reviewMove.to + (reviewMove.promotion ?? "")
        : undefined;

  const mistakeEntry =
    puzzle?.source === "mistake"
      ? mistakePuzzles.find((item) => item.puzzle.id === puzzle.id)?.entry
      : undefined;

  return {
    source,
    setSource,
    theme,
    setTheme,
    puzzle,
    phase,
    failed,
    revealed,
    hintLevel,
    shownHints,
    hintsTotal: hints.length,
    nextHintReveals: nextHint?.kind === "move",
    notice,
    ratingDelta,
    stats: stats.puzzles,
    solvedInSession,
    solver,
    /** The side that may move on the board right now, if any. */
    movableSide:
      phase === "solving"
        ? solver
        : phase === "showing"
          ? game.turn()
          : (false as const),
    playedSan,
    replySan,
    /** How many of the solver's own moves the line holds, and how many are done. */
    solverMoves: puzzle ? Math.ceil(puzzle.solution.length / 2) : 0,
    movesDone: Math.ceil(step / 2),
    line: lineFromGame(solvedGame ?? game, setupPlies, solver),
    activePly: plies,
    canStepBack: plies > 0,
    canStepForward: !!replay?.canGoNext,
    lastMove,
    verdict,
    hintSquare:
      lastHint && lastHint.kind !== "motif"
        ? lastHint.kind === "piece"
          ? lastHint.square
          : lastHint.from
        : undefined,
    arrowMove,
    arrowSide: game.turn(),
    motionKey: `${puzzle?.id ?? "none"}:${attempt}`,
    mistakeCount: mistakePuzzles.length,
    mistakeNumber: mistakeIndex % (mistakePuzzles.length || 1),
    mistakeEntry,
    askHint,
    revealSolution,
    waiting,
    advance,
    moveTime,
    setMoveTime,
    autoNext,
    setAutoNext,
    review,
    goToPly,
    next,
    previous,
    retry,
  };
};

export type PuzzleTrainer = ReturnType<typeof usePuzzleTrainer>;
