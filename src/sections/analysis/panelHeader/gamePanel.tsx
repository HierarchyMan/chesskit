import { Grid2 as Grid, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import { gameAtom } from "../states";

export default function GamePanel() {
  const game = useAtomValue(gameAtom);
  const gameHeaders = game.getHeaders();

  const hasGameInfo = !!gameHeaders.White && gameHeaders.White !== "?";

  if (!hasGameInfo) return null;

  const termination = gameHeaders.Termination || "?";
  const result =
    termination.split(" ").length > 2 ? termination : gameHeaders.Result || "?";

  return (
    <Grid
      container
      justifyContent="space-evenly"
      alignItems="center"
      rowGap={1}
      columnGap={3}
      size={11}
    >
      <Grid container justifyContent="center" alignItems="center" size="grow">
        <Typography noWrap fontSize="0.9rem">
          Site : {gameHeaders.Site || "?"}
        </Typography>
      </Grid>

      <Grid container justifyContent="center" alignItems="center" size="grow">
        <Typography noWrap fontSize="0.9rem">
          Date : {gameHeaders.Date || "?"}
        </Typography>
      </Grid>

      <Grid container justifyContent="center" alignItems="center" size="grow">
        <Typography noWrap fontSize="0.9rem">
          Result : {result}
        </Typography>
      </Grid>
    </Grid>
  );
}
