import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { ReplayAction } from "@/lib/chessHistory";
import { playSoundFromMove } from "@/lib/sounds";
import { navigateAnalysisAtom } from "../sessionAtoms";

export function useAnalysisNavigation() {
  const navigate = useSetAtom(navigateAnalysisAtom);
  return useCallback(
    (action: ReplayAction) => {
      const move = navigate(action);
      if (move) playSoundFromMove(move);
    },
    [navigate]
  );
}
