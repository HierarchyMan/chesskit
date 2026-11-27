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
import {
  DEFAULT_VERTICAL_RESERVE_HEIGHT,
  fitBoardWorkspace,
} from "@/lib/boardWorkspace";

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

export interface WorkspaceLayout {
  /** True on landscape desktop/laptop; false when stacked vertically. */
  sideBySide: boolean;
  /** True on phone-width vertical screens (< 600px). */
  isCompactPhone: boolean;
  /** Measured width of the board stage in pixels. */
  boardWidth: number;
}

const DEFAULT_LAYOUT: WorkspaceLayout = {
  sideBySide: true,
  isCompactPhone: false,
  boardWidth: 480,
};

const LayoutContext = createContext<WorkspaceLayout>(DEFAULT_LAYOUT);
export const useWorkspaceLayout = () => useContext(LayoutContext);

export interface VerticalWorkspaceSlots {
  /** [1] Locked 38–40px identity/status/mode strip above the board. */
  contextBar?: ReactNode;
  /** [3] Bounded live feedback, palette, or keypad directly beneath the board. */
  liveStrip?: ReactNode;
  /** [4] Single-row 52px thumb deck (sticky bottom on <600px; under liveStrip on >=600px portrait). */
  actionBar?: ReactNode;
  /** [5] Natural single-scroll reference sheet (worth scrolling down for). */
  sheet?: ReactNode;
  /** Minimum vertical pixels reserved for contextBar + liveStrip + actionBar (default 176). */
  reserveHeight?: number;
  /** Hide the board stage in vertical mode (e.g. collapsible default setup preview). */
  hideBoard?: boolean;
}

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
  vertical,
  inspectorMinWidth = 380,
  inspectorLabel = "Analysis tools",
}: {
  board: ReactNode;
  inspector: ReactNode;
  vertical?: VerticalWorkspaceSlots;
  inspectorMinWidth?: number;
  inspectorLabel?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({
    width: 1000,
    height: 600,
    viewportWidth: 1280,
    portrait: false,
  });
  const [chrome, setChrome] = useState({ height: 144, gutter: 48 });
  const reportChrome = useCallback((height: number, gutter: number) => {
    const next = { height: Math.round(height), gutter: Math.round(gutter) };
    setChrome((previous) =>
      Math.abs(previous.height - next.height) <= 1 &&
      Math.abs(previous.gutter - next.gutter) <= 1
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
      const viewportWidth = window.innerWidth;
      const next = {
        width: Math.max(
          200,
          Math.floor(
            Math.min(
              element.clientWidth,
              viewportWidth -
                Math.max(0, rect.left) -
                (viewportWidth < 600 ? 8 : 12)
            )
          )
        ),
        viewportWidth,
        portrait: window.innerHeight > viewportWidth,
        height: Math.max(
          200,
          Math.floor(
            window.innerHeight -
              (rect.top + window.scrollY) -
              (viewportWidth < 600 ? 6 : 12)
          )
        ),
      };
      setBounds((previous) =>
        previous.width === next.width &&
        previous.height === next.height &&
        previous.viewportWidth === next.viewportWidth &&
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
    width: bounds.width,
    height: bounds.height,
    portrait: bounds.portrait,
    inspectorMinWidth,
    chromeHeight: chrome.height,
    gutterWidth: chrome.gutter,
    verticalReserveHeight:
      vertical?.reserveHeight ?? DEFAULT_VERTICAL_RESERVE_HEIGHT,
  });

  const isCompactPhone = !fit.sideBySide && bounds.viewportWidth < 600;

  const stage = useMemo(
    () => ({ width: fit.boardWidth, reportChrome }),
    [fit.boardWidth, reportChrome]
  );

  const layout = useMemo<WorkspaceLayout>(
    () => ({
      sideBySide: fit.sideBySide,
      isCompactPhone,
      boardWidth: fit.boardWidth,
    }),
    [fit.sideBySide, isCompactPhone, fit.boardWidth]
  );

  const content = fit.sideBySide ? (
    <Box
      data-board-workspace="bounded"
      sx={{
        display: "grid",
        gridTemplateColumns: `${fit.boardWidth}px minmax(0, 1fr)`,
        gap: "20px",
        height: fit.height,
        minWidth: 0,
        minHeight: 0,
        alignItems: "start",
      }}
    >
      <Box
        data-board-stage
        sx={{
          display: "flex",
          justifyContent: "flex-start",
          minWidth: 0,
          maxWidth: "100%",
        }}
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
          height: "100%",
          maxHeight: "100%",
          overflowX: "hidden",
          overflowY: "auto",
          overscrollBehavior: "contain",
          border: 1,
          borderColor: "divider",
          borderRadius: 1.5,
          bgcolor: "background.paper",
          "& > *": { minWidth: 0 },
        }}
      >
        <InspectorContext.Provider value={true}>
          <PageFlowContext.Provider value={false}>
            {inspector}
          </PageFlowContext.Provider>
        </InspectorContext.Provider>
      </Box>
    </Box>
  ) : vertical ? (
    <InspectorContext.Provider value={true}>
      <PageFlowContext.Provider value={true}>
        <Box
          data-board-workspace="vertical"
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: isCompactPhone ? 1 : 1.5,
            width: "100%",
            maxWidth: isCompactPhone ? "100%" : 740,
            mx: isCompactPhone ? 0 : "auto",
            minWidth: 0,
            minHeight: isCompactPhone ? "calc(100dvh - 56px)" : "auto",
            // Stacked workspaces have one scroll owner: the document.
            "& [data-inspector-scroller]": {
              maxHeight: "none",
              overflow: "visible",
              overscrollBehavior: "auto",
              scrollbarGutter: "auto",
            },
          }}
        >
          {/* [1] Slim Context Strip above board */}
          {vertical.contextBar}

          {/* [2] Height-aware centered Board Stage */}
          {!vertical.hideBoard && (
            <Box
              data-board-stage
              sx={{
                display: "flex",
                justifyContent: "center",
                minWidth: 0,
                maxWidth: "100%",
                flexShrink: 0,
              }}
            >
              <StageContext.Provider value={stage}>
                {board}
              </StageContext.Provider>
            </Box>
          )}

          {/* [3] Bounded Live Feedback / Active Input Strip */}
          {vertical.liveStrip}

          {/* On wider portrait tablets/monitors (>= 600px), place Action Bar directly below Live Strip */}
          {!isCompactPhone && vertical.actionBar && (
            <Box
              component="nav"
              aria-label={inspectorLabel}
              sx={{ flexShrink: 0 }}
            >
              {vertical.actionBar}
            </Box>
          )}

          {/* [5] Below-the-Fold Reference Sheet (natural single-document scroll) */}
          {vertical.sheet ? (
            <Box
              component="section"
              aria-label={inspectorLabel}
              data-workspace-inspector
              data-vertical-sheet
              sx={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                flex: isCompactPhone ? "1 0 auto" : undefined,
                border: 1,
                borderColor: "divider",
                borderRadius: 1.5,
                bgcolor: "background.paper",
                "& > *": { minWidth: 0 },
              }}
            >
              {vertical.sheet}
            </Box>
          ) : isCompactPhone && vertical.actionBar ? (
            <Box sx={{ flex: "1 0 0px" }} />
          ) : null}

          {/* [4] Sticky Bottom Thumb Action Bar on phones (< 600px) */}
          {isCompactPhone && vertical.actionBar && (
            <Box
              component="nav"
              aria-label={inspectorLabel}
              sx={{
                position: "sticky",
                bottom: 0,
                zIndex: 20,
                mx: -1,
                mt: "auto",
                flexShrink: 0,
                // Release sticky when virtual keyboard shrinks viewport height.
                "@media (max-height: 450px)": {
                  position: "static",
                },
              }}
            >
              {vertical.actionBar}
            </Box>
          )}
        </Box>
      </PageFlowContext.Provider>
    </InspectorContext.Provider>
  ) : (
    <Box
      data-board-workspace="stacked"
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: "20px",
        height: "auto",
        minWidth: 0,
        minHeight: 0,
        alignItems: "start",
      }}
    >
      <Box
        data-board-stage
        sx={{
          display: "flex",
          justifyContent: "center",
          minWidth: 0,
          maxWidth: "100%",
        }}
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
          height: "auto",
          overflowX: "visible",
          overflowY: "visible",
          overscrollBehavior: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1.5,
          bgcolor: "background.paper",
          "& > *": { minWidth: 0 },
          "& [data-inspector-scroller]": {
            maxHeight: "none",
            overflow: "visible",
            overscrollBehavior: "auto",
            scrollbarGutter: "auto",
          },
        }}
      >
        <InspectorContext.Provider value={true}>
          <PageFlowContext.Provider value={true}>
            {inspector}
          </PageFlowContext.Provider>
        </InspectorContext.Provider>
      </Box>
    </Box>
  );

  return (
    <LayoutContext.Provider value={layout}>
      <Box ref={root} sx={{ width: "100%", minWidth: 0 }}>
        {content}
      </Box>
    </LayoutContext.Provider>
  );
}
