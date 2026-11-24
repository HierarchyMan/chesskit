import { useCallback, useEffect, useMemo, useState } from "react";
import type { Square } from "chess.js";
import type { BoardArrow } from "@/lib/arrows/types";
import type { LastMoveCue, SquareHighlight } from "@/components/board/cues";
import type {
  MoveStory,
  StoryLine,
  StoryStep,
} from "@/lib/visualize/moveStory";

export type CascadeBranch = "played" | "better";

export interface ActiveCascade {
  story: MoveStory;
  branch: CascadeBranch;
  stepIndex: number;
  playing: boolean;
  /** Optional label for the close/rewind button (e.g. "Try again" in Play, "Back" in Analysis). */
  exitLabel?: string;
  onTryAgain?: () => void;
}

export interface CascadeBoardProjection {
  active: boolean;
  branch: CascadeBranch;
  hasBetterBranch: boolean;
  stepIndex: number;
  maxStep: number;
  playing: boolean;
  previewFen?: string;
  lastMove?: LastMoveCue;
  arrows: BoardArrow[];
  highlights: SquareHighlight[];
  caption?: string;
  san?: string;
  evalLabel?: string;
  exitLabel: string;
  canTryAgain: boolean;
}

export const COACH_ARROW_COLORS = {
  bright: "#f5b82e",
  success: "#22c55e",
  danger: "#ef4444",
  reminder: "#6382f6",
} as const;

const STEP_INTERVAL_MS = 1450;

const parseUciSquares = (
  uci?: string
): { from: Square; to: Square } | undefined => {
  if (!uci || uci.length < 4) return undefined;
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
  };
};

const getBranchLine = (story: MoveStory, branch: CascadeBranch): StoryLine => {
  if (branch === "better" && story.better) return story.better;
  return story.played;
};

/**
 * Manages an in-board refutation or best-line cascade directly on the main chessboard,
 * without leaving the game or opening a modal dialog.
 */
export function useInBoardCascade(resetKey: string | number) {
  const [cascade, setCascade] = useState<ActiveCascade | null>(null);

  // Automatically dismiss the demonstration when the underlying position/game changes.
  useEffect(() => {
    setCascade(null);
  }, [resetKey]);

  // Auto-advance timer while playing.
  useEffect(() => {
    if (!cascade || !cascade.playing) return;
    const line = getBranchLine(cascade.story, cascade.branch);
    const maxStep = Math.min(line.autoEnd, line.steps.length - 1);
    if (cascade.stepIndex >= maxStep) {
      setCascade((prev) => (prev ? { ...prev, playing: false } : null));
      return;
    }
    const timer = window.setTimeout(() => {
      setCascade((prev) => {
        if (!prev || !prev.playing) return prev;
        const currentLine = getBranchLine(prev.story, prev.branch);
        const cap = Math.min(currentLine.autoEnd, currentLine.steps.length - 1);
        const next = Math.min(cap, prev.stepIndex + 1);
        return {
          ...prev,
          stepIndex: next,
          playing: next < cap,
        };
      });
    }, STEP_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [cascade]);

  const start = useCallback(
    (
      story: MoveStory,
      options?: {
        branch?: CascadeBranch;
        exitLabel?: string;
        onTryAgain?: () => void;
      }
    ) => {
      const branch = options?.branch ?? "played";
      const line = getBranchLine(story, branch);
      const startStep = line.steps.length > 1 ? 1 : 0;
      setCascade({
        story,
        branch,
        stepIndex: startStep,
        playing: line.steps.length > 2,
        exitLabel: options?.exitLabel,
        onTryAgain: options?.onTryAgain,
      });
    },
    []
  );

  const stop = useCallback(() => setCascade(null), []);

  const togglePlay = useCallback(() => {
    setCascade((prev) => {
      if (!prev) return null;
      const line = getBranchLine(prev.story, prev.branch);
      const maxStep = Math.min(line.autoEnd, line.steps.length - 1);
      if (!prev.playing && prev.stepIndex >= maxStep) {
        return {
          ...prev,
          stepIndex: line.steps.length > 1 ? 1 : 0,
          playing: true,
        };
      }
      return { ...prev, playing: !prev.playing };
    });
  }, []);

  const stepPrev = useCallback(() => {
    setCascade((prev) =>
      prev
        ? {
            ...prev,
            playing: false,
            stepIndex: Math.max(0, prev.stepIndex - 1),
          }
        : null
    );
  }, []);

  const stepNext = useCallback(() => {
    setCascade((prev) => {
      if (!prev) return null;
      const line = getBranchLine(prev.story, prev.branch);
      const maxStep = line.steps.length - 1;
      return {
        ...prev,
        playing: false,
        stepIndex: Math.min(maxStep, prev.stepIndex + 1),
      };
    });
  }, []);

  const replay = useCallback(() => {
    setCascade((prev) => {
      if (!prev) return null;
      const line = getBranchLine(prev.story, prev.branch);
      return {
        ...prev,
        stepIndex: line.steps.length > 1 ? 1 : 0,
        playing: line.steps.length > 2,
      };
    });
  }, []);

  const switchBranch = useCallback((branch: CascadeBranch) => {
    setCascade((prev) => {
      if (!prev) return null;
      const line = getBranchLine(prev.story, branch);
      return {
        ...prev,
        branch,
        stepIndex: line.steps.length > 1 ? 1 : 0,
        playing: line.steps.length > 2,
      };
    });
  }, []);

  const tryAgain = useCallback(() => {
    const fn = cascade?.onTryAgain;
    setCascade(null);
    fn?.();
  }, [cascade]);

  const projection = useMemo<CascadeBoardProjection>(() => {
    if (!cascade) {
      return {
        active: false,
        branch: "played",
        hasBetterBranch: false,
        stepIndex: 0,
        maxStep: 0,
        playing: false,
        arrows: [],
        highlights: [],
        exitLabel: "Done",
        canTryAgain: false,
      };
    }

    const line = getBranchLine(cascade.story, cascade.branch);
    const step: StoryStep = line.steps[cascade.stepIndex] ?? line.steps[0];
    const nextStep: StoryStep | undefined = line.steps[cascade.stepIndex + 1];
    const currentSquares = parseUciSquares(step.uci);
    const nextSquares = parseUciSquares(nextStep?.uci);
    const isRefutation =
      cascade.branch === "played" && cascade.story.kind !== "continuation";
    const isOpponentReply =
      step.color !== undefined && step.color !== cascade.story.mover;

    const arrows: BoardArrow[] = [];
    const highlights: SquareHighlight[] = [];

    if (currentSquares) {
      const tone = isRefutation
        ? isOpponentReply
          ? "danger"
          : "bright"
        : "success";
      arrows.push({
        from: currentSquares.from,
        to: currentSquares.to,
        kind: "content",
        color: COACH_ARROW_COLORS[tone],
      });
      highlights.push({
        square: currentSquares.to,
        tone,
        pulse:
          tone === "danger" ||
          step.tags.includes("mate") ||
          step.tags.includes("fork"),
      });
    }

    if (
      nextSquares &&
      cascade.stepIndex < Math.min(line.autoEnd, line.steps.length - 1)
    ) {
      arrows.push({
        from: nextSquares.from,
        to: nextSquares.to,
        kind: "content",
        color: isRefutation
          ? COACH_ARROW_COLORS.reminder
          : COACH_ARROW_COLORS.success,
        dimmed: true,
      });
    }

    return {
      active: true,
      branch: cascade.branch,
      hasBetterBranch: !!cascade.story.better,
      stepIndex: cascade.stepIndex,
      maxStep: Math.max(0, line.steps.length - 1),
      playing: cascade.playing,
      previewFen: step.fen,
      lastMove: currentSquares
        ? {
            from: currentSquares.from,
            to: currentSquares.to,
            tone: isRefutation && cascade.stepIndex === 1 ? "bad" : undefined,
          }
        : undefined,
      arrows,
      highlights,
      caption: step.note,
      san: step.san,
      evalLabel: line.evalLabel,
      exitLabel: cascade.exitLabel ?? "Back to game",
      canTryAgain: !!cascade.onTryAgain,
    };
  }, [cascade]);

  return {
    projection,
    start,
    stop,
    togglePlay,
    stepPrev,
    stepNext,
    replay,
    switchBranch,
    tryAgain,
  };
}
