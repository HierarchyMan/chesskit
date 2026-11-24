import { Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  analysisCascadeNarrationAtom,
  analysisCascadeStoryAtom,
  analysisHighlightsAtom,
  boardAtom,
  currentPositionAtom,
} from "../../states";
import { useEffect, useMemo } from "react";
import { getMoveFeedback } from "@/lib/bestMoveHint";
import Image from "next/image";
import PrettyMoveSan from "@/components/prettyMoveSan";
import { positionFor } from "@/lib/currentPosition";
import { CLASSIFICATION_PHRASES } from "@/lib/classificationLabels";
import { CLASSIFICATION_COLORS } from "@/constants";
import { buildAnalysisFeedback } from "@/lib/analysisFeedback";

export default function MoveInfo() {
  const board = useAtomValue(boardAtom);
  const position = positionFor(useAtomValue(currentPositionAtom), board.fen());
  const setCascadeStory = useSetAtom(analysisCascadeStoryAtom);
  const cascadeNarration = useAtomValue(analysisCascadeNarrationAtom);
  const setAnalysisHighlights = useSetAtom(analysisHighlightsAtom);
  const plyCount = board.history().length;

  const { classification: moveClassification, previousBestMove } = useMemo(
    () => getMoveFeedback(position),
    [position]
  );

  const commentary = useMemo(
    () => buildAnalysisFeedback(position, plyCount),
    [position, plyCount]
  );

  useEffect(() => {
    setAnalysisHighlights(commentary?.highlights ?? []);
    return () => setAnalysisHighlights([]);
  }, [commentary, setAnalysisHighlights]);

  const accentColor = cascadeNarration
    ? "#f5b82e"
    : moveClassification
      ? CLASSIFICATION_COLORS[moveClassification]
      : undefined;
  const canShowWhy = !!commentary?.story;

  const frameSx = {
    mt: 0.5,
    pl: 1.5,
    pr: 1,
    py: 0.85,
    height: 112,
    minHeight: 112,
    maxHeight: 112,
    boxSizing: "border-box" as const,
    overflowY: "auto" as const,
    scrollbarGutter: "stable" as const,
    borderLeft: "2.5px solid",
    borderColor: accentColor ?? "divider",
    borderRadius: "0 8px 8px 0",
    bgcolor: (theme: { palette: { mode: string } }) =>
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.025)"
        : "rgba(0, 0, 0, 0.025)",
  };

  if (cascadeNarration) {
    return (
      <Box data-analysis-move-feedback sx={frameSx}>
        <Stack spacing={0.6}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
          >
            <Chip
              size="small"
              label={
                cascadeNarration.branch === "better"
                  ? "Stronger line"
                  : "Showing why"
              }
              sx={{
                height: 20,
                fontSize: "0.69rem",
                fontWeight: 700,
                bgcolor: "rgba(245, 184, 46, 0.22)",
                color: "#f5b82e",
                "& .MuiChip-label": { px: 0.85 },
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              Step {cascadeNarration.stepIndex}/{cascadeNarration.maxStep}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            sx={{ fontSize: "0.84rem", lineHeight: 1.45 }}
          >
            {cascadeNarration.san ? (
              <strong>{cascadeNarration.san}: </strong>
            ) : null}
            {cascadeNarration.caption ?? "Step through the line on the board."}
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (plyCount === 0) {
    return (
      <Box data-analysis-move-feedback sx={frameSx}>
        <Typography
          variant="body2"
          sx={{
            fontSize: "0.82rem",
            color: "text.secondary",
            lineHeight: 1.45,
          }}
        >
          Starting position. Step forward or play a move on the board to see
          move feedback here.
        </Typography>
      </Box>
    );
  }

  if (!position.eval) {
    return (
      <Box data-analysis-move-feedback sx={frameSx}>
        <Stack spacing={0.75}>
          <Skeleton
            variant="rounded"
            animation="wave"
            width="58%"
            height={20}
          />
          <Skeleton
            variant="rounded"
            animation="wave"
            width="90%"
            height={16}
          />
          <Skeleton
            variant="rounded"
            animation="wave"
            width="72%"
            height={16}
          />
        </Stack>
      </Box>
    );
  }

  return (
    <Box data-analysis-move-feedback sx={frameSx}>
      <Stack spacing={0.6}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          columnGap={1.25}
          rowGap={0.5}
          flexWrap="wrap"
        >
          {moveClassification && (
            <Stack direction="row" alignItems="center" spacing={0.85}>
              <Image
                src={`/icons/${moveClassification}.png`}
                alt="move-icon"
                width={16}
                height={16}
              />

              <PrettyMoveSan
                typographyProps={{
                  fontSize: "0.88rem",
                  fontWeight: 600,
                }}
                san={position.lastMove?.san ?? ""}
                color={position.lastMove?.color ?? "w"}
                additionalText={
                  " is " + CLASSIFICATION_PHRASES[moveClassification]
                }
              />
            </Stack>
          )}

          {commentary?.motifLabel && (
            <Chip
              size="small"
              label={commentary.motifLabel}
              variant="outlined"
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 600,
                borderColor: "divider",
                color: "text.secondary",
                "& .MuiChip-label": { px: 0.85 },
              }}
            />
          )}
        </Stack>

        {commentary?.sentence && (
          <Typography
            variant="body2"
            sx={{
              fontSize: "0.82rem",
              lineHeight: 1.45,
              color: "text.secondary",
            }}
          >
            {commentary.sentence}
          </Typography>
        )}

        {(previousBestMove || canShowWhy) && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            columnGap={1.5}
            rowGap={0.5}
            flexWrap="wrap"
            pt={0.15}
          >
            {previousBestMove ? (
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.5}
                flexWrap="wrap"
                sx={{ color: "text.secondary", opacity: 0.85 }}
              >
                <Icon icon="mdi:history" height={14} />
                <Typography variant="caption">
                  {previousBestMove.context},
                </Typography>
                <PrettyMoveSan
                  typographyProps={{
                    variant: "caption",
                  }}
                  san={previousBestMove.alternative.san}
                  color={previousBestMove.alternative.color}
                  additionalText=" was best"
                />
              </Stack>
            ) : (
              <span />
            )}

            {canShowWhy && commentary?.story && (
              <Button
                size="small"
                variant="text"
                startIcon={<Icon icon="mdi:play-circle-outline" width={15} />}
                onClick={() => setCascadeStory(commentary.story!)}
                sx={{
                  py: 0,
                  px: 0.75,
                  minHeight: 24,
                  fontSize: "0.75rem",
                  color: "text.secondary",
                  "&:hover": { color: "text.primary" },
                }}
              >
                Show why
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
