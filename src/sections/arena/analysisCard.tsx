import AnalysisOptionsPanel, {
  AnalysisOptionCopy,
} from "@/components/analysisOptions/analysisOptionsPanel";
import { CLASSIFICATION_COLORS, engineLabel } from "@/constants";
import {
  CLASSIFICATION_PHRASES,
  WORTH_VISUALIZING,
  classificationName,
} from "@/lib/classificationLabels";
import { getLineEvalLabel } from "@/lib/chess";
import { AnalysisOption } from "@/lib/analysisOptions";
import { useEffectiveArenaEval } from "@/hooks/useEffectiveEngineSettings";
import { ArenaMoveAnalysis } from "@/lib/engine/arenaAnalysis";
import { buildMoveStory, MoveStory } from "@/lib/visualize/moveStory";
import { describeMove } from "@/lib/visualize/explain";
import { getPreviousBestMoveFeedback } from "@/lib/bestMoveHint";
import { MoveClassification } from "@/types/enums";
import {
  Alert,
  Box,
  Button,
  Chip,
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
    help: "Grade each move on the board and in the move list. Select any move to explain or visualize it.",
  },
};

const DARK_INK_CLASSIFICATIONS = new Set<MoveClassification>([
  MoveClassification.Inaccuracy,
  MoveClassification.Mistake,
  MoveClassification.Opening,
  MoveClassification.Forced,
  MoveClassification.Splendid,
]);

const formatAccuracy = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;

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
      footer={
        <Stack spacing={0.75}>
          {(analysis.opening || (analysis.showAnnotations && hasMoves)) && (
            <Box
              sx={{
                px: 1.25,
                py: 0.85,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
                bgcolor: "action.hover",
              }}
            >
              {analysis.opening && (
                <Typography
                  variant="caption"
                  fontWeight={600}
                  noWrap
                  display="block"
                  title={analysis.opening}
                >
                  {analysis.opening}
                </Typography>
              )}
              {analysis.showAnnotations && hasMoves && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  Accuracy: White {formatAccuracy(analysis.accuracy?.white)} ·
                  Black {formatAccuracy(analysis.accuracy?.black)}
                </Typography>
              )}
            </Box>
          )}

          {analysis.showArrows && analysis.bestMove && (
            <Typography variant="caption" noWrap display="block">
              {analysis.bestMove.color === "w" ? "White" : "Black"} best:{" "}
              <b>{analysis.bestMove.san}</b>
            </Typography>
          )}

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {engineLabel(analysis.engineName).small} · depth {arenaDepth}
          </Typography>

          {analysis.error ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={analysis.retry}>
                  Retry
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
                color="text.secondary"
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
        </Stack>
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
    if (!WORTH_VISUALIZING.includes(classification)) {
      result.summary = [describeMove(move.before, move.lan).text];
    }
    return result;
  }, [move, before, after, classification]);
  const moveNumber = move.before.split(" ")[5];
  const evalLine = after?.lines[0];
  const darkInk = classification
    ? DARK_INK_CLASSIFICATIONS.has(classification)
    : false;

  return (
    <Stack
      spacing={1}
      sx={{
        mt: 1.5,
        p: 1.25,
        borderRadius: 1.5,
        border: 1,
        borderColor: "divider",
        bgcolor: "action.hover",
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {moveNumber}
          {move.color === "w" ? "." : "…"} {move.san}
        </Typography>
        {classification ? (
          <Chip
            size="small"
            label={classificationName(classification)}
            sx={{
              height: 22,
              fontWeight: 600,
              color: darkInk ? "#111" : "#fff",
              bgcolor: CLASSIFICATION_COLORS[classification],
            }}
          />
        ) : (
          <Chip
            size="small"
            variant="outlined"
            label="Pending…"
            sx={{ height: 22 }}
          />
        )}
        {evalLine && (
          <Chip
            size="small"
            variant="outlined"
            label={getLineEvalLabel(evalLine)}
            sx={{
              height: 22,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          />
        )}
      </Stack>

      {classification && (
        <Typography variant="caption" color="text.secondary">
          {move.san} is {CLASSIFICATION_PHRASES[classification]}.
        </Typography>
      )}
      {previousBestMove && (
        <Typography variant="caption" color="text.secondary">
          Previous move: {previousBestMove.context},{" "}
          <b>{previousBestMove.alternative.san}</b> was best.
        </Typography>
      )}
      {story && (
        <>
          <Typography variant="body2">{story.summary[0]}</Typography>
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
