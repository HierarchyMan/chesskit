import { Box, Paper, Stack, Typography } from "@mui/material";
import { TooltipProps } from "recharts";
import { ChartItemData } from "./types";
import { getLineEvalLabel } from "@/lib/chess";
import { classificationName } from "@/lib/classificationLabels";
import { CLASSIFICATION_COLORS } from "@/constants";

export default function CustomTooltip({
  active,
  payload,
}: TooltipProps<number, number>) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as ChartItemData;
  const evalLabel = getLineEvalLabel(data);
  const classification = data.moveClassification;
  const classColor = classification
    ? CLASSIFICATION_COLORS[classification]
    : undefined;

  return (
    <Paper
      elevation={3}
      sx={{
        px: 1.25,
        py: 0.75,
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        gap={0.75}
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {classColor && (
          <Box
            aria-hidden
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: classColor,
              flexShrink: 0,
            }}
          />
        )}
        <Typography variant="caption" fontWeight={700} noWrap>
          {data.moveLabel ?? "Start"}
        </Typography>
        {classification && (
          <Typography
            variant="caption"
            fontWeight={600}
            noWrap
            sx={{ color: classColor }}
          >
            · {classificationName(classification)}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          · {evalLabel}
        </Typography>
      </Stack>
    </Paper>
  );
}
