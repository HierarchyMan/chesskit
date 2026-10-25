import Board from "@/sections/analysis/board";
import PanelHeader from "@/sections/analysis/panelHeader";
import GameDetails from "@/sections/analysis/panelHeader/gamePanel";
import BoardWorkspace from "@/components/boardWorkspace";
import PanelToolBar from "@/sections/analysis/panelToolbar";
import AnalysisOverlayPanel from "@/sections/analysis/overlayPanel";
import { useAnalysisOverlay } from "@/sections/analysis/hooks/useAnalysisOverlay";
import AnalysisTab from "@/sections/analysis/panelBody/analysisTab";
import ClassificationTab from "@/sections/analysis/panelBody/classificationTab";
import {
  arrangeModeAtom,
  boardAtom,
  gameAtom,
  gameEvalAtom,
} from "@/sections/analysis/states";
import {
  Box,
  Alert,
  Button,
  CircularProgress,
  Stack,
  Divider,
  Tab,
  Tabs,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { Activity, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import TopMovesSection from "@/sections/analysis/panelBody/topMovesSection";
import dynamic from "next/dynamic";
const GraphTab = dynamic(
  () => import("@/sections/analysis/panelBody/graphTab"),
  { ssr: false }
);
import { PageTitle } from "@/components/pageTitle";
import { AnalysisEngineProvider } from "./engineContext";
import ArrangeBoard from "./arrange/arrangeBoard";
import ArrangePanel from "./arrange/arrangePanel";
import ModeSwitch from "./arrange/modeSwitch";
import { useArrangeMode } from "./arrange/useArrangeMode";
import { useAnalysisSources } from "./hooks/useAnalysisSources";
import { useAnalysisPersistence } from "./hooks/useAnalysisPersistence";
import SessionPanel from "./sessionPanel";

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

  const arrange = useAtomValue(arrangeModeAtom);
  const gameEval = useAtomValue(gameEvalAtom);
  const game = useAtomValue(gameAtom);
  const board = useAtomValue(boardAtom);
  const { enterArrange } = useArrangeMode();
  // One composition for the page: the board draws it and the overlay lists it.
  const overlay = useAnalysisOverlay();

  const showMovesTab = game.history().length > 0 || board.history().length > 0;

  useEffect(() => {
    if (tab === 1 && !showMovesTab) setTab(0);
    if (tab === 2 && !gameEval) setTab(0);
  }, [showMovesTab, gameEval, tab]);

  const enteredWithMode = useRef(false);
  useEffect(() => {
    if (enteredWithMode.current) return;
    enteredWithMode.current = true;

    if (startInArrangeMode && !arrange) {
      enterArrange();
    }
  }, [startInArrangeMode, arrange, enterArrange]);

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

  return (
    <>
      <PageTitle title={title} />
      <BoardWorkspace
        inspectorLabel="Analysis inspector"
        board={arrange ? <ArrangeBoard /> : <Board overlay={overlay} />}
        inspector={
          <>
            <Stack
              spacing={1.25}
              sx={{
                p: 1.5,
                flexShrink: 0,
                borderBottom: 1,
                borderColor: "divider",
                userSelect: "none",
              }}
            >
              <SessionPanel />
              {!arrange && <PanelHeader />}
              <ModeSwitch />
              {!arrange && (
                <AnalysisOverlayPanel overlay={overlay} view="inspector" />
              )}
            </Stack>
            {arrange ? (
              <Box
                data-inspector-scroller
                sx={{
                  p: 1.5,
                  minHeight: 0,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                  scrollbarGutter: "stable",
                }}
              >
                <ArrangePanel />
              </Box>
            ) : (
              <>
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
                      py: 0.75,
                      textTransform: "none",
                    },
                  }}
                >
                  <Tab
                    label="Position"
                    id="tab0"
                    aria-controls="tabContent0"
                    icon={<Icon icon="mdi:magnify" height={16} />}
                    iconPosition="start"
                  />
                  <Tab
                    label="Moves"
                    id="tab1"
                    aria-controls="tabContent1"
                    disabled={!showMovesTab}
                    icon={<Icon icon="mdi:format-list-bulleted" height={16} />}
                    iconPosition="start"
                  />
                  <Tab
                    label="Graph"
                    id="tab2"
                    aria-controls="tabContent2"
                    disabled={!gameEval}
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
                  {[0, 1, 2].map((view) => (
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
                        p: 1.5,
                        overscrollBehavior: "contain",
                        scrollbarGutter: "stable",
                      }}
                    >
                      <Activity mode={tab === view ? "visible" : "hidden"}>
                        {visited.has(view) && view === 0 && (
                          <>
                            {game.getHeaders().White &&
                              game.getHeaders().White !== "?" && (
                                <Box
                                  component="details"
                                  sx={{
                                    mb: 1.5,
                                    "& summary": {
                                      cursor: "pointer",
                                      fontSize: "0.85rem",
                                      color: "text.secondary",
                                      py: 0.5,
                                      userSelect: "none",
                                    },
                                  }}
                                >
                                  <summary>Game details</summary>
                                  <GameDetails />
                                </Box>
                              )}
                            <AnalysisTab hidden={tab !== 0} />
                            <TopMovesSection />
                          </>
                        )}
                        {visited.has(view) && view === 1 && (
                          <ClassificationTab hidden={tab !== 1} />
                        )}
                        {visited.has(view) && view === 2 && gameEval && (
                          <GraphTab hidden={tab !== 2} />
                        )}
                      </Activity>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ px: 1, py: 0.5, flexShrink: 0, userSelect: "none" }}>
                  <Divider sx={{ mb: 0.5 }} />
                  <PanelToolBar />
                </Box>
              </>
            )}
          </>
        }
      />
    </>
  );
}
