import { useScreenSize } from "@/hooks/useScreenSize";
import { useMemo } from "react";

export const useAnalysisBoardSize = (): number => {
  const screenSize = useScreenSize();

  return useMemo(() => {
    const width = screenSize.width;
    const height = screenSize.height;

    // 1200 is the lg layout breakpoint
    if (screenSize.windowWidth < 1200) {
      return Math.min(width, height - 150);
    }

    return Math.min(width - 700, height * 0.92);
  }, [screenSize]);
};
