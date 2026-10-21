import { useViewport } from "./useViewport";

interface Options {
  sidePanelWidth?: number;
  extraWidth?: number;
  minBoardSize?: number;
}

const GAP = 32;
const HEADERS_AND_CHROME = 188;

export const useBoardLayout = ({
  sidePanelWidth = 440,
  extraWidth = 0,
  minBoardSize = 280,
}: Options = {}) => {
  const dims = useViewport("main", 900, 800);

  const widthLeftForBoard = dims.width - sidePanelWidth - GAP - extraWidth;
  const sideBySide = widthLeftForBoard >= 380;
  const boardByWidth = sideBySide ? widthLeftForBoard : dims.width - extraWidth;
  const boardByHeight = dims.height * 0.96 - HEADERS_AND_CHROME;

  const boardSize = Math.floor(
    Math.max(minBoardSize, Math.min(boardByWidth, boardByHeight))
  );

  return { boardSize, sideBySide, containerWidth: dims.width };
};
