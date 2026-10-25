import Board from "@/components/board";
import Panel from "@/components/panel";
import { OPENING_LINES, OpeningLine } from "@/data/openingLines";
import BoardWorkspace from "@/components/boardWorkspace";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { setHandoff } from "@/lib/handoff";
import { buildSteps, lineToPgn, moveLabel } from "@/lib/openingTrainer";
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
  Stack,
  ToggleButton,
  ToggleButtonGroup,
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

const LEARN_COLOR = "rgba(255,170,0,0.7)";

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

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100, mx: "auto", py: 1 }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Openings
        </Typography>
        <Typography sx={{ opacity: 0.75 }}>
          Learn the ideas behind each move, then drill the line from memory. A
          drill with no mistakes and no hints marks the opening as learned.{" "}
          {learned.length} of {OPENING_LINES.length} learned.
        </Typography>
      </Box>

      {(["w", "b"] as const).map((side) => (
        <Box key={side}>
          <Typography
            variant="overline"
            sx={{ opacity: 0.7, letterSpacing: "0.1em" }}
          >
            Play as {side === "w" ? "White" : "Black"}
          </Typography>
          <Grid container spacing={2} mt={0}>
            {OPENING_LINES.filter((line) => line.side === side).map((line) => (
              <Grid key={line.id} size={{ xs: 12, sm: 6, md: 4 }}>
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
  const preview = useMemo(
    () =>
      buildSteps(line)
        .slice(0, 6)
        .map((step) => (step.color === "w" ? moveLabel(step) : step.san))
        .join(" "),
    [line]
  );

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderColor: learned ? "success.main" : "divider",
        transition: "transform 0.15s",
        "&:hover": { transform: "translateY(-2px)" },
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 2, height: "100%" }}>
        <Stack spacing={1} height="100%">
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Typography fontWeight={600}>{line.name}</Typography>
            {learned && (
              <Icon icon="mdi:check-circle" height={20} color="#22ac38" />
            )}
          </Stack>
          <Typography
            variant="body2"
            sx={{ opacity: 0.7, fontFamily: "monospace" }}
          >
            {preview}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            {line.summary}
          </Typography>
          <Stack direction="row" gap={0.75} mt="auto !important">
            <Chip size="small" variant="outlined" label={line.eco} />
            <Chip
              size="small"
              variant="outlined"
              label={`${line.moves.split(" ").length} plies`}
            />
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

  const arrows = useMemo(() => {
    const list: BoardArrow[] = [];
    if (study.learnUci)
      list.push(
        arrowFromUci(study.learnUci, { kind: "content", color: LEARN_COLOR })
      );
    if (study.hintUci)
      list.push(arrowFromUci(study.hintUci, { kind: "best", side: line.side }));
    return list;
  }, [study.learnUci, study.hintUci, line.side]);

  useKeyboardShortcut("ArrowRight", () => study.goTo(study.ply + 1), learnMode);
  useKeyboardShortcut("ArrowLeft", () => study.goTo(study.ply - 1), learnMode);
  useKeyboardShortcut("Home", () => study.goTo(0), learnMode);
  useKeyboardShortcut("End", () => study.goTo(study.steps.length), learnMode);
  useKeyboardShortcut("h", study.askHint, study.mode === "drill");

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
        />
      }
      inspector={
        <Stack
          spacing={2}
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
              <Stack direction="row" alignItems="center" gap={1}>
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
              </Stack>

              <Typography variant="h6" fontWeight={700}>
                {line.name}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
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

  const analyse = () => {
    setHandoff({ kind: "pgn", pgn: lineToPgn(line, steps) }, "/analysis");
    router.push("/analysis");
  };

  return (
    <>
      <Panel title="The line">
        <Stack spacing={1.5}>
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
              minHeight: 64,
              borderRadius: 2,
              border: 1,
              borderColor: "divider",
              backgroundColor: "action.hover",
            }}
          >
            <Typography variant="body2">
              {study.currentNote ??
                (ply === 0
                  ? "Press next, or click a move, to see the idea behind each move."
                  : "A developing move that follows the line.")}
            </Typography>
          </Box>

          <Stack direction="row" justifyContent="center" gap={0.5}>
            <IconButton aria-label="Start" onClick={() => study.goTo(0)}>
              <Icon icon="mdi:skip-previous" height={24} />
            </IconButton>
            <IconButton
              aria-label="Previous move"
              onClick={() => study.goTo(ply - 1)}
            >
              <Icon icon="mdi:chevron-left" height={24} />
            </IconButton>
            <IconButton
              aria-label={study.playing ? "Pause" : "Play"}
              onClick={study.togglePlaying}
            >
              <Icon
                icon={study.playing ? "mdi:pause" : "mdi:play"}
                height={24}
              />
            </IconButton>
            <IconButton
              aria-label="Next move"
              onClick={() => study.goTo(ply + 1)}
            >
              <Icon icon="mdi:chevron-right" height={24} />
            </IconButton>
            <IconButton
              aria-label="End"
              onClick={() => study.goTo(steps.length)}
            >
              <Icon icon="mdi:skip-next" height={24} />
            </IconButton>
          </Stack>
        </Stack>
      </Panel>

      <Panel title="Plans">
        <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5 }}>
          {line.plans.map((plan) => (
            <Typography key={plan} component="li" variant="body2">
              {plan}
            </Typography>
          ))}
        </Stack>
      </Panel>

      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button
          variant="contained"
          startIcon={<Icon icon="mdi:target" height={18} />}
          onClick={study.startDrill}
        >
          Drill this line
        </Button>
        <Button
          variant="outlined"
          startIcon={<Icon icon="mdi:chart-line" height={18} />}
          onClick={analyse}
        >
          Analyze
        </Button>
      </Stack>
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
  const { line, phase, steps, ply } = study;
  const mine = steps.filter((step) => step.color === line.side);
  const done = mine.filter((step) => step.ply < ply).length;

  return (
    <Panel title="Drill">
      <Stack spacing={1.5}>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <Chip
            size="small"
            label={`Move ${Math.min(done + 1, mine.length)} of ${mine.length}`}
          />
          <Chip
            size="small"
            variant="outlined"
            color={study.mistakes ? "warning" : "default"}
            label={`${study.mistakes} mistake${study.mistakes === 1 ? "" : "s"}`}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`${study.hints} hint${study.hints === 1 ? "" : "s"}`}
          />
        </Stack>

        {phase === "playing" && (
          <Typography variant="body2">
            Your move. Play the book move for {line.name}.
          </Typography>
        )}
        {phase === "replying" && (
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Your opponent answers…
          </Typography>
        )}
        {phase === "wrong" && (
          <Typography variant="body2" color="error.main">
            That is not the book move. Take it back and think again.
          </Typography>
        )}

        {(study.feedback.mine || study.feedback.reply) && phase !== "wrong" && (
          <Stack spacing={0.75}>
            {study.feedback.mine && (
              <Alert
                severity="success"
                icon={<Icon icon="mdi:check" height={20} />}
              >
                {study.feedback.mine}
              </Alert>
            )}
            {study.feedback.reply && (
              <Alert
                severity="info"
                icon={<Icon icon="mdi:account-outline" height={20} />}
              >
                {study.feedback.reply}
              </Alert>
            )}
          </Stack>
        )}

        {phase === "done" && (
          <Alert severity={study.learned ? "success" : "info"}>
            {study.learned
              ? "Line learned. No mistakes and no hints, so it is marked as learned."
              : `Finished with ${study.mistakes} mistake${study.mistakes === 1 ? "" : "s"} and ${study.hints} hint${study.hints === 1 ? "" : "s"}. Drill again with none to mark it as learned.`}
          </Alert>
        )}

        <Stack direction="row" gap={1} flexWrap="wrap">
          {phase !== "done" && (
            <Button
              size="small"
              variant="outlined"
              disabled={phase !== "playing" || !!study.hintUci}
              startIcon={<Icon icon="mdi:lightbulb-on-outline" height={18} />}
              onClick={study.askHint}
            >
              Hint
            </Button>
          )}
          <Button
            size="small"
            variant={phase === "done" ? "contained" : "outlined"}
            startIcon={<Icon icon="mdi:refresh" height={18} />}
            onClick={study.startDrill}
          >
            {phase === "done" ? "Drill again" : "Restart"}
          </Button>
          <Button size="small" variant="outlined" onClick={study.startLearn}>
            Back to learning
          </Button>
          {phase === "done" && (
            <Button
              size="small"
              variant="text"
              startIcon={<Icon icon="mdi:skip-next" height={18} />}
              onClick={onNext}
            >
              Next: {nextName}
            </Button>
          )}
        </Stack>
      </Stack>
    </Panel>
  );
}
