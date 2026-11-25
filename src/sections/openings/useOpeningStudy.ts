import { LastMoveCue, VerdictCue } from "@/components/board/cues";
import { OpeningLine } from "@/data/openingLines";
import { useChessActions } from "@/hooks/useChessActions";
import { LineStep, buildSteps } from "@/lib/openingTrainer";
import { playIllegalMoveSound, playSoundFromMove } from "@/lib/sounds";
import { markOpeningLearned, statsAtom } from "@/lib/stats";
import { Chess, Square } from "chess.js";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openingGameAtom } from "./states";

export type OpeningMode = "learn" | "drill";
export type DrillPhase = "idle" | "playing" | "replying" | "wrong" | "done";

export interface DrillFeedback {
  mine?: string;
  reply?: string;
}

interface Judged {
  ply: number;
  from: Square;
  to: Square;
  kind: VerdictCue["kind"];
}

const REPLY_DELAY_MS = 450;
const WRONG_DELAY_MS = 700;
const AUTOPLAY_MS = 1100;
const AUTO_HINT_AFTER_MISTAKES = 2;

const gameAtPly = (steps: LineStep[], ply: number): Chess => {
  const game = new Chess();
  for (let index = 0; index < ply; index++) game.move(steps[index].san);
  return game;
};

export const useOpeningStudy = (line: OpeningLine) => {
  const steps = useMemo(() => buildSteps(line), [line]);
  const [game, setGame] = useAtom(openingGameAtom);
  const actions = useChessActions(openingGameAtom);
  const [stats, setStats] = useAtom(statsAtom);

  const [mode, setModeState] = useState<OpeningMode>("learn");
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [phase, setPhase] = useState<DrillPhase>("idle");
  const [attempt, setAttempt] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [mistakesHere, setMistakesHere] = useState(0);
  const [feedback, setFeedback] = useState<DrillFeedback>({});
  const [learned, setLearned] = useState(false);
  const [judged, setJudged] = useState<Judged | null>(null);
  const [reviewPly, setReviewPly] = useState<number | null>(null);

  const timers = useRef<number[]>([]);
  const actionsRef = useRef(actions);

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

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (mode === "learn") setGame(gameAtPly(steps, ply));
  }, [mode, ply, steps, setGame]);

  useEffect(() => {
    if (!playing || mode !== "learn") return;

    const interval = window.setInterval(() => {
      setPly((current) => {
        if (current >= steps.length) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, AUTOPLAY_MS);

    return () => window.clearInterval(interval);
  }, [playing, mode, steps.length]);

  const goTo = useCallback(
    (target: number) => {
      setPlaying(false);
      const clamped = Math.max(0, Math.min(steps.length, target));
      if (mode === "drill" && phase === "done") {
        setReviewPly(clamped);
        const nextGame = gameAtPly(steps, clamped);
        setGame(nextGame);
        const last = nextGame.history({ verbose: true }).at(-1);
        if (last) playSoundFromMove(last);
        return;
      }
      setPly(clamped);
    },
    [mode, phase, setGame, steps]
  );

  const togglePlaying = useCallback(() => {
    if (ply >= steps.length) setPly(0);
    setPlaying((value) => !value);
  }, [ply, steps.length]);

  const playLineMove = useCallback(
    (step: LineStep) =>
      actionsRef.current.playMove({
        from: step.uci.slice(0, 2),
        to: step.uci.slice(2, 4),
        promotion: step.uci.slice(4, 5) || undefined,
      }),
    []
  );

  const finishDrill = useCallback(
    (clean: boolean) => {
      setPhase("done");
      setReviewPly(steps.length);
      if (!clean) return;

      setLearned(true);
      setStats((previous) => markOpeningLearned(previous, line.id));
    },
    [line.id, setStats, steps.length]
  );

  const startDrill = useCallback(() => {
    clearTimers();
    setPlaying(false);
    setModeState("drill");
    setAttempt((count) => count + 1);
    setPly(0);
    setReviewPly(null);
    setMistakes(0);
    setHints(0);
    setHintShown(false);
    setMistakesHere(0);
    setFeedback({});
    setLearned(false);
    setJudged(null);
    setGame(new Chess());

    if (line.side === "b") {
      setPhase("replying");
      later(() => {
        playLineMove(steps[0]);
        setPly(1);
        setPhase("playing");
      }, REPLY_DELAY_MS);
    } else {
      setPhase("playing");
    }
  }, [clearTimers, later, line.side, playLineMove, setGame, steps]);

  const startLearn = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setPly(0);
    setReviewPly(null);
    setJudged(null);
    setModeState("learn");
  }, [clearTimers]);

  useEffect(() => {
    if (mode !== "drill" || phase !== "playing") return;

    const history = game.history({ verbose: true });
    if (history.length !== ply + 1) return;

    const played = history[ply];
    const uci = played.from + played.to + (played.promotion ?? "");
    const expected = steps[ply];

    if (uci !== expected.uci) {
      setMistakes((count) => count + 1);
      setMistakesHere((count) => count + 1);
      if (mistakesHere + 1 >= AUTO_HINT_AFTER_MISTAKES) setHintShown(true);
      setFeedback({ mine: undefined, reply: undefined });
      setJudged({
        ply: history.length,
        from: played.from,
        to: played.to,
        kind: "wrong",
      });
      setPhase("wrong");
      playIllegalMoveSound();
      later(() => {
        actionsRef.current.undoMove();
        setJudged(null);
        setPhase("playing");
      }, WRONG_DELAY_MS);
      return;
    }

    const afterMine = ply + 1;
    setHintShown(false);
    setMistakesHere(0);
    setPly(afterMine);
    setJudged({
      ply: history.length,
      from: played.from,
      to: played.to,
      kind: "correct",
    });
    setFeedback({ mine: line.notes[ply] });

    if (afterMine >= steps.length) {
      finishDrill(mistakes === 0 && hints === 0);
      return;
    }

    const reply = steps[afterMine];
    setPhase("replying");
    later(() => {
      playLineMove(reply);
      setPly(afterMine + 1);
      setJudged(null);
      setFeedback({ mine: line.notes[ply], reply: line.notes[afterMine] });

      if (afterMine + 1 >= steps.length)
        finishDrill(mistakes === 0 && hints === 0);
      else setPhase("playing");
    }, REPLY_DELAY_MS);
    // A drill move is judged once, when the board changes. The values the
    // judgement reads are current at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, phase, mode, ply]);

  const askHint = useCallback(() => {
    if (mode !== "drill" || phase !== "playing" || hintShown) return;
    setHintShown(true);
    setHints((count) => count + 1);
  }, [mode, phase, hintShown]);

  const activePly =
    mode === "drill" && phase === "done" ? (reviewPly ?? ply) : ply;
  const nextExpected = steps[ply];
  const boardPlies = game.history().length;

  const lastMove: LastMoveCue | undefined = (() => {
    if (
      mode === "drill" &&
      judged?.kind === "wrong" &&
      judged.ply === boardPlies
    ) {
      return { from: judged.from, to: judged.to, tone: "bad" };
    }
    const prevStep = activePly > 0 ? steps[activePly - 1] : undefined;
    if (prevStep && (mode === "learn" || phase === "done")) {
      return {
        from: prevStep.uci.slice(0, 2) as Square,
        to: prevStep.uci.slice(2, 4) as Square,
      };
    }
    return undefined;
  })();

  const verdict: VerdictCue | undefined =
    mode === "drill" && judged && judged.ply === boardPlies
      ? { square: judged.to, kind: judged.kind }
      : undefined;

  const hintUci =
    mode === "drill" && phase === "playing" && hintShown
      ? nextExpected?.uci
      : undefined;

  const hintSquare = hintUci ? (hintUci.slice(0, 2) as Square) : undefined;

  // In Learn mode (or post-drill review), point at the NEXT book move while
  // lastMove highlights the move just played.
  const nextArrowUci =
    mode === "learn" && activePly < steps.length
      ? steps[activePly].uci
      : mode === "drill" && phase === "done" && activePly < steps.length
        ? steps[activePly].uci
        : undefined;

  const alreadyLearned = stats.openings.learned.includes(line.id);

  return {
    line,
    steps,
    mode,
    ply: activePly,
    drillPly: ply,
    playing,
    phase,
    mistakes,
    hints,
    feedback,
    learned,
    alreadyLearned,
    goTo,
    togglePlaying,
    startDrill,
    startLearn,
    askHint,
    hintUci,
    hintSquare,
    learnUci: nextArrowUci,
    lastMove,
    verdict,
    motionKey: `${line.id}:${mode}:${attempt}`,
    currentNote: activePly > 0 ? line.notes[activePly - 1] : undefined,
  };
};

export type OpeningStudy = ReturnType<typeof useOpeningStudy>;
