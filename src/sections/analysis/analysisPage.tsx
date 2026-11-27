import Board from "@/sections/analysis/board";
import PanelHeader from "@/sections/analysis/panelHeader";
import LoadGame from "@/sections/analysis/panelHeader/loadGame";
import AnalyzeButton from "@/sections/analysis/panelHeader/analyzeButton";
import BoardWorkspace from "@/components/boardWorkspace";
import {
  VerticalContextStrip,
  VerticalLiveStrip,
  WorkspaceActionBar,
} from "@/components/inspector/workspaceActionBar";
import PanelToolBar from "@/sections/analysis/panelToolbar";
import BoardNavigation from "@/sections/analysis/panelToolbar/boardNavigation";
import MoreMenu from "@/sections/analysis/panelToolbar/moreMenu";
import AnalysisOverlayPanel from "@/sections/analysis/overlayPanel";
import { useAnalysisOverlay } from "@/sections/analysis/hooks/useAnalysisOverlay";
import AnalysisTab from "@/sections/analysis/panelBody/analysisTab";
import EngineLines from "@/sections/analysis/panelBody/analysisTab/engineLines";
import LineEvaluation from "@/sections/analysis/panelBody/analysisTab/engineLines/lineEvaluation";
import MoveInfo from "@/sections/analysis/panelBody/analysisTab/moveInfo";
import VisualizeContinuation from "@/sections/analysis/panelBody/analysisTab/visualizeContinuation";
import ClassificationTab from "@/sections/analysis/panelBody/classificationTab";
import {
  analysisInitialTabAtom,
  arrangeModeAtom,
  boardAtom,
  currentPositionAtom,
} from "@/sections/analysis/states";
import { positionFor } from "@/lib/currentPosition";
import { arrangeHistoryAtom } from "./sessionAtoms";
import {
  Box,
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import { Activity, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { PageTitle } from "@/components/pageTitle";
import { AnalysisEngineProvider } from "./engineContext";
import ArrangeBoard from "./arrange/arrangeBoard";
import ArrangePanel, { useArrangeVerticalSlots } from "./arrange/arrangePanel";
import ModeSwitch from "./arrange/modeSwitch";
import { useArrangeMode } from "./arrange/useArrangeMode";
import { useAnalysisSources } from "./hooks/useAnalysisSources";
import { useAnalysisPersistence } from "./hooks/useAnalysisPersistence";
import SessionPanel, { SessionBanners } from "./sessionPanel";

interface Props {
  title: string;
  startInArrangeMode?: boolean;
}

export default function AnalysisPage(props: Props) {
  const persistence = useAnalysisPersistence();
  if (!persistence.ready) {
    return (
      <Stack spacing={2} alignItems="center" p={3}>
        {persistence.state.error ? (
          <Alert
            severity="error"
            action={<Button onClick={persistence.retry}>Retry</Button>}
          >
            {persistence.state.error}
            <Button onClick={persistence.continueUnsaved}>
              Open a new session
            </Button>
          </Alert>
        ) : (
          <>
            <CircularProgress />
            <span>Opening analysis sessions…</span>
          </>
        )}
      </Stack>
    );
  }
  return (
    <AnalysisEngineProvider>
      <AnalysisPageBody {...props} />
    </AnalysisEngineProvider>
  );
}

function AnalysisPageBody({ title, startInArrangeMode = false }: Props) {
  const [tab, setTab] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  const [initialTab, setInitialTab] = useAtom(analysisInitialTabAtom);
  const [confirmLeaveArrange, setConfirmLeaveArrange] = useState(false);

  const arrange = useAtomValue(arrangeModeAtom);
  const arrangeHistory = useAtomValue(arrangeHistoryAtom);
  const { enterArrange, leaveArrange, finishArrange, validation } =
    useArrangeMode();
  // One composition for the page: the board draws it and the overlay lists it.
  const overlay = useAnalysisOverlay();
  const arrangeVertical = useArrangeVerticalSlots();
  const board = useAtomValue(boardAtom);
  const currentPos = positionFor(
    useAtomValue(currentPositionAtom),
    board.fen()
  );
  const topEngineLine = currentPos?.eval?.lines?.[0];
  const threatsOn = !!(overlay.prefs.enabled && overlay.prefs.threats);

  useEffect(() => {
    if (!initialTab) return;
    const next = initialTab === "review" ? 1 : 0;
    setVisited((previous) => new Set([...previous, next]));
    setTab(next);
    setInitialTab(null);
  }, [initialTab, setInitialTab]);

  const enteredWithMode = useRef(false);
  useEffect(() => {
    if (enteredWithMode.current) return;
    enteredWithMode.current = true;

    if (startInArrangeMode && !arrange) {
      enterArrange();
    } else if (!startInArrangeMode && arrange) {
      if (arrangeHistory.past.length > 0) {
        setConfirmLeaveArrange(true);
      } else {
        leaveArrange();
      }
    }
  }, [
    startInArrangeMode,
    arrange,
    arrangeHistory.past.length,
    enterArrange,
    leaveArrange,
  ]);

  // Establish the route's default mode before consuming an explicit handoff;
  // otherwise the default editor effect can overwrite the requested FEN.
  const loadingSource = useAnalysisSources(startInArrangeMode);
  if (loadingSource)
    return (
      <Stack alignItems="center" spacing={2} p={3}>
        <CircularProgress />
        <span>Opening analysis source…</span>
      </Stack>
    );

  const analysisVertical = {
    contextBar: (
      <VerticalContextStrip
        left={<SessionPanel />}
        right={
          <>
            <LoadGame />
            <AnalyzeButton />
            <AnalysisOverlayPanel overlay={overlay} />
            <ModeSwitch />
          </>
        }
      />
    ),
    liveStrip: (
      <Stack spacing={0.5} sx={{ flexShrink: 0 }}>
        <PanelHeader />
        <VerticalLiveStrip minHeight={64} sx={{ px: 1, py: 0.65 }}>
          <Stack spacing={0.5}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={0.5}
              sx={{ minWidth: 0 }}
            >
              <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                {topEngineLine ? (
                  <LineEvaluation
                    line={topEngineLine}
                    action={<VisualizeContinuation compact />}
                  />
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {board.isGameOver()
                      ? "Game over"
                      : "Engine evaluating position…"}
                  </Typography>
                )}
              </Box>
              {!board.isGameOver() && (
                <Button
                  size="small"
                  variant={threatsOn ? "contained" : "text"}
                  color={threatsOn ? "warning" : "inherit"}
                  onClick={() =>
                    overlay.update({ enabled: true, threats: !threatsOn })
                  }
                  aria-label="Toggle opponent threats"
                  sx={{
                    minWidth: 32,
                    minHeight: 30,
                    px: 0.75,
                    flexShrink: 0,
                    bgcolor: threatsOn ? undefined : "action.hover",
                  }}
                >
                  <Icon icon="mdi:alert-decagram-outline" height={16} />
                </Button>
              )}
            </Stack>
            <MoveInfo />
          </Stack>
        </VerticalLiveStrip>
      </Stack>
    ),
    actionBar: (
      <WorkspaceActionBar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <BoardNavigation />
        </Box>
        <MoreMenu />
      </WorkspaceActionBar>
    ),
    sheet: (
      <>
        <SessionBanners />
        <EngineLines overlay={overlay} />
        <Tabs
          value={tab}
          onChange={(_, value: number) => {
            setVisited((previous) => new Set([...previous, value]));
            setTab(value);
          }}
          aria-label="Analysis views"
          variant="fullWidth"
          sx={{
            minHeight: 38,
            flexShrink: 0,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": {
              minHeight: 38,
              py: 0.5,
              textTransform: "none",
              fontSize: "0.84rem",
            },
          }}
        >
          <Tab
            label="Moves"
            id="tab0-v"
            aria-controls="tabContent0-v"
            icon={<Icon icon="mdi:format-list-bulleted" height={16} />}
            iconPosition="start"
          />
          <Tab
            label="Review"
            id="tab1-v"
            aria-controls="tabContent1-v"
            icon={<Icon icon="mdi:chart-line" height={16} />}
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ p: 1.25 }}>
          <Activity mode={tab === 0 ? "visible" : "hidden"}>
            {visited.has(0) && <AnalysisTab hidden={tab !== 0} />}
          </Activity>
          <Activity mode={tab === 1 ? "visible" : "hidden"}>
            {visited.has(1) && <ClassificationTab hidden={tab !== 1} />}
          </Activity>
        </Box>

        <Box
          sx={{
            px: 1,
            py: 0.5,
            flexShrink: 0,
            borderTop: 1,
            borderColor: "divider",
            userSelect: "none",
          }}
        >
          <PanelToolBar />
        </Box>
      </>
    ),
  };

  return (
    <>
      <PageTitle title={title} />
      <BoardWorkspace
        inspectorMinWidth={400}
        inspectorLabel="Analysis inspector"
        vertical={arrange ? arrangeVertical : analysisVertical}
        board={arrange ? <ArrangeBoard /> : <Board overlay={overlay} />}
        inspector={
          <>
            {/* Slim unified top inspector header */}
            <Stack
              spacing={0.75}
              sx={{
                px: 1.25,
                py: 0.75,
                flexShrink: 0,
                borderBottom: 1,
                borderColor: "divider",
                userSelect: "none",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={0.75}
              >
                <SessionPanel />
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={0.35}
                  sx={{ flexShrink: 0 }}
                >
                  <ModeSwitch />
                  {!arrange && <AnalysisOverlayPanel overlay={overlay} />}
                </Stack>
              </Stack>
              {!arrange && (
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <LoadGame />
                  <AnalyzeButton />
                </Stack>
              )}
            </Stack>

            {/* Conditional 3px analysis progress bar (only while analyzing) */}
            {!arrange && <PanelHeader />}

            {/* Conditional alerts, undo banner, and variation selector */}
            <SessionBanners />

            {arrange ? (
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <ArrangePanel />
              </Box>
            ) : (
              <>
                {/* Pinned Engine Lines (always visible above Moves / Review, collapsible) */}
                <EngineLines overlay={overlay} />

                {/* 2 clean views: Moves (default) | Review (Accuracy + Graph + Recap) */}
                <Tabs
                  value={tab}
                  onChange={(_, value: number) => {
                    setVisited((previous) => new Set([...previous, value]));
                    setTab(value);
                  }}
                  aria-label="Analysis views"
                  variant="fullWidth"
                  sx={{
                    minHeight: 36,
                    flexShrink: 0,
                    borderBottom: 1,
                    borderColor: "divider",
                    "& .MuiTab-root": {
                      minHeight: 36,
                      py: 0.5,
                      textTransform: "none",
                      fontSize: "0.84rem",
                    },
                  }}
                >
                  <Tab
                    label="Moves"
                    id="tab0"
                    aria-controls="tabContent0"
                    icon={<Icon icon="mdi:format-list-bulleted" height={16} />}
                    iconPosition="start"
                  />
                  <Tab
                    label="Review"
                    id="tab1"
                    aria-controls="tabContent1"
                    icon={<Icon icon="mdi:chart-line" height={16} />}
                    iconPosition="start"
                  />
                </Tabs>

                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr)",
                    gridTemplateRows: "minmax(0, 1fr)",
                  }}
                >
                  {[0, 1].map((view) => (
                    <Box
                      key={view}
                      id={`tabContent${view}`}
                      role="tabpanel"
                      aria-labelledby={`tab${view}`}
                      data-inspector-scroller
                      hidden={tab !== view}
                      sx={{
                        display: tab === view ? "block" : "none",
                        gridArea: "1 / 1",
                        overflowY: "auto",
                        minWidth: 0,
                        minHeight: 0,
                        p: 1.25,
                        overscrollBehavior: "contain",
                        scrollbarGutter: "stable",
                      }}
                    >
                      <Activity mode={tab === view ? "visible" : "hidden"}>
                        {visited.has(view) && view === 0 && (
                          <AnalysisTab hidden={tab !== 0} />
                        )}
                        {visited.has(view) && view === 1 && (
                          <ClassificationTab hidden={tab !== 1} />
                        )}
                      </Activity>
                    </Box>
                  ))}
                </Box>

                {/* Docked compact utility footer */}
                <Box
                  sx={{
                    px: 1,
                    py: 0.5,
                    flexShrink: 0,
                    borderTop: 1,
                    borderColor: "divider",
                    userSelect: "none",
                  }}
                >
                  <PanelToolBar />
                </Box>
              </>
            )}
          </>
        }
      />

      <Dialog
        open={confirmLeaveArrange}
        onClose={() => setConfirmLeaveArrange(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Unsaved board editor changes</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You have unsaved changes from the Board Editor. Apply them to
            Analysis, or discard them and return to your analysis session.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLeaveArrange(false)}>
            Stay in editor
          </Button>
          <Button
            color="error"
            onClick={() => {
              setConfirmLeaveArrange(false);
              leaveArrange();
            }}
          >
            Discard edits
          </Button>
          <Button
            variant="contained"
            disabled={!validation.ok}
            onClick={() => {
              setConfirmLeaveArrange(false);
              finishArrange();
            }}
          >
            Apply &amp; Analyze
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
