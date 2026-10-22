import { useAtomValue } from "jotai";
import { displayedAnalysisGameAtom } from "../sessionAtoms";
import { ToolbarButton } from "@/components/ToolbarButton";

export const CopyPgnButton = () => {
  const game = useAtomValue(displayedAnalysisGameAtom);

  return (
    <ToolbarButton
      tooltip="Copy PGN"
      onClick={() => {
        navigator.clipboard?.writeText?.(game.pgn());
      }}
      icon="ri:clipboard-line"
      disabled={game.history().length === 0}
    />
  );
};
