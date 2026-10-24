import { useBoardAppearance } from "@/components/board/appearance";
import Panel from "@/components/panel";
import { useBoardLayout } from "@/hooks/useBoardLayout";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import ArrowLayer from "@/components/board/arrowLayer";
import { BoardArrow } from "@/lib/arrows/types";
import { FILES, RANKS } from "@/lib/vision";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  FormControlLabel,
} from "@mui/material";
import { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import {
  CustomSquareStyles,
  Square,
} from "react-chessboard/dist/chessboard/types";
import {
  DIFFICULTY_RANGE,
  Difficulty,
  OrientationChoice,
  ROUND_MS,
  VisionMode,
  VisionTrainer,
  useVisionTrainer,
} from "./useVisionTrainer";

const SIDE_PANEL_WIDTH = 420;
const CORRECT = "rgba(34, 172, 56, 0.75)";
const WRONG = "rgba(223, 83, 83, 0.8)";
const TARGET = "rgba(255, 170, 0, 0.55)";
const VISITED = "rgba(59, 154, 198, 0.4)";

const MODES: { id: VisionMode; label: string; icon: string; text: string }[] = [
  {
    id: "find",
    label: "Find",
    icon: "mdi:cursor-default-click-outline",
    text: "A square name appears. Click it on the board.",
  },
  {
    id: "name",
    label: "Name",
    icon: "mdi:keyboard-outline",
    text: "A square lights up. Name it with its file and rank.",
  },
  {
    id: "colour",
    label: "Colour",
    icon: "mdi:checkerboard",
    text: "A square name appears. Is it light or dark?",
  },
  {
    id: "knight",
    label: "Knight",
    icon: "mdi:chess-knight",
    text: "Hop the knight to the ringed square in as few moves as you can.",
  },
];

const squareStyle = (color: string): Record<string, string> => ({
  background: color,
});

const ringStyle = (color: string): Record<string, string> => ({
  background: `radial-gradient(circle, transparent 52%, ${color} 54%, ${color} 68%, transparent 70%)`,
});

const buildBoard = (trainer: VisionTrainer) => {
  const styles: CustomSquareStyles = {};
  const arrows: BoardArrow[] = [];
  let position: string | Record<string, string> = "8/8/8/8/8/8/8/8";

  if (
    trainer.mode === "name" &&
    trainer.target &&
    trainer.phase === "running"
  ) {
    styles[trainer.target as Square] = squareStyle(TARGET);
  }

  if (trainer.mode === "knight" && trainer.phase === "running") {
    const current = trainer.path.at(-1) ?? trainer.route.from;
    position = { [current]: "wN" };

    trainer.path.slice(0, -1).forEach((square) => {
      styles[square as Square] = squareStyle(VISITED);
    });
    styles[trainer.route.to as Square] = ringStyle(CORRECT);

    for (let i = 1; i < trainer.path.length; i++) {
      arrows.push({
        from: trainer.path[i - 1] as Square,
        to: trainer.path[i] as Square,
        kind: "content",
        color: "rgba(59, 154, 198, 0.85)",
      });
    }

    if (trainer.showSolution) {
      for (let i = 1; i < trainer.solution.length; i++) {
        arrows.push({
          from: trainer.solution[i - 1] as Square,
          to: trainer.solution[i] as Square,
          kind: "content",
          color: "rgba(255, 170, 0, 0.8)",
        });
      }
    }
  }

  for (const { square, correct } of trainer.flashes) {
    styles[square as Square] = squareStyle(correct ? CORRECT : WRONG);
  }

  return { styles, arrows, position };
};

export default function VisionPage() {
  const trainer = useVisionTrainer();
  const appearance = useBoardAppearance();
  const { boardSize, sideBySide } = useBoardLayout({
    sidePanelWidth: SIDE_PANEL_WIDTH,
    extraWidth: 40,
  });

  const { styles, arrows, position } = useMemo(
    () => buildBoard(trainer),
    [trainer]
  );

  const labelsAllowed = trainer.mode === "find" || trainer.mode === "knight";
  const nameKeys = [...FILES, ...RANKS];

  useKeyboardShortcut(
    nameKeys,
    (event) => trainer.typeKey(event.key),
    trainer.mode === "name" && trainer.phase === "running"
  );
  useKeyboardShortcut(
    ["l", "d"],
    (event) => trainer.answerColour(event.key === "l"),
    trainer.mode === "colour" && trainer.phase === "running"
  );
  useKeyboardShortcut(
    "Backspace",
    trainer.undoKnight,
    trainer.mode === "knight" && trainer.phase === "running"
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: sideBySide ? "row" : "column" },
        justifyContent: "center",
        alignItems: { xs: "center", sm: sideBySide ? "flex-start" : "center" },
        gap: 4,
      }}
    >
      <Box sx={{ width: boardSize, maxWidth: "100%", position: "relative" }}>
        <Chessboard
          id="VisionBoard"
          boardWidth={boardSize}
          position={position}
          boardOrientation={trainer.orientation}
          arePiecesDraggable={false}
          areArrowsAllowed={false}
          animationDuration={150}
          onSquareClick={(square) => trainer.clickSquare(square)}
          customSquareStyles={styles}
          customBoardStyle={appearance.customBoardStyle}
          customDarkSquareStyle={appearance.customDarkSquareStyle}
          customLightSquareStyle={appearance.customLightSquareStyle}
          customPieces={appearance.customPieces}
          showBoardNotation={labelsAllowed && trainer.showLabels}
        />
        <ArrowLayer
          arrows={arrows}
          orientation={trainer.orientation}
          turn="w"
          size={boardSize}
        />
      </Box>

      <Stack
        spacing={2}
        sx={{
          width: { xs: "100%", sm: sideBySide ? SIDE_PANEL_WIDTH : "100%" },
        }}
      >
        <Panel>
          <Stack spacing={1.5}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={trainer.mode}
              onChange={(_, value: VisionMode | null) =>
                value && trainer.setMode(value)
              }
            >
              {MODES.map(({ id, label, icon }) => (
                <ToggleButton key={id} value={id} sx={{ gap: 0.75, py: 0.75 }}>
                  <Icon icon={icon} height={16} />
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {MODES.find(({ id }) => id === trainer.mode)?.text}
            </Typography>

            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <ToggleButtonGroup
                exclusive
                size="small"
                value={trainer.orientationChoice}
                onChange={(_, value: OrientationChoice | null) =>
                  value && trainer.setOrientationChoice(value)
                }
              >
                <ToggleButton value="white">White side</ToggleButton>
                <ToggleButton value="black">Black side</ToggleButton>
                <ToggleButton value="random">Random</ToggleButton>
              </ToggleButtonGroup>

              {labelsAllowed && (
                <FormControlLabel
                  sx={{ ml: 0.5 }}
                  control={
                    <Switch
                      size="small"
                      checked={trainer.showLabels}
                      onChange={(event) =>
                        trainer.setShowLabels(event.target.checked)
                      }
                    />
                  }
                  label="Show labels"
                />
              )}
            </Stack>

            {trainer.mode === "knight" && (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={trainer.difficulty}
                onChange={(_, value: Difficulty | null) =>
                  value && trainer.setDifficulty(value)
                }
              >
                {(Object.keys(DIFFICULTY_RANGE) as Difficulty[]).map(
                  (level) => (
                    <ToggleButton key={level} value={level}>
                      {level} ({DIFFICULTY_RANGE[level].join("–")})
                    </ToggleButton>
                  )
                )}
              </ToggleButtonGroup>
            )}
          </Stack>
        </Panel>

        <Panel>
          {trainer.mode === "knight" ? (
            <KnightPanel trainer={trainer} />
          ) : (
            <TimedPanel trainer={trainer} />
          )}
        </Panel>

        <Panel>
          <Stack
            direction="row"
            justifyContent="space-around"
            textAlign="center"
          >
            <Box>
              <Typography fontWeight={700}>{trainer.bestScore}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Best round
              </Typography>
            </Box>
            <Box>
              <Typography fontWeight={700}>{trainer.sessions}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Rounds played
              </Typography>
            </Box>
          </Stack>
        </Panel>
      </Stack>
    </Box>
  );
}

function TimedPanel({ trainer }: { trainer: VisionTrainer }) {
  const { phase, mode, score, misses, msLeft } = trainer;
  const answered = score + misses;
  const accuracy = answered ? Math.round((score / answered) * 100) : 0;
  const isNewBest = phase === "done" && score > trainer.previousBest;

  if (phase === "idle") {
    return (
      <Stack spacing={1.5} alignItems="flex-start">
        <Typography fontWeight={600}>30 seconds on the clock</Typography>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          Answer as many as you can. Misses cost time, not points, so keep
          moving.
        </Typography>
        <Button
          variant="contained"
          startIcon={<Icon icon="mdi:play" height={20} />}
          onClick={trainer.start}
        >
          Start round
        </Button>
      </Stack>
    );
  }

  if (phase === "done") {
    return (
      <Stack spacing={1.25} alignItems="flex-start">
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="h4" fontWeight={700}>
            {score}
          </Typography>
          <Typography>correct</Typography>
          {isNewBest && <Chip size="small" color="success" label="New best" />}
        </Stack>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {accuracy}% accuracy, {misses} miss{misses === 1 ? "" : "es"}. Your
          best round is {Math.max(trainer.bestScore, score)}.
        </Typography>
        <Button
          variant="contained"
          startIcon={<Icon icon="mdi:refresh" height={20} />}
          onClick={trainer.start}
        >
          Play again
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      <LinearProgress
        variant="determinate"
        value={(msLeft / ROUND_MS) * 100}
        sx={{ height: 8, borderRadius: 4 }}
      />

      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2">
          {(msLeft / 1000).toFixed(1)}s left
        </Typography>
        <Typography variant="body2">
          Score <b>{score}</b>
        </Typography>
      </Stack>

      <Typography
        sx={{
          fontSize: "4rem",
          lineHeight: 1,
          fontWeight: 700,
          textAlign: "center",
          py: 1,
          letterSpacing: "0.02em",
        }}
      >
        {trainer.target}
      </Typography>

      {mode === "name" && (
        <Stack spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            {trainer.typed
              ? `${trainer.typed}… now the rank`
              : "Pick the file, then the rank (or type it)"}
          </Typography>
          <Stack
            direction="row"
            gap={0.5}
            flexWrap="wrap"
            justifyContent="center"
          >
            {FILES.map((file) => (
              <Button
                key={file}
                size="small"
                variant={trainer.typed === file ? "contained" : "outlined"}
                sx={{ minWidth: 36 }}
                onClick={() => trainer.typeKey(file)}
              >
                {file}
              </Button>
            ))}
          </Stack>
          <Stack
            direction="row"
            gap={0.5}
            flexWrap="wrap"
            justifyContent="center"
          >
            {RANKS.map((rank) => (
              <Button
                key={rank}
                size="small"
                variant="outlined"
                disabled={!trainer.typed}
                sx={{ minWidth: 36 }}
                onClick={() => trainer.typeKey(rank)}
              >
                {rank}
              </Button>
            ))}
          </Stack>
        </Stack>
      )}

      {mode === "colour" && (
        <Stack direction="row" gap={1.5} justifyContent="center">
          <Button
            variant="contained"
            sx={{
              minWidth: 120,
              backgroundColor: "#f0d9b5",
              color: "#222",
              "&:hover": { backgroundColor: "#e8cd9f" },
            }}
            onClick={() => trainer.answerColour(true)}
          >
            Light (L)
          </Button>
          <Button
            variant="contained"
            sx={{
              minWidth: 120,
              backgroundColor: "#946f51",
              "&:hover": { backgroundColor: "#7f5e44" },
            }}
            onClick={() => trainer.answerColour(false)}
          >
            Dark (D)
          </Button>
        </Stack>
      )}

      {mode === "find" && (
        <Typography variant="body2" textAlign="center" sx={{ opacity: 0.8 }}>
          Click that square on the board.
        </Typography>
      )}
    </Stack>
  );
}

function KnightPanel({ trainer }: { trainer: VisionTrainer }) {
  const { phase, route, path, knightResult } = trainer;

  if (phase === "idle") {
    return (
      <Stack spacing={1.5} alignItems="flex-start">
        <Typography fontWeight={600}>Knight routes</Typography>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          Click a square a knight can reach to hop there. Click your last square
          again to take a hop back. The shortest route has a fixed length, so
          try to match it.
        </Typography>
        <Button
          variant="contained"
          startIcon={<Icon icon="mdi:play" height={20} />}
          onClick={trainer.start}
        >
          Start
        </Button>
      </Stack>
    );
  }

  const used = path.length - 1;

  return (
    <Stack spacing={1.25}>
      <Typography fontWeight={600}>
        {route.from} → {route.to}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.85 }}>
        The shortest route takes <b>{route.moves}</b> hops. You have used{" "}
        <b>{used}</b>.
      </Typography>

      {knightResult && (
        <Typography
          variant="body2"
          color={
            knightResult.used === knightResult.best
              ? "success.main"
              : "warning.main"
          }
        >
          {knightResult.used === knightResult.best
            ? "Perfect, that is as short as it gets."
            : `Arrived in ${knightResult.used}. The shortest was ${knightResult.best}. Show the route to see it.`}
        </Typography>
      )}

      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button
          size="small"
          variant="outlined"
          disabled={path.length < 2 || !!knightResult}
          startIcon={<Icon icon="mdi:undo-variant" height={18} />}
          onClick={trainer.undoKnight}
        >
          Undo hop
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Icon icon="mdi:eye-outline" height={18} />}
          onClick={() => trainer.setShowSolution(!trainer.showSolution)}
        >
          {trainer.showSolution ? "Hide route" : "Show route"}
        </Button>
        <Button
          size="small"
          variant={knightResult ? "contained" : "text"}
          startIcon={<Icon icon="mdi:skip-next" height={18} />}
          onClick={trainer.start}
        >
          {knightResult ? "Next route" : "Skip"}
        </Button>
      </Stack>
    </Stack>
  );
}
