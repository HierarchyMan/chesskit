import { useAtomValue } from "jotai";
import { Grid2 as Grid, Typography } from "@mui/material";
import { currentPositionAtom } from "../../states";

export default function Opening() {
  const position = useAtomValue(currentPositionAtom);

  const lastMove = position?.lastMove;
  if (!lastMove) return null;

  const opening = position?.eval?.opening || position.opening;

  if (!opening) return null;

  return (
    <Grid>
      <Typography fontSize="0.9rem" color="text.secondary">
        {opening}
      </Typography>
    </Grid>
  );
}
