import { useBoardAppearance } from "@/components/board/appearance";
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
import BoardWorkspace, { SquareBoardStage } from "@/components/boardWorkspace";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import ArrowLayer from "@/components/board/arrowLayer";
import { BoardArrow } from "@/lib/arrows/types";
import { FILES, RANKS } from "@/lib/vision";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import Chessboard from "@/components/board/motionChessboard";
import { PIECE_SLIDE_MS } from "@/lib/pieceMotion";
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

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

const MODES: { id: VisionMode; label: string; icon: string; text: string }[] = [
  {
    id: "find",
    label: "Find",
    icon: "mdi:cursor-default-click-outline",
    text: "A square name appears on the board. Click that square as fast as you can.",
  },
  {
    id: "name",
    label: "Name",
    icon: "mdi:keyboard-outline",
    text: "A square highlights on the board. Name it with its file and rank.",
  },
  {
    id: "colour",
    label: "Color",
    icon: "mdi:checkerboard",
    text: "Visualize the board in your head. Is the target square light or dark?",
  },
  {
    id: "knight",
    label: "Knight",
    icon: "mdi:chess-knight",
    text: "Click or drag the knight to the ringed square in the fewest possible hops.",
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
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);

  const { styles, arrows, position } = useMemo(
    () => buildBoard(trainer),
    [trainer]
  );

  const labelsAllowed = trainer.mode === "find" || trainer.mode === "knight";
  const nameKeys = useMemo(
    () => [...FILES, ...FILES.map((f) => f.toUpperCase()), ...RANKS],
    []
  );

  useKeyboardShortcut(
    nameKeys,
    (event) => trainer.typeKey(event.key),
    trainer.mode === "name" && trainer.phase === "running"
  );
  useKeyboardShortcut(
    ["l", "L", "d", "D"],
    (event) => trainer.answerColour(event.key.toLowerCase() === "l"),
    trainer.mode === "colour" && trainer.phase === "running"
  );
  useKeyboardShortcut(
    "Backspace",
    trainer.undoKnight,
    trainer.mode === "knight" && trainer.phase === "running"
  );
  useKeyboardShortcut(
    ["Enter", " "],
    (event) => {
      event.preventDefault();
      trainer.start();
    },
    trainer.phase !== "running" ||
      (trainer.mode === "knight" && !!trainer.knightResult)
  );

  const isBlindfoldColor =
    trainer.mode === "colour" && trainer.phase === "running";
  const showFindOverlay =
    trainer.mode === "find" && trainer.phase === "running" && !!trainer.target;
  const latestFlash = trainer.flashes[0];

  return (
    <BoardWorkspace
      inspectorMinWidth={SIDE_PANEL_WIDTH}
      inspectorLabel="Vision trainer controls"
      board={
        <SquareBoardStage>
          {(boardSize) => (
            <Box
              sx={{ position: "relative", width: boardSize, height: boardSize }}
            >
              <Chessboard
                id="VisionBoard"
                boardWidth={boardSize}
                position={position}
                boardOrientation={trainer.orientation}
                arePiecesDraggable={
                  trainer.mode === "knight" &&
                  trainer.phase === "running" &&
                  !trainer.knightResult
                }
                areArrowsAllowed={false}
                animationDuration={PIECE_SLIDE_MS}
                onSquareClick={(square) => trainer.clickSquare(square)}
                onPieceDrop={(source, targetSquare) =>
                  trainer.dropKnight(source, targetSquare)
                }
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

              {showFindOverlay && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                >
                  <Box
                    sx={{
                      px: 3,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: "rgba(15, 17, 22, 0.72)",
                      backdropFilter: "blur(4px)",
                      boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.16)",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: `${Math.max(40, Math.round(boardSize * 0.14))}px`,
                        lineHeight: 1.05,
                        fontWeight: 800,
                        color: "#fff",
                        letterSpacing: "0.04em",
                        userSelect: "none",
                      }}
                    >
                      {trainer.target}
                    </Typography>
                  </Box>
                </Box>
              )}

              {isBlindfoldColor && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1.5,
                    bgcolor: "rgba(16, 18, 24, 0.94)",
                    backdropFilter: "blur(8px)",
                    borderRadius: 1,
                    zIndex: 10,
                    p: 3,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "rgba(255,255,255,0.65)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontWeight: 600,
                    }}
                  >
                    Blindfold square color
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: `${Math.max(56, Math.round(boardSize * 0.2))}px`,
                      lineHeight: 1,
                      fontWeight: 800,
                      color: "#fff",
                      letterSpacing: "0.04em",
                      userSelect: "none",
                    }}
                  >
                    {trainer.target}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      minHeight: 22,
                      color: latestFlash
                        ? latestFlash.correct
                          ? "success.light"
                          : "error.light"
                        : "rgba(255,255,255,0.6)",
                      fontWeight: latestFlash ? 600 : 400,
                    }}
                  >
                    {latestFlash
                      ? latestFlash.correct
                        ? `${latestFlash.square} — Correct`
                        : `${latestFlash.square} — Missed`
                      : "Press L for Light or D for Dark"}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </SquareBoardStage>
      }
      inspector={
        <InspectorShell>
          {/* Zone 1 — Slim Context Header */}
          <InspectorHeader
            left={
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                Board vision
              </Typography>
            }
            right={
              trainer.mode === "knight" ? (
                <InspectorPill
                  icon="mdi:chess-knight"
                  label={`${trainer.knightSolved} solved`}
                  tooltip={`${trainer.knightPerfect} perfect routes`}
                />
              ) : (
                <InspectorPill
                  icon="mdi:trophy-outline"
                  label={`Best ${trainer.bestScore}`}
                  tooltip={`${trainer.sessions} timed rounds played`}
                />
              )
            }
          />

          {/* Mode Selector Strip */}
          <Box
            sx={{
              px: 1.25,
              py: 0.75,
              flexShrink: 0,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
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
                <ToggleButton
                  key={id}
                  value={id}
                  sx={{
                    gap: 0.45,
                    px: 0.75,
                    py: 0.45,
                    fontSize: "0.76rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon icon={icon} height={15} />
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Zone 2 — Flexing Stage */}
          <InspectorBody sx={{ p: 1.5 }}>
            {trainer.mode === "knight" ? (
              <KnightPanel trainer={trainer} />
            ) : (
              <TimedPanel trainer={trainer} />
            )}
          </InspectorBody>

          {/* Zone 3 — Docked Bottom Control Deck */}
          <InspectorDeck>
            <InspectorDeckRow>
              <Stack
                direction="row"
                alignItems="center"
                gap={0.45}
                flexWrap="nowrap"
                sx={{ flexShrink: 0 }}
              >
                {trainer.phase !== "running" ? (
                  <DeckButton active icon="mdi:play" onClick={trainer.start}>
                    {trainer.phase === "done"
                      ? "Play again"
                      : trainer.mode === "knight"
                        ? "Start"
                        : "Start round"}
                  </DeckButton>
                ) : trainer.mode === "knight" ? (
                  <>
                    {trainer.knightResult ? (
                      <>
                        <DeckButton
                          active
                          icon="mdi:skip-next"
                          onClick={trainer.start}
                        >
                          Next route
                        </DeckButton>
                        {(trainer.knightResult.used !==
                          trainer.knightResult.best ||
                          trainer.knightResult.usedHint) && (
                          <DeckButton
                            icon="mdi:refresh"
                            onClick={trainer.retryKnightRoute}
                          >
                            Retry
                          </DeckButton>
                        )}
                      </>
                    ) : (
                      <>
                        <DeckButton
                          icon="mdi:undo-variant"
                          disabled={trainer.path.length < 2}
                          onClick={trainer.undoKnight}
                        >
                          Undo hop
                        </DeckButton>
                        <DeckButton
                          active={trainer.showSolution}
                          icon="mdi:eye-outline"
                          onClick={() =>
                            trainer.setShowSolution(!trainer.showSolution)
                          }
                        >
                          {trainer.showSolution ? "Hide route" : "Route"}
                        </DeckButton>
                      </>
                    )}
                  </>
                ) : (
                  <DeckButton icon="mdi:refresh" onClick={trainer.start}>
                    Restart
                  </DeckButton>
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
                sx={{ ml: "auto", flexShrink: 0 }}
              >
                {trainer.phase === "running" && trainer.mode !== "knight" && (
                  <DeckButton
                    subtle
                    danger
                    icon="mdi:stop"
                    onClick={trainer.stop}
                  >
                    Stop
                  </DeckButton>
                )}
                {trainer.phase === "running" &&
                  trainer.mode === "knight" &&
                  !trainer.knightResult && (
                    <DeckButton
                      subtle
                      icon="mdi:skip-next"
                      onClick={trainer.start}
                    >
                      Skip
                    </DeckButton>
                  )}
              </Stack>
            </InspectorDeckRow>
          </InspectorDeck>

          <InspectorPopover
            title="Vision options"
            open={!!optionsAnchor}
            anchorEl={optionsAnchor}
            onClose={() => setOptionsAnchor(null)}
            width={316}
          >
            <Stack spacing={1.5}>
              <Box>
                <PopoverSectionLabel>Board perspective</PopoverSectionLabel>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={trainer.orientationChoice}
                  onChange={(_, value: OrientationChoice | null) =>
                    value && trainer.setOrientationChoice(value)
                  }
                  sx={{
                    mt: 0.6,
                    "& .MuiToggleButton-root": { py: 0.4, fontSize: "0.75rem" },
                  }}
                >
                  <ToggleButton value="white">White</ToggleButton>
                  <ToggleButton value="random">Random</ToggleButton>
                  <ToggleButton value="black">Black</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {trainer.mode === "knight" && (
                <Box>
                  <PopoverSectionLabel>Route length</PopoverSectionLabel>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={trainer.difficulty}
                    onChange={(_, value: Difficulty | null) =>
                      value && trainer.setDifficulty(value)
                    }
                    sx={{
                      mt: 0.6,
                      "& .MuiToggleButton-root": {
                        py: 0.4,
                        fontSize: "0.74rem",
                      },
                    }}
                  >
                    {(Object.keys(DIFFICULTY_RANGE) as Difficulty[]).map(
                      (level) => (
                        <ToggleButton key={level} value={level}>
                          {DIFFICULTY_LABELS[level]} (
                          {DIFFICULTY_RANGE[level].join("–")})
                        </ToggleButton>
                      )
                    )}
                  </ToggleButtonGroup>
                </Box>
              )}

              {labelsAllowed && (
                <PopoverSwitchRow
                  label="Show square labels"
                  checked={trainer.showLabels}
                  onChange={trainer.setShowLabels}
                />
              )}

              <Divider />

              <Typography variant="caption" color="text.secondary">
                {MODES.find(({ id }) => id === trainer.mode)?.text}
              </Typography>
            </Stack>
          </InspectorPopover>
        </InspectorShell>
      }
    />
  );
}

function TimedPanel({ trainer }: { trainer: VisionTrainer }) {
  const { phase, mode, score, misses, msLeft } = trainer;
  const answered = score + misses;
  const accuracy = answered ? Math.round((score / answered) * 100) : 0;
  const isNewBest = phase === "done" && score > trainer.previousBest;

  if (phase === "idle") {
    return (
      <Stack spacing={1.25} alignItems="flex-start">
        <Typography fontWeight={600}>30-second sprint</Typography>
        <Typography variant="body2" color="text.secondary">
          Answer as many squares as you can before time runs out. Both speed and
          accuracy are tracked. Press Enter or Space, or click Start round
          below.
        </Typography>
      </Stack>
    );
  }

  if (phase === "done") {
    return (
      <Stack spacing={1.25} alignItems="flex-start">
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {score}
          </Typography>
          <Typography>correct</Typography>
          {isNewBest && <Chip size="small" color="success" label="New best" />}
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {accuracy}% accuracy · {misses} miss{misses === 1 ? "" : "es"} · Best{" "}
          {Math.max(trainer.bestScore, score)}
        </Typography>
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
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {(msLeft / 1000).toFixed(1)}s left
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography
            variant="body2"
            color="success.main"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            Hits <b>{score}</b>
          </Typography>
          <Typography
            variant="body2"
            color={misses > 0 ? "error.main" : "text.secondary"}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            Misses <b>{misses}</b>
          </Typography>
        </Stack>
      </Stack>

      {mode === "name" ? (
        <Stack spacing={1} alignItems="center">
          <Typography variant="subtitle1" fontWeight={700}>
            Which square is highlighted?
          </Typography>
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.08em",
              minHeight: 42,
              color: trainer.typed ? "primary.main" : "text.disabled",
            }}
          >
            {trainer.typed ? `${trainer.typed}–` : "—"}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ minHeight: 18 }}
          >
            {trainer.typed
              ? `File "${trainer.typed}" selected — now pick or type the rank (1–8)`
              : "Pick or type the file (a–h), then the rank (1–8)"}
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
      ) : (
        <Typography
          sx={{
            fontSize: "3.5rem",
            lineHeight: 1,
            fontWeight: 800,
            textAlign: "center",
            py: 0.75,
            letterSpacing: "0.03em",
          }}
        >
          {trainer.target}
        </Typography>
      )}

      {mode === "colour" && (
        <Stack direction="row" gap={1.5} justifyContent="center">
          <Button
            variant="contained"
            sx={{
              minWidth: 120,
              backgroundColor: "#f0d9b5",
              color: "#1a1a1a",
              fontWeight: 700,
              "&:hover": { backgroundColor: "#e6c999" },
            }}
            onClick={() => trainer.answerColour(true)}
          >
            Light (L)
          </Button>
          <Button
            variant="contained"
            sx={{
              minWidth: 120,
              backgroundColor: "#7c583c",
              color: "#fff",
              fontWeight: 700,
              "&:hover": { backgroundColor: "#65462f" },
            }}
            onClick={() => trainer.answerColour(false)}
          >
            Dark (D)
          </Button>
        </Stack>
      )}

      {mode === "find" && (
        <Typography variant="body2" textAlign="center" color="text.secondary">
          Click the target square shown on the board.
        </Typography>
      )}
    </Stack>
  );
}

function KnightPanel({ trainer }: { trainer: VisionTrainer }) {
  const { phase, route, path, knightResult } = trainer;

  if (phase === "idle") {
    return (
      <Stack spacing={1.25} alignItems="flex-start">
        <Typography fontWeight={600}>Knight routes</Typography>
        <Typography variant="body2" color="text.secondary">
          Click a reachable square or drag the knight to hop there. Click the
          knight again (or press Backspace) to undo a hop.
        </Typography>
      </Stack>
    );
  }

  const used = path.length - 1;
  const isPerfect =
    knightResult &&
    knightResult.used === knightResult.best &&
    !knightResult.usedHint;
  const isOptimalWithHint =
    knightResult &&
    knightResult.used === knightResult.best &&
    knightResult.usedHint;

  return (
    <Stack spacing={1.25}>
      <Typography fontWeight={700} variant="subtitle1">
        {route.from} → {route.to}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        Shortest route: <b>{route.moves}</b> hop{route.moves === 1 ? "" : "s"} ·
        Used: <b>{used}</b>
      </Typography>

      <Box sx={{ minHeight: 44 }}>
        {knightResult && (
          <Typography
            variant="body2"
            fontWeight={500}
            color={
              isPerfect
                ? "success.main"
                : isOptimalWithHint
                  ? "info.main"
                  : "warning.main"
            }
          >
            {isPerfect
              ? "Perfect! Shortest possible route."
              : isOptimalWithHint
                ? `Arrived in ${knightResult.used} hops (optimal length, route shown).`
                : `Arrived in ${knightResult.used} hops. Shortest is ${knightResult.best} — retry or show route.`}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
