import EngineStatusChip from "@/components/engineStatusChip";
import MovesList from "@/components/movesList";
import Panel from "@/components/panel";
import PrettyMoveSan from "@/components/prettyMoveSan";
import StrengthControl from "@/components/strengthControl";
import { EngineField } from "@/components/enginePicker";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { linesToTopMoves, PositionArrows } from "@/lib/engine/topMoves";
import { chessPathKey } from "@/lib/chessHistory";
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
  IconButton,
  Skeleton,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useInBoardCascade } from "@/lib/coachCascade";
import { BoardArrow } from "@/lib/arrows/types";
import { arrowFromUci } from "@/lib/arrows/uci";
import {
  ARENA_SPEEDS,
  ArenaSide,
  arenaEditingPlayersAtom,
  arenaFlippedAtom,
  arenaSpeedAtom,
  arenaVarietyAtom,
} from "./states";
import { Arena, sideLabel } from "./useArena";
import AnalysisCard, { MoveFeedback } from "./analysisCard";
import { setupPosition } from "@/lib/setupPosition";
import { setHandoff } from "@/lib/handoff";

export default function ArenaSidePanel({
  arena,
  onArrows,
  overlays,
  story,
  storyControls,
}: {
  arena: Arena;
  story: ReturnType<typeof useInBoardCascade>;
  storyControls: ReactNode;
  onArrows: (arrows: PositionArrows) => void;
  overlays?: ReactNode;
}) {
  const editingPlayers = useAtomValue(arenaEditingPlayersAtom);
  const playersEditor = arena.started && editingPlayers && (
    <PlayersEditCard arena={arena} />
  );

  return (
    <Stack spacing={0}>
      {!arena.started && <PlayersCard arena={arena} />}
      {arena.started && arena.isOver && <ResultCard arena={arena} />}
      {arena.started && arena.isOver && playersEditor}
      {arena.started && !arena.isOver && <ControlsCard arena={arena} />}
      {arena.started && !arena.isOver && playersEditor}
      {arena.started && !arena.isOver && (
        <ProposalCard arena={arena} onArrows={onArrows} />
      )}
      {arena.started && (
        <MovesCard arena={arena} story={story} storyControls={storyControls} />
      )}
      {arena.started && <AnalysisCard arena={arena} />}
      {overlays}
      {arena.started && (
        <Panel sx={{ borderBottom: 0, py: 1 }}>
          <PlayersSummary arena={arena} />
        </Panel>
      )}
    </Stack>
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
    <Stack spacing={1.25}>
      <Typography variant="overline" color="text.secondary">
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
    <Panel title="Set up the match" sx={{ borderBottom: 0 }}>
      <Stack spacing={2}>
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
        >
          {startLabel}
        </Button>

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

        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<Icon icon="mdi:swap-horizontal" height={18} />}
            onClick={arena.swapSides}
            sx={{ borderColor: "divider" }}
          >
            Swap sides
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<Icon icon="mdi:pencil-ruler" height={18} />}
            disabled={!!preview.error}
            onClick={() => {
              setHandoff({ kind: "fen", fen: preview.fen }, "/editor");
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
                height={18}
              />
            }
            onClick={() => setShowFen((open) => !open)}
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
              preview.error ?? "Leave blank for the standard starting position."
            }
          />
        </Collapse>
      </Stack>
    </Panel>
  );
}

function PlayersEditCard({ arena }: { arena: Arena }) {
  const setEditingPlayers = useSetAtom(arenaEditingPlayersAtom);

  return (
    <Panel title={<Typography fontWeight={600}>Players</Typography>}>
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
            : "Changes take effect on the next move without restarting the game."}
        </Typography>

        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            size="small"
            color="inherit"
            startIcon={<Icon icon="mdi:swap-horizontal" height={18} />}
            onClick={arena.swapSides}
          >
            Swap sides
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setEditingPlayers(false)}
          >
            Done
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}

function ControlsCard({ arena }: { arena: Arena }) {
  const [speed, setSpeed] = useAtom(arenaSpeedAtom);
  const [variety, setVariety] = useAtom(arenaVarietyAtom);
  const [, setFlipped] = useAtom(arenaFlippedAtom);
  const [editingPlayers, setEditingPlayers] = useAtom(arenaEditingPlayersAtom);
  const [confirmAction, setConfirmAction] = useState<"restart" | "new" | null>(
    null
  );

  const canAdvance = arena.proposal.status === "ready" && !arena.isOver;
  const hasMoves = arena.totalPlies > 0;

  const requestReset = (action: "restart" | "new") => {
    arena.setRunning(false);
    if (!hasMoves) {
      if (action === "restart") arena.start();
      else arena.stop();
      return;
    }
    setConfirmAction(action);
  };

  return (
    <Panel
      title={
        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          sx={{ minHeight: 24 }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: 1.5,
              borderColor: "divider",
              bgcolor: arena.turn === "w" ? "#f2f2f2" : "#1d1d1d",
            }}
          />
          <Typography fontWeight={600}>
            {arena.turn === "w" ? "White" : "Black"} to move
          </Typography>
          <CircularProgress
            size={14}
            thickness={5}
            sx={{
              visibility:
                arena.proposal.status === "thinking" ? "visible" : "hidden",
            }}
          />
        </Stack>
      }
      actions={
        <Stack direction="row" gap={0.5}>
          <Tooltip title="Flip board (F)">
            <IconButton
              size="small"
              aria-label="Flip board"
              onClick={() => setFlipped((value) => !value)}
            >
              <Icon icon="mdi:swap-vertical" height={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title={editingPlayers ? "Hide players" : "Change players"}>
            <IconButton
              size="small"
              aria-label="Change players"
              color={editingPlayers ? "primary" : "default"}
              onClick={() => setEditingPlayers(!editingPlayers)}
            >
              <Icon icon="mdi:cog-outline" height={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    >
      <Stack spacing={1.5}>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Tooltip title="Toggle auto-play (Space)">
            <Button
              size="small"
              variant={arena.running ? "outlined" : "contained"}
              startIcon={
                <Icon
                  icon={arena.running ? "mdi:pause" : "mdi:play"}
                  height={18}
                />
              }
              disabled={arena.isOver}
              onClick={() => arena.setRunning(!arena.running)}
              sx={{ minWidth: 112 }}
            >
              {arena.running ? "Pause" : "Auto-play"}
            </Button>
          </Tooltip>
          <Tooltip title="Play the engine's proposed move" disableInteractive>
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:skip-next" height={18} />}
                disabled={!canAdvance || arena.running}
                onClick={arena.acceptProposal}
              >
                Next move
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Take back the last move" disableInteractive>
            <span>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<Icon icon="mdi:undo-variant" height={18} />}
                disabled={!hasMoves}
                onClick={arena.takeBack}
                sx={{ borderColor: "divider" }}
              >
                Take back
              </Button>
            </span>
          </Tooltip>
        </Stack>

        <Box>
          <Typography variant="caption" color="text.secondary">
            Auto-play speed
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={speed}
            onChange={(_, value: number | null) =>
              value !== null && setSpeed(value)
            }
            sx={{ mt: 0.5 }}
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
            <Typography variant="caption" color="text.secondary">
              Move variety
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontVariantNumeric: "tabular-nums" }}
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

        <Stack
          direction="row"
          gap={1}
          justifyContent="flex-end"
          pt={0.5}
          sx={{ borderTop: 1, borderColor: "divider" }}
        >
          <Button
            size="small"
            variant="text"
            color="inherit"
            startIcon={<Icon icon="mdi:restart" height={16} />}
            onClick={() => requestReset("restart")}
            sx={{
              color: "text.secondary",
              "&:hover": { color: "warning.main" },
            }}
          >
            Restart
          </Button>
          <Button
            size="small"
            variant="text"
            color="inherit"
            startIcon={<Icon icon="mdi:plus" height={16} />}
            onClick={() => requestReset("new")}
            sx={{
              color: "text.secondary",
              "&:hover": { color: "error.main" },
            }}
          >
            New match
          </Button>
        </Stack>
      </Stack>

      <Dialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
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
    </Panel>
  );
}

function ProposalCard({
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

  // Retain previous candidates briefly while auto-playing so the panel doesn't
  // strobe 4 skeletons on every single ply.
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
    <Panel
      title={<Typography fontWeight={600}>{moverName} proposes</Typography>}
    >
      <Stack spacing={0.75} sx={{ minHeight: 196 }}>
        {(proposal.status === "loading" ||
          (proposal.status === "thinking" && !showingStale)) && (
          <>
            <Typography variant="body2" color="text.secondary">
              {proposal.status === "loading" ? proposal.message : "Thinking…"}
            </Typography>
            <Stack spacing={0.75}>
              {[0, 1, 2, 3].map((idx) => (
                <Skeleton key={idx} variant="rounded" height={40} />
              ))}
            </Stack>
          </>
        )}

        {proposal.status === "error" && (
          <Alert
            severity="error"
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
              gap={1}
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
                px: 1,
                py: 0.75,
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
                <Stack direction="row" alignItems="center" gap={0.75}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    #{candidate.rank}
                  </Typography>
                  <Typography fontWeight={700} component="span">
                    <PrettyMoveSan san={candidate.san} color={arena.turn} />
                  </Typography>
                  <Box
                    component="span"
                    sx={{
                      px: 0.75,
                      borderRadius: 0.75,
                      fontSize: "0.75rem",
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
              >
                {chosen ? "Play" : "Nudge"}
              </Button>
            </Stack>
          );
        })}
      </Stack>
    </Panel>
  );
}

function MovesCard({
  arena,
  story,
  storyControls,
}: {
  arena: Arena;
  story: ReturnType<typeof useInBoardCascade>;
  storyControls: ReactNode;
}) {
  const history = arena.game.history();
  const { analysis } = arena;
  const activeIndex = arena.displayPly - 1;
  const entry = activeIndex >= 0 ? analysis.moves[activeIndex] : undefined;
  const firstMove = analysis.moves[0]?.move;

  return (
    <Panel
      title="Moves"
      actions={
        history.length > 0 ? (
          <Stack direction="row" alignItems="center" gap={0.25}>
            <Tooltip title="Start (Home)">
              <span>
                <IconButton
                  size="small"
                  aria-label="Start"
                  disabled={arena.displayPly <= 0}
                  onClick={() => arena.goToPly(0)}
                >
                  <Icon icon="mdi:skip-previous" height={18} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Previous move (←)">
              <span>
                <IconButton
                  size="small"
                  aria-label="Previous move"
                  disabled={arena.displayPly <= 0}
                  onClick={() => arena.stepReview(-1)}
                >
                  <Icon icon="mdi:chevron-left" height={20} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next move (→)">
              <span>
                <IconButton
                  size="small"
                  aria-label="Next move"
                  disabled={!arena.isReviewing}
                  onClick={() => arena.stepReview(1)}
                >
                  <Icon icon="mdi:chevron-right" height={20} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Latest move (End)">
              <span>
                <IconButton
                  size="small"
                  aria-label="Latest move"
                  disabled={!arena.isReviewing}
                  onClick={() => arena.goToPly(null)}
                >
                  <Icon icon="mdi:skip-next" height={18} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ) : undefined
      }
    >
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
        maxHeight={200}
        fixedHeight
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
          sx={{ mt: 0.75 }}
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
    </Panel>
  );
}

function PlayersSummary({ arena }: { arena: Arena }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      display="block"
      textAlign="center"
    >
      White: {sideLabel(arena.white)} · Black: {sideLabel(arena.black)}
    </Typography>
  );
}

function ResultCard({ arena }: { arena: Arena }) {
  const router = useRouter();
  const { addGame } = useGameDatabase();
  const [editingPlayers, setEditingPlayers] = useAtom(arenaEditingPlayersAtom);
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
    <Panel>
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Icon icon="mdi:trophy-outline" height={36} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {headline}
          </Typography>
          <Typography color="text.secondary">
            {result.reason} · {result.result}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="center">
          <Button size="small" variant="contained" onClick={analyze}>
            Analyze game
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => arena.rematch()}
          >
            Rematch, swap colors
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            aria-expanded={editingPlayers}
            onClick={() => setEditingPlayers(!editingPlayers)}
            sx={{ borderColor: "divider" }}
          >
            {editingPlayers ? "Hide players" : "Change players"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={arena.stop}
            sx={{ borderColor: "divider" }}
          >
            New match
          </Button>
        </Stack>
        <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="center">
          <Button
            size="small"
            variant="text"
            startIcon={
              <Icon
                icon={copied === "pgn" ? "mdi:check" : "mdi:content-copy"}
                height={16}
              />
            }
            onClick={() => void copyText("pgn")}
          >
            {copied === "pgn" ? "Copied!" : "Copy PGN"}
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={
              <Icon
                icon={copied === "fen" ? "mdi:check" : "mdi:content-copy"}
                height={16}
              />
            }
            onClick={() => void copyText("fen")}
          >
            {copied === "fen" ? "Copied!" : "Copy FEN"}
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}
