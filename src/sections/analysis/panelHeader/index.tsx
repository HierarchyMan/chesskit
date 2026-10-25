import { Box, Stack, Typography } from "@mui/material";
import LoadGame from "./loadGame";
import AnalyzeButton from "./analyzeButton";
import { useAtomValue } from "jotai";
import { evaluationProgressAtom } from "../states";

export default function PanelHeader() {
  const evaluationProgress = useAtomValue(evaluationProgressAtom);

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
      >
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ flex: 1, minWidth: 90 }}
        >
          Game analysis
        </Typography>
        <LoadGame />
        <AnalyzeButton />
      </Stack>
      <Box
        role="status"
        sx={{
          height: 3,
          bgcolor: "action.hover",
          mt: 0.75,
          borderRadius: 1,
          overflow: "hidden",
        }}
        aria-label={
          evaluationProgress
            ? `Analyzing ${Math.round(evaluationProgress)} percent`
            : "Analysis ready"
        }
      >
        <Box
          sx={{
            height: "100%",
            width: `${evaluationProgress}%`,
            bgcolor: "primary.main",
          }}
        />
      </Box>
    </Box>
  );
}
