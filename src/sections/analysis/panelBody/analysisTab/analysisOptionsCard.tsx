import AnalysisOptionsPanel, {
  AnalysisOptionCopy,
} from "@/components/analysisOptions/analysisOptionsPanel";
import { AnalysisOption } from "@/lib/analysisOptions";
import { analysisOptionAtoms } from "../../states";
import { analysisPositionErrorAtom } from "../../sessionAtoms";
import { useAtomValue } from "jotai";
import { Alert, Button } from "@mui/material";
import { useAnalysisEngine } from "../../engineContext";

const ANALYSIS_OPTION_COPY: Record<AnalysisOption, AnalysisOptionCopy> = {
  evaluation: {
    label: "Evaluation bar",
    help: "Show the score bar beside the board. Analysis keeps running while it is hidden.",
  },
  annotations: {
    label: "Move annotations",
    help: "Show each played move's quality icon on the board. Grades in Moves and Graph stay visible.",
  },
  bestMove: {
    label: "Best-move arrow",
    help: "Show the engine's better alternative to the last move, unless that move was already best.",
  },
};

export default function AnalysisOptionsCard() {
  const error = useAtomValue(analysisPositionErrorAtom);
  const engine = useAnalysisEngine();
  return (
    <AnalysisOptionsPanel
      atoms={analysisOptionAtoms}
      copy={ANALYSIS_OPTION_COPY}
      footer={
        error ? (
          <Alert
            severity="error"
            action={<Button onClick={engine.retry}>Retry analysis</Button>}
          >
            {error}
          </Alert>
        ) : undefined
      }
    />
  );
}
