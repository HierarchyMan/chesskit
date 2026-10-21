import { useChessActions } from "@/hooks/useChessActions";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { useMistakes } from "@/hooks/useMistakes";
import { pickOfflinePuzzle } from "@/lib/offlinePuzzles";
import {
  Puzzle,
  evaluatePuzzleStep,
  fetchDailyPuzzle,
  fetchLichessPuzzle,
  mistakeToPuzzle,
  solutionToSan,
  solverColor,
} from "@/lib/puzzles";
import { recordPuzzle, statsAtom } from "@/lib/stats";
import { Chess, Square } from "chess.js";
import { useAtom } from "jotai";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PreferredSource,
  PuzzleSource,
  SEEN_LIMIT,
  preferredSourceAtom,
  puzzleGameAtom,
  puzzleThemeAtom,
  seenPuzzlesAtom,
} from "./states";

export type Phase =
  | "loading"
  | "solving"
  | "replying"
  | "wrong"
  | "solved"
  | "empty";

const REPLY_DELAY_MS = 450;
const WRONG_DELAY_MS = 700;
const GAMES_CHECK_DELAY_MS = 500;

const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const isSource = (value: unknown): value is PuzzleSource =>
  value === "lichess" ||
  value === "daily" ||
  value === "offline" ||
  value === "mistakes";

export const usePuzzleTrainer = () => {
  const router = useRouter();
  const [game, setGame] = useAtom(puzzleGameAtom);
  const actions = useChessActions(puzzleGameAtom);
  const [stats, setStats] = useAtom(statsAtom);
  const [preferred, setPreferred] = useAtom(preferredSourceAtom);
  const [theme, setTheme] = useAtom(puzzleThemeAtom);
  const [seen, setSeen] = useAtom(seenPuzzlesAtom);
  const [source, setSourceState] = useState<PuzzleSource | null>(null);
  const { games, isReady, gamesLoaded } = useGameDatabase(
    source === "mistakes"
  );
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const [mistakeIndex, setMistakeIndex] = useState(0);
  const [gamesChecked, setGamesChecked] = useState(false);
  const [solvedInSession, setSolvedInSession] = useState(0);

  const timers = useRef<number[]>([]);
  const scoredFor = useRef<string | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const actionsRef = useRef(actions);
  const focusApplied = useRef(false);

  useEffect(() => {
    actionsRef.current = actions;
  });

  const later = useCallback((action: () => void, delay: number) => {
    timers.current.push(window.setTimeout(action, delay));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

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

    setPuzzle(next);
    setStep(0);
    setFailed(false);
    setHintLevel(0);
    setRevealed(false);
    setRatingDelta(null);
    setNotice(message);
    setPhase("solving");
    setGame(new Chess(next.fen));

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
    setPhase("solved");

    if (!cleanly) return;
    score(true);
    if (!alreadyScored) setSolvedInSession((count) => count + 1);
  };

  useEffect(() => {
    if (!puzzle || phase !== "solving") return;

    const history = game.history({ verbose: true });
    if (history.length !== step + 1) return;

    const move = history[step];
    const uci = move.from + move.to + (move.promotion ?? "");
    const outcome = evaluatePuzzleStep(puzzle, step, move.before, uci);

    if (outcome.verdict === "wrong") {
      markFailed();
      setPhase("wrong");
      later(() => {
        actionsRef.current.undoMove();
        setPhase("solving");
      }, WRONG_DELAY_MS);
      return;
    }

    const clean = !failed && !revealed;

    if (!outcome.reply) {
      setStep(outcome.nextStep);
      finish(clean);
      return;
    }

    const reply = outcome.reply;
    setPhase("replying");
    later(() => {
      actionsRef.current.playMove({
        from: reply.slice(0, 2),
        to: reply.slice(2, 4),
        promotion: reply.slice(4, 5) || undefined,
      });
      setStep(outcome.nextStep);
      setHintLevel(0);

      if (outcome.solved) finish(clean);
      else setPhase("solving");
    }, REPLY_DELAY_MS);
    // Only a new move or phase should be judged; the helpers read fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, phase, step, puzzle]);

  const askHint = () => {
    if (phase !== "solving") return;

    if (hintLevel === 0) {
      setHintLevel(1);
    } else if (hintLevel === 1) {
      setHintLevel(2);
      markFailed();
    }
  };

  const revealSolution = () => {
    if (!puzzle) return;
    setRevealed(true);
    markFailed();
  };

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

  const nextMoveUci = puzzle?.solution[step];
  const pieceToMove = (() => {
    if (!nextMoveUci || hintLevel === 0) return null;
    const piece = game.get(nextMoveUci.slice(0, 2) as Square);
    return piece ? PIECE_NAMES[piece.type] : null;
  })();

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
    pieceToMove,
    notice,
    ratingDelta,
    stats: stats.puzzles,
    solvedInSession,
    solver: puzzle ? solverColor(puzzle) : "w",
    solutionSan: puzzle && revealed ? solutionToSan(puzzle) : [],
    arrowMove:
      phase === "solving" && (hintLevel >= 2 || revealed)
        ? nextMoveUci
        : undefined,
    mistakeCount: mistakePuzzles.length,
    mistakeNumber: mistakeIndex % (mistakePuzzles.length || 1),
    mistakeEntry,
    askHint,
    revealSolution,
    next,
    previous,
    retry,
  };
};

export type PuzzleTrainer = ReturnType<typeof usePuzzleTrainer>;
