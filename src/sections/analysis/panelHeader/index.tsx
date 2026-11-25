import { Box } from "@mui/material";
import { useAtomValue } from "jotai";
import { evaluationProgressAtom } from "../states";

/** Slim 3px progress bar rendered ONLY while a full-game evaluation is in progress. */
export default function PanelHeader() {
  const evaluationProgress = useAtomValue(evaluationProgressAtom);

  if (!(evaluationProgress > 0 && evaluationProgress < 100)) {
    return null;
  }

  return (
    <Box
      role="progressbar"
      aria-valuenow={Math.round(evaluationProgress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Analyzing ${Math.round(evaluationProgress)} percent`}
      sx={{
        height: 3,
        width: "100%",
        bgcolor: "action.hover",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          height: "100%",
          width: `${evaluationProgress}%`,
          bgcolor: "primary.main",
          transition: "width 120ms linear",
        }}
      />
    </Box>
  );
}
