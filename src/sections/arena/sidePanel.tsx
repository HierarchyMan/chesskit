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
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useMemo, useState } from "react";
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
}: {
  arena: Arena;
  onArrows: (arrows: PositionArrows) => void;
  overlays?: ReactNode;
}) {
  const editingPlayers = useAtomValue(arenaEditingPlayersAtom);
  // Shown under the card that holds its button: Controls while playing, Result
  // once the game is over.
  const playersEditor = arena.started && editingPlayers && (
    <PlayersEditCard arena={arena} />
  );

  return (
    <Stack spacing={2}>
      {!arena.started && <PlayersCard arena={arena} />}
      {arena.started && <ControlsCard arena={arena} />}
      {!arena.isOver && playersEditor}
      {overlays}
      <AnalysisCard arena={arena} />
      {arena.started && !arena.isOver && (
        <ProposalCard arena={arena} onArrows={onArrows} />
      )}
      {arena.started && arena.isOver && <ResultCard arena={arena} />}
      {arena.isOver && playersEditor}
      {arena.started && <MovesCard arena={arena} />}
      {arena.started && <PlayersSummary arena={arena} />}
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
      <Typography variant="overline" sx={{ opacity: 0.7 }}>
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
  const preview = useMemo(
    () => setupPosition(arena.startFen),
    [arena.startFen]
  );

  const bothReady =
    arena.whiteEngine.status === "ready" &&
    arena.blackEngine.status === "ready";

  return (
    <Panel title="Set up the match">
      <Stack spacing={2.5}>
        <SideSetup
          title="White"
          side={arena.white}
          onChange={arena.setWhite}
          state={arena.whiteEngine}
        />
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
          >
            Build a position
          </Button>
        </Stack>

        <TextField
          size="small"
          label="Start from a FEN (optional)"
          value={arena.startFen ?? ""}
          onChange={(event) => {
            arena.setStartFen(event.target.value || undefined);
          }}
          error={!!preview.error}
          helperText={
            preview.error ??
            "The board previews this position. Leave empty for the standard starting position."
          }
        />

        <Button
          variant="contained"
          size="large"
          disabled={!bothReady || !!preview.error}
          startIcon={<Icon icon="mdi:play" height={22} />}
          onClick={() => arena.start()}
        >
          {bothReady ? "Start the match" : "Loading engines…"}
        </Button>
      </Stack>
    </Panel>
  );
}

function PlayersEditCard({ arena }: { arena: Arena }) {
  const setEditingPlayers = useSetAtom(arenaEditingPlayersAtom);

  return (
    <Panel title={<Typography fontWeight={600}>Players</Typography>}>
      <Stack spacing={2.5}>
        <SideSetup
          title="White"
          side={arena.white}
          onChange={arena.setWhite}
          state={arena.whiteEngine}
        />
        <SideSetup
          title="Black"
          side={arena.black}
          onChange={arena.setBlack}
          state={arena.blackEngine}
        />

        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          {arena.isOver
            ? "The finished game is kept. These players are used for the next match."
            : "The game goes on. Each new setting applies from the current position, so the next move uses it."}
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

  const canAdvance = arena.proposal.status === "ready" && !arena.isOver;

  return (
    <Panel
      title={
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography fontWeight={600}>
            {arena.isOver
              ? "Game over"
              : `${arena.turn === "w" ? "White" : "Black"} to move`}
          </Typography>
          {arena.proposal.status === "thinking" && (
            <CircularProgress size={16} thickness={5} />
          )}
        </Stack>
      }
    >
      <Stack spacing={1.75}>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            variant={arena.running ? "outlined" : "contained"}
            startIcon={
              <Icon
                icon={arena.running ? "mdi:pause" : "mdi:play"}
                height={20}
              />
            }
            disabled={arena.isOver}
            onClick={() => arena.setRunning(!arena.running)}
          >
            {arena.running ? "Pause" : "Auto-play"}
          </Button>
          <Tooltip title="Play the engine's proposed move" disableInteractive>
            <span>
              <Button
                variant="outlined"
                startIcon={<Icon icon="mdi:skip-next" height={20} />}
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
                variant="outlined"
                color="inherit"
                startIcon={<Icon icon="mdi:undo-variant" height={20} />}
                disabled={arena.game.history().length === 0}
                onClick={arena.takeBack}
              >
                Take back
              </Button>
            </span>
          </Tooltip>
        </Stack>

        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            size="small"
            color="inherit"
            startIcon={<Icon icon="mdi:swap-vertical" height={18} />}
            onClick={() => setFlipped((value) => !value)}
          >
            Flip board
          </Button>
          <Button
            size="small"
            color="inherit"
            startIcon={<Icon icon="mdi:restart" height={18} />}
            onClick={() => arena.start()}
          >
            Restart
          </Button>
          {!arena.isOver && (
            <Button
              size="small"
              color="inherit"
              aria-expanded={editingPlayers}
              startIcon={<Icon icon="mdi:cog-outline" height={18} />}
              onClick={() => setEditingPlayers(!editingPlayers)}
            >
              {editingPlayers ? "Hide players" : "Change players"}
            </Button>
          )}
          <Button
            size="small"
            color="inherit"
            startIcon={<Icon icon="mdi:plus" height={18} />}
            onClick={arena.stop}
          >
            New match
          </Button>
        </Stack>

        <Box>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Speed of auto-play
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={speed}
            onChange={(_, value: number | null) =>
              value !== null && setSpeed(value)
            }
          >
            {ARENA_SPEEDS.map((option) => (
              <ToggleButton key={option.ms} value={option.ms}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Variety: {Math.round(variety * 100)}%
          </Typography>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.05}
            value={variety}
            onChange={(_, value) => setVariety(value as number)}
            aria-label="Variety"
          />
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Higher variety lets the engines pick a near-best alternative
            sometimes, so repeated games differ.
          </Typography>
        </Box>
      </Stack>
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

  const candidates = useMemo(
    () =>
      proposal.status === "ready" && proposal.fen === arena.game.fen()
        ? linesToTopMoves(proposal.fen, proposal.choice.lines, 4)
        : [],
    [proposal, arena.game]
  );

  useEffect(() => {
    if (proposal.status !== "ready" || proposal.fen !== arena.game.fen()) {
      onArrows({ positionKey, arrows: [] });
      return;
    }

    const side = arena.game.turn();
    const chosenRank = candidates.find(
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

    const hovered = candidates.find(
      (candidate) => candidate.uci === hoveredUci
    );
    if (hovered && hovered.uci !== proposal.choice.uci) {
      arrows.push(
        arrowFromUci(hovered.uci, {
          kind: "candidate",
          rank: hovered.rank,
          side,
        })
      );
    }

    onArrows({ positionKey, arrows });
  }, [proposal, hoveredUci, positionKey, onArrows, candidates, arena.game]);

  useEffect(
    () => () => onArrows({ positionKey, arrows: [] }),
    [onArrows, positionKey]
  );

  const moverName = sideLabel(arena.mover);

  return (
    <Panel
      title={<Typography fontWeight={600}>{moverName} proposes</Typography>}
    >
      <Stack spacing={1}>
        {proposal.status === "loading" && (
          <Typography variant="body2">{proposal.message}</Typography>
        )}
        {proposal.status === "thinking" && (
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            Thinking…
          </Typography>
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
                setHovered({ positionKey, uci: candidate.uci })
              }
              onMouseLeave={() => setHovered(null)}
              tabIndex={0}
              onFocus={() => setHovered({ positionKey, uci: candidate.uci })}
              onBlur={() => setHovered(null)}
              sx={{
                p: 0.75,
                borderRadius: 1,
                border: 1,
                borderColor: chosen ? "success.main" : "divider",
                borderLeft: "4px solid",
                borderLeftColor:
                  candidate.rank === 1 ? "primary.main" : "divider",
                backgroundColor:
                  candidate.rank === 1 ? "action.selected" : undefined,
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="caption" color="text.secondary">
                    #{candidate.rank}
                    {candidate.rank === 1 ? " · Best" : ""}
                  </Typography>
                  <Typography fontWeight={700} component="span">
                    <PrettyMoveSan san={candidate.san} color={arena.turn} />
                  </Typography>
                  <Box
                    component="span"
                    sx={{
                      px: 0.75,
                      borderRadius: 1,
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      border: "1px solid #424242",
                      backgroundColor:
                        (candidate.cp ?? 0) < 0 || (candidate.mate ?? 0) < 0
                          ? "#000"
                          : "#fff",
                      color:
                        (candidate.cp ?? 0) < 0 || (candidate.mate ?? 0) < 0
                          ? "#fff"
                          : "#000",
                    }}
                  >
                    {candidate.evalLabel}
                  </Box>
                  {chosen && (
                    <Typography variant="caption" color="success.main">
                      engine's choice
                    </Typography>
                  )}
                </Stack>
              </Box>
              <Button
                size="small"
                variant={chosen ? "contained" : "outlined"}
                onClick={() => arena.playCandidate(candidate.uci)}
              >
                {chosen ? "Play" : "Nudge to this"}
              </Button>
            </Stack>
          );
        })}

        {proposal.status === "ready" && (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Or drag any piece on the board to make a different move yourself.
          </Typography>
        )}
      </Stack>
    </Panel>
  );
}

function MovesCard({ arena }: { arena: Arena }) {
  const history = arena.game.history();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { analysis } = arena;
  const selectedIndex = analysis.moves.findIndex(
    (entry) => entry.key === selectedKey
  );
  const index = selectedIndex < 0 ? history.length - 1 : selectedIndex;
  const entry = analysis.moves[index];
  const firstMove = analysis.moves[0]?.move;

  useEffect(() => {
    if (!history.length) setSelectedKey(null);
  }, [history.length]);

  return (
    <Panel title="Moves">
      <MovesList
        moves={history}
        startsWithBlack={firstMove?.color === "b"}
        firstMoveNumber={Number(firstMove?.before.split(" ")[5] ?? 1)}
        currentPly={analysis.showAnnotations ? index + 1 : history.length}
        onSelect={
          analysis.showAnnotations
            ? (ply) => setSelectedKey(analysis.moves[ply - 1].key)
            : undefined
        }
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
        emptyText={
          arena.isOver
            ? "This starting position is already game over."
            : "No moves yet. Press Next move or Auto-play."
        }
      />
      {analysis.showAnnotations && entry && (
        <>
          {selectedIndex >= 0 && index !== history.length - 1 && (
            <Button size="small" onClick={() => setSelectedKey(null)}>
              Follow latest move
            </Button>
          )}
          <MoveFeedback entry={entry} arena={arena} />
        </>
      )}
    </Panel>
  );
}

function PlayersSummary({ arena }: { arena: Arena }) {
  return (
    <Typography variant="caption" sx={{ opacity: 0.65, textAlign: "center" }}>
      White: {sideLabel(arena.white)} · Black: {sideLabel(arena.black)}
    </Typography>
  );
}

function ResultCard({ arena }: { arena: Arena }) {
  const router = useRouter();
  const { addGame } = useGameDatabase();
  const [editingPlayers, setEditingPlayers] = useAtom(arenaEditingPlayersAtom);
  const { result } = arena;

  const headline = result.winner
    ? `${result.winner === "w" ? "White" : "Black"} wins`
    : "Draw";

  const analyze = async () => {
    const id = await addGame(arena.finishedGame());
    router.push({ pathname: "/analysis", query: { gameId: id } });
  };

  return (
    <Panel>
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Icon icon="mdi:trophy-outline" height={40} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {headline}
          </Typography>
          <Typography sx={{ opacity: 0.75 }}>
            {result.reason} · {result.result}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="center">
          <Button variant="contained" onClick={analyze}>
            Analyze game
          </Button>
          <Button variant="outlined" onClick={() => arena.rematch()}>
            Rematch, swap colours
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            aria-expanded={editingPlayers}
            onClick={() => setEditingPlayers(!editingPlayers)}
          >
            {editingPlayers ? "Hide players" : "Change players"}
          </Button>
          <Button variant="outlined" color="inherit" onClick={arena.stop}>
            New match
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}
