import { useAtomValue } from "jotai";
import { Grid2 as Grid, Typography } from "@mui/material";
import { currentPositionAtom } from "../../states";

export default function Opening() {
  const position = useAtomValue(currentPositionAtom);

  const lastMove = position?.lastMove;
  const opening = lastMove ? position?.eval?.opening || position.opening : "";

  return (
    <Grid sx={{ height: 22, minHeight: 22, overflow: "hidden" }}>
      <Typography
        fontSize="0.9rem"
        color="text.secondary"
        noWrap
        title={opening || undefined}
      >
        {opening || "\u00A0"}
      </Typography>
    </Grid>
  );
}
