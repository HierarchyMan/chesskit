import EngineStatusChip from "@/components/engineStatusChip";
import type { VerticalWorkspaceSlots } from "@/components/boardWorkspace";
import { EngineField } from "@/components/enginePicker";
import {
  InspectorPopover,
  PopoverSectionLabel,
} from "@/components/inspector/inspectorPopover";
import {
  DeckButton,
  InspectorBody,
  InspectorDeck,
  InspectorDeckRow,
  InspectorHeader,
  InspectorPill,
  InspectorShell,
} from "@/components/inspector/inspectorShell";
import {
  VerticalContextStrip,
  VerticalLiveStrip,
  WorkspaceActionBar,
} from "@/components/inspector/workspaceActionBar";
import MovesList from "@/components/movesList";
import PrettyMoveSan from "@/components/prettyMoveSan";
import StrengthControl from "@/components/strengthControl";
import { ToolbarButton } from "@/components/ToolbarButton";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { BoardArrow } from "@/lib/arrows/types";
import { arrowFromUci } from "@/lib/arrows/uci";
import { chessPathKey } from "@/lib/chessHistory";
import { useInBoardCascade } from "@/lib/coachCascade";
import { linesToTopMoves, PositionArrows } from "@/lib/engine/topMoves";
import { setHandoff } from "@/lib/handoff";
import { setupPosition } from "@/lib/setupPosition";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Skeleton,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import { useAtom } from "jotai";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import AnalysisCard, { MoveFeedback } from "./analysisCard";
import {
  ARENA_SPEEDS,
  ArenaSide,
  arenaEditingPlayersAtom,
  arenaFlippedAtom,
  arenaQueuedSourceAtom,
  arenaSpeedAtom,
  arenaVarietyAtom,
} from "./states";
import { Arena, sideLabel } from "./useArena";

export default function ArenaSidePanel({
  arena,
  onArrows,
  overlayControls,
  story,
  storyControls,
}: {
  arena: Arena;
  story: ReturnType<typeof useInBoardCascade>;
  storyControls: ReactNode;
  onArrows: (arrows: PositionArrows) => void;
  overlayControls?: ReactNode;
}) {
  if (!arena.started) {
    return <PlayersCard arena={arena} />;
  }

  return (
    <ActiveArenaPanel
      arena={arena}
      onArrows={onArrows}
      overlayControls={overlayControls}
      story={story}
      storyControls={storyControls}
    />
  );
}

function SideSetup({
  title,
  side,
  onChange,
  state,
}: {
  title: string;
  side: ArenaSide;
  onChange: (side: ArenaSide) => void;
  state: Arena["whiteEngine"];
}) {
  return (
    <Stack spacing={1.15}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.4 }}
      >
        {title}
      </Typography>
      <EngineField
        label={`${title} engine`}
        role="play"
        value={side.engine}
        onChange={(engine) => {
          if (engine !== "analysis") onChange({ ...side, engine });
        }}
      />
      <Box>
        <EngineStatusChip state={state} engineName={side.engine} />
      </Box>
      <StrengthControl
        value={side.strength}
        onChange={(strength) => onChange({ ...side, strength })}
        engineName={side.engine}
      />
    </Stack>
  );
}

function PlayersCard({ arena }: { arena: Arena }) {
  const router = useRouter();
  const [showFen, setShowFen] = useState(!!arena.startFen);
  const preview = useMemo(
    () => setupPosition(arena.startFen),
    [arena.startFen]
  );

  useEffect(() => {
    if (arena.startFen) setShowFen(true);
  }, [arena.startFen]);

  const anyError =
    arena.whiteEngine.status === "error" ||
    arena.blackEngine.status === "error";
  const bothReady =
    arena.whiteEngine.status === "ready" &&
    arena.blackEngine.status === "ready";

  const startLabel = anyError
    ? "Engine unavailable"
    : bothReady
      ? "Start the match"
      : "Loading engines…";

  return (
    <InspectorShell>
      <InspectorHeader
        left={
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            Set up match
          </Typography>
        }
        right={
          <InspectorPill
            tone={anyError ? "error" : bothReady ? "success" : "neutral"}
            label={
              anyError
                ? "Unavailable"
                : bothReady
                  ? "Engines ready"
                  : "Loading…"
            }
          />
        }
      />

      <InspectorBody sx={{ p: 1.5 }}>
        <Stack spacing={2}>
          <SideSetup
            title="White"
            side={arena.white}
            onChange={arena.setWhite}
            state={arena.whiteEngine}
          />

          <Divider />

          <SideSetup
            title="Black"
            side={arena.black}
            onChange={arena.setBlack}
            state={arena.blackEngine}
          />

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<Icon icon="mdi:swap-horizontal" height={17} />}
              onClick={arena.swapSides}
              sx={{ borderColor: "divider" }}
            >
              Swap sides
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<Icon icon="mdi:pencil-ruler" height={17} />}
              disabled={!!preview.error}
              onClick={() => {
                setHandoff(
                  { kind: "fen", fen: preview.fen, source: "Arena" },
                  "/editor"
                );
                void router.push("/editor");
              }}
              sx={{ borderColor: "divider" }}
            >
              Board editor
            </Button>
            <Button
              size="small"
              variant="text"
              color="inherit"
              endIcon={
                <Icon
                  icon={showFen ? "mdi:chevron-up" : "mdi:chevron-down"}
                  height={17}
                />
              }
              onClick={() => setShowFen((open) => !open)}
              sx={{ color: "text.secondary" }}
            >
              Custom FEN
            </Button>
          </Stack>

          <Collapse in={showFen}>
            <TextField
              size="small"
              fullWidth
              label="Start from FEN (optional)"
              value={arena.startFen ?? ""}
              onChange={(event) => {
                arena.setStartFen(event.target.value || undefined);
              }}
              error={!!preview.error}
              helperText={
                preview.error ??
                "Leave blank for the standard starting position."
              }
            />
          </Collapse>
        </Stack>
      </InspectorBody>

      <InspectorDeck sx={{ p: 1.25 }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!bothReady || !!preview.error}
          startIcon={
            <Icon
              icon={anyError ? "mdi:alert-circle-outline" : "mdi:play"}
              height={22}
            />
          }
          onClick={() => arena.start()}
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          {startLabel}
        </Button>
      </InspectorDeck>
    </InspectorShell>
  );
}

function ActiveArenaPanel({
  arena,
  onArrows,
  overlayControls,
  story,
  storyControls,
}: {
  arena: Arena;
  story: ReturnType<typeof useInBoardCascade>;
  storyControls: ReactNode;
  onArrows: (arrows: PositionArrows) => void;
  overlayControls?: ReactNode;
}) {
  const [speed, setSpeed] = useAtom(arenaSpeedAtom);
  const [variety, setVariety] = useAtom(arenaVarietyAtom);
  const [, setFlipped] = useAtom(arenaFlippedAtom);
  const [editingPlayers, setEditingPlayers] = useAtom(arenaEditingPlayersAtom);
  const [queuedSource, setQueuedSource] = useAtom(arenaQueuedSourceAtom);
  const [tab, setTab] = useState(0);
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const [confirmAction, setConfirmAction] = useState<"restart" | "new" | null>(
    null
  );

  const canAdvance = arena.proposal.status === "ready" && !arena.isOver;
  const hasMoves = arena.totalPlies > 0;
  const history = arena.game.history();
  const { analysis } = arena;
  const activeIndex = arena.displayPly - 1;
  const entry = activeIndex >= 0 ? analysis.moves[activeIndex] : undefined;
  const firstMove = analysis.moves[0]?.move;

  const requestReset = (action: "restart" | "new") => {
    setOptionsAnchor(null);
    arena.setRunning(false);
    if (!hasMoves) {
      if (action === "restart") arena.start();
      else arena.stop();
      return;
    }
    setConfirmAction(action);
  };

  return (
    <InspectorShell>
      {/* Zone 1 — Slim Context Header */}
      <InspectorHeader
        left={
          <>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              noWrap
              sx={{ fontSize: "0.84rem" }}
              title={`${sideLabel(arena.white)} vs ${sideLabel(arena.black)}`}
            >
              {sideLabel(arena.white)} vs {sideLabel(arena.black)}
            </Typography>
            <InspectorPill
              icon="mdi:account-cog-outline"
              label="Players"
              tooltip="Change White or Black engines"
              onClick={() => setEditingPlayers(true)}
            />
          </>
        }
        right={
          !arena.isOver ? (
            <Stack
              direction="row"
              alignItems="center"
              gap={0.55}
              sx={{ flexShrink: 0 }}
            >
              {arena.proposal.status === "thinking" ? (
                <CircularProgress size={11} thickness={5} />
              ) : (
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    border: 1.5,
                    borderColor: "divider",
                    bgcolor: arena.turn === "w" ? "#f2f2f2" : "#1d1d1d",
                    flexShrink: 0,
                  }}
                />
              )}
              <Typography
                variant="caption"
                noWrap
                sx={{
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  color: "text.secondary",
                }}
              >
                {arena.turn === "w" ? "White" : "Black"}
              </Typography>
            </Stack>
          ) : undefined
        }
      />

      {/* Zone 2 — Result Card / Queued Board Banner */}
      {arena.isOver && <ResultCard arena={arena} />}

      {queuedSource && (
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            flexShrink: 0,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Alert
            severity="info"
            sx={{ py: 0.15, "& .MuiAlert-message": { fontSize: "0.78rem" } }}
            action={
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  setQueuedSource(null);
                  arena.setStartFen(undefined);
                }}
              >
                Clear
              </Button>
            }
          >
            Next match will start from the board sent from {queuedSource}.
          </Alert>
        </Box>
      )}

      {/* Zone 3 — Pinned Compact Proposal Stage */}
      {!arena.isOver && <ProposalSection arena={arena} onArrows={onArrows} />}

      {/* Zone 4 — Flexing Moves / Analysis Tabs */}
      <Tabs
        value={tab}
        onChange={(_, value: number) => setTab(value)}
        aria-label="Arena views"
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
            fontSize: "0.82rem",
          },
        }}
      >
        <Tab
          label="Moves"
          icon={<Icon icon="mdi:format-list-bulleted" height={15} />}
          iconPosition="start"
        />
        <Tab
          label="Analysis"
          icon={<Icon icon="mdi:chart-line" height={15} />}
          iconPosition="start"
        />
      </Tabs>

      <InspectorBody sx={{ px: 1.25, py: 0.75 }}>
        {tab === 0 ? (
          <Stack spacing={1}>
            <MovesList
              moves={history}
              startsWithBlack={firstMove?.color === "b"}
              firstMoveNumber={Number(firstMove?.before.split(" ")[5] ?? 1)}
              currentPly={arena.displayPly}
              onSelect={(ply) => arena.goToPly(ply)}
              annotations={
                analysis.showAnnotations
                  ? analysis.moves.map((move) => ({
                      classification: move.after?.moveClassification,
                      evaluation: move.after?.lines[0],
                      status:
                        analysis.error && !move.after?.moveClassification
                          ? "error"
                          : undefined,
                    }))
                  : undefined
              }
              maxHeight="none"
              emptyText={
                arena.isOver
                  ? "This starting position is already game over."
                  : "No moves yet. Press Auto-play or Next move."
              }
            />

            {arena.isReviewing && (
              <Button
                size="small"
                variant="text"
                startIcon={<Icon icon="mdi:skip-next" height={16} />}
                onClick={() => arena.goToPly(null)}
                sx={{ alignSelf: "flex-start" }}
              >
                Back to live position
              </Button>
            )}

            {analysis.showAnnotations && entry && (
              <>
                <MoveFeedback
                  entry={entry}
                  onShowStory={(value) => {
                    arena.setRunning(false);
                    story.start(value, { exitLabel: "Back to game" });
                  }}
                />
                {storyControls}
              </>
            )}
          </Stack>
        ) : (
          <AnalysisCard arena={arena} />
        )}
      </InspectorBody>

      {/* Zone 5 — Docked Bottom Control Deck */}
      <InspectorDeck>
        <InspectorDeckRow sx={{ py: 0.5, minHeight: 38 }}>
          <Stack
            direction="row"
            alignItems="center"
            gap={0.15}
            data-board-shortcuts
          >
            <ToolbarButton
              tooltip="Start (Home)"
              icon="mdi:skip-previous"
              iconHeight={20}
              disabled={arena.displayPly <= 0}
              onClick={() => arena.goToPly(0)}
            />
            <ToolbarButton
              tooltip="Previous move (←)"
              icon="mdi:chevron-left"
              iconHeight={22}
              disabled={arena.displayPly <= 0}
              onClick={() => arena.stepReview(-1)}
            />
            <ToolbarButton
              tooltip="Next move (→)"
              icon="mdi:chevron-right"
              iconHeight={22}
              disabled={!arena.isReviewing}
              onClick={() => arena.stepReview(1)}
            />
            <ToolbarButton
              tooltip="Latest move (End)"
              icon="mdi:skip-next"
              iconHeight={20}
              active={arena.isReviewing ? true : undefined}
              disabled={!arena.isReviewing}
              onClick={() => arena.goToPly(null)}
            />
          </Stack>

          <Stack direction="row" alignItems="center" gap={0.4}>
            <ToolbarButton
              tooltip="Flip board (F)"
              icon="mdi:swap-vertical"
              iconHeight={20}
              onClick={() => setFlipped((value) => !value)}
            />
            <DeckButton
              icon="mdi:undo-variant"
              disabled={!hasMoves}
              onClick={arena.takeBack}
            >
              Take back
            </DeckButton>
          </Stack>
        </InspectorDeckRow>

        <InspectorDeckRow dividerTop>
          <Stack
            direction="row"
            alignItems="center"
            gap={0.45}
            flexWrap="nowrap"
            sx={{ flexShrink: 0 }}
          >
            {!arena.isOver && (
              <>
                <Tooltip title="Toggle auto-play (Space)">
                  <span>
                    <DeckButton
                      active={arena.running}
                      icon={arena.running ? "mdi:pause" : "mdi:play"}
                      onClick={() => arena.setRunning(!arena.running)}
                    >
                      {arena.running ? "Pause" : "Auto-play"}
                    </DeckButton>
                  </span>
                </Tooltip>

                <Tooltip title="Play the engine's proposed move">
                  <span>
                    <DeckButton
                      icon="mdi:skip-next"
                      disabled={!canAdvance || arena.running}
                      onClick={arena.acceptProposal}
                    >
                      Next
                    </DeckButton>
                  </span>
                </Tooltip>
              </>
            )}

            <Tooltip title="Speed, variety, and board overlays">
              <DeckButton
                active={!!optionsAnchor}
                icon="mdi:tune-variant"
                onClick={(event) => setOptionsAnchor(event.currentTarget)}
              >
                Options
              </DeckButton>
            </Tooltip>
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            gap={0.25}
            flexWrap="nowrap"
            sx={{ ml: "auto", flexShrink: 0 }}
          >
            <DeckButton
              subtle
              icon="mdi:restart"
              onClick={() => requestReset("restart")}
            >
              Restart
            </DeckButton>
            <DeckButton
              subtle
              danger
              icon="mdi:plus"
              onClick={() => requestReset("new")}
            >
              New
            </DeckButton>
          </Stack>
        </InspectorDeckRow>
      </InspectorDeck>

      {/* Options Popover (Speed, Variety, Board Overlays) */}
      <InspectorPopover
        title="Arena options"
        open={!!optionsAnchor}
        anchorEl={optionsAnchor}
        onClose={() => setOptionsAnchor(null)}
        width={324}
      >
        <Stack spacing={1.5}>
          <Box>
            <PopoverSectionLabel>Auto-play speed</PopoverSectionLabel>
            <ToggleButtonGroup
              exclusive
              size="small"
              fullWidth
              value={speed}
              onChange={(_, value: number | null) =>
                value !== null && setSpeed(value)
              }
              sx={{
                mt: 0.6,
                "& .MuiToggleButton-root": {
                  py: 0.4,
                  fontSize: "0.75rem",
                },
              }}
            >
              {ARENA_SPEEDS.map((option) => (
                <ToggleButton key={option.ms} value={option.ms}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Stack direction="row" justifyContent="space-between">
              <PopoverSectionLabel>Move variety</PopoverSectionLabel>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
              >
                {Math.round(variety * 100)}%
              </Typography>
            </Stack>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.05}
              value={variety}
              onChange={(_, value) => setVariety(value as number)}
              aria-label="Variety"
            />
          </Box>

          {overlayControls && (
            <>
              <Divider />
              <Stack spacing={0.75}>
                <PopoverSectionLabel>Board overlays</PopoverSectionLabel>
                {overlayControls}
              </Stack>
            </>
          )}
        </Stack>
      </InspectorPopover>

      {/* Edit Players Dialog (replaces inline jumping PlayersEditCard) */}
      <Dialog
        open={editingPlayers}
        onClose={() => setEditingPlayers(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Arena players</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <SideSetup
              title="White"
              side={arena.white}
              onChange={arena.setWhite}
              state={arena.whiteEngine}
            />
            <Divider />
            <SideSetup
              title="Black"
              side={arena.black}
              onChange={arena.setBlack}
              state={arena.blackEngine}
            />
            <Typography variant="caption" color="text.secondary">
              {arena.isOver
                ? "The finished game is kept. New players apply to the next match."
                : "Changes take effect on the next move without restarting the match."}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 2 }}>
          <Button
            size="small"
            color="inherit"
            startIcon={<Icon icon="mdi:swap-horizontal" height={17} />}
            onClick={arena.swapSides}
          >
            Swap sides
          </Button>
          <Button variant="contained" onClick={() => setEditingPlayers(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Restart / New Match */}
      <Dialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {confirmAction === "restart"
            ? "Restart match?"
            : "Leave current match?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmAction === "restart"
              ? "This clears the current moves and restarts from move 1."
              : "This ends the current match and returns to player setup."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              const action = confirmAction;
              setConfirmAction(null);
              if (action === "restart") arena.start();
              else if (action === "new") arena.stop();
            }}
          >
            {confirmAction === "restart" ? "Restart" : "New match"}
          </Button>
        </DialogActions>
      </Dialog>
    </InspectorShell>
  );
}

function ProposalSection({
  arena,
  onArrows,
}: {
  arena: Arena;
  onArrows: (arrows: PositionArrows) => void;
}) {
  const { proposal } = arena;
  const [hovered, setHovered] = useState<{
    positionKey: string;
    uci: string;
  } | null>(null);
  const positionKey = chessPathKey(arena.game);
  const hoveredUci = hovered?.positionKey === positionKey ? hovered.uci : null;

  const liveCandidates = useMemo(
    () =>
      proposal.status === "ready" && proposal.fen === arena.game.fen()
        ? linesToTopMoves(proposal.fen, proposal.choice.lines, 4)
        : [],
    [proposal, arena.game]
  );

  const lastCandidatesRef = useRef(liveCandidates);
  if (liveCandidates.length > 0) {
    lastCandidatesRef.current = liveCandidates;
  }
  const showingStale =
    arena.running &&
    liveCandidates.length === 0 &&
    lastCandidatesRef.current.length > 0 &&
    proposal.status === "thinking";
  const candidates = showingStale ? lastCandidatesRef.current : liveCandidates;

  useEffect(() => {
    if (
      arena.isReviewing ||
      proposal.status !== "ready" ||
      proposal.fen !== arena.game.fen()
    ) {
      onArrows({ positionKey, arrows: [] });
      return;
    }

    const side = arena.game.turn();
    const chosenRank = liveCandidates.find(
      (candidate) => candidate.uci === proposal.choice.uci
    )?.rank;
    const arrows: BoardArrow[] = [
      arrowFromUci(proposal.choice.uci, {
        kind: "planned",
        side,
        rank: chosenRank,
        label: "▶",
      }),
    ];

    const hoveredCandidate = liveCandidates.find(
      (candidate) => candidate.uci === hoveredUci
    );
    if (hoveredCandidate && hoveredCandidate.uci !== proposal.choice.uci) {
      arrows.push(
        arrowFromUci(hoveredCandidate.uci, {
          kind: "candidate",
          rank: hoveredCandidate.rank,
          side,
        })
      );
    }

    onArrows({ positionKey, arrows });
  }, [
    arena.isReviewing,
    proposal,
    hoveredUci,
    positionKey,
    onArrows,
    liveCandidates,
    arena.game,
  ]);

  useEffect(
    () => () => onArrows({ positionKey, arrows: [] }),
    [onArrows, positionKey]
  );

  const moverName = sideLabel(arena.mover);

  return (
    <Box
      sx={(theme) => ({
        px: 1.25,
        py: 0.9,
        flexShrink: 0,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor:
          theme.palette.mode === "dark"
            ? alpha(theme.palette.common.white, 0.02)
            : alpha(theme.palette.common.black, 0.015),
      })}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 0.65 }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
        >
          {moverName} proposes
        </Typography>
        {(proposal.status === "loading" || proposal.status === "thinking") && (
          <Typography variant="caption" color="text.secondary">
            {proposal.status === "loading" ? proposal.message : "Thinking…"}
          </Typography>
        )}
      </Stack>

      <Stack spacing={0.5} sx={{ minHeight: 152 }}>
        {(proposal.status === "loading" ||
          (proposal.status === "thinking" && !showingStale)) && (
          <>
            {[0, 1, 2, 3].map((idx) => (
              <Skeleton key={idx} variant="rounded" height={33} />
            ))}
          </>
        )}

        {proposal.status === "error" && (
          <Alert
            severity="error"
            sx={{ py: 0.25 }}
            action={
              arena.moverState.status === "error" ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={arena.moverState.retry}
                >
                  Retry
                </Button>
              ) : undefined
            }
          >
            {proposal.message}
          </Alert>
        )}

        {candidates.map((candidate) => {
          const chosen =
            !showingStale &&
            proposal.status === "ready" &&
            candidate.uci === proposal.choice.uci;

          return (
            <Stack
              key={candidate.uci}
              role="group"
              aria-label={`Candidate ${candidate.rank}: ${candidate.san}${chosen ? ", engine's choice" : ""}`}
              direction="row"
              alignItems="center"
              gap={0.75}
              onMouseEnter={() =>
                !showingStale && setHovered({ positionKey, uci: candidate.uci })
              }
              onMouseLeave={() => setHovered(null)}
              tabIndex={0}
              onFocus={() =>
                !showingStale && setHovered({ positionKey, uci: candidate.uci })
              }
              onBlur={() => setHovered(null)}
              sx={(theme) => ({
                px: 0.9,
                py: 0.4,
                borderRadius: 1,
                border: 1,
                borderColor: chosen
                  ? alpha(theme.palette.primary.main, 0.5)
                  : "divider",
                bgcolor: chosen
                  ? alpha(theme.palette.primary.main, 0.08)
                  : "transparent",
                opacity: showingStale ? 0.55 : 1,
                transition: "opacity 0.12s",
              })}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={0.65}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    #{candidate.rank}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} component="span">
                    <PrettyMoveSan san={candidate.san} color={arena.turn} />
                  </Typography>
                  <Box
                    component="span"
                    sx={{
                      px: 0.65,
                      borderRadius: 0.75,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      border: "1px solid #424242",
                      backgroundColor:
                        (candidate.cp ?? 0) < 0 || (candidate.mate ?? 0) < 0
                          ? "#111"
                          : "#fff",
                      color:
                        (candidate.cp ?? 0) < 0 || (candidate.mate ?? 0) < 0
                          ? "#fff"
                          : "#111",
                    }}
                  >
                    {candidate.evalLabel}
                  </Box>
                  {chosen && (
                    <Typography
                      variant="caption"
                      color="primary.main"
                      fontWeight={600}
                    >
                      choice
                    </Typography>
                  )}
                </Stack>
              </Box>
              <Button
                size="small"
                variant={chosen ? "contained" : "outlined"}
                disabled={showingStale}
                onClick={() => arena.playCandidate(candidate.uci)}
                sx={{ minHeight: 24, py: 0.1, px: 0.9, fontSize: "0.74rem" }}
              >
                {chosen ? "Play" : "Nudge"}
              </Button>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

function ResultCard({ arena }: { arena: Arena }) {
  const router = useRouter();
  const { addGame } = useGameDatabase();
  const [copied, setCopied] = useState<"pgn" | "fen" | null>(null);
  const { result } = arena;

  const headline = result.winner
    ? `${result.winner === "w" ? "White" : "Black"} wins`
    : "Draw";

  const analyze = async () => {
    const id = await addGame(arena.finishedGame());
    router.push({ pathname: "/analysis", query: { gameId: id } });
  };

  const copyText = async (kind: "pgn" | "fen") => {
    const text = kind === "pgn" ? arena.finishedGame().pgn() : arena.game.fen();
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(
      () => setCopied((current) => (current === kind ? null : current)),
      1800
    );
  };

  return (
    <Box
      sx={(theme) => ({
        px: 1.5,
        py: 1.15,
        flexShrink: 0,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: alpha(
          result.winner
            ? theme.palette.success.main
            : theme.palette.text.secondary,
          theme.palette.mode === "dark" ? 0.1 : 0.07
        ),
      })}
    >
      <Stack spacing={1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
            <Box
              sx={(theme) => ({
                width: 32,
                height: 32,
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                color: "primary.main",
              })}
            >
              <Icon icon="mdi:trophy-outline" height={20} />
            </Box>
            <Box minWidth={0}>
              <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                {headline}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {result.reason} · {result.result}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" gap={0.25} flexShrink={0}>
            <Button
              size="small"
              color="inherit"
              startIcon={
                <Icon
                  icon={copied === "pgn" ? "mdi:check" : "mdi:content-copy"}
                  height={14}
                />
              }
              onClick={() => void copyText("pgn")}
              sx={{
                minWidth: 0,
                px: 0.75,
                minHeight: 26,
                fontSize: "0.72rem",
                color: "text.secondary",
              }}
            >
              {copied === "pgn" ? "Copied" : "PGN"}
            </Button>
            <Button
              size="small"
              color="inherit"
              startIcon={
                <Icon
                  icon={copied === "fen" ? "mdi:check" : "mdi:content-copy"}
                  height={14}
                />
              }
              onClick={() => void copyText("fen")}
              sx={{
                minWidth: 0,
                px: 0.75,
                minHeight: 26,
                fontSize: "0.72rem",
                color: "text.secondary",
              }}
            >
              {copied === "fen" ? "Copied" : "FEN"}
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          <Button
            size="small"
            variant="contained"
            startIcon={<Icon icon="mdi:chart-line" height={15} />}
            onClick={analyze}
          >
            Analyze
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Icon icon="mdi:sync" height={15} />}
            onClick={() => arena.rematch()}
          >
            Rematch
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Icon icon="mdi:plus" height={15} />}
            onClick={arena.stop}
          >
            New match
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

/**
 * Vertical workspace slots for Engine Arena (both Match Setup and Active Match).
 */
export function useArenaVerticalSlots({
  arena,
  onArrows,
  overlayControls,
  story,
  storyControls,
}: {
  arena: Arena;
  story: ReturnType<typeof useInBoardCascade>;
  storyControls: ReactNode;
  onArrows: (arrows: PositionArrows) => void;
  overlayControls?: ReactNode;
}): VerticalWorkspaceSlots {
  const router = useRouter();
  const [speed, setSpeed] = useAtom(arenaSpeedAtom);
  const [variety, setVariety] = useAtom(arenaVarietyAtom);
  const [, setFlipped] = useAtom(arenaFlippedAtom);
  const [editingPlayers, setEditingPlayers] = useAtom(arenaEditingPlayersAtom);
  const [queuedSource, setQueuedSource] = useAtom(arenaQueuedSourceAtom);
  const [showFen, setShowFen] = useState(!!arena.startFen);
  const [showBoardPreview, setShowBoardPreview] = useState(false);
  const [tab, setTab] = useState(0);
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const [confirmAction, setConfirmAction] = useState<"restart" | "new" | null>(
    null
  );

  const preview = useMemo(
    () => setupPosition(arena.startFen),
    [arena.startFen]
  );

  useEffect(() => {
    if (arena.startFen) setShowFen(true);
  }, [arena.startFen]);

  const anyError =
    arena.whiteEngine.status === "error" ||
    arena.blackEngine.status === "error";
  const bothReady =
    arena.whiteEngine.status === "ready" &&
    arena.blackEngine.status === "ready";
  const startLabel = anyError
    ? "Engine unavailable"
    : bothReady
      ? "Start the match"
      : "Loading engines…";

  const canAdvance = arena.proposal.status === "ready" && !arena.isOver;
  const hasMoves = arena.totalPlies > 0;
  const history = arena.game.history();
  const { analysis } = arena;
  const activeIndex = arena.displayPly - 1;
  const entry = activeIndex >= 0 ? analysis.moves[activeIndex] : undefined;
  const firstMove = analysis.moves[0]?.move;

  const liveCandidates = useMemo(
    () =>
      arena.started &&
      arena.proposal.status === "ready" &&
      arena.proposal.fen === arena.game.fen()
        ? linesToTopMoves(arena.proposal.fen, arena.proposal.choice.lines, 4)
        : [],
    [arena.started, arena.proposal, arena.game]
  );

  const readyChoiceUci =
    arena.proposal.status === "ready" ? arena.proposal.choice.uci : undefined;
  const chosenCandidate = readyChoiceUci
    ? (liveCandidates.find((c) => c.uci === readyChoiceUci) ??
      liveCandidates[0])
    : undefined;

  const requestReset = (action: "restart" | "new") => {
    setOptionsAnchor(null);
    arena.setRunning(false);
    if (!hasMoves) {
      if (action === "restart") arena.start();
      else arena.stop();
      return;
    }
    setConfirmAction(action);
  };

  // Match setup vertical slots
  if (!arena.started) {
    const hasCustomFen = Boolean(arena.startFen?.trim());
    return {
      hideBoard: !hasCustomFen && !showBoardPreview,
      contextBar: (
        <VerticalContextStrip
          left={
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              Set up match
            </Typography>
          }
          right={
            <>
              {!hasCustomFen && (
                <InspectorPill
                  icon={
                    showBoardPreview ? "mdi:eye-off-outline" : "mdi:eye-outline"
                  }
                  label={showBoardPreview ? "Hide board" : "Preview"}
                  onClick={() => setShowBoardPreview((value) => !value)}
                />
              )}
              <InspectorPill
                tone={anyError ? "error" : bothReady ? "success" : "neutral"}
                label={
                  anyError
                    ? "Unavailable"
                    : bothReady
                      ? "Engines ready"
                      : "Loading…"
                }
              />
            </>
          }
        />
      ),
      sheet: (
        <Stack spacing={2} sx={{ p: 1.5 }}>
          <SideSetup
            title="White"
            side={arena.white}
            onChange={arena.setWhite}
            state={arena.whiteEngine}
          />
          <Divider />
          <SideSetup
            title="Black"
            side={arena.black}
            onChange={arena.setBlack}
            state={arena.blackEngine}
          />
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<Icon icon="mdi:swap-horizontal" height={17} />}
              onClick={arena.swapSides}
              sx={{ borderColor: "divider" }}
            >
              Swap sides
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<Icon icon="mdi:pencil-ruler" height={17} />}
              disabled={!!preview.error}
              onClick={() => {
                setHandoff(
                  { kind: "fen", fen: preview.fen, source: "Arena" },
                  "/editor"
                );
                void router.push("/editor");
              }}
              sx={{ borderColor: "divider" }}
            >
              Board editor
            </Button>
            <Button
              size="small"
              variant="text"
              color="inherit"
              endIcon={
                <Icon
                  icon={showFen ? "mdi:chevron-up" : "mdi:chevron-down"}
                  height={17}
                />
              }
              onClick={() => setShowFen((open) => !open)}
              sx={{ color: "text.secondary" }}
            >
              Custom FEN
            </Button>
          </Stack>
          <Collapse in={showFen}>
            <TextField
              size="small"
              fullWidth
              label="Start from FEN (optional)"
              value={arena.startFen ?? ""}
              onChange={(event) => {
                arena.setStartFen(event.target.value || undefined);
              }}
              error={!!preview.error}
              helperText={
                preview.error ??
                "Leave blank for the standard starting position."
              }
            />
          </Collapse>
        </Stack>
      ),
      actionBar: (
        <WorkspaceActionBar>
          <Button
            variant="contained"
            size="medium"
            fullWidth
            disabled={!bothReady || !!preview.error}
            startIcon={
              <Icon
                icon={anyError ? "mdi:alert-circle-outline" : "mdi:play"}
                height={20}
              />
            }
            onClick={() => arena.start()}
            sx={{ minHeight: 40, borderRadius: 1, fontWeight: 700 }}
          >
            {startLabel}
          </Button>
        </WorkspaceActionBar>
      ),
    };
  }

  // Active match vertical slots
  return {
    contextBar: (
      <VerticalContextStrip
        left={
          <>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              noWrap
              sx={{ fontSize: "0.82rem" }}
            >
              {sideLabel(arena.white)} vs {sideLabel(arena.black)}
            </Typography>
            <InspectorPill
              icon="mdi:account-cog-outline"
              label="Players"
              onClick={() => setEditingPlayers(true)}
            />
          </>
        }
        right={
          !arena.isOver ? (
            <Stack direction="row" alignItems="center" gap={0.5}>
              {arena.proposal.status === "thinking" ? (
                <CircularProgress size={11} thickness={5} />
              ) : (
                <Box
                  sx={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    border: 1.5,
                    borderColor: "divider",
                    bgcolor: arena.turn === "w" ? "#f2f2f2" : "#1d1d1d",
                  }}
                />
              )}
              <Typography
                variant="caption"
                fontWeight={600}
                color="text.secondary"
              >
                {arena.turn === "w" ? "White" : "Black"}
              </Typography>
            </Stack>
          ) : undefined
        }
      />
    ),
    liveStrip: arena.isOver ? (
      <Box
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 1.25,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <ResultCard arena={arena} />
      </Box>
    ) : story.projection.active ? (
      <Box sx={{ flexShrink: 0 }}>{storyControls}</Box>
    ) : (
      <VerticalLiveStrip minHeight={64} sx={{ px: 1.1, py: 0.7 }}>
        <Stack spacing={0.55}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={0.75}
          >
            <Stack direction="row" alignItems="center" gap={0.6} minWidth={0}>
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                noWrap
              >
                {sideLabel(arena.mover)}:
              </Typography>
              {chosenCandidate ? (
                <>
                  <Typography variant="body2" fontWeight={700} component="span">
                    <PrettyMoveSan
                      san={chosenCandidate.san}
                      color={arena.turn}
                    />
                  </Typography>
                  <InspectorPill label={chosenCandidate.evalLabel} />
                </>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {arena.proposal.status === "error"
                    ? arena.proposal.message
                    : "Thinking…"}
                </Typography>
              )}
            </Stack>

            {chosenCandidate && (
              <Button
                size="small"
                variant="contained"
                disabled={arena.running}
                onClick={() => arena.playCandidate(chosenCandidate.uci)}
                sx={{ minHeight: 28, py: 0.15, px: 1.1, fontSize: "0.75rem" }}
              >
                Play
              </Button>
            )}
          </Stack>

          {liveCandidates.length > 1 && (
            <Stack
              direction="row"
              alignItems="center"
              gap={0.5}
              sx={{
                overflowX: "auto",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {liveCandidates
                .filter((c) => c.uci !== chosenCandidate?.uci)
                .map((candidate) => (
                  <InspectorPill
                    key={candidate.uci}
                    label={`#${candidate.rank} ${candidate.san} (${candidate.evalLabel})`}
                    onClick={() => arena.playCandidate(candidate.uci)}
                  />
                ))}
            </Stack>
          )}
        </Stack>
      </VerticalLiveStrip>
    ),
    actionBar: (
      <>
        <WorkspaceActionBar
          left={
            <>
              <ToolbarButton
                tooltip="Previous move"
                icon="mdi:chevron-left"
                iconHeight={22}
                disabled={arena.displayPly <= 0}
                onClick={() => arena.stepReview(-1)}
              />
              <ToolbarButton
                tooltip="Next move"
                icon="mdi:chevron-right"
                iconHeight={22}
                disabled={!arena.isReviewing}
                onClick={() => arena.stepReview(1)}
              />
              {!arena.isOver && (
                <>
                  <DeckButton
                    active={arena.running}
                    icon={arena.running ? "mdi:pause" : "mdi:play"}
                    onClick={() => arena.setRunning(!arena.running)}
                  >
                    {arena.running ? "Pause" : "Auto"}
                  </DeckButton>
                  <DeckButton
                    icon="mdi:skip-next"
                    disabled={!canAdvance || arena.running}
                    onClick={arena.acceptProposal}
                  >
                    Next
                  </DeckButton>
                </>
              )}
            </>
          }
          right={
            <>
              <ToolbarButton
                tooltip="Take back"
                icon="mdi:undo-variant"
                iconHeight={20}
                disabled={!hasMoves}
                onClick={arena.takeBack}
              />
              <ToolbarButton
                tooltip="Arena options"
                icon="mdi:tune-variant"
                iconHeight={20}
                active={!!optionsAnchor || undefined}
                onClick={() => setOptionsAnchor(document.body)}
              />
            </>
          }
        />

        <InspectorPopover
          title="Arena options"
          open={!!optionsAnchor}
          anchorEl={optionsAnchor}
          onClose={() => setOptionsAnchor(null)}
          width={324}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:swap-vertical" height={16} />}
                onClick={() => {
                  setFlipped((value) => !value);
                  setOptionsAnchor(null);
                }}
              >
                Flip board
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:restart" height={16} />}
                onClick={() => requestReset("restart")}
              >
                Restart
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<Icon icon="mdi:plus" height={16} />}
                onClick={() => requestReset("new")}
              >
                New match
              </Button>
            </Stack>

            <Box>
              <PopoverSectionLabel>Auto-play speed</PopoverSectionLabel>
              <ToggleButtonGroup
                exclusive
                size="small"
                fullWidth
                value={speed}
                onChange={(_, value: number | null) =>
                  value !== null && setSpeed(value)
                }
                sx={{
                  mt: 0.6,
                  "& .MuiToggleButton-root": {
                    py: 0.45,
                    fontSize: "0.75rem",
                  },
                }}
              >
                {ARENA_SPEEDS.map((option) => (
                  <ToggleButton key={option.ms} value={option.ms}>
                    {option.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Stack direction="row" justifyContent="space-between">
                <PopoverSectionLabel>Move variety</PopoverSectionLabel>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
                >
                  {Math.round(variety * 100)}%
                </Typography>
              </Stack>
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.05}
                value={variety}
                onChange={(_, value) => setVariety(value as number)}
                aria-label="Variety"
              />
            </Box>

            {overlayControls && (
              <>
                <Divider />
                <Stack spacing={0.75}>
                  <PopoverSectionLabel>Board overlays</PopoverSectionLabel>
                  {overlayControls}
                </Stack>
              </>
            )}
          </Stack>
        </InspectorPopover>

        <Dialog
          open={editingPlayers}
          onClose={() => setEditingPlayers(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Arena players</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <SideSetup
                title="White"
                side={arena.white}
                onChange={arena.setWhite}
                state={arena.whiteEngine}
              />
              <Divider />
              <SideSetup
                title="Black"
                side={arena.black}
                onChange={arena.setBlack}
                state={arena.blackEngine}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ justifyContent: "space-between", px: 2 }}>
            <Button
              size="small"
              color="inherit"
              startIcon={<Icon icon="mdi:swap-horizontal" height={17} />}
              onClick={arena.swapSides}
            >
              Swap sides
            </Button>
            <Button
              variant="contained"
              onClick={() => setEditingPlayers(false)}
            >
              Done
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={confirmAction !== null}
          onClose={() => setConfirmAction(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>
            {confirmAction === "restart"
              ? "Restart match?"
              : "Leave current match?"}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {confirmAction === "restart"
                ? "This clears the current moves and restarts from move 1."
                : "This ends the current match and returns to player setup."}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant="contained"
              color="warning"
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === "restart") arena.start();
                else if (action === "new") arena.stop();
              }}
            >
              {confirmAction === "restart" ? "Restart" : "New match"}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    ),
    sheet: (
      <Stack spacing={0}>
        {queuedSource && (
          <Box sx={{ p: 1.25, borderBottom: 1, borderColor: "divider" }}>
            <Alert
              severity="info"
              sx={{ py: 0.15 }}
              action={
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    setQueuedSource(null);
                    arena.setStartFen(undefined);
                  }}
                >
                  Clear
                </Button>
              }
            >
              Next match will start from the board sent from {queuedSource}.
            </Alert>
          </Box>
        )}

        {!arena.isOver && <ProposalSection arena={arena} onArrows={onArrows} />}

        <Tabs
          value={tab}
          onChange={(_, value: number) => setTab(value)}
          aria-label="Arena views"
          variant="fullWidth"
          sx={{
            minHeight: 38,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": {
              minHeight: 38,
              py: 0.5,
              textTransform: "none",
              fontSize: "0.82rem",
            },
          }}
        >
          <Tab
            label="Moves"
            icon={<Icon icon="mdi:format-list-bulleted" height={15} />}
            iconPosition="start"
          />
          <Tab
            label="Analysis"
            icon={<Icon icon="mdi:chart-line" height={15} />}
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ px: 1.25, py: 0.75 }}>
          {tab === 0 ? (
            <Stack spacing={1}>
              <MovesList
                moves={history}
                startsWithBlack={firstMove?.color === "b"}
                firstMoveNumber={Number(firstMove?.before.split(" ")[5] ?? 1)}
                currentPly={arena.displayPly}
                onSelect={(ply) => arena.goToPly(ply)}
                annotations={
                  analysis.showAnnotations
                    ? analysis.moves.map((move) => ({
                        classification: move.after?.moveClassification,
                        evaluation: move.after?.lines[0],
                        status:
                          analysis.error && !move.after?.moveClassification
                            ? "error"
                            : undefined,
                      }))
                    : undefined
                }
                maxHeight="none"
                emptyText={
                  arena.isOver
                    ? "This starting position is already game over."
                    : "No moves yet. Tap Auto or Next."
                }
              />
              {analysis.showAnnotations && entry && (
                <MoveFeedback
                  entry={entry}
                  onShowStory={(value) => {
                    arena.setRunning(false);
                    story.start(value, { exitLabel: "Back to game" });
                  }}
                />
              )}
            </Stack>
          ) : (
            <AnalysisCard arena={arena} />
          )}
        </Box>
      </Stack>
    ),
  };
}
