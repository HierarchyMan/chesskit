import {
  Grid2 as Grid,
  Grid2Props as GridProps,
  Stack,
  Typography,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { boardAtom, gameEvalAtom } from "../../states";
import PlayersMetric from "./playersMetric";
import MoveInfo from "./moveInfo";
import Opening from "./opening";
import EngineLines from "./engineLines";
import VisualizeContinuation from "./visualizeContinuation";

export default function AnalysisTab(props: GridProps) {
  const gameEval = useAtomValue(gameEvalAtom);
  const board = useAtomValue(boardAtom);

  const isGameOver = board.isGameOver();

  return (
    <Grid
      container
      size={12}
      justifyContent={{ xs: "center", lg: gameEval ? "start" : "center" }}
      alignItems="center"
      flexWrap="wrap"
      gap={2}
      marginY={{ lg: gameEval ? 1 : undefined }}
      paddingX={0}
      {...props}
      sx={props.hidden ? { display: "none" } : props.sx}
    >
      <Stack
        justifyContent="center"
        alignItems="stretch"
        rowGap={1}
        minWidth={0}
        width="100%"
      >
        <VisualizeContinuation />
        {gameEval && (
          <PlayersMetric
            title="Accuracy"
            whiteValue={
              gameEval.accuracy.white === null
                ? "—"
                : `${gameEval.accuracy.white.toFixed(1)} %`
            }
            blackValue={
              gameEval.accuracy.black === null
                ? "—"
                : `${gameEval.accuracy.black.toFixed(1)} %`
            }
          />
        )}

        {gameEval?.estimatedElo && (
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

        <MoveInfo />

        <Opening />

        {isGameOver && (
          <Typography align="center" fontSize="0.9rem" noWrap>
            Game is over
          </Typography>
        )}
      </Stack>

      <EngineLines size={12} />
    </Grid>
  );
}
