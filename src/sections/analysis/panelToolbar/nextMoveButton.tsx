import { useAtomValue } from "jotai";
import { analysisReplayStateAtom } from "../sessionAtoms";
import { useAnalysisNavigation } from "../hooks/useAnalysisNavigation";
import { useCallback } from "react";
import { ToolbarButton } from "@/components/ToolbarButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export const useNextMove = () => {
  const state = useAtomValue(analysisReplayStateAtom);
  const navigate = useAnalysisNavigation();
  const goNext = useCallback(() => navigate("next"), [navigate]);
  return { ...state, goNext };
};

export default function NextMoveButton() {
  const { canGoNext, goNext } = useNextMove();

  useKeyboardShortcut("ArrowRight", goNext);

  return (
    <ToolbarButton
      tooltip="Next move (→)"
      onClick={goNext}
      icon="ri:arrow-right-s-line"
      disabled={!canGoNext}
      iconHeight={30}
    />
  );
}
