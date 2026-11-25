import { Box, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import dynamic from "next/dynamic";
import { gameEvalAtom } from "../../states";
import PlayersMetric from "../analysisTab/playersMetric";
import MovesClassificationsRecap from "./movesClassificationsRecap";
import AnalyzeButton from "../../panelHeader/analyzeButton";

const GraphTab = dynamic(() => import("../graphTab"), { ssr: false });

export default function ClassificationTab({
  hidden = false,
}: {
  hidden?: boolean;
}) {
  const gameEval = useAtomValue(gameEvalAtom);

  if (hidden) return null;

  if (!gameEval) {
    return (
      <Stack
        spacing={1.5}
        alignItems="center"
        justifyContent="center"
        textAlign="center"
        sx={{
          py: 4,
          px: 2,
          borderRadius: 1.5,
          border: 1,
          borderColor: "divider",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.02)"
              : "rgba(0,0,0,0.015)",
        }}
      >
        <Icon
          icon="mdi:chart-areaspline"
          height={36}
          style={{ opacity: 0.55 }}
        />
        <Box>
          <Typography variant="subtitle2" fontWeight={600}>
            No game review yet
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mt: 0.5, maxWidth: 280 }}
          >
            Run a full game analysis to view accuracy, move classifications, and
            the win-probability graph.
          </Typography>
        </Box>
        <AnalyzeButton label="Analyze game" />
      </Stack>
    );
  }

  return (
    <Stack spacing={1.75} sx={{ minWidth: 0, width: "100%" }}>
      <Stack spacing={1}>
        <PlayersMetric
          title="Accuracy"
          whiteValue={
            gameEval.accuracy.white === null
              ? "—"
              : `${gameEval.accuracy.white.toFixed(1)}%`
          }
          blackValue={
            gameEval.accuracy.black === null
              ? "—"
              : `${gameEval.accuracy.black.toFixed(1)}%`
          }
        />

        {gameEval.estimatedElo && (
          <PlayersMetric
            title="Game Rating"
            whiteValue={
              gameEval.estimatedElo.white === null
                ? "—"
                : Math.round(gameEval.estimatedElo.white)
            }
            blackValue={
              gameEval.estimatedElo.black === null
                ? "—"
                : Math.round(gameEval.estimatedElo.black)
            }
          />
        )}
      </Stack>

      <GraphTab hidden={hidden} />

      <MovesClassificationsRecap />
    </Stack>
  );
}
