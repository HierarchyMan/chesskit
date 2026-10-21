import { useViewport } from "./useViewport";
export const useScreenSize = () => {
  const viewport = useViewport(".MuiGrid2-root", 500, 600);
  return {
    width: viewport.width,
    height: viewport.height - 100,
    windowWidth: viewport.windowWidth,
  };
};
