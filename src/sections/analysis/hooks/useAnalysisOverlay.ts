import { useEngineArrows } from "@/components/board/useEngineArrows";
import { ARROW_CAPABILITIES } from "@/lib/arrows/prefs";
import {
  currentPositionAtom,
  boardArrowsAtom,
  boardAtom,
  analysisArrowPrefsAtom,
} from "../states";
import { useAtomValue } from "jotai";

/**
 * The Analysis page's engine arrows, composed once for the page. The board
 * draws them and the overlay inspector lists them, so the two read the same
 * state and a legend focus shows on the board it describes.
 */
export const useAnalysisOverlay = () => {
  const position = useAtomValue(currentPositionAtom);
  const board = useAtomValue(boardAtom);
  const panelArrows = useAtomValue(boardArrowsAtom);

  return useEngineArrows({
    position,
    fen: board.fen(),
    prefsAtom: analysisArrowPrefsAtom,
    capabilities: ARROW_CAPABILITIES.analysis,
    extra: panelArrows,
  });
};

export type AnalysisOverlay = ReturnType<typeof useAnalysisOverlay>;
