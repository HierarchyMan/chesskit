import MiniBoard from "@/components/board/miniBoard";
import { classificationName } from "@/lib/classificationLabels";
import PrettyMoveSan from "@/components/prettyMoveSan";
import { CLASSIFICATION_COLORS } from "@/constants";
import {
  CASCADE_END_TEXT,
  CascadeEndReason,
  MAX_CASCADE_PLIES,
  MoveStory,
  StoryLine,
} from "@/lib/visualize/moveStory";
import { Color } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAtom } from "jotai";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { arrowFromUci } from "@/lib/arrows/uci";
import { BoardArrow } from "@/lib/arrows/types";

import { moveStoryAtom, MoveStoryDialogState } from "@/lib/moveStoryState";
export { moveStoryAtom } from "@/lib/moveStoryState";

type LineKey = "played" | "better";

const STEP_MS = 1500;

export default function MoveStoryDialog() {
  const [state, setState] = useAtom(moveStoryAtom);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const { story } = state;

  const close = () => {
    setState((prev) => ({ ...prev, open: false }));
    const trigger = state.trigger;
    if (trigger)
      requestAnimationFrame(() => {
        if (trigger.isConnected) trigger.focus();
      });
  };

  return (
    <Dialog
      open={state.open}
      disableRestoreFocus={!!state.trigger}
      onClose={close}
      fullWidth
      maxWidth="md"
      scroll="paper"
      fullScreen={isSmall}
    >
      <Header state={state} onClose={close} />
      <DialogContent dividers>
        {state.loading && (
          <Stack spacing={1.5} py={4} alignItems="center">
            <LinearProgress sx={{ width: "60%", borderRadius: 1 }} />
            <Typography color="text.secondary">
              Asking the engine what happens next…
            </Typography>
          </Stack>
        )}

        {state.error && !state.loading && (
          <Alert severity="error">{state.error}</Alert>
        )}

        {state.open && story && !state.loading && (
          <StoryBody
            key={JSON.stringify(story)}
            story={story}
            compact={isSmall}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function Header({
  state,
  onClose,
}: {
  state: MoveStoryDialogState;
  onClose: () => void;
}) {
  const { story, classification } = state;

  return (
    <DialogTitle
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        py: 1.5,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap">
        <Icon icon="mdi:eye-outline" height={22} />
        <Typography variant="h6" fontWeight={700} component="span">
          {story ? (
            <>
              Visualize{" "}
              <PrettyMoveSan san={story.playedSan} color={story.mover} />
            </>
          ) : (
            "Visualize"
          )}
        </Typography>
        {classification && (
          <Chip
            size="small"
            label={classificationName(classification)}
            icon={
              <Image
                src={`/icons/${classification}.png`}
                alt=""
                width={16}
                height={16}
              />
            }
            sx={{
              textTransform: "capitalize",
              fontWeight: 600,
              color: CLASSIFICATION_COLORS[classification],
              borderColor: CLASSIFICATION_COLORS[classification],
            }}
            variant="outlined"
          />
        )}
      </Stack>
      <Tooltip title="Close (Esc)">
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <Icon icon="mdi:close" height={20} />
        </IconButton>
      </Tooltip>
    </DialogTitle>
  );
}

function StoryBody({ story, compact }: { story: MoveStory; compact: boolean }) {
  const [lineKey, setLineKey] = useState<LineKey>("played");
  const [step, setStep] = useState(0);
  const [extra, setExtra] = useState<Record<LineKey, number>>({
    played: 0,
    better: 0,
  });
  const [playing, setPlaying] = useState(false);

  const line: StoryLine =
    (lineKey === "better" && story.better) || story.played;
  const maxIndex = line.steps.length - 1;
  const visibleEnd = Math.min(maxIndex, line.autoEnd + extra[lineKey]);
  const hiddenCount = maxIndex - visibleEnd;
  const reachedEnd = step >= visibleEnd;

  const current = line.steps[step];
  const lastMove = current.uci
    ? { from: current.uci.slice(0, 2), to: current.uci.slice(2, 4) }
    : undefined;

  const startFenParts = (line.steps[0]?.fen ?? "").split(" ");
  const startFullmove = Number(startFenParts[5]) || 1;
  const startTurn: "w" | "b" = startFenParts[1] === "b" ? "b" : "w";

  const stepMoveNumberLabel = (stepIndex: number, moveColor?: "w" | "b") => {
    if (stepIndex === 0 || !moveColor) return "•";
    const moveIdx = stepIndex - 1;
    const moveNum =
      startFullmove + Math.floor((moveIdx + (startTurn === "b" ? 1 : 0)) / 2);
    return moveColor === "w" ? `${moveNum}.` : `${moveNum}...`;
  };

  const arrows = useMemo<BoardArrow[]>(() => {
    const upcoming = line.steps[step + 1];
    if (!upcoming?.uci || step >= visibleEnd) return [];

    return [arrowFromUci(upcoming.uci, { kind: "best", side: upcoming.color })];
  }, [line, step, visibleEnd]);

  const switchLine = (key: LineKey) => {
    setLineKey(key);
    setStep(0);
    setPlaying(false);
  };

  const goTo = useCallback(
    (index: number) => {
      setStep(Math.max(0, Math.min(visibleEnd, index)));
      setPlaying(false);
    },
    [visibleEnd]
  );

  const moveBy = useCallback(
    (delta: number) => {
      setStep((value) => Math.max(0, Math.min(visibleEnd, value + delta)));
      setPlaying(false);
    },
    [visibleEnd]
  );

  const togglePlay = useCallback(() => {
    setPlaying((currentlyPlaying) => {
      if (currentlyPlaying) return false;
      setStep((currentStep) => (currentStep >= visibleEnd ? 0 : currentStep));
      return true;
    });
  }, [visibleEnd]);

  useEffect(() => {
    if (!playing) return;

    if (step >= visibleEnd) {
      setPlaying(false);
      return;
    }

    const timer = setTimeout(
      () => setStep((value) => Math.min(visibleEnd, value + 1)),
      STEP_MS
    );
    return () => clearTimeout(timer);
  }, [playing, step, visibleEnd]);

  const actionsRef = useRef({ moveBy, goTo, togglePlay, visibleEnd });
  useEffect(() => {
    actionsRef.current = { moveBy, goTo, togglePlay, visibleEnd };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.stopImmediatePropagation();
        event.preventDefault();
        actionsRef.current.moveBy(1);
      } else if (event.key === "ArrowLeft") {
        event.stopImmediatePropagation();
        event.preventDefault();
        actionsRef.current.moveBy(-1);
      } else if (event.key === "Home") {
        event.stopImmediatePropagation();
        event.preventDefault();
        actionsRef.current.goTo(0);
      } else if (event.key === "End") {
        event.stopImmediatePropagation();
        event.preventDefault();
        actionsRef.current.goTo(actionsRef.current.visibleEnd);
      } else if (event.key === " ") {
        event.stopImmediatePropagation();
        event.preventDefault();
        actionsRef.current.togglePlay();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>("[data-current='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [step, lineKey]);

  const boardWrapRef = useRef<HTMLDivElement>(null);
  const maxBoardSize = compact ? 340 : 380;
  const [boardSize, setBoardSize] = useState(maxBoardSize);

  useLayoutEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const measure = () => {
      const width = Math.floor(el.clientWidth);
      if (width > 0) setBoardSize(Math.min(maxBoardSize, width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [maxBoardSize]);

  const orientation = story.mover === "w" ? Color.White : Color.Black;

  const moverWinPercentage = Math.round(line.moverWinPercentage);
  const endReason: CascadeEndReason =
    extra[lineKey] === 0
      ? line.endReason
      : maxIndex >= 1 + MAX_CASCADE_PLIES
        ? "limit"
        : "line-ended";

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      gap={3}
      alignItems={{ md: "flex-start" }}
    >
      <Stack
        gap={1.5}
        alignItems="center"
        sx={{
          flexShrink: 0,
          width: { xs: "100%", md: maxBoardSize },
          maxWidth: maxBoardSize,
          mx: { xs: "auto", md: 0 },
        }}
      >
        <Box
          ref={boardWrapRef}
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <MiniBoard
            fen={current.fen}
            size={boardSize}
            orientation={orientation}
            lastMove={lastMove}
            arrows={arrows}
          />
        </Box>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          gap={0.5}
        >
          <Tooltip title="Start (Home)">
            <span>
              <IconButton
                onClick={() => goTo(0)}
                disabled={step === 0}
                aria-label="Go to the start"
              >
                <Icon icon="mdi:skip-previous" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Previous move (←)">
            <span>
              <IconButton
                onClick={() => moveBy(-1)}
                disabled={step === 0}
                aria-label="Previous move"
              >
                <Icon icon="mdi:chevron-left" height={28} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={playing ? "Pause (Space)" : "Play it out (Space)"}>
            <span>
              <IconButton
                color="primary"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play it out"}
              >
                <Icon
                  icon={playing ? "mdi:pause-circle" : "mdi:play-circle"}
                  height={36}
                />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Next move (→)">
            <span>
              <IconButton
                onClick={() => moveBy(1)}
                disabled={reachedEnd}
                aria-label="Next move"
              >
                <Icon icon="mdi:chevron-right" height={28} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="End (End)">
            <span>
              <IconButton
                onClick={() => goTo(visibleEnd)}
                disabled={reachedEnd}
                aria-label="Go to the end"
              >
                <Icon icon="mdi:skip-next" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}
        >
          {story.kind === "continuation"
            ? "Evaluation at the starting position"
            : lineKey === "played"
              ? "After the played move"
              : "With the better move"}
          : <b>{line.evalLabel}</b> · {moverWinPercentage}% win chance for{" "}
          {story.mover === "w" ? "White" : "Black"}
        </Typography>
      </Stack>

      <Stack gap={1.5} sx={{ minWidth: 0, flexGrow: 1 }}>
        <Stack gap={0.75}>
          {story.summary.map((paragraph, index) => (
            <Typography
              key={index}
              variant={index === 0 ? "subtitle1" : "body2"}
              fontWeight={index === 0 ? 600 : 400}
            >
              {paragraph}
            </Typography>
          ))}
        </Stack>

        {story.better && (
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={lineKey}
            onChange={(_, value: LineKey | null) => value && switchLine(value)}
            aria-label="Which line to show"
            sx={{
              "& .MuiToggleButton-root": {
                textTransform: "none",
                minHeight: 34,
              },
            }}
          >
            <ToggleButton value="played">
              What happens:&nbsp;
              <PrettyMoveSan san={story.playedSan} color={story.mover} />
            </ToggleButton>
            <ToggleButton value="better">
              Better:&nbsp;
              <PrettyMoveSan san={story.bestSan ?? ""} color={story.mover} />
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        <Box
          ref={listRef}
          sx={{
            height: compact ? "auto" : 260,
            maxHeight: compact ? "none" : 260,
            overflowY: compact ? "visible" : "auto",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          {line.steps.slice(0, visibleEnd + 1).map((entry) => {
            const isCurrent = entry.index === step;
            return (
              <ButtonBase
                key={entry.index}
                data-current={isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => goTo(entry.index)}
                sx={{
                  display: "flex",
                  width: "100%",
                  gap: 1.25,
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  px: 1.25,
                  py: 0.75,
                  backgroundColor: isCurrent ? "action.selected" : undefined,
                  "&:hover": { backgroundColor: "action.hover" },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: -2,
                  },
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    minWidth: 32,
                    pt: 0.25,
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {stepMoveNumberLabel(entry.index, entry.color)}
                </Typography>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  {entry.san && entry.color && (
                    <Typography fontWeight={700} component="div">
                      <PrettyMoveSan san={entry.san} color={entry.color} />
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color={
                      entry.index === 0 ? "text.secondary" : "text.primary"
                    }
                  >
                    {entry.note}
                  </Typography>
                </Box>
              </ButtonBase>
            );
          })}

          <Box sx={{ px: 1.25, py: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: "italic" }}
            >
              {CASCADE_END_TEXT[endReason]}
            </Typography>
            {hiddenCount > 0 && (
              <Button
                size="small"
                sx={{ mt: 0.5 }}
                onClick={() =>
                  setExtra((prev) => ({
                    ...prev,
                    [lineKey]: prev[lineKey] + hiddenCount,
                  }))
                }
              >
                Show {hiddenCount} more {hiddenCount === 1 ? "move" : "moves"}
              </Button>
            )}
          </Box>
        </Box>
      </Stack>
    </Stack>
  );
}
