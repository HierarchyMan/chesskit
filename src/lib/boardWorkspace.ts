export interface WorkspaceBounds {
  width: number;
  height: number;
  inspectorMinWidth: number;
  chromeHeight: number;
  gutterWidth: number;
  /** Viewport orientation, independent of navigation and header space. */
  portrait?: boolean;
  /**
   * Minimum vertical pixels reserved for above-the-fold context, live feedback,
   * and the primary action bar in stacked/vertical mode.
   */
  verticalReserveHeight?: number;
}

export const DEFAULT_VERTICAL_RESERVE_HEIGHT = 176;

/** Fit the square and its real chrome; inspector contents never enter this calculation. */
export function fitBoardWorkspace({
  width,
  height,
  inspectorMinWidth,
  chromeHeight,
  gutterWidth,
  portrait = height > width,
  verticalReserveHeight = DEFAULT_VERTICAL_RESERVE_HEIGHT,
}: WorkspaceBounds) {
  const gap = 20;
  const usableSquare = 300;
  const sideBySide =
    !portrait &&
    width >= inspectorMinWidth + gap + gutterWidth + usableSquare &&
    height >= chromeHeight + 160;
  const stageWidth = sideBySide ? width - inspectorMinWidth - gap : width;
  const maxVerticalSquare = Math.max(
    220,
    Math.floor(height - chromeHeight - verticalReserveHeight)
  );
  const square = Math.max(
    160,
    Math.floor(
      Math.min(
        Math.max(0, stageWidth - gutterWidth),
        sideBySide ? Math.max(160, height - chromeHeight) : maxVerticalSquare
      )
    )
  );
  const boardWidth = Math.max(0, Math.min(stageWidth, square + gutterWidth));
  return {
    sideBySide,
    // A narrow window may be smaller than the preferred square; never overflow its width.
    boardWidth,
    inspectorWidth: sideBySide
      ? Math.max(inspectorMinWidth, width - boardWidth - gap)
      : width,
    height,
  };
}
