import AnalysisOptionsPanel, {
  AnalysisOptionCopy,
} from "@/components/analysisOptions/analysisOptionsPanel";
import { engineLabel } from "@/constants";
import {
  CLASSIFICATION_PHRASES,
  WORTH_VISUALIZING,
} from "@/lib/classificationLabels";
import { getLineEvalLabel } from "@/lib/chess";
import { AnalysisOption } from "@/lib/analysisOptions";
import { useEffectiveArenaEval } from "@/hooks/useEffectiveEngineSettings";
import { ArenaMoveAnalysis } from "@/lib/engine/arenaAnalysis";
import { buildMoveStory, MoveStory } from "@/lib/visualize/moveStory";
import { describeMove } from "@/lib/visualize/explain";
import { getPreviousBestMoveFeedback } from "@/lib/bestMoveHint";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import { arenaAnalysisOptionAtoms } from "./states";
import { Arena } from "./useArena";

const ARENA_OPTION_COPY: Record<AnalysisOption, AnalysisOptionCopy> = {
  evaluation: { label: "Evaluation bar" },
  annotations: {
    label: "Move annotations",
    help: "Grade each move on the board and in the move list. Select a move to explain or visualize it.",
  },
};

const formatAccuracy = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)} %`;

export default function AnalysisCard({ arena }: { arena: Arena }) {
  const { analysis } = arena;
  const { depth: arenaDepth } = useEffectiveArenaEval();
  const completed = analysis.moves.filter(
    (entry) => entry.after?.moveClassification
  ).length;
  const hasMoves = analysis.moves.length > 0;

  return (
    <AnalysisOptionsPanel
      atoms={arenaAnalysisOptionAtoms}
      copy={ARENA_OPTION_COPY}
      details={{
        annotations: analysis.enabled ? (
          <Stack spacing={0.25} sx={{ minHeight: 38 }}>
            <Typography
              variant="caption"
              noWrap
              title={analysis.opening || undefined}
            >
              {analysis.opening ? `Opening: ${analysis.opening}` : "\u00A0"}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {hasMoves
                ? `Accuracy · White ${formatAccuracy(analysis.accuracy?.white)} · Black ${formatAccuracy(analysis.accuracy?.black)}`
                : "Accuracy · White — · Black —"}
            </Typography>
          </Stack>
        ) : undefined,
      }}
      footer={
        <>
          <Typography
            variant="caption"
            noWrap
            sx={{ minHeight: 20, display: "block" }}
          >
            {analysis.showArrows && analysis.bestMove
              ? `${analysis.bestMove.color === "w" ? "White" : "Black"} to move: ${analysis.bestMove.san}`
              : "\u00A0"}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7, pt: 0.5 }}>
            {engineLabel(analysis.engineName).small} · depth {arenaDepth}. Uses
            the engine and search depth chosen for Arena evaluation in Settings.
            Positive scores favor White. Options are remembered.
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
            <Stack
              direction="row"
              gap={1}
              alignItems="center"
              role="status"
              sx={{ minHeight: 20 }}
            >
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  visibility:
                    analysis.busy || analysis.engineState.status !== "ready"
                      ? "visible"
                      : "hidden",
                }}
              >
                <CircularProgress size={14} />
              </Box>
              <Typography
                variant="caption"
                noWrap
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
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
  onShowStory,
}: {
  entry: ArenaMoveAnalysis;
  onShowStory: (story: MoveStory) => void;
}) {
  const { move, before, after } = entry;
  const classification = after?.moveClassification;
  const previousBestMove = getPreviousBestMoveFeedback({
    lastMove: move,
    lastEval: before,
    eval: after,
  });
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
      {previousBestMove && (
        <Typography variant="caption" color="text.secondary">
          Previous move · {previousBestMove.context},{" "}
          {previousBestMove.alternative.san} was the best move.
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
            onClick={() => onShowStory(story)}
          >
            Show why
          </Button>
        </>
      )}
    </Stack>
  );
}
