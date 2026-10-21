import { moveStoryAtom } from "@/lib/moveStoryState";
import AnalysisOptionsPanel, {
  AnalysisOptionCopy,
} from "@/components/analysisOptions/analysisOptionsPanel";
import { ENGINE_LABELS } from "@/constants";
import {
  CLASSIFICATION_PHRASES,
  WORTH_VISUALIZING,
} from "@/lib/classificationLabels";
import { getLineEvalLabel } from "@/lib/chess";
import { AnalysisOption } from "@/lib/analysisOptions";
import {
  ARENA_ANALYSIS_DEPTH,
  ArenaMoveAnalysis,
} from "@/lib/engine/arenaAnalysis";
import { buildMoveStory } from "@/lib/visualize/moveStory";
import { describeMove } from "@/lib/visualize/explain";
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useSetAtom } from "jotai";
import { useMemo } from "react";
import { arenaAnalysisOptionAtoms } from "./states";
import { Arena } from "./useArena";

const ARENA_OPTION_COPY: Record<AnalysisOption, AnalysisOptionCopy> = {
  evaluation: { label: "Evaluation bar" },
  annotations: {
    label: "Move annotations",
    help: "Grade each move on the board and in the move list. Select a move to explain or visualize it.",
  },
  bestMove: {
    label: "Best-move arrow",
    help: "Show the better alternative to the last move, alongside candidate arrows.",
  },
};

const formatAccuracy = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)} %`;

export default function AnalysisCard({ arena }: { arena: Arena }) {
  const { analysis } = arena;
  const completed = analysis.moves.filter(
    (entry) => entry.after?.moveClassification
  ).length;
  const hasMoves = analysis.moves.length > 0;

  return (
    <AnalysisOptionsPanel
      atoms={arenaAnalysisOptionAtoms}
      copy={ARENA_OPTION_COPY}
      details={{
        annotations:
          analysis.enabled && hasMoves ? (
            <Stack spacing={0.25}>
              {analysis.opening && (
                <Typography variant="caption">
                  Opening: {analysis.opening}
                </Typography>
              )}
              <Typography variant="caption">
                Accuracy · White {formatAccuracy(analysis.accuracy?.white)} ·
                Black {formatAccuracy(analysis.accuracy?.black)}
              </Typography>
            </Stack>
          ) : undefined,
        bestMove: analysis.betterMove ? (
          <Typography variant="caption">
            Better alternative: {analysis.betterMove}
          </Typography>
        ) : undefined,
      }}
      footer={
        <>
          <Typography variant="caption" sx={{ opacity: 0.7, pt: 1 }}>
            {ENGINE_LABELS[analysis.engineName].small} · depth{" "}
            {ARENA_ANALYSIS_DEPTH}. Uses the analysis engine selected in the top
            bar. Positive scores favor White. Options are remembered.
          </Typography>
          {analysis.error ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={analysis.retry}>
                  Retry analysis
                </Button>
              }
            >
              {analysis.error} The match can continue.
            </Alert>
          ) : analysis.enabled ? (
            <Stack direction="row" gap={1} alignItems="center" role="status">
              {(analysis.busy || analysis.engineState.status !== "ready") && (
                <CircularProgress size={14} />
              )}
              <Typography variant="caption">
                {analysis.engineState.status !== "ready"
                  ? "Loading analysis engine…"
                  : analysis.showAnnotations
                    ? `${completed}/${analysis.moves.length} moves annotated${analysis.busy ? " · Analyzing…" : ""}`
                    : analysis.busy
                      ? "Evaluating position…"
                      : "Evaluation ready"}
              </Typography>
            </Stack>
          ) : null}
        </>
      }
    />
  );
}

export function MoveFeedback({
  entry,
  arena,
}: {
  entry: ArenaMoveAnalysis;
  arena: Arena;
}) {
  const setStory = useSetAtom(moveStoryAtom);
  const { move, before, after } = entry;
  const classification = after?.moveClassification;
  const story = useMemo(() => {
    if (!before || !after || !classification) return undefined;
    const result = buildMoveStory({
      fenBefore: move.before,
      playedUci: move.lan,
      beforeLines: before.lines,
      afterLines: after.lines,
    });
    // A book/good move should not inherit the weak-move story's loss wording
    // for a tiny evaluation fluctuation. Keep its playable lines available.
    if (!WORTH_VISUALIZING.includes(classification)) {
      result.summary = [describeMove(move.before, move.lan).text];
    }
    return result;
  }, [move, before, after, classification]);
  const moveNumber = move.before.split(" ")[5];

  return (
    <Stack spacing={1} sx={{ pt: 1.5 }}>
      <Typography variant="body2" fontWeight={600}>
        {moveNumber}
        {move.color === "w" ? "." : "…"} {move.san}
        {classification
          ? ` is ${CLASSIFICATION_PHRASES[classification]}`
          : " · Analysis pending…"}
      </Typography>
      {after?.lines[0] && (
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          Evaluation after the move: {getLineEvalLabel(after.lines[0])}
        </Typography>
      )}
      {story && (
        <>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            {story.summary[0]}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
            onClick={() => {
              arena.setRunning(false);
              setStory({ open: true, story, classification });
            }}
          >
            Visualize move
          </Button>
        </>
      )}
    </Stack>
  );
}
