import { CellAnalysis, analyzeCell, sampleCell } from "./cell";
import {
  ClassifiedCell,
  ScanPosition,
  ShapeTemplate,
  buildScanPosition,
  classifyCells,
  detectWhiteAtBottom,
} from "./classify";
import { GridRect, RawImage } from "./gridDetect";

export interface ScanOutcome {
  grid: GridRect;
  position: ScanPosition;
  classified: ClassifiedCell[];
  analyses: CellAnalysis[];
}

export const scanBoard = (
  image: RawImage,
  templates: ShapeTemplate[],
  grid: GridRect,
  whiteAtBottom?: boolean
): ScanOutcome => {
  const analyses: CellAnalysis[] = [];

  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      analyses.push(analyzeCell(sampleCell(image, grid, column, row)));
    }
  }

  const classified = classifyCells(analyses, templates);
  const orientation = whiteAtBottom ?? detectWhiteAtBottom(classified);

  return {
    grid,
    classified,
    analyses,
    position: buildScanPosition(classified, orientation),
  };
};
