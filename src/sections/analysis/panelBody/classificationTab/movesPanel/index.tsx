import { Grid2 as Grid } from "@mui/material";
import { useVisibleAtomValue } from "@/hooks/useVisibleAtomValue";
import { memo } from "react";
import {
  boardAtom,
  currentPositionAtom,
  gameAtom,
  gameEvalAtom,
} from "../../../states";
import { useChessActions } from "@/hooks/useChessActions";
import MovesList from "@/components/movesList";

function MovesPanel({ visible }: { visible: boolean }) {
  const game = useVisibleAtomValue(gameAtom, visible);
  const evaluation = useVisibleAtomValue(gameEvalAtom, visible);
  const position = useVisibleAtomValue(currentPositionAtom, visible);
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

export default memo(MovesPanel);
