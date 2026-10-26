import { Grid2 as Grid, Grid2Props as GridProps, List } from "@mui/material";
import LineEvaluation from "./lineEvaluation";
import {
  boardAtom,
  currentPositionAtom,
  engineMultiPvAtom,
  engineNameAtom,
} from "../../../states";
import { useAtomValue, useSetAtom } from "jotai";
import { LineEval } from "@/types/eval";
import { positionFor } from "@/lib/currentPosition";
import { EngineFailureAlert } from "@/components/engineDownloadAlert";
import { DEFAULT_ENGINE } from "@/constants";
import { useAnalysisEngine } from "../../../engineContext";

export default function EngineLines(props: GridProps) {
  const board = useAtomValue(boardAtom);
  const linesNumber = useAtomValue(engineMultiPvAtom);
  const position = positionFor(useAtomValue(currentPositionAtom), board.fen());
  const engine = useAnalysisEngine();
  const setEngineName = useSetAtom(engineNameAtom);

  // An engine that did not start (or is not downloaded) takes the place of its lines.
  if (engine.status === "error") {
    return (
      <Grid container {...props}>
        <EngineFailureAlert
          state={engine}
          retryLabel="Retry analysis"
          onUseDefault={() => setEngineName(DEFAULT_ENGINE)}
        />
      </Grid>
    );
  }

  const linesSkeleton: LineEval[] = Array.from({ length: linesNumber }).map(
    (_, i) => ({ pv: [`${i}`], depth: 0, multiPv: i + 1 })
  );

  // The search may hold more lines than the list is set to show.
  const engineLines = position?.eval?.lines?.length
    ? position.eval.lines.slice(0, linesNumber)
    : linesSkeleton;

  if (board.isGameOver()) return null;

  return (
    <Grid container justifyContent="center" alignItems="center" {...props}>
      <List sx={{ width: "100%", padding: 0 }}>
        {engineLines.map((line) => (
          <LineEvaluation key={line.multiPv} line={line} />
        ))}
      </List>
    </Grid>
  );
}
