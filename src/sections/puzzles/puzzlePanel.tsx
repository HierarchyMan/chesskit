import {
  InspectorPopover,
  PopoverSectionLabel,
  PopoverSwitchRow,
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
import type { VerticalWorkspaceSlots } from "@/components/boardWorkspace";
import { ToolbarButton } from "@/components/ToolbarButton";
import { setHandoff } from "@/lib/handoff";
import { MOVE_TIMES, MoveTime } from "@/lib/puzzleFlow";
import { PUZZLE_THEMES } from "@/lib/puzzles";
import { displayThemes } from "@/lib/puzzleThemes";
import { buildMoveStory, MoveStory } from "@/lib/visualize/moveStory";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import { useRouter } from "next/router";
import { ReactNode, useState } from "react";
import { PuzzleSource } from "./states";
import { PuzzleTrainer } from "./usePuzzleTrainer";

const SOURCES: { id: PuzzleSource; label: string; icon: string }[] = [
  { id: "lichess", label: "Lichess", icon: "mdi:puzzle-outline" },
  { id: "daily", label: "Daily", icon: "mdi:calendar-today" },
  { id: "mistakes", label: "My mistakes", icon: "mdi:target" },
  { id: "offline", label: "Offline", icon: "mdi:wifi-off" },
];

interface Props {
  trainer: PuzzleTrainer;
  onShowStory: (story: MoveStory) => void;
  storyControls: ReactNode;
}

export default function PuzzlePanel({
  trainer,
  onShowStory,
  storyControls,
}: Props) {
  const router = useRouter();
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const { puzzle, phase, source, stats } = trainer;

  const solved = phase === "solved";
  const isMistake = puzzle?.source === "mistake";
  const helped = trainer.failed || trainer.revealed;
  const sideName = trainer.solver === "w" ? "White" : "Black";
  const ratingVisible = solved || trainer.revealed;
  const usesThemes = source === "lichess" || source === "offline";
  const themes = puzzle && solved ? displayThemes(puzzle.themes) : [];
  const lessons = themes.filter((theme) => theme.explain).slice(0, 2);
  const multiStep = trainer.solverMoves > 1;
  const canAdvanceMistake = source !== "mistakes" || trainer.mistakeCount >= 2;

  const openWithFen = (path: string) => {
    setMoreAnchor(null);
    if (!puzzle) return;
    setHandoff({ kind: "fen", fen: puzzle.fen, source: "Puzzles" }, path);
    void router.push(path);
  };

  const visualizeMistake = () => {
    const entry = trainer.mistakeEntry;
    if (!entry) return;
    onShowStory(
      buildMoveStory({
        fenBefore: entry.fenBefore,
        playedUci: entry.playedUci,
        beforeLines: entry.beforeLines,
        afterLines: entry.afterLines,
      })
    );
  };

  const currentSource = SOURCES.find((s) => s.id === source);

  return (
    <InspectorShell>
      {/* Zone 1 — Slim Context Header */}
      <InspectorHeader
        left={
          <>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {currentSource?.label ?? "Puzzles"}
            </Typography>
            {source === "mistakes" && trainer.mistakeCount > 0 && (
              <InspectorPill
                label={`${trainer.mistakeNumber + 1}/${trainer.mistakeCount}`}
              />
            )}
          </>
        }
        right={
          <>
            <InspectorPill
              icon="mdi:trophy-outline"
              label={stats.rating}
              tooltip="Puzzle rating"
            />
            <InspectorPill
              icon="mdi:fire"
              tone={stats.streak > 0 ? "warning" : "neutral"}
              label={stats.streak}
              tooltip={`Current streak (best ${stats.bestStreak})`}
            />
          </>
        }
      />

      {/* Zone 2 — Semantic Status Banner (pinned at top, zero jump) */}
      {puzzle && phase !== "loading" && phase !== "empty" && (
        <Box
          role="status"
          aria-live="polite"
          sx={(theme) => {
            const tone =
              phase === "wrong"
                ? theme.palette.error.main
                : solved
                  ? helped
                    ? theme.palette.warning.main
                    : theme.palette.success.main
                  : phase === "replying"
                    ? theme.palette.success.main
                    : theme.palette.primary.main;
            const isNeutral =
              phase === "setup" || phase === "solving" || phase === "showing";
            return {
              px: 1.5,
              py: 1.1,
              flexShrink: 0,
              borderBottom: 1,
              borderColor: isNeutral ? "divider" : alpha(tone, 0.4),
              bgcolor: isNeutral
                ? theme.palette.mode === "dark"
                  ? alpha(theme.palette.common.white, 0.02)
                  : alpha(theme.palette.common.black, 0.02)
                : alpha(tone, 0.11),
            };
          }}
        >
          <Stack direction="row" alignItems="center" gap={1.15}>
            {solved ? (
              <Icon
                icon={helped ? "mdi:check-circle-outline" : "mdi:check-circle"}
                height={21}
                style={{
                  color: helped ? "#ed6c02" : "#2e7d32",
                  flexShrink: 0,
                }}
              />
            ) : phase === "wrong" ? (
              <Icon
                icon="mdi:close-circle"
                height={21}
                style={{ color: "#d32f2f", flexShrink: 0 }}
              />
            ) : phase === "replying" ? (
              <Icon
                icon="mdi:check-circle"
                height={21}
                style={{ color: "#2e7d32", flexShrink: 0 }}
              />
            ) : (
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: 2,
                  borderColor: "divider",
                  backgroundColor:
                    trainer.solver === "w" ? "#f2f2f2" : "#1d1d1d",
                  flexShrink: 0,
                }}
              />
            )}

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                lineHeight={1.25}
              >
                {solved
                  ? helped
                    ? isMistake
                      ? "Move found"
                      : "Solved with help"
                    : "Solved!"
                  : phase === "wrong"
                    ? `${trainer.playedSan} is not the move`
                    : phase === "replying"
                      ? `${trainer.playedSan} is right!`
                      : phase === "showing"
                        ? "Showing solution"
                        : `${sideName} to move`}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "block",
                  mt: 0.15,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {solved ? (
                  <>
                    {helped
                      ? isMistake
                        ? "Review the line or tap Show why."
                        : "Step through the line to lock in the pattern."
                      : "Clean solve."}
                    {trainer.ratingDelta !== null && (
                      <>
                        {" "}
                        Rating{" "}
                        <b>
                          {trainer.ratingDelta >= 0 ? "+" : ""}
                          {trainer.ratingDelta}
                        </b>{" "}
                        → {stats.rating}
                      </>
                    )}
                  </>
                ) : phase === "setup" ? (
                  "Watch your opponent's last move…"
                ) : phase === "wrong" ? (
                  trainer.revealed ? (
                    "That is not the solution move."
                  ) : (
                    "Take another look."
                  )
                ) : phase === "replying" ? (
                  trainer.waiting ? (
                    "Press Next move to see the reply."
                  ) : (
                    "Opponent replying…"
                  )
                ) : phase === "showing" ? (
                  trainer.waiting ? (
                    "Play the arrowed move or press Next move."
                  ) : (
                    "Playing out the winning line…"
                  )
                ) : trainer.replySan ? (
                  <>
                    Opponent played <b>{trainer.replySan}</b>.{" "}
                    {trainer.failed
                      ? "Find the next move."
                      : "Keep going — find the next move."}
                  </>
                ) : trainer.failed ? (
                  "Finish the line. This puzzle no longer counts for rating."
                ) : (
                  `Find the best move for ${sideName}.`
                )}
              </Typography>
            </Box>

            {multiStep && !solved && (
              <Stack
                direction="row"
                gap={0.45}
                sx={{ flexShrink: 0 }}
                role="img"
                aria-label={`Move ${Math.min(
                  trainer.movesDone + 1,
                  trainer.solverMoves
                )} of ${trainer.solverMoves}`}
              >
                {Array.from({ length: trainer.solverMoves }, (_, index) => (
                  <Box
                    key={index}
                    sx={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      border: 1.5,
                      borderColor:
                        index <= trainer.movesDone ? "success.main" : "divider",
                      backgroundColor:
                        index < trainer.movesDone
                          ? "success.main"
                          : "transparent",
                    }}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      )}

      {/* Zone 3 — Flexing Body */}
      <InspectorBody sx={{ p: 1.5 }}>
        <Stack spacing={1.5}>
          {trainer.notice && (
            <Alert
              severity="info"
              icon={<Icon icon="mdi:wifi-off" height={18} />}
              sx={{ py: 0.25 }}
            >
              {trainer.notice}
            </Alert>
          )}

          {phase === "loading" && (
            <Stack spacing={1}>
              <Typography variant="body2">Finding a puzzle…</Typography>
              <LinearProgress />
            </Stack>
          )}

          {phase === "empty" && (
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography fontWeight={600}>
                No mistakes to practice yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Play a game against a bot or import one, then run analysis. Your
                biggest misses will turn into puzzles here.
              </Typography>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => void router.push("/play")}
                >
                  Play a game
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => trainer.setSource("lichess")}
                >
                  Try Lichess puzzles
                </Button>
              </Stack>
            </Stack>
          )}

          {puzzle && phase !== "loading" && phase !== "empty" && (
            <>
              {trainer.shownHints.length > 0 && phase === "solving" && (
                <Alert
                  severity="info"
                  icon={<Icon icon="mdi:lightbulb-on-outline" height={18} />}
                  sx={{ py: 0.25 }}
                >
                  <Stack spacing={0.25}>
                    {trainer.shownHints.map((hint, index) => (
                      <span key={index}>{hint.text}</span>
                    ))}
                  </Stack>
                </Alert>
              )}

              {puzzle.description && !solved && (
                <Typography variant="body2" color="text.secondary">
                  {puzzle.description}
                </Typography>
              )}

              {storyControls}

              {trainer.line.length > 0 && (
                <Stack
                  data-board-shortcuts
                  direction="row"
                  flexWrap="wrap"
                  alignItems="center"
                  gap={0.5}
                  aria-label="Moves of the puzzle"
                >
                  {trainer.line.map((move) => (
                    <Stack
                      key={move.ply}
                      direction="row"
                      alignItems="center"
                      gap={0.25}
                    >
                      {(move.color === "w" || move === trainer.line[0]) && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 0.5, fontVariantNumeric: "tabular-nums" }}
                        >
                          {move.number}
                          {move.color === "w" ? "." : "…"}
                        </Typography>
                      )}
                      <Chip
                        size="small"
                        label={move.san}
                        clickable={solved}
                        onClick={
                          solved ? () => trainer.goToPly(move.ply) : undefined
                        }
                        color={
                          trainer.activePly === move.ply && solved
                            ? "primary"
                            : "default"
                        }
                        variant={move.mine ? "filled" : "outlined"}
                      />
                    </Stack>
                  ))}
                </Stack>
              )}

              {solved && (trainer.mistakeEntry || lessons.length > 0) && (
                <Stack spacing={1}>
                  {trainer.mistakeEntry && (
                    <Alert severity="info" sx={{ py: 0.25 }}>
                      In your game you played <b>{trainer.mistakeEntry.san}</b>{" "}
                      here.
                    </Alert>
                  )}
                  {lessons.length > 0 && (
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        What to take from it
                      </Typography>
                      {lessons.map((lesson) => (
                        <Typography key={lesson.id} variant="body2">
                          <b>{lesson.label}.</b> {lesson.explain}
                        </Typography>
                      ))}
                    </Stack>
                  )}
                </Stack>
              )}

              {((puzzle.rating !== undefined && ratingVisible) ||
                themes.length > 0) && (
                <>
                  <Divider />
                  <Stack
                    direction="row"
                    gap={0.65}
                    flexWrap="wrap"
                    alignItems="center"
                  >
                    {puzzle.rating !== undefined && ratingVisible && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Rating ${puzzle.rating}`}
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      />
                    )}
                    {themes.slice(0, 5).map((theme) => (
                      <Chip key={theme.id} size="small" label={theme.label} />
                    ))}
                  </Stack>
                </>
              )}

              {!solved && !isMistake && phase === "solving" && (
                <Typography variant="caption" color="text.secondary">
                  {trainer.nextHintReveals
                    ? "Show move or Give up counts as missed for rating. Skip is unrated."
                    : "Give up reveals the solution and counts as missed. Skip is unrated."}
                </Typography>
              )}
            </>
          )}
        </Stack>
      </InspectorBody>

      {/* Zone 4 — Docked Bottom Control Deck */}
      <InspectorDeck>
        {(solved && trainer.line.length > 0) ||
        (source === "mistakes" && trainer.mistakeCount >= 2) ? (
          <InspectorDeckRow sx={{ py: 0.45, minHeight: 38 }}>
            {solved && trainer.line.length > 0 ? (
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
                  disabled={!trainer.canStepBack}
                  onClick={() => trainer.review("start")}
                />
                <ToolbarButton
                  tooltip="Previous move (←)"
                  icon="mdi:chevron-left"
                  iconHeight={22}
                  disabled={!trainer.canStepBack}
                  onClick={() => trainer.review("previous")}
                />
                <ToolbarButton
                  tooltip="Next move (→)"
                  icon="mdi:chevron-right"
                  iconHeight={22}
                  disabled={!trainer.canStepForward}
                  onClick={() => trainer.review("next")}
                />
                <ToolbarButton
                  tooltip="End (End)"
                  icon="mdi:skip-next"
                  iconHeight={20}
                  disabled={!trainer.canStepForward}
                  onClick={() => trainer.review("end")}
                />
              </Stack>
            ) : (
              <Box />
            )}

            {source === "mistakes" && trainer.mistakeCount >= 2 && (
              <Stack direction="row" alignItems="center" gap={0.25}>
                <ToolbarButton
                  tooltip="Previous mistake"
                  icon="mdi:chevron-left"
                  iconHeight={20}
                  onClick={trainer.previous}
                />
                <ToolbarButton
                  tooltip="Next mistake"
                  icon="mdi:chevron-right"
                  iconHeight={20}
                  onClick={trainer.next}
                />
              </Stack>
            )}
          </InspectorDeckRow>
        ) : null}

        <InspectorDeckRow
          dividerTop={
            (solved && trainer.line.length > 0) ||
            (source === "mistakes" && trainer.mistakeCount >= 2)
          }
        >
          <Stack
            direction="row"
            alignItems="center"
            gap={0.45}
            flexWrap="nowrap"
            sx={{ flexShrink: 0 }}
            data-board-shortcuts
          >
            {!solved ? (
              <>
                <DeckButton
                  icon="mdi:lightbulb-on-outline"
                  disabled={
                    phase !== "solving" ||
                    trainer.hintsTotal === 0 ||
                    trainer.hintLevel >= trainer.hintsTotal
                  }
                  onClick={trainer.askHint}
                >
                  {trainer.nextHintReveals
                    ? "Show move"
                    : trainer.hintLevel < trainer.hintsTotal
                      ? `Hint ${trainer.hintLevel + 1}/${trainer.hintsTotal}`
                      : "Hint"}
                </DeckButton>

                {trainer.waiting ? (
                  <DeckButton
                    active
                    icon="mdi:skip-next"
                    onClick={trainer.advance}
                  >
                    Next move
                  </DeckButton>
                ) : (
                  canAdvanceMistake && (
                    <DeckButton icon="mdi:skip-next" onClick={trainer.next}>
                      Skip
                    </DeckButton>
                  )
                )}
              </>
            ) : (
              <>
                {canAdvanceMistake && (
                  <Tooltip title="Next puzzle (Space / Enter / N)">
                    <span>
                      <DeckButton
                        active
                        icon="mdi:skip-next"
                        onClick={trainer.next}
                      >
                        {source === "mistakes" ? "Next" : "Next puzzle"}
                      </DeckButton>
                    </span>
                  </Tooltip>
                )}
                <DeckButton icon="mdi:refresh" onClick={trainer.retry}>
                  Retry
                </DeckButton>
                {trainer.mistakeEntry && (
                  <DeckButton icon="mdi:eye-outline" onClick={visualizeMistake}>
                    Show why
                  </DeckButton>
                )}
              </>
            )}

            <DeckButton
              active={!!optionsAnchor}
              icon="mdi:tune-variant"
              onClick={(event) => setOptionsAnchor(event.currentTarget)}
            >
              Options
            </DeckButton>
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            gap={0.25}
            flexWrap="nowrap"
            sx={{ ml: "auto", flexShrink: 0 }}
          >
            {!solved ? (
              <DeckButton
                subtle
                danger
                icon="mdi:eye-outline"
                disabled={phase !== "solving"}
                onClick={trainer.revealSolution}
              >
                Give up
              </DeckButton>
            ) : (
              <DeckButton
                subtle
                icon="mdi:dots-horizontal"
                onClick={(event) => setMoreAnchor(event.currentTarget)}
              >
                Open in
              </DeckButton>
            )}
          </Stack>
        </InspectorDeckRow>
      </InspectorDeck>

      {/* Puzzle Options Popover (Source, Theme, Pace, Automation, Stats) */}
      <InspectorPopover
        title="Puzzle options"
        open={!!optionsAnchor}
        anchorEl={optionsAnchor}
        onClose={() => setOptionsAnchor(null)}
        width={324}
      >
        <Stack spacing={1.5}>
          <Box>
            <PopoverSectionLabel>Source</PopoverSectionLabel>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={source}
              aria-label="Puzzle source"
              onChange={(_, value: PuzzleSource | null) =>
                value && trainer.setSource(value)
              }
              sx={{
                mt: 0.6,
                "& .MuiToggleButton-root": {
                  py: 0.45,
                  px: 0.6,
                  fontSize: "0.74rem",
                },
              }}
            >
              {SOURCES.map(({ id, label }) => (
                <ToggleButton key={id} value={id}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {usesThemes && (
            <Box>
              <PopoverSectionLabel>Theme</PopoverSectionLabel>
              <Select
                size="small"
                fullWidth
                value={trainer.theme}
                onChange={(event) => trainer.setTheme(event.target.value)}
                sx={{ mt: 0.6 }}
              >
                {PUZZLE_THEMES.map(({ id, label }) => (
                  <MenuItem key={id} value={id}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          )}

          <Box>
            <PopoverSectionLabel>Move pace</PopoverSectionLabel>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={trainer.moveTime}
              aria-label="Move pace"
              onChange={(_, value: MoveTime | null) =>
                value && trainer.setMoveTime(value)
              }
              sx={{
                mt: 0.6,
                "& .MuiToggleButton-root": { py: 0.4, fontSize: "0.75rem" },
              }}
            >
              {MOVE_TIMES.map(({ id, label }) => (
                <ToggleButton key={id} value={id}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Stack spacing={0.25}>
            <PopoverSwitchRow
              label="Opponent replies automatically"
              help="When off, press Next move to play each opponent reply"
              checked={trainer.autoNext}
              onChange={trainer.setAutoNext}
            />
            <PopoverSwitchRow
              label="Auto-advance on clean solve"
              checked={trainer.autoJump}
              onChange={trainer.setAutoJump}
            />
          </Stack>

          <Divider />

          <Stack
            direction="row"
            justifyContent="space-around"
            textAlign="center"
          >
            <Box>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {stats.rating}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Rating
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {stats.streak} / {stats.bestStreak}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Streak / Best
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {stats.solved}/{stats.solved + stats.failed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Solved
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </InspectorPopover>

      {/* Post-solve Overflow Menu */}
      <Menu
        anchorEl={moreAnchor}
        open={!!moreAnchor}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              borderRadius: 1.5,
              border: 1,
              borderColor: "divider",
              mb: 0.5,
            },
          },
        }}
      >
        <MenuItem dense onClick={() => openWithFen("/analysis")}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Icon icon="mdi:chart-line" height={18} />
          </ListItemIcon>
          <ListItemText
            primary="Analyze position"
            slotProps={{ primary: { fontSize: "0.84rem" } }}
          />
        </MenuItem>
        <MenuItem dense onClick={() => openWithFen("/play")}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <Icon icon="mdi:chess-pawn" height={18} />
          </ListItemIcon>
          <ListItemText
            primary="Play it out vs bot"
            slotProps={{ primary: { fontSize: "0.84rem" } }}
          />
        </MenuItem>
        {puzzle?.url && (
          <MenuItem
            dense
            component="a"
            href={puzzle.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMoreAnchor(null)}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Icon icon="mdi:open-in-new" height={18} />
            </ListItemIcon>
            <ListItemText
              primary="Open on Lichess"
              slotProps={{ primary: { fontSize: "0.84rem" } }}
            />
          </MenuItem>
        )}
      </Menu>
    </InspectorShell>
  );
}

/**
 * Shared vertical workspace slots for Puzzles: keeps board + semantic status banner
 * (or CascadeBar) + single-row thumb Action Bar above the fold, and places move chips,
 * tactical lessons, themes, and external links cleanly below the fold.
 */
export function usePuzzleVerticalSlots({
  trainer,
  onShowStory,
  storyControls,
  storyActive,
}: {
  trainer: PuzzleTrainer;
  onShowStory: (story: MoveStory) => void;
  storyControls: ReactNode;
  storyActive: boolean;
}): VerticalWorkspaceSlots {
  const router = useRouter();
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const { puzzle, phase, source, stats } = trainer;

  const solved = phase === "solved";
  const isMistake = puzzle?.source === "mistake";
  const helped = trainer.failed || trainer.revealed;
  const sideName = trainer.solver === "w" ? "White" : "Black";
  const ratingVisible = solved || trainer.revealed;
  const usesThemes = source === "lichess" || source === "offline";
  const themes = puzzle && solved ? displayThemes(puzzle.themes) : [];
  const lessons = themes.filter((theme) => theme.explain).slice(0, 2);
  const multiStep = trainer.solverMoves > 1;
  const canAdvanceMistake = source !== "mistakes" || trainer.mistakeCount >= 2;
  const currentSource = SOURCES.find((s) => s.id === source);

  const openWithFen = (path: string) => {
    setOptionsAnchor(null);
    if (!puzzle) return;
    setHandoff({ kind: "fen", fen: puzzle.fen, source: "Puzzles" }, path);
    void router.push(path);
  };

  const visualizeMistake = () => {
    const entry = trainer.mistakeEntry;
    if (!entry) return;
    onShowStory(
      buildMoveStory({
        fenBefore: entry.fenBefore,
        playedUci: entry.playedUci,
        beforeLines: entry.beforeLines,
        afterLines: entry.afterLines,
      })
    );
  };

  const latestHint = trainer.shownHints.at(-1);

  const vertical: VerticalWorkspaceSlots = {
    contextBar: (
      <VerticalContextStrip
        left={
          <>
            <InspectorPill
              icon={currentSource?.icon}
              label={`${currentSource?.label ?? "Puzzles"} ▾`}
              onClick={(event?: unknown) => {
                const target = (event as React.MouseEvent<HTMLElement>)
                  ?.currentTarget;
                setOptionsAnchor(target ?? document.body);
              }}
              ariaLabel="Change puzzle source and options"
            />
            {source === "mistakes" && trainer.mistakeCount > 0 && (
              <InspectorPill
                label={`${trainer.mistakeNumber + 1}/${trainer.mistakeCount}`}
              />
            )}
          </>
        }
        right={
          <>
            <InspectorPill
              icon="mdi:trophy-outline"
              label={stats.rating}
              tooltip="Puzzle rating"
            />
            <InspectorPill
              icon="mdi:fire"
              tone={stats.streak > 0 ? "warning" : "neutral"}
              label={stats.streak}
              tooltip={`Current streak (best ${stats.bestStreak})`}
            />
          </>
        }
      />
    ),
    liveStrip: storyActive ? (
      <Box sx={{ flexShrink: 0 }}>{storyControls}</Box>
    ) : phase === "loading" ? (
      <VerticalLiveStrip minHeight={62}>
        <Stack spacing={0.75}>
          <Typography variant="body2">Finding a puzzle…</Typography>
          <LinearProgress />
        </Stack>
      </VerticalLiveStrip>
    ) : phase === "empty" ? (
      <VerticalLiveStrip minHeight={62}>
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="subtitle2" fontWeight={700}>
            No mistakes to practice yet
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Play or analyze a game and your biggest misses will appear here.
          </Typography>
          <Stack direction="row" gap={1}>
            <Button
              variant="contained"
              size="small"
              onClick={() => void router.push("/play")}
            >
              Play a game
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => trainer.setSource("lichess")}
            >
              Lichess puzzles
            </Button>
          </Stack>
        </Stack>
      </VerticalLiveStrip>
    ) : puzzle ? (
      <VerticalLiveStrip
        minHeight={62}
        role="status"
        aria-live="polite"
        sx={(theme) => {
          const tone =
            phase === "wrong"
              ? theme.palette.error.main
              : solved
                ? helped
                  ? theme.palette.warning.main
                  : theme.palette.success.main
                : phase === "replying"
                  ? theme.palette.success.main
                  : theme.palette.primary.main;
          const isNeutral =
            phase === "setup" || phase === "solving" || phase === "showing";
          return {
            borderColor: isNeutral ? "divider" : alpha(tone, 0.45),
            bgcolor: isNeutral ? "background.paper" : alpha(tone, 0.11),
          };
        }}
      >
        <Stack spacing={0.6}>
          <Stack direction="row" alignItems="center" gap={1}>
            {solved ? (
              <Icon
                icon={helped ? "mdi:check-circle-outline" : "mdi:check-circle"}
                height={20}
                style={{
                  color: helped ? "#ed6c02" : "#2e7d32",
                  flexShrink: 0,
                }}
              />
            ) : phase === "wrong" ? (
              <Icon
                icon="mdi:close-circle"
                height={20}
                style={{ color: "#d32f2f", flexShrink: 0 }}
              />
            ) : phase === "replying" ? (
              <Icon
                icon="mdi:check-circle"
                height={20}
                style={{ color: "#2e7d32", flexShrink: 0 }}
              />
            ) : (
              <Box
                sx={{
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  border: 2,
                  borderColor: "divider",
                  backgroundColor:
                    trainer.solver === "w" ? "#f2f2f2" : "#1d1d1d",
                  flexShrink: 0,
                }}
              />
            )}

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2}>
                {solved
                  ? helped
                    ? isMistake
                      ? "Move found"
                      : "Solved with help"
                    : "Solved!"
                  : phase === "wrong"
                    ? `${trainer.playedSan} is not the move`
                    : phase === "replying"
                      ? `${trainer.playedSan} is right!`
                      : phase === "showing"
                        ? "Showing solution"
                        : `${sideName} to move`}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "block",
                  mt: 0.15,
                  fontVariantNumeric: "tabular-nums",
                }}
                noWrap
              >
                {solved ? (
                  <>
                    {helped
                      ? isMistake
                        ? "Review the line or tap Show why."
                        : "Step through the line to lock in the pattern."
                      : "Clean solve."}
                    {trainer.ratingDelta !== null && (
                      <>
                        {" "}
                        Rating{" "}
                        <b>
                          {trainer.ratingDelta >= 0 ? "+" : ""}
                          {trainer.ratingDelta}
                        </b>{" "}
                        → {stats.rating}
                      </>
                    )}
                  </>
                ) : phase === "setup" ? (
                  "Watch your opponent's last move…"
                ) : phase === "wrong" ? (
                  trainer.revealed ? (
                    "That is not the solution move."
                  ) : (
                    "Take another look."
                  )
                ) : phase === "replying" ? (
                  trainer.waiting ? (
                    "Tap Next move to see the reply."
                  ) : (
                    "Opponent replying…"
                  )
                ) : phase === "showing" ? (
                  trainer.waiting ? (
                    "Play the arrowed move or tap Next move."
                  ) : (
                    "Playing out the winning line…"
                  )
                ) : trainer.replySan ? (
                  <>
                    Opponent played <b>{trainer.replySan}</b>. Find the next
                    move.
                  </>
                ) : (
                  `Find the best move for ${sideName}.`
                )}
              </Typography>
            </Box>

            {multiStep && !solved && (
              <Stack direction="row" gap={0.45} sx={{ flexShrink: 0 }}>
                {Array.from({ length: trainer.solverMoves }, (_, index) => (
                  <Box
                    key={index}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      border: 1.5,
                      borderColor:
                        index <= trainer.movesDone ? "success.main" : "divider",
                      backgroundColor:
                        index < trainer.movesDone
                          ? "success.main"
                          : "transparent",
                    }}
                  />
                ))}
              </Stack>
            )}
          </Stack>

          {latestHint && phase === "solving" && (
            <Stack
              direction="row"
              alignItems="center"
              gap={0.5}
              sx={{
                pt: 0.4,
                borderTop: 1,
                borderColor: "divider",
                color: "info.main",
              }}
            >
              <Icon icon="mdi:lightbulb-on-outline" height={15} />
              <Typography variant="caption" color="text.primary" noWrap>
                {latestHint.text}
              </Typography>
            </Stack>
          )}
        </Stack>
      </VerticalLiveStrip>
    ) : null,
    actionBar: (
      <WorkspaceActionBar
        left={
          !solved ? (
            <>
              <DeckButton
                icon="mdi:lightbulb-on-outline"
                disabled={
                  phase !== "solving" ||
                  trainer.hintsTotal === 0 ||
                  trainer.hintLevel >= trainer.hintsTotal
                }
                onClick={trainer.askHint}
              >
                {trainer.nextHintReveals
                  ? "Show"
                  : trainer.hintLevel < trainer.hintsTotal
                    ? `Hint ${trainer.hintLevel + 1}/${trainer.hintsTotal}`
                    : "Hint"}
              </DeckButton>
              {trainer.waiting ? (
                <DeckButton
                  active
                  icon="mdi:skip-next"
                  onClick={trainer.advance}
                >
                  Next move
                </DeckButton>
              ) : (
                canAdvanceMistake && (
                  <DeckButton icon="mdi:skip-next" onClick={trainer.next}>
                    Skip
                  </DeckButton>
                )
              )}
            </>
          ) : (
            <>
              {trainer.line.length > 0 && (
                <>
                  <ToolbarButton
                    tooltip="Previous move"
                    icon="mdi:chevron-left"
                    iconHeight={22}
                    disabled={!trainer.canStepBack}
                    onClick={() => trainer.review("previous")}
                  />
                  <ToolbarButton
                    tooltip="Next move"
                    icon="mdi:chevron-right"
                    iconHeight={22}
                    disabled={!trainer.canStepForward}
                    onClick={() => trainer.review("next")}
                  />
                </>
              )}
              {canAdvanceMistake && (
                <DeckButton active icon="mdi:skip-next" onClick={trainer.next}>
                  Next
                </DeckButton>
              )}
              <ToolbarButton
                tooltip="Retry puzzle"
                icon="mdi:refresh"
                iconHeight={20}
                onClick={trainer.retry}
              />
              {trainer.mistakeEntry && (
                <DeckButton icon="mdi:eye-outline" onClick={visualizeMistake}>
                  Why
                </DeckButton>
              )}
            </>
          )
        }
        right={
          <>
            {!solved && (
              <DeckButton
                subtle
                danger
                icon="mdi:eye-outline"
                disabled={phase !== "solving"}
                onClick={trainer.revealSolution}
              >
                Give up
              </DeckButton>
            )}
            <ToolbarButton
              tooltip="Puzzle options"
              icon="mdi:tune-variant"
              iconHeight={20}
              active={!!optionsAnchor || undefined}
              onClick={() => setOptionsAnchor(document.body)}
            />
          </>
        }
      />
    ),
    sheet:
      puzzle && phase !== "loading" && phase !== "empty" ? (
        <Stack spacing={1.5} sx={{ p: 1.5 }}>
          {trainer.notice && (
            <Alert
              severity="info"
              icon={<Icon icon="mdi:wifi-off" height={18} />}
              sx={{ py: 0.25 }}
            >
              {trainer.notice}
            </Alert>
          )}

          {trainer.line.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ fontWeight: 700, letterSpacing: "0.08em" }}
              >
                Puzzle line
              </Typography>
              <Stack
                direction="row"
                flexWrap="wrap"
                alignItems="center"
                gap={0.5}
                mt={0.5}
              >
                {trainer.line.map((move) => (
                  <Stack
                    key={move.ply}
                    direction="row"
                    alignItems="center"
                    gap={0.25}
                  >
                    {(move.color === "w" || move === trainer.line[0]) && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.5, fontVariantNumeric: "tabular-nums" }}
                      >
                        {move.number}
                        {move.color === "w" ? "." : "…"}
                      </Typography>
                    )}
                    <Chip
                      size="small"
                      label={move.san}
                      clickable={solved}
                      onClick={
                        solved ? () => trainer.goToPly(move.ply) : undefined
                      }
                      color={
                        trainer.activePly === move.ply && solved
                          ? "primary"
                          : "default"
                      }
                      variant={move.mine ? "filled" : "outlined"}
                    />
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {puzzle.description && !solved && (
            <Typography variant="body2" color="text.secondary">
              {puzzle.description}
            </Typography>
          )}

          {solved && (trainer.mistakeEntry || lessons.length > 0) && (
            <Stack spacing={1}>
              {trainer.mistakeEntry && (
                <Alert severity="info" sx={{ py: 0.25 }}>
                  In your game you played <b>{trainer.mistakeEntry.san}</b>{" "}
                  here.
                </Alert>
              )}
              {lessons.length > 0 && (
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    What to take from it
                  </Typography>
                  {lessons.map((lesson) => (
                    <Typography key={lesson.id} variant="body2">
                      <b>{lesson.label}.</b> {lesson.explain}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Stack>
          )}

          {((puzzle.rating !== undefined && ratingVisible) ||
            themes.length > 0) && (
            <>
              <Divider />
              <Stack
                direction="row"
                gap={0.65}
                flexWrap="wrap"
                alignItems="center"
              >
                {puzzle.rating !== undefined && ratingVisible && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Rating ${puzzle.rating}`}
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  />
                )}
                {themes.slice(0, 5).map((theme) => (
                  <Chip key={theme.id} size="small" label={theme.label} />
                ))}
              </Stack>
            </>
          )}

          {solved && (
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:chart-line" height={16} />}
                onClick={() => openWithFen("/analysis")}
              >
                Analyze position
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:chess-pawn" height={16} />}
                onClick={() => openWithFen("/play")}
              >
                Play vs bot
              </Button>
            </Stack>
          )}

          {!solved && !isMistake && phase === "solving" && (
            <Typography variant="caption" color="text.secondary">
              {trainer.nextHintReveals
                ? "Show move or Give up counts as missed for rating. Skip is unrated."
                : "Give up reveals the solution and counts as missed. Skip is unrated."}
            </Typography>
          )}
        </Stack>
      ) : undefined,
  };

  const overlays = (
    <InspectorPopover
      title="Puzzle options"
      open={!!optionsAnchor}
      anchorEl={optionsAnchor}
      onClose={() => setOptionsAnchor(null)}
      width={324}
    >
      <Stack spacing={1.5}>
        <Box>
          <PopoverSectionLabel>Source</PopoverSectionLabel>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={source}
            aria-label="Puzzle source"
            onChange={(_, value: PuzzleSource | null) =>
              value && trainer.setSource(value)
            }
            sx={{
              mt: 0.6,
              "& .MuiToggleButton-root": {
                py: 0.5,
                px: 0.6,
                fontSize: "0.74rem",
              },
            }}
          >
            {SOURCES.map(({ id, label }) => (
              <ToggleButton key={id} value={id}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {usesThemes && (
          <Box>
            <PopoverSectionLabel>Theme</PopoverSectionLabel>
            <Select
              size="small"
              fullWidth
              value={trainer.theme}
              onChange={(event) => trainer.setTheme(event.target.value)}
              sx={{ mt: 0.6 }}
            >
              {PUZZLE_THEMES.map(({ id, label }) => (
                <MenuItem key={id} value={id}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </Box>
        )}

        <Box>
          <PopoverSectionLabel>Move pace</PopoverSectionLabel>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={trainer.moveTime}
            aria-label="Move pace"
            onChange={(_, value: MoveTime | null) =>
              value && trainer.setMoveTime(value)
            }
            sx={{
              mt: 0.6,
              "& .MuiToggleButton-root": { py: 0.45, fontSize: "0.75rem" },
            }}
          >
            {MOVE_TIMES.map(({ id, label }) => (
              <ToggleButton key={id} value={id}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Stack spacing={0.25}>
          <PopoverSwitchRow
            label="Opponent replies automatically"
            help="When off, press Next move to play each opponent reply"
            checked={trainer.autoNext}
            onChange={trainer.setAutoNext}
          />
          <PopoverSwitchRow
            label="Auto-advance on clean solve"
            checked={trainer.autoJump}
            onChange={trainer.setAutoJump}
          />
        </Stack>

        {solved && (
          <>
            <Divider />
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:chart-line" height={16} />}
                onClick={() => openWithFen("/analysis")}
              >
                Analyze
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:chess-pawn" height={16} />}
                onClick={() => openWithFen("/play")}
              >
                Play vs bot
              </Button>
              {puzzle?.url && (
                <Button
                  size="small"
                  variant="outlined"
                  component="a"
                  href={puzzle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<Icon icon="mdi:open-in-new" height={16} />}
                >
                  Lichess
                </Button>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </InspectorPopover>
  );

  return {
    ...vertical,
    actionBar: (
      <>
        {vertical.actionBar}
        {overlays}
      </>
    ),
  };
}
