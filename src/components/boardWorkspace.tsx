import { Box } from "@mui/material";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fitBoardWorkspace } from "@/lib/boardWorkspace";

const useMeasuredLayout =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Stage {
  width: number;
  reportChrome: (height: number, gutter: number) => void;
}
const StageContext = createContext<Stage | null>(null);
export const useBoardStage = () => useContext(StageContext);
const InspectorContext = createContext(false);
export const useInBoardInspector = () => useContext(InspectorContext);
const PageFlowContext = createContext(false);
export const useWorkspacePageFlow = () => useContext(PageFlowContext);

/** A board-only stage (Vision and similar tools) has no player/replay chrome. */
export function SquareBoardStage({
  children,
}: {
  children: (size: number) => ReactNode;
}) {
  const stage = useBoardStage();
  const reportChrome = stage?.reportChrome;
  useMeasuredLayout(() => {
    reportChrome?.(0, 0);
  }, [reportChrome]);
  const size = stage?.width ?? 400;
  return (
    <Box sx={{ width: size, maxWidth: "100%", position: "relative" }}>
      {children(size)}
    </Box>
  );
}

/** Owns the available rectangle, independently of moves, reports, and inspector content. */
export default function BoardWorkspace({
  board,
  inspector,
  inspectorMinWidth = 380,
  inspectorLabel = "Analysis tools",
}: {
  board: ReactNode;
  inspector: ReactNode;
  inspectorMinWidth?: number;
  inspectorLabel?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({
    width: 1000,
    height: 600,
    portrait: false,
  });
  const [chrome, setChrome] = useState({ height: 144, gutter: 48 });
  const reportChrome = useCallback((height: number, gutter: number) => {
    const next = { height: Math.ceil(height), gutter: Math.ceil(gutter) };
    setChrome((previous) =>
      previous.height === next.height && previous.gutter === next.gutter
        ? previous
        : next
    );
  }, []);

  useMeasuredLayout(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const next = {
        width: Math.floor(element.clientWidth),
        portrait: window.innerHeight > window.innerWidth,
        height: Math.max(
          200,
          Math.floor(window.innerHeight - (rect.top + window.scrollY) - 12)
        ),
      };
      setBounds((previous) =>
        previous.width === next.width &&
        previous.height === next.height &&
        previous.portrait === next.portrait
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
    observer.observe(element);
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const fit = fitBoardWorkspace({
    ...bounds,
    inspectorMinWidth,
    chromeHeight: chrome.height,
    gutterWidth: chrome.gutter,
  });
  const stage = useMemo(
    () => ({ width: fit.boardWidth, reportChrome }),
    [fit.boardWidth, reportChrome]
  );

  return (
    <Box
      ref={root}
      data-board-workspace={fit.sideBySide ? "bounded" : "stacked"}
      sx={{
        display: "grid",
        gridTemplateColumns: fit.sideBySide
          ? `${fit.boardWidth}px minmax(0, 1fr)`
          : "minmax(0, 1fr)",
        gap: "20px",
        height: fit.sideBySide ? fit.height : "auto",
        minWidth: 0,
        minHeight: 0,
        alignItems: "start",
      }}
    >
      <Box
        data-board-stage
        sx={{ display: "flex", justifyContent: "flex-start", minWidth: 0 }}
      >
        <StageContext.Provider value={stage}>{board}</StageContext.Provider>
      </Box>
      <Box
        component="aside"
        aria-label={inspectorLabel}
        data-workspace-inspector
        sx={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          height: fit.sideBySide ? "100%" : "auto",
          maxHeight: fit.sideBySide ? "100%" : undefined,
          overflowX: fit.sideBySide ? "hidden" : "visible",
          overflowY: fit.sideBySide ? "auto" : "visible",
          overscrollBehavior: fit.sideBySide ? "contain" : "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1.5,
          bgcolor: "background.paper",
          "& > *": { minWidth: 0 },
          ...(!fit.sideBySide
            ? {
                // Stacked workspaces have one scroll owner: the document.
                // Both axes must be visible: hidden X would turn visible Y into auto.
                "& [data-inspector-scroller]": {
                  maxHeight: "none",
                  overflow: "visible",
                  overscrollBehavior: "auto",
                  scrollbarGutter: "auto",
                },
              }
            : {}),
        }}
      >
        <InspectorContext.Provider value={true}>
          <PageFlowContext.Provider value={!fit.sideBySide}>
            {inspector}
          </PageFlowContext.Provider>
        </InspectorContext.Provider>
      </Box>
    </Box>
  );
}
