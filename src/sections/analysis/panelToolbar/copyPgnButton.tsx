import { useAtomValue } from "jotai";
import { displayedAnalysisPgnAtom } from "../sessionAtoms";
import { ToolbarButton } from "@/components/ToolbarButton";
import { useCopyText } from "@/hooks/useCopyText";

export const CopyPgnButton = () => {
  const pgn = useAtomValue(displayedAnalysisPgnAtom);
  const { copy, feedback } = useCopyText();

  return (
    <>
      <ToolbarButton
        tooltip="Copy line PGN"
        onClick={() => {
          void copy(pgn, "Line PGN");
        }}
        icon="ri:clipboard-line"
      />
      {feedback}
    </>
  );
};
