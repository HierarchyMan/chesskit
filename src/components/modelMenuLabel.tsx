import { ENGINE_LABELS } from "@/constants";
import { ModelView, StatusTone, describeModel } from "@/lib/engine/modelStatus";
import { Box, Typography } from "@mui/material";

export const statusColor = (tone: StatusTone): string | undefined =>
  tone === "success"
    ? "success.main"
    : tone === "error"
      ? "error.main"
      : undefined;

export default function ModelMenuLabel({ view }: { view: ModelView }) {
  const status = describeModel(view);

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body1">
        {ENGINE_LABELS[view.model.name].full}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          color: statusColor(status.tone),
          opacity: status.tone === "default" ? 0.75 : 1,
        }}
      >
        {status.text}
      </Typography>
    </Box>
  );
}
