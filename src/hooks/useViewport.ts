import { useEffect, useLayoutEffect, useState } from "react";
const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
export function useViewport(
  selector: string,
  initialWidth: number,
  initialHeight: number
) {
  const [dims, setDims] = useState({
    width: initialWidth,
    height: initialHeight,
    windowWidth: initialWidth,
  });
  useBrowserLayoutEffect(() => {
    const element = document.querySelector(selector);
    let frame = 0;
    const measure = () => {
      const next = {
        width: element?.clientWidth ?? window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
      };
      setDims((previous) =>
        previous.width === next.width &&
        previous.height === next.height &&
        previous.windowWidth === next.windowWidth
          ? previous
          : next
      );
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    measure();
    const observer = new ResizeObserver(schedule);
    if (element) observer.observe(element);
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
    };
  }, [selector]);
  return dims;
}
