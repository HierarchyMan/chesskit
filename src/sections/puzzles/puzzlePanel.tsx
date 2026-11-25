import { ReactNode } from "react";
import Panel from "@/components/panel";
import { setHandoff } from "@/lib/handoff";
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
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useRouter } from "next/router";
import PuzzleControls from "./puzzleControls";
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
    if (!puzzle) return;
    setHandoff({ kind: "fen", fen: puzzle.fen }, path);
    router.push(path);
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

  return (
    <Stack spacing={0}>
      <Panel>
        <Stack spacing={1.5}>
          {trainer.notice && (
            <Alert
              severity="info"
              icon={<Icon icon="mdi:wifi-off" height={20} />}
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
                  onClick={() => router.push("/play")}
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
              {/* Semantic status banner at TOP above all actions */}
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
                    phase === "setup" ||
                    phase === "solving" ||
                    phase === "showing";
                  return {
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 1.5,
                    border: 1,
                    borderColor: isNeutral ? "divider" : alpha(tone, 0.45),
                    bgcolor: isNeutral ? "action.hover" : alpha(tone, 0.12),
                  };
                }}
              >
                <Stack direction="row" alignItems="center" gap={1.25}>
                  {solved ? (
                    <Icon
                      icon={
                        helped ? "mdi:check-circle-outline" : "mdi:check-circle"
                      }
                      height={22}
                      style={{
                        color: helped ? "#ed6c02" : "#2e7d32",
                        flexShrink: 0,
                      }}
                    />
                  ) : phase === "wrong" ? (
                    <Icon
                      icon="mdi:close-circle"
                      height={22}
                      style={{ color: "#d32f2f", flexShrink: 0 }}
                    />
                  ) : phase === "replying" ? (
                    <Icon
                      icon="mdi:check-circle"
                      height={22}
                      style={{ color: "#2e7d32", flexShrink: 0 }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
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
                      variant="subtitle1"
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
                        mt: 0.25,
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
                      gap={0.5}
                      sx={{ flexShrink: 0 }}
                      role="img"
                      aria-label={`Move ${Math.min(
                        trainer.movesDone + 1,
                        trainer.solverMoves
                      )} of ${trainer.solverMoves}`}
                    >
                      {Array.from(
                        { length: trainer.solverMoves },
                        (_, index) => (
                          <Box
                            key={index}
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              border: 1.5,
                              borderColor:
                                index <= trainer.movesDone
                                  ? "success.main"
                                  : "divider",
                              backgroundColor:
                                index < trainer.movesDone
                                  ? "success.main"
                                  : "transparent",
                            }}
                          />
                        )
                      )}
                    </Stack>
                  )}
                </Stack>
              </Box>

              {trainer.shownHints.length > 0 && phase === "solving" && (
                <Alert
                  severity="info"
                  icon={<Icon icon="mdi:lightbulb-on-outline" height={20} />}
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

              {/* Action controls: separated cleanly by risk when solving, unified when solved */}
              {!solved ? (
                <Stack spacing={0.75} data-board-shortcuts>
                  <Stack
                    direction="row"
                    gap={1}
                    flexWrap="wrap"
                    alignItems="center"
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      color={trainer.nextHintReveals ? "warning" : "primary"}
                      disabled={
                        phase !== "solving" ||
                        trainer.hintsTotal === 0 ||
                        trainer.hintLevel >= trainer.hintsTotal
                      }
                      startIcon={
                        <Icon icon="mdi:lightbulb-on-outline" height={18} />
                      }
                      onClick={trainer.askHint}
                      sx={{
                        minWidth: 112,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {trainer.nextHintReveals
                        ? "Show move"
                        : trainer.hintLevel < trainer.hintsTotal
                          ? `Hint ${trainer.hintLevel + 1}/${trainer.hintsTotal}`
                          : "Hint"}
                    </Button>

                    {canAdvanceMistake && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<Icon icon="mdi:skip-next" height={18} />}
                        onClick={trainer.next}
                        sx={{ borderColor: "divider" }}
                      >
                        Skip
                      </Button>
                    )}

                    {trainer.waiting && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Icon icon="mdi:skip-next" height={18} />}
                        onClick={trainer.advance}
                      >
                        Next move
                      </Button>
                    )}

                    <Box sx={{ flex: 1 }} />

                    <Button
                      size="small"
                      variant="text"
                      color="error"
                      disabled={phase !== "solving"}
                      startIcon={<Icon icon="mdi:eye-outline" height={18} />}
                      onClick={trainer.revealSolution}
                      sx={{
                        color: "text.secondary",
                        "&:hover": { color: "error.main" },
                      }}
                    >
                      Give up
                    </Button>
                  </Stack>

                  {!isMistake && phase === "solving" && (
                    <Typography variant="caption" color="text.secondary">
                      {trainer.nextHintReveals
                        ? "Show move or Give up counts as missed for rating. Skip is unrated."
                        : "Give up reveals the solution and counts as missed. Skip is unrated."}
                    </Typography>
                  )}
                </Stack>
              ) : (
                <Stack spacing={1} data-board-shortcuts>
                  <Stack
                    direction="row"
                    gap={1}
                    flexWrap="wrap"
                    alignItems="center"
                  >
                    {canAdvanceMistake && (
                      <Tooltip title="Next puzzle (Space / Enter / N)">
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<Icon icon="mdi:skip-next" height={18} />}
                          onClick={trainer.next}
                        >
                          {source === "mistakes"
                            ? "Next mistake"
                            : "Next puzzle"}
                        </Button>
                      </Tooltip>
                    )}

                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Icon icon="mdi:refresh" height={18} />}
                      onClick={trainer.retry}
                    >
                      Retry
                    </Button>

                    {trainer.mistakeEntry && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Icon icon="mdi:eye-outline" height={18} />}
                        onClick={visualizeMistake}
                      >
                        Show why
                      </Button>
                    )}

                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Icon icon="mdi:chart-line" height={18} />}
                      onClick={() => openWithFen("/analysis")}
                    >
                      Analyze
                    </Button>

                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Icon icon="mdi:chess-pawn" height={18} />}
                      onClick={() => openWithFen("/play")}
                    >
                      Play it out
                    </Button>

                    {puzzle.url && (
                      <Button
                        size="small"
                        variant="text"
                        component="a"
                        href={puzzle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        startIcon={<Icon icon="mdi:open-in-new" height={18} />}
                      >
                        Lichess
                      </Button>
                    )}
                  </Stack>
                </Stack>
              )}

              {solved && trainer.line.length > 0 && (
                <Stack
                  data-board-shortcuts
                  direction="row"
                  justifyContent="center"
                  gap={0.5}
                >
                  <Tooltip title="Start (Home)">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Go to the start"
                        disabled={!trainer.canStepBack}
                        onClick={() => trainer.review("start")}
                      >
                        <Icon icon="mdi:skip-previous" height={20} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Previous move (←)">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Previous move"
                        disabled={!trainer.canStepBack}
                        onClick={() => trainer.review("previous")}
                      >
                        <Icon icon="mdi:chevron-left" height={22} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Next move (→)">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Next move"
                        disabled={!trainer.canStepForward}
                        onClick={() => trainer.review("next")}
                      >
                        <Icon icon="mdi:chevron-right" height={22} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="End (End)">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Go to the end"
                        disabled={!trainer.canStepForward}
                        onClick={() => trainer.review("end")}
                      >
                        <Icon icon="mdi:skip-next" height={20} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              )}

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
                    <Alert severity="info">
                      In your game you played <b>{trainer.mistakeEntry.san}</b>{" "}
                      here.
                    </Alert>
                  )}
                  {lessons.length > 0 && (
                    <Stack spacing={0.75}>
                      <Typography variant="subtitle2">
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
                    gap={0.75}
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
            </>
          )}
        </Stack>
      </Panel>

      <Panel>
        <Stack spacing={1.5}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={source}
            aria-label="Puzzle source"
            onChange={(_, value: PuzzleSource | null) =>
              value && trainer.setSource(value)
            }
          >
            {SOURCES.map(({ id, label, icon }) => (
              <ToggleButton
                key={id}
                value={id}
                aria-label={label}
                sx={{ p: 0 }}
              >
                <Tooltip title={label}>
                  <Box
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 0.75,
                      py: 0.75,
                      px: 1,
                      width: "100%",
                    }}
                  >
                    <Icon icon={icon} height={16} />
                    <Box
                      component="span"
                      sx={{ display: { xs: "none", sm: "inline" } }}
                    >
                      {label}
                    </Box>
                  </Box>
                </Tooltip>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {usesThemes && (
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                Theme
              </Typography>
              <Select
                size="small"
                fullWidth
                value={trainer.theme}
                onChange={(event) => trainer.setTheme(event.target.value)}
              >
                {PUZZLE_THEMES.map(({ id, label }) => (
                  <MenuItem key={id} value={id}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          )}

          {source === "mistakes" && trainer.mistakeCount > 0 && (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Button
                size="small"
                disabled={trainer.mistakeCount < 2}
                onClick={trainer.previous}
                startIcon={<Icon icon="mdi:chevron-left" height={18} />}
              >
                Previous
              </Button>
              <Typography
                variant="body2"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                Mistake {trainer.mistakeNumber + 1} of {trainer.mistakeCount}
              </Typography>
              <Button
                size="small"
                disabled={trainer.mistakeCount < 2}
                onClick={trainer.next}
                endIcon={<Icon icon="mdi:chevron-right" height={18} />}
              >
                Next
              </Button>
            </Stack>
          )}

          <PuzzleControls trainer={trainer} />
        </Stack>
      </Panel>

      <Panel sx={{ borderBottom: 0 }}>
        <Stack direction="row" justifyContent="space-around" textAlign="center">
          <Stat label="Rating" value={stats.rating} icon="mdi:trophy-outline" />
          <Stat label="Streak" value={stats.streak} icon="mdi:fire" />
          <Stat label="Best" value={stats.bestStreak} icon="mdi:star-outline" />
          <Stat
            label="Solved"
            value={`${stats.solved}/${stats.solved + stats.failed}`}
            icon="mdi:check-circle-outline"
          />
        </Stack>
      </Panel>
    </Stack>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        gap={0.5}
      >
        <Icon icon={icon} height={18} />
        <Typography
          fontWeight={700}
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
