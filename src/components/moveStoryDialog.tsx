import MiniBoard from "@/components/board/miniBoard";
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
  Chip,
  Dialog,
  DialogContent,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { Arrow, Square } from "react-chessboard/dist/chessboard/types";

import { moveStoryAtom, MoveStoryDialogState } from "@/lib/moveStoryState";
export { moveStoryAtom } from "@/lib/moveStoryState";

type LineKey = "played" | "better";

const STEP_MS = 1500;

export default function MoveStoryDialog() {
  const [state, setState] = useAtom(moveStoryAtom);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const { story } = state;

  const close = () => setState((prev) => ({ ...prev, open: false }));

  return (
    <Dialog
      open={state.open}
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
            <LinearProgress sx={{ width: "60%" }} />
            <Typography sx={{ opacity: 0.75 }}>
              Asking the engine what happens next…
            </Typography>
          </Stack>
        )}

        {state.error && !state.loading && (
          <Alert severity="error">{state.error}</Alert>
        )}

        {story && !state.loading && (
          <StoryBody
            key={story.fenBefore + story.playedSan}
            story={story}
            compact={isSmall}
          />
        )}
      </DialogContent>
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
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={1}
      sx={{ px: 3, py: 1.5 }}
    >
      <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap">
        <Icon icon="mdi:eye-outline" height={24} />
        <Typography variant="h6" fontWeight={700}>
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
            label={classification}
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
              color: "#fff",
              backgroundColor: CLASSIFICATION_COLORS[classification],
            }}
          />
        )}
      </Stack>
      <Tooltip title="Close (Esc)">
        <IconButton onClick={onClose} aria-label="Close">
          <Icon icon="mdi:close" />
        </IconButton>
      </Tooltip>
    </Stack>
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

  const arrows = useMemo<Arrow[]>(() => {
    const upcoming = line.steps[step + 1];
    if (!upcoming?.uci || step >= visibleEnd) return [];

    return [
      [
        upcoming.uci.slice(0, 2) as Square,
        upcoming.uci.slice(2, 4) as Square,
        "rgba(59, 154, 198, 0.75)",
      ],
    ];
  }, [line, step, visibleEnd]);

  const switchLine = (key: LineKey) => {
    setLineKey(key);
    setStep(0);
    setPlaying(false);
  };

  const goTo = (index: number) => {
    setStep(Math.max(0, Math.min(visibleEnd, index)));
    setPlaying(false);
  };

  useEffect(() => {
    if (!playing) return;

    if (step >= visibleEnd) {
      setPlaying(false);
      return;
    }

    const timer = setTimeout(() => setStep((value) => value + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, step, visibleEnd]);

  const goToRef = useRef(goTo);
  useEffect(() => {
    goToRef.current = goTo;
  });
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

      event.stopImmediatePropagation();
      event.preventDefault();
      goToRef.current(stepRef.current + (event.key === "ArrowRight" ? 1 : -1));
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

  const boardSize = compact ? Math.min(340, window.innerWidth - 56) : 380;
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
        sx={{ flexShrink: 0, width: boardSize }}
      >
        <MiniBoard
          fen={current.fen}
          size={boardSize}
          orientation={orientation}
          lastMove={lastMove}
          arrows={arrows}
        />

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          gap={0.5}
        >
          <Tooltip title="Start">
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
                onClick={() => goTo(step - 1)}
                disabled={step === 0}
                aria-label="Previous move"
              >
                <Icon icon="mdi:chevron-left" height={28} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={playing ? "Pause" : "Play it out"}>
            <span>
              <IconButton
                color="primary"
                onClick={() => {
                  if (reachedEnd) setStep(0);
                  setPlaying((value) => !value);
                }}
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
                onClick={() => goTo(step + 1)}
                disabled={reachedEnd}
                aria-label="Next move"
              >
                <Icon icon="mdi:chevron-right" height={28} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="End">
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

        <Typography variant="body2" sx={{ opacity: 0.8, textAlign: "center" }}>
          {lineKey === "played" ? "After your move" : "With the better move"}:{" "}
          <b>{line.evalLabel}</b> · {moverWinPercentage}% win chance for{" "}
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
          >
            <ToggleButton value="played">
              What happens: {story.playedSan}
            </ToggleButton>
            <ToggleButton value="better">Better: {story.bestSan}</ToggleButton>
          </ToggleButtonGroup>
        )}

        <Box
          ref={listRef}
          sx={{
            maxHeight: 260,
            overflowY: "auto",
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          {line.steps.slice(0, visibleEnd + 1).map((entry) => (
            <Box
              key={entry.index}
              data-current={entry.index === step}
              onClick={() => goTo(entry.index)}
              sx={{
                display: "flex",
                gap: 1.25,
                alignItems: "flex-start",
                px: 1.25,
                py: 0.75,
                cursor: "pointer",
                backgroundColor:
                  entry.index === step ? "action.selected" : undefined,
                "&:hover": { backgroundColor: "action.hover" },
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Typography
                variant="caption"
                sx={{ minWidth: 22, opacity: 0.6, pt: 0.25 }}
              >
                {entry.index === 0 ? "•" : entry.index}
              </Typography>
              <Box sx={{ minWidth: 0 }}>
                {entry.san && entry.color && (
                  <Typography fontWeight={700} component="div">
                    <PrettyMoveSan san={entry.san} color={entry.color} />
                  </Typography>
                )}
                <Typography
                  variant="body2"
                  sx={{ opacity: entry.index === 0 ? 0.65 : 0.9 }}
                >
                  {entry.note}
                </Typography>
              </Box>
            </Box>
          ))}

          <Box sx={{ px: 1.25, py: 1 }}>
            <Typography
              variant="body2"
              sx={{ opacity: 0.75, fontStyle: "italic" }}
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
