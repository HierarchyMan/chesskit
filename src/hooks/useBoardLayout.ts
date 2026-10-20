import { useEffect, useState } from "react";

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
  const [dims, setDims] = useState({ width: 900, height: 800 });

  useEffect(() => {
    const main = document.querySelector("main");

    const update = () =>
      setDims({
        width: main?.clientWidth ?? window.innerWidth,
        height: window.innerHeight,
      });

    update();

    const observer = new ResizeObserver(update);
    if (main) observer.observe(main);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const widthLeftForBoard = dims.width - sidePanelWidth - GAP - extraWidth;
  const sideBySide = widthLeftForBoard >= 380;
  const boardByWidth = sideBySide ? widthLeftForBoard : dims.width - extraWidth;
  const boardByHeight = dims.height * 0.96 - HEADERS_AND_CHROME;

  const boardSize = Math.floor(
    Math.max(minBoardSize, Math.min(boardByWidth, boardByHeight))
  );

  return { boardSize, sideBySide, containerWidth: dims.width };
};
