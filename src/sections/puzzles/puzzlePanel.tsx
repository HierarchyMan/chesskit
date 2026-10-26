import { moveStoryAtom } from "@/lib/moveStoryState";
import Panel from "@/components/panel";
import { setHandoff } from "@/lib/handoff";
import { PUZZLE_THEMES } from "@/lib/puzzles";
import { displayThemes } from "@/lib/puzzleThemes";
import { buildMoveStory } from "@/lib/visualize/moveStory";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { useSetAtom } from "jotai";
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
}

export default function PuzzlePanel({ trainer }: Props) {
  const router = useRouter();
  const setStory = useSetAtom(moveStoryAtom);
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

  const openWithFen = (path: string) => {
    if (!puzzle) return;
    setHandoff({ kind: "fen", fen: puzzle.fen }, path);
    router.push(path);
  };

  const visualizeMistake = () => {
    const entry = trainer.mistakeEntry;
    if (!entry) return;

    setStory({
      open: true,
      classification: entry.classification,
      story: buildMoveStory({
        fenBefore: entry.fenBefore,
        playedUci: entry.playedUci,
        beforeLines: entry.beforeLines,
        afterLines: entry.afterLines,
      }),
    });
  };

  // Order matters on a tall screen, where this panel sits under the board:
  // the one-line title and the buttons come first, and everything that grows
  // while solving (messages, hints, the line, lessons) comes after them, so
  // the buttons stay in one place for the whole puzzle.
  return (
    <Stack spacing={2}>
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
              <Typography>Finding a puzzle…</Typography>
              <LinearProgress />
            </Stack>
          )}

          {phase === "empty" && (
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography fontWeight={600}>
                No mistakes to practise yet
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Play a game as You against a bot or import one, then run an
                analysis. The moves that cost you the most turn into puzzles
                here.
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
              <Stack direction="row" alignItems="center" gap={1.25}>
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
                <Typography variant="h6" fontWeight={600}>
                  {solved
                    ? helped
                      ? isMistake
                        ? "That's the move"
                        : "Solved, with help"
                      : "Solved!"
                    : `${sideName} to move`}
                </Typography>
                {multiStep && !solved && (
                  <Stack
                    direction="row"
                    gap={0.5}
                    sx={{ ml: "auto" }}
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
                    ))}
                  </Stack>
                )}
              </Stack>

              <Stack
                data-board-shortcuts
                direction="row"
                gap={1}
                flexWrap="wrap"
                alignItems="center"
              >
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

                {!solved && (
                  <>
                    <Tooltip
                      title={
                        trainer.nextHintReveals
                          ? "Shows the move. This puzzle then counts as missed."
                          : ""
                      }
                    >
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={
                            phase !== "solving" ||
                            trainer.hintsTotal === 0 ||
                            trainer.hintLevel >= trainer.hintsTotal
                          }
                          startIcon={
                            <Icon icon="mdi:lightbulb-on-outline" height={18} />
                          }
                          onClick={trainer.askHint}
                        >
                          {trainer.nextHintReveals
                            ? "Show move"
                            : trainer.hintLevel < trainer.hintsTotal
                              ? `Hint ${trainer.hintLevel + 1}/${trainer.hintsTotal}`
                              : "Hint"}
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Plays the answer on the board. This puzzle then counts as missed.">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={phase !== "solving"}
                          startIcon={
                            <Icon icon="mdi:eye-outline" height={18} />
                          }
                          onClick={trainer.revealSolution}
                        >
                          Solution
                        </Button>
                      </span>
                    </Tooltip>
                  </>
                )}

                {source !== "mistakes" || trainer.mistakeCount < 2 ? (
                  <Button
                    size="small"
                    variant={solved ? "contained" : "text"}
                    startIcon={<Icon icon="mdi:skip-next" height={18} />}
                    onClick={trainer.next}
                  >
                    {solved ? "Next puzzle" : "Skip"}
                  </Button>
                ) : (
                  solved && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Icon icon="mdi:skip-next" height={18} />}
                      onClick={trainer.next}
                    >
                      Next mistake
                    </Button>
                  )
                )}

                {solved && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<Icon icon="mdi:refresh" height={18} />}
                    onClick={trainer.retry}
                  >
                    Retry
                  </Button>
                )}

                {trainer.mistakeEntry && solved && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Icon icon="mdi:eye-outline" height={18} />}
                    onClick={visualizeMistake}
                  >
                    Why was mine bad?
                  </Button>
                )}
              </Stack>

              {solved && trainer.line.length > 0 && (
                <Stack
                  data-board-shortcuts
                  direction="row"
                  justifyContent="center"
                  gap={0.5}
                >
                  <Tooltip title="Start">
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
                  <Tooltip title="End">
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

              {/* One live region, so each change in the story is announced. */}
              <Stack spacing={1} role="status" aria-live="polite">
                {phase === "setup" && (
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Watch what your opponent just played…
                  </Typography>
                )}

                {phase === "solving" && (
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    {trainer.replySan && (
                      <>
                        Your opponent played <b>{trainer.replySan}</b>.{" "}
                      </>
                    )}
                    {trainer.replySan
                      ? trainer.failed
                        ? "Find the next move."
                        : "Correct so far. Find the next move."
                      : isMistake
                        ? "Drag a piece or click it, then its square. Hint and Solution are there if you need them."
                        : trainer.failed
                          ? "Keep going and finish the line. This one no longer counts for your rating."
                          : "Find the best move. Drag a piece or click it, then its square."}
                  </Typography>
                )}

                {phase === "replying" && (
                  <Typography variant="body2" color="success.main">
                    <b>{trainer.playedSan}</b> is right.{" "}
                    {trainer.waiting
                      ? "Press Next move to see your opponent's reply."
                      : "Your opponent answers…"}
                  </Typography>
                )}

                {phase === "wrong" && (
                  <Typography variant="body2" color="error.main">
                    <b>{trainer.playedSan}</b>{" "}
                    {trainer.revealed
                      ? "is not the solution move."
                      : "is not the move. Take another look."}
                  </Typography>
                )}

                {phase === "showing" && (
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    {trainer.waiting
                      ? "Play the arrowed move yourself, or press Next move."
                      : "Here is the solution, one move at a time…"}
                  </Typography>
                )}

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
              </Stack>

              {puzzle.description && !solved && (
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {puzzle.description}
                </Typography>
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
                          sx={{ opacity: 0.6, ml: 0.5 }}
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

              {solved && (
                <Stack spacing={1}>
                  <Typography variant="body2">
                    {helped
                      ? isMistake
                        ? "Press Why was mine bad? to see what your move allowed."
                        : "You found it in the end. Step through the line once more and it will stick."
                      : "Clean solve."}
                    {trainer.ratingDelta !== null && (
                      <>
                        {" "}
                        Rating{" "}
                        <b>
                          {trainer.ratingDelta >= 0 ? "+" : ""}
                          {trainer.ratingDelta}
                        </b>{" "}
                        → {stats.rating}.
                      </>
                    )}
                  </Typography>
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

              <Stack
                direction="row"
                gap={0.75}
                flexWrap="wrap"
                alignItems="center"
              >
                {puzzle.rating !== undefined && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      ratingVisible
                        ? `Puzzle rating ${puzzle.rating}`
                        : "Rating hidden until you finish"
                    }
                  />
                )}
                {themes.slice(0, 5).map((theme) => (
                  <Chip key={theme.id} size="small" label={theme.label} />
                ))}
              </Stack>

              {solved && (
                <Stack direction="row" gap={1} flexWrap="wrap">
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
            onChange={(_, value: PuzzleSource | null) =>
              value && trainer.setSource(value)
            }
          >
            {SOURCES.map(({ id, label, icon }) => (
              <ToggleButton key={id} value={id} sx={{ gap: 0.75, py: 0.75 }}>
                <Icon icon={icon} height={16} />
                <Box
                  component="span"
                  sx={{ display: { xs: "none", sm: "inline" } }}
                >
                  {label}
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {usesThemes && (
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
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
              <Typography variant="body2">
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

      <Panel>
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
        <Typography fontWeight={700}>{value}</Typography>
      </Stack>
      <Typography variant="caption" sx={{ opacity: 0.65 }}>
        {label}
      </Typography>
    </Box>
  );
}
