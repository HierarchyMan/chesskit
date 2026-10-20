import { recordVision, statsAtom } from "@/lib/stats";
import {
  isKnightMove,
  isLightSquare,
  knightPath,
  randomKnightRoute,
  randomSquare,
} from "@/lib/vision";
import { useAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";

export type VisionMode = "find" | "name" | "colour" | "knight";
export type OrientationChoice = "white" | "black" | "random";
export type Phase = "idle" | "running" | "done";
export type Difficulty = "short" | "medium" | "long";

export const ROUND_MS = 30000;
const TICK_MS = 100;
const FLASH_MS = 700;

export const DIFFICULTY_RANGE: Record<Difficulty, [number, number]> = {
  short: [2, 3],
  medium: [3, 4],
  long: [4, 6],
};

export interface Flash {
  square: string;
  correct: boolean;
}

export interface KnightResult {
  used: number;
  best: number;
}

export const useVisionTrainer = () => {
  const [stats, setStats] = useAtom(statsAtom);

  const [mode, setModeState] = useState<VisionMode>("find");
  const [orientationChoice, setOrientationChoice] =
    useState<OrientationChoice>("white");
  const [showLabels, setShowLabels] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [phase, setPhase] = useState<Phase>("idle");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [msLeft, setMsLeft] = useState(ROUND_MS);
  const [target, setTarget] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [typed, setTyped] = useState("");
  const [previousBest, setPreviousBest] = useState(0);

  const [route, setRoute] = useState({ from: "b1", to: "c3", moves: 1 });
  const [path, setPath] = useState<string[]>([]);
  const [knightResult, setKnightResult] = useState<KnightResult | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  const endsAt = useRef(0);
  const scoreRef = useRef(0);
  const flashTimers = useRef<number[]>([]);

  const timed = mode !== "knight";

  const clearFlashTimers = useCallback(() => {
    flashTimers.current.forEach((timer) => window.clearTimeout(timer));
    flashTimers.current = [];
  }, []);

  useEffect(() => clearFlashTimers, [clearFlashTimers]);

  const flash = useCallback((items: Flash[]) => {
    setFlashes(items);
    flashTimers.current.push(window.setTimeout(() => setFlashes([]), FLASH_MS));
  }, []);

  const finishRound = useCallback(() => {
    setPhase("done");
    setTarget(null);
    setTyped("");
    setPreviousBest(stats.vision.bestScore);
    setStats((previous) => recordVision(previous, scoreRef.current));
  }, [setStats, stats.vision.bestScore]);

  useEffect(() => {
    if (phase !== "running" || !timed) return;

    const interval = window.setInterval(() => {
      const left = endsAt.current - Date.now();

      if (left <= 0) {
        window.clearInterval(interval);
        setMsLeft(0);
        finishRound();
      } else {
        setMsLeft(left);
      }
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [phase, timed, finishRound]);

  const newKnightRoute = useCallback(
    (level: Difficulty) => {
      const [min, max] = DIFFICULTY_RANGE[level];
      const next = randomKnightRoute(min, max);

      setRoute(next);
      setPath([next.from]);
      setKnightResult(null);
      setShowSolution(false);
      setPhase("running");
      setOrientation(
        orientationChoice === "random"
          ? Math.random() < 0.5
            ? "white"
            : "black"
          : orientationChoice
      );
    },
    [orientationChoice]
  );

  const start = useCallback(() => {
    clearFlashTimers();
    setFlashes([]);

    if (mode === "knight") {
      newKnightRoute(difficulty);
      return;
    }

    scoreRef.current = 0;
    setScore(0);
    setMisses(0);
    setTyped("");
    setMsLeft(ROUND_MS);
    setTarget(randomSquare());
    setOrientation(
      orientationChoice === "random"
        ? Math.random() < 0.5
          ? "white"
          : "black"
        : orientationChoice
    );
    endsAt.current = Date.now() + ROUND_MS;
    setPhase("running");
  }, [clearFlashTimers, difficulty, mode, newKnightRoute, orientationChoice]);

  const setMode = useCallback(
    (next: VisionMode) => {
      clearFlashTimers();
      setFlashes([]);
      setTyped("");
      setPhase("idle");
      setTarget(null);
      setKnightResult(null);
      setModeState(next);
    },
    [clearFlashTimers]
  );

  const answer = useCallback(
    (correct: boolean, shownSquare: string, clicked?: string) => {
      if (correct) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
      } else {
        setMisses((count) => count + 1);
      }

      flash(
        correct
          ? [{ square: shownSquare, correct: true }]
          : [
              { square: shownSquare, correct: true },
              ...(clicked && clicked !== shownSquare
                ? [{ square: clicked, correct: false }]
                : []),
            ]
      );
      setTarget(randomSquare(shownSquare));
      setTyped("");
    },
    [flash]
  );

  const clickSquare = useCallback(
    (square: string) => {
      if (phase !== "running") return;

      if (mode === "find" && target) {
        answer(square === target, target, square);
        return;
      }

      if (mode === "knight") {
        const current = path.at(-1);
        if (!current || knightResult) return;

        if (square === current && path.length > 1) {
          setPath(path.slice(0, -1));
          return;
        }

        if (!isKnightMove(current, square)) return;

        const next = [...path, square];
        setPath(next);

        if (square === route.to) {
          setKnightResult({ used: next.length - 1, best: route.moves });
        }
      }
    },
    [answer, knightResult, mode, path, phase, route, target]
  );

  const typeKey = useCallback(
    (key: string) => {
      if (phase !== "running" || mode !== "name" || !target) return;

      if (/^[a-h]$/.test(key)) {
        setTyped(key);
      } else if (/^[1-8]$/.test(key) && typed) {
        answer(typed + key === target, target);
      }
    },
    [answer, mode, phase, target, typed]
  );

  const answerColour = useCallback(
    (light: boolean) => {
      if (phase !== "running" || mode !== "colour" || !target) return;
      answer(isLightSquare(target) === light, target);
    },
    [answer, mode, phase, target]
  );

  const undoKnight = useCallback(() => {
    if (mode !== "knight" || knightResult || path.length < 2) return;
    setPath(path.slice(0, -1));
  }, [knightResult, mode, path]);

  const solution = knightPath(route.from, route.to);

  return {
    mode,
    setMode,
    orientationChoice,
    setOrientationChoice,
    orientation,
    showLabels,
    setShowLabels,
    difficulty,
    setDifficulty,
    phase,
    timed,
    msLeft,
    target,
    score,
    misses,
    flashes,
    typed,
    previousBest,
    bestScore: stats.vision.bestScore,
    sessions: stats.vision.sessions,
    route,
    path,
    knightResult,
    showSolution,
    setShowSolution,
    solution,
    start,
    clickSquare,
    typeKey,
    answerColour,
    undoKnight,
  };
};

export type VisionTrainer = ReturnType<typeof useVisionTrainer>;
