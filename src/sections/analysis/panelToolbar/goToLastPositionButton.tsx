import { useAtomValue } from "jotai";
import { analysisReplayStateAtom } from "../sessionAtoms";
import { useAnalysisNavigation } from "../hooks/useAnalysisNavigation";
import { ToolbarButton } from "@/components/ToolbarButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

export default function GoToLastPositionButton() {
  const { atEnd: isButtonDisabled } = useAtomValue(analysisReplayStateAtom);
  const navigate = useAnalysisNavigation();

  const goToLastPosition = () => {
    if (isButtonDisabled) return;
    navigate("end");
  };

  useKeyboardShortcut("ArrowUp", goToLastPosition);

  return (
    <ToolbarButton
      tooltip="Final position (↑)"
      onClick={goToLastPosition}
      icon="ri:skip-forward-line"
      disabled={isButtonDisabled}
    />
  );
}
