import Board from "@/components/board";
import MiniBoard from "@/components/board/miniBoard";
import Panel from "@/components/panel";
import { OPENING_LINES, OpeningLine } from "@/data/openingLines";
import BoardWorkspace from "@/components/boardWorkspace";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { setHandoff } from "@/lib/handoff";
import {
  buildSteps,
  fenAtPly,
  lineToPgn,
  moveLabel,
} from "@/lib/openingTrainer";
import { statsAtom } from "@/lib/stats";
import { Color } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Grid2 as Grid,
  IconButton,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { arrowFromUci } from "@/lib/arrows/uci";
import { BoardArrow } from "@/lib/arrows/types";
import { openingGameAtom } from "./states";
import { OpeningMode, OpeningStudy, useOpeningStudy } from "./useOpeningStudy";

const SIDE_PANEL_WIDTH = 440;
const LEARN_COLOR = "rgba(255,170,0,0.75)";
const PREVIEW_BOARD_SIZE = 104;

export default function OpeningsPage() {
  const router = useRouter();
  const lineId =
    typeof router.query.line === "string" ? router.query.line : undefined;
  const line = OPENING_LINES.find(({ id }) => id === lineId);

  const select = (id?: string) =>
    router.push(
      id ? { pathname: "/openings", query: { line: id } } : "/openings",
      undefined,
      { shallow: true }
    );

  return line ? (
    <StudyView key={line.id} line={line} onSelect={select} />
  ) : (
    <OpeningList onSelect={select} />
  );
}

function OpeningList({ onSelect }: { onSelect: (id: string) => void }) {
  const learned = useAtomValue(statsAtom).openings.learned;
  const learnedCount = OPENING_LINES.filter(({ id }) =>
    learned.includes(id)
  ).length;

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100, mx: "auto", py: 1 }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Openings
        </Typography>
        <Typography color="text.secondary">
          Learn the ideas behind each move, then drill the line from memory. A
          clean drill with no mistakes and no hints marks the opening as
          learned.
        </Typography>
      </Box>

      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between">
          <Typography
            variant="body2"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {learnedCount} of {OPENING_LINES.length} learned
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={(learnedCount / OPENING_LINES.length) * 100}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Stack>

      {(["w", "b"] as const).map((side) => (
        <Box key={side}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ letterSpacing: "0.1em" }}
          >
            Play as {side === "w" ? "White" : "Black"}
          </Typography>
          <Grid container spacing={2} mt={0}>
            {OPENING_LINES.filter((line) => line.side === side).map((line) => (
              <Grid key={line.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <OpeningCard
                  line={line}
                  learned={learned.includes(line.id)}
                  onSelect={() => onSelect(line.id)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Stack>
  );
}

function OpeningCard({
  line,
  learned,
  onSelect,
}: {
  line: OpeningLine;
  learned: boolean;
  onSelect: () => void;
}) {
  const { preview, finalFen, fullMoves } = useMemo(() => {
    const steps = buildSteps(line);
    return {
      preview: steps
        .slice(0, 6)
        .map((step) => (step.color === "w" ? moveLabel(step) : step.san))
        .join(" "),
      finalFen: fenAtPly(steps, steps.length),
      fullMoves: Math.ceil(steps.length / 2),
    };
  }, [line]);

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 1.5,
        borderColor: learned ? "success.main" : "divider",
        transition: "transform 0.15s, border-color 0.15s",
        "&:hover": { transform: "translateY(-2px)" },
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 1.75, height: "100%" }}>
        <Stack
          direction="row"
          spacing={1.5}
          height="100%"
          alignItems="flex-start"
        >
          <MiniBoard
            fen={finalFen}
            size={PREVIEW_BOARD_SIZE}
            orientation={line.side === "w" ? Color.White : Color.Black}
            showCoordinates={false}
          />
          <Stack spacing={0.75} minWidth={0} flex={1} height="100%">
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              gap={0.75}
            >
              <Typography fontWeight={600} lineHeight={1.25}>
                {line.name}
              </Typography>
              {learned && (
                <Box
                  component="span"
                  sx={{
                    color: "success.main",
                    display: "inline-flex",
                    flexShrink: 0,
                  }}
                >
                  <Icon icon="mdi:check-circle" height={20} />
                </Box>
              )}
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: "monospace" }}
              noWrap
            >
              {preview}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {line.summary}
            </Typography>
            <Stack direction="row" gap={0.75} flexWrap="wrap" pt={0.5}>
              <Chip size="small" variant="outlined" label={line.eco} />
              <Chip
                size="small"
                variant="outlined"
                label={`${fullMoves} moves`}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              />
            </Stack>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function StudyView({
  line,
  onSelect,
}: {
  line: OpeningLine;
  onSelect: (id?: string) => void;
}) {
  const study = useOpeningStudy(line);

  const side = line.side === "w" ? Color.White : Color.Black;
  const learnMode = study.mode === "learn";
  const canStep = learnMode || study.phase === "done";

  const arrows = useMemo(() => {
    const list: BoardArrow[] = [];
    if (study.learnUci) {
      list.push(
        arrowFromUci(study.learnUci, { kind: "content", color: LEARN_COLOR })
      );
    }
    if (study.hintUci) {
      list.push(arrowFromUci(study.hintUci, { kind: "best", side: line.side }));
    }
    return list;
  }, [study.learnUci, study.hintUci, line.side]);

  useKeyboardShortcut("ArrowRight", () => study.goTo(study.ply + 1), canStep);
  useKeyboardShortcut("ArrowLeft", () => study.goTo(study.ply - 1), canStep);
  useKeyboardShortcut("Home", () => study.goTo(0), canStep);
  useKeyboardShortcut("End", () => study.goTo(study.steps.length), canStep);
  useKeyboardShortcut(["h", "H"], study.askHint, study.mode === "drill");

  const index = OPENING_LINES.findIndex(({ id }) => id === line.id);
  const next = OPENING_LINES[(index + 1) % OPENING_LINES.length];

  return (
    <BoardWorkspace
      inspectorMinWidth={SIDE_PANEL_WIDTH}
      inspectorLabel="Opening study controls"
      board={
        <Board
          id="OpeningBoard"
          canPlay={
            !learnMode && study.phase === "playing" ? (side as Color) : false
          }
          gameAtom={openingGameAtom}
          whitePlayer={{ name: line.side === "w" ? "You" : "Opponent" }}
          blackPlayer={{ name: line.side === "b" ? "You" : "Opponent" }}
          boardOrientation={side}
          arrows={arrows}
          lastMove={study.lastMove}
          verdict={study.verdict}
          hintSquare={study.hintSquare}
          motionKey={study.motionKey}
        />
      }
      inspector={
        <Stack
          spacing={0}
          data-inspector-scroller
          sx={{
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollbarGutter: "stable",
          }}
        >
          <Panel>
            <Stack spacing={1.25}>
              <Stack
                direction="row"
                alignItems="center"
                gap={0.75}
                flexWrap="wrap"
              >
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<Icon icon="mdi:chevron-left" height={18} />}
                  onClick={() => onSelect()}
                >
                  All openings
                </Button>
                <Chip size="small" variant="outlined" label={line.eco} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`You play ${line.side === "w" ? "White" : "Black"}`}
                />
                {study.alreadyLearned && (
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    icon={<Icon icon="mdi:check-circle" height={14} />}
                    label="Learned"
                  />
                )}
              </Stack>

              <Typography variant="h6" fontWeight={700}>
                {line.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {line.summary}
              </Typography>

              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={study.mode}
                onChange={(_, value: OpeningMode | null) => {
                  if (value === "learn") study.startLearn();
                  if (value === "drill") study.startDrill();
                }}
              >
                <ToggleButton value="learn" sx={{ gap: 0.75 }}>
                  <Icon icon="mdi:book-open-page-variant-outline" height={16} />
                  Learn
                </ToggleButton>
                <ToggleButton value="drill" sx={{ gap: 0.75 }}>
                  <Icon icon="mdi:target" height={16} />
                  Drill
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Panel>

          {learnMode ? (
            <LearnPanel study={study} />
          ) : (
            <DrillPanel
              study={study}
              onNext={() => onSelect(next.id)}
              nextName={next.name}
            />
          )}
        </Stack>
      }
    />
  );
}

function LearnPanel({ study }: { study: OpeningStudy }) {
  const router = useRouter();
  const { line, steps, ply } = study;

  const analyze = () => {
    setHandoff({ kind: "pgn", pgn: lineToPgn(line, steps) }, "/analysis");
    router.push("/analysis");
  };

  return (
    <>
      <Panel
        title="The line"
        actions={
          <Button
            size="small"
            variant="outlined"
            startIcon={<Icon icon="mdi:chart-line" height={16} />}
            onClick={analyze}
          >
            Analyze
          </Button>
        }
      >
        <Stack spacing={1.5}>
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
                  aria-label="Start"
                  disabled={ply <= 0}
                  onClick={() => study.goTo(0)}
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
                  disabled={ply <= 0}
                  onClick={() => study.goTo(ply - 1)}
                >
                  <Icon icon="mdi:chevron-left" height={22} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={study.playing ? "Pause" : "Auto-play"}>
              <IconButton
                size="small"
                aria-label={study.playing ? "Pause" : "Play"}
                onClick={study.togglePlaying}
              >
                <Icon
                  icon={study.playing ? "mdi:pause" : "mdi:play"}
                  height={20}
                />
              </IconButton>
            </Tooltip>
            <Tooltip title="Next move (→)">
              <span>
                <IconButton
                  size="small"
                  aria-label="Next move"
                  disabled={ply >= steps.length}
                  onClick={() => study.goTo(ply + 1)}
                >
                  <Icon icon="mdi:chevron-right" height={22} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="End (End)">
              <span>
                <IconButton
                  size="small"
                  aria-label="End"
                  disabled={ply >= steps.length}
                  onClick={() => study.goTo(steps.length)}
                >
                  <Icon icon="mdi:skip-next" height={20} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {steps.map((step) => (
              <Chip
                key={step.ply}
                size="small"
                label={step.color === "w" ? moveLabel(step) : step.san}
                color={step.ply + 1 === ply ? "primary" : "default"}
                variant={step.ply < ply ? "filled" : "outlined"}
                onClick={() => study.goTo(step.ply + 1)}
              />
            ))}
          </Stack>

          <Box
            sx={{
              p: 1.5,
              minHeight: 72,
              borderRadius: 1.5,
              border: 1,
              borderColor: "divider",
              backgroundColor: "action.hover",
            }}
          >
            <Typography variant="body2">
              {study.currentNote ??
                (ply === 0
                  ? "Step forward or click a move to see the idea behind each move."
                  : "Book move in this line.")}
            </Typography>
          </Box>
        </Stack>
      </Panel>

      <Panel title="Key plans" sx={{ borderBottom: 0 }}>
        <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
          {line.plans.map((plan) => (
            <Typography key={plan} component="li" variant="body2">
              {plan}
            </Typography>
          ))}
        </Stack>
      </Panel>
    </>
  );
}

function DrillPanel({
  study,
  onNext,
  nextName,
}: {
  study: OpeningStudy;
  onNext: () => void;
  nextName: string;
}) {
  const { line, phase, steps, ply, drillPly } = study;
  const mine = steps.filter((step) => step.color === line.side);
  const done = mine.filter((step) => step.ply < drillPly).length;
  const playedSteps = steps.slice(0, drillPly);
  const isDone = phase === "done";

  return (
    <Panel title="Drill" sx={{ borderBottom: 0 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <Chip
            size="small"
            label={`Move ${Math.min(done + 1, mine.length)} of ${mine.length}`}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          />
          <Chip
            size="small"
            variant="outlined"
            color={study.mistakes ? "warning" : "default"}
            label={`${study.mistakes} mistake${study.mistakes === 1 ? "" : "s"}`}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`${study.hints} hint${study.hints === 1 ? "" : "s"}`}
            sx={{ fontVariantNumeric: "tabular-nums" }}
          />
        </Stack>

        {/* Single consolidated status / feedback banner */}
        {isDone ? (
          <Alert severity={study.learned ? "success" : "info"}>
            <Stack spacing={0.5}>
              <Typography variant="body2" fontWeight={600}>
                {study.learned
                  ? "Clean drill — opening marked as learned!"
                  : `Finished with ${study.mistakes} mistake${study.mistakes === 1 ? "" : "s"} and ${study.hints} hint${study.hints === 1 ? "" : "s"}.`}
              </Typography>
              {!study.learned && (
                <Typography variant="caption">
                  Complete a drill with zero mistakes and zero hints to mark it
                  learned.
                </Typography>
              )}
              {study.currentNote && (
                <Typography variant="caption" color="text.secondary">
                  {study.currentNote}
                </Typography>
              )}
            </Stack>
          </Alert>
        ) : (
          <Alert
            severity={
              phase === "wrong"
                ? "error"
                : study.feedback.mine || study.feedback.reply
                  ? "success"
                  : "info"
            }
            icon={
              <Icon
                icon={
                  phase === "wrong"
                    ? "mdi:close-circle"
                    : study.feedback.mine || study.feedback.reply
                      ? "mdi:check-circle"
                      : "mdi:target"
                }
                height={20}
              />
            }
          >
            {phase === "wrong"
              ? "Not the book move — try again."
              : phase === "replying"
                ? (study.feedback.mine ?? "Book move! Opponent replying…")
                : study.feedback.reply
                  ? study.feedback.reply
                  : study.feedback.mine
                    ? study.feedback.mine
                    : `Your move — play the book move for ${line.name}.`}
          </Alert>
        )}

        <Stack direction="row" gap={1} flexWrap="wrap">
          {!isDone && (
            <Tooltip title="Using a hint won't count as a clean drill">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={phase !== "playing" || !!study.hintUci}
                  startIcon={
                    <Icon icon="mdi:lightbulb-on-outline" height={18} />
                  }
                  onClick={study.askHint}
                >
                  Hint
                </Button>
              </span>
            </Tooltip>
          )}

          {isDone && study.learned && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Icon icon="mdi:skip-next" height={18} />}
              onClick={onNext}
            >
              Next: {nextName}
            </Button>
          )}

          <Button
            size="small"
            variant={isDone && !study.learned ? "contained" : "outlined"}
            startIcon={<Icon icon="mdi:refresh" height={18} />}
            onClick={study.startDrill}
          >
            {isDone ? "Drill again" : "Restart"}
          </Button>

          {isDone && !study.learned && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Icon icon="mdi:skip-next" height={18} />}
              onClick={onNext}
            >
              Next: {nextName}
            </Button>
          )}
        </Stack>

        {isDone && (
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
                  aria-label="Start"
                  disabled={ply <= 0}
                  onClick={() => study.goTo(0)}
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
                  disabled={ply <= 0}
                  onClick={() => study.goTo(ply - 1)}
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
                  disabled={ply >= steps.length}
                  onClick={() => study.goTo(ply + 1)}
                >
                  <Icon icon="mdi:chevron-right" height={22} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="End (End)">
              <span>
                <IconButton
                  size="small"
                  aria-label="End"
                  disabled={ply >= steps.length}
                  onClick={() => study.goTo(steps.length)}
                >
                  <Icon icon="mdi:skip-next" height={20} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}

        {playedSteps.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {playedSteps.map((step) => (
              <Chip
                key={step.ply}
                size="small"
                label={step.color === "w" ? moveLabel(step) : step.san}
                clickable={isDone}
                onClick={isDone ? () => study.goTo(step.ply + 1) : undefined}
                color={isDone && step.ply + 1 === ply ? "primary" : "default"}
                variant={step.color === line.side ? "filled" : "outlined"}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}
