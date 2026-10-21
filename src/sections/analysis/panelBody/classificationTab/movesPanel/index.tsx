import { Grid2 as Grid } from "@mui/material";
import { useAtomValue } from "jotai";
import {
  boardAtom,
  currentPositionAtom,
  gameAtom,
  gameEvalAtom,
} from "../../../states";
import { useChessActions } from "@/hooks/useChessActions";
import MovesList from "@/components/movesList";

export default function MovesPanel() {
  const game = useAtomValue(gameAtom);
  const evaluation = useAtomValue(gameEvalAtom);
  const position = useAtomValue(currentPositionAtom);
  const { goToMove } = useChessActions(boardAtom);
  const history = game.history({ verbose: true });
  if (!history.length) return null;
  return (
    <Grid size={6} sx={{ minWidth: 0, overflowY: "auto" }} id="moves-panel">
      <MovesList
        moves={history.map((move) => move.san)}
        startsWithBlack={history[0].color === "b"}
        firstMoveNumber={Number(history[0].before.split(" ")[5])}
        currentPly={position.currentMoveIdx}
        onSelect={(ply) => goToMove(ply, game)}
        maxHeight="22rem"
        annotations={
          evaluation
            ? history.map((_, index) => ({
                classification:
                  evaluation.positions[index + 1]?.moveClassification,
              }))
            : undefined
        }
      />
    </Grid>
  );
}
