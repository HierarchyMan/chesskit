import Board from "@/components/board";
import MiniBoard from "@/components/board/miniBoard";
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
import { ToolbarButton } from "@/components/ToolbarButton";
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
  Card,
  CardActionArea,
  Chip,
  Grid2 as Grid,
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
  const router = useRouter();
  const { steps, ply, drillPly, phase } = study;
  const isDone = phase === "done";
  const mine = steps.filter((step) => step.color === line.side);
  const done = mine.filter((step) => step.ply < drillPly).length;
  const playedSteps = steps.slice(0, drillPly);
  const activeStep = ply > 0 ? steps[ply - 1] : undefined;

  const analyze = () => {
    setHandoff(
      { kind: "pgn", pgn: lineToPgn(line, steps), source: "Openings" },
      "/analysis"
    );
    void router.push("/analysis");
  };

  const verticalSlots = {
    contextBar: (
      <VerticalContextStrip
        left={
          <>
            <ToolbarButton
              tooltip="All openings"
              icon="mdi:arrow-left"
              iconHeight={18}
              onClick={() => onSelect()}
            />
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {line.name}
            </Typography>
            <InspectorPill label={line.eco} />
            {study.alreadyLearned && (
              <InspectorPill
                tone="success"
                icon="mdi:check-circle"
                label="Learned"
              />
            )}
          </>
        }
        right={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={study.mode}
            onChange={(_, value: OpeningMode | null) => {
              if (value === "learn") study.startLearn();
              if (value === "drill") study.startDrill();
            }}
            sx={{
              "& .MuiToggleButton-root": {
                py: 0.25,
                px: 0.9,
                minHeight: 28,
                fontSize: "0.74rem",
              },
            }}
          >
            <ToggleButton value="learn">Learn</ToggleButton>
            <ToggleButton value="drill">Drill</ToggleButton>
          </ToggleButtonGroup>
        }
      />
    ),
    liveStrip: (
      <VerticalLiveStrip minHeight={74}>
        {learnMode ? (
          <Stack spacing={0.5}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={0.75}
            >
              <Stack direction="row" alignItems="center" gap={0.6} minWidth={0}>
                {activeStep ? (
                  <InspectorPill
                    tone="primary"
                    label={
                      activeStep.color === "w"
                        ? moveLabel(activeStep)
                        : `${Math.floor(activeStep.ply / 2) + 1}… ${activeStep.san}`
                    }
                  />
                ) : (
                  <InspectorPill label="Start" />
                )}
                <InspectorPill label={`${ply}/${steps.length}`} />
              </Stack>
              <InspectorPill label={line.side === "w" ? "White" : "Black"} />
            </Stack>
            <Typography
              variant="body2"
              sx={{
                fontSize: "0.84rem",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {study.currentNote ??
                (ply === 0
                  ? "Tap Next to step through the opening and see the idea behind each move."
                  : "Book move in this line.")}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={0.65}>
            <Stack
              direction="row"
              alignItems="center"
              gap={0.5}
              flexWrap="wrap"
            >
              <InspectorPill
                tone="primary"
                label={`Move ${Math.min(done + 1, mine.length)}/${mine.length}`}
              />
              <InspectorPill
                tone={study.mistakes ? "warning" : "neutral"}
                label={`${study.mistakes} mistake${study.mistakes === 1 ? "" : "s"}`}
              />
              {study.hints > 0 && (
                <InspectorPill
                  label={`${study.hints} hint${study.hints === 1 ? "" : "s"}`}
                />
              )}
            </Stack>
            {isDone ? (
              <Alert
                severity={study.learned ? "success" : "info"}
                sx={{ py: 0.35 }}
              >
                <Typography variant="body2" fontWeight={600}>
                  {study.learned
                    ? "Clean drill — opening marked as learned!"
                    : `Finished with ${study.mistakes} mistake${study.mistakes === 1 ? "" : "s"} and ${study.hints} hint${study.hints === 1 ? "" : "s"}.`}
                </Typography>
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
                    height={18}
                  />
                }
                sx={{ py: 0.25 }}
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
          </Stack>
        )}
      </VerticalLiveStrip>
    ),
    actionBar: (
      <WorkspaceActionBar
        left={
          learnMode ? (
            <Stack
              data-board-shortcuts
              direction="row"
              alignItems="center"
              gap={0.15}
            >
              <ToolbarButton
                tooltip="Start"
                icon="mdi:skip-previous"
                iconHeight={20}
                disabled={ply <= 0}
                onClick={() => study.goTo(0)}
              />
              <ToolbarButton
                tooltip="Previous move"
                icon="mdi:chevron-left"
                iconHeight={24}
                disabled={ply <= 0}
                onClick={() => study.goTo(ply - 1)}
              />
              <ToolbarButton
                tooltip={study.playing ? "Pause" : "Auto-play"}
                icon={study.playing ? "mdi:pause" : "mdi:play"}
                iconHeight={21}
                active={study.playing ? true : undefined}
                onClick={study.togglePlaying}
              />
              <ToolbarButton
                tooltip="Next move"
                icon="mdi:chevron-right"
                iconHeight={24}
                disabled={ply >= steps.length}
                onClick={() => study.goTo(ply + 1)}
              />
              <ToolbarButton
                tooltip="End"
                icon="mdi:skip-next"
                iconHeight={20}
                disabled={ply >= steps.length}
                onClick={() => study.goTo(steps.length)}
              />
            </Stack>
          ) : isDone ? (
            <Stack
              data-board-shortcuts
              direction="row"
              alignItems="center"
              gap={0.15}
            >
              <ToolbarButton
                tooltip="Previous move"
                icon="mdi:chevron-left"
                iconHeight={24}
                disabled={ply <= 0}
                onClick={() => study.goTo(ply - 1)}
              />
              <ToolbarButton
                tooltip="Next move"
                icon="mdi:chevron-right"
                iconHeight={24}
                disabled={ply >= steps.length}
                onClick={() => study.goTo(ply + 1)}
              />
              <DeckButton
                active={study.learned}
                icon="mdi:skip-next"
                onClick={() => onSelect(next.id)}
              >
                Next
              </DeckButton>
              <DeckButton
                active={!study.learned}
                icon="mdi:refresh"
                onClick={study.startDrill}
              >
                Again
              </DeckButton>
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" gap={0.5}>
              <DeckButton
                icon="mdi:lightbulb-on-outline"
                disabled={phase !== "playing" || !!study.hintUci}
                onClick={study.askHint}
              >
                Hint
              </DeckButton>
              <DeckButton icon="mdi:refresh" onClick={study.startDrill}>
                Restart
              </DeckButton>
            </Stack>
          )
        }
        right={
          <>
            {learnMode && (
              <DeckButton active icon="mdi:target" onClick={study.startDrill}>
                Drill
              </DeckButton>
            )}
            <ToolbarButton
              tooltip="Open in Analysis"
              icon="mdi:chart-line"
              iconHeight={20}
              onClick={analyze}
            />
          </>
        }
      />
    ),
    sheet: (
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        {(learnMode ? steps : playedSteps).length > 0 && (
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ fontWeight: 700, letterSpacing: "0.08em" }}
            >
              Moves
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.5}>
              {(learnMode ? steps : playedSteps).map((step) => (
                <Chip
                  key={step.ply}
                  size="small"
                  label={step.color === "w" ? moveLabel(step) : step.san}
                  clickable={canStep}
                  color={
                    canStep && step.ply + 1 === ply ? "primary" : "default"
                  }
                  variant={
                    learnMode
                      ? step.ply < ply
                        ? "filled"
                        : "outlined"
                      : step.color === line.side
                        ? "filled"
                        : "outlined"
                  }
                  onClick={canStep ? () => study.goTo(step.ply + 1) : undefined}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Typography variant="body2" color="text.secondary">
          {line.summary}
        </Typography>

        <Box>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ fontWeight: 700, letterSpacing: "0.08em" }}
          >
            Key plans
          </Typography>
          <Stack component="ul" spacing={0.6} sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
            {line.plans.map((plan) => (
              <Typography key={plan} component="li" variant="body2">
                {plan}
              </Typography>
            ))}
          </Stack>
        </Box>
      </Stack>
    ),
  };

  return (
    <BoardWorkspace
      inspectorMinWidth={SIDE_PANEL_WIDTH}
      inspectorLabel="Opening study controls"
      vertical={verticalSlots}
      board={
        <Board
          id="OpeningBoard"
          hidePlayersInVertical
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
        <OpeningStudyInspector
          line={line}
          study={study}
          onSelect={onSelect}
          next={next}
        />
      }
    />
  );
}

function OpeningStudyInspector({
  line,
  study,
  onSelect,
  next,
}: {
  line: OpeningLine;
  study: OpeningStudy;
  onSelect: (id?: string) => void;
  next: OpeningLine;
}) {
  const router = useRouter();
  const { steps, ply, drillPly, phase } = study;
  const learnMode = study.mode === "learn";
  const isDone = phase === "done";
  const canStep = learnMode || isDone;
  const mine = steps.filter((step) => step.color === line.side);
  const done = mine.filter((step) => step.ply < drillPly).length;
  const playedSteps = steps.slice(0, drillPly);

  const analyze = () => {
    setHandoff(
      { kind: "pgn", pgn: lineToPgn(line, steps), source: "Openings" },
      "/analysis"
    );
    void router.push("/analysis");
  };

  return (
    <InspectorShell>
      {/* Zone 1 — Slim Context Header */}
      <InspectorHeader
        left={
          <>
            <ToolbarButton
              tooltip="All openings"
              icon="mdi:arrow-left"
              iconHeight={18}
              onClick={() => onSelect()}
            />
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {line.name}
            </Typography>
            <InspectorPill label={line.eco} />
            {study.alreadyLearned && (
              <InspectorPill
                tone="success"
                icon="mdi:check-circle"
                label="Learned"
              />
            )}
          </>
        }
        right={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={study.mode}
            onChange={(_, value: OpeningMode | null) => {
              if (value === "learn") study.startLearn();
              if (value === "drill") study.startDrill();
            }}
            sx={{
              "& .MuiToggleButton-root": {
                py: 0.25,
                px: 0.9,
                minHeight: 26,
                fontSize: "0.74rem",
              },
            }}
          >
            <ToggleButton value="learn">Learn</ToggleButton>
            <ToggleButton value="drill">Drill</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      {/* Zone 2 — Flexing Body */}
      <InspectorBody sx={{ p: 1.5 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" gap={0.65} flexWrap="wrap">
            <InspectorPill
              label={`You play ${line.side === "w" ? "White" : "Black"}`}
            />
            {!learnMode && (
              <>
                <InspectorPill
                  label={`Move ${Math.min(done + 1, mine.length)}/${mine.length}`}
                />
                <InspectorPill
                  tone={study.mistakes ? "warning" : "neutral"}
                  label={`${study.mistakes} mistake${study.mistakes === 1 ? "" : "s"}`}
                />
                <InspectorPill
                  label={`${study.hints} hint${study.hints === 1 ? "" : "s"}`}
                />
              </>
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {line.summary}
          </Typography>

          {!learnMode &&
            (isDone ? (
              <Alert
                severity={study.learned ? "success" : "info"}
                sx={{ py: 0.5 }}
              >
                <Stack spacing={0.25}>
                  <Typography variant="body2" fontWeight={600}>
                    {study.learned
                      ? "Clean drill — opening marked as learned!"
                      : `Finished with ${study.mistakes} mistake${study.mistakes === 1 ? "" : "s"} and ${study.hints} hint${study.hints === 1 ? "" : "s"}.`}
                  </Typography>
                  {!study.learned && (
                    <Typography variant="caption">
                      Complete a drill with zero mistakes and zero hints to mark
                      it learned.
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
                    height={19}
                  />
                }
                sx={{ py: 0.4 }}
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
            ))}

          {(learnMode ? steps : playedSteps).length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {(learnMode ? steps : playedSteps).map((step) => (
                <Chip
                  key={step.ply}
                  size="small"
                  label={step.color === "w" ? moveLabel(step) : step.san}
                  clickable={canStep}
                  color={
                    canStep && step.ply + 1 === ply ? "primary" : "default"
                  }
                  variant={
                    learnMode
                      ? step.ply < ply
                        ? "filled"
                        : "outlined"
                      : step.color === line.side
                        ? "filled"
                        : "outlined"
                  }
                  onClick={canStep ? () => study.goTo(step.ply + 1) : undefined}
                />
              ))}
            </Stack>
          )}

          {(learnMode || (isDone && study.currentNote)) && (
            <Box
              sx={{
                p: 1.25,
                minHeight: 68,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
                bgcolor: "action.hover",
              }}
            >
              <Typography variant="body2">
                {study.currentNote ??
                  (ply === 0
                    ? "Step forward or click a move to see the idea behind each move."
                    : "Book move in this line.")}
              </Typography>
            </Box>
          )}

          {learnMode && (
            <Box>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ fontWeight: 700, letterSpacing: "0.08em" }}
              >
                Key plans
              </Typography>
              <Stack
                component="ul"
                spacing={0.6}
                sx={{ m: 0, mt: 0.5, pl: 2.25 }}
              >
                {line.plans.map((plan) => (
                  <Typography key={plan} component="li" variant="body2">
                    {plan}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </InspectorBody>

      {/* Zone 3 — Unified Docked Bottom Control Deck */}
      <InspectorDeck>
        {canStep && (
          <InspectorDeckRow sx={{ py: 0.45, minHeight: 38 }}>
            <Stack
              data-board-shortcuts
              direction="row"
              alignItems="center"
              gap={0.15}
            >
              <ToolbarButton
                tooltip="Start (Home)"
                icon="mdi:skip-previous"
                iconHeight={20}
                disabled={ply <= 0}
                onClick={() => study.goTo(0)}
              />
              <ToolbarButton
                tooltip="Previous move (←)"
                icon="mdi:chevron-left"
                iconHeight={22}
                disabled={ply <= 0}
                onClick={() => study.goTo(ply - 1)}
              />
              {learnMode && (
                <ToolbarButton
                  tooltip={study.playing ? "Pause" : "Auto-play"}
                  icon={study.playing ? "mdi:pause" : "mdi:play"}
                  iconHeight={20}
                  active={study.playing ? true : undefined}
                  onClick={study.togglePlaying}
                />
              )}
              <ToolbarButton
                tooltip="Next move (→)"
                icon="mdi:chevron-right"
                iconHeight={22}
                disabled={ply >= steps.length}
                onClick={() => study.goTo(ply + 1)}
              />
              <ToolbarButton
                tooltip="End (End)"
                icon="mdi:skip-next"
                iconHeight={20}
                disabled={ply >= steps.length}
                onClick={() => study.goTo(steps.length)}
              />
            </Stack>
          </InspectorDeckRow>
        )}

        <InspectorDeckRow dividerTop={canStep}>
          <Stack
            direction="row"
            alignItems="center"
            gap={0.45}
            flexWrap="nowrap"
            sx={{ flexShrink: 0 }}
          >
            {learnMode ? (
              <DeckButton active icon="mdi:target" onClick={study.startDrill}>
                Start drill
              </DeckButton>
            ) : (
              <>
                {!isDone && (
                  <Tooltip title="Using a hint won't count as a clean drill">
                    <span>
                      <DeckButton
                        icon="mdi:lightbulb-on-outline"
                        disabled={phase !== "playing" || !!study.hintUci}
                        onClick={study.askHint}
                      >
                        Hint
                      </DeckButton>
                    </span>
                  </Tooltip>
                )}
                {isDone && (
                  <DeckButton
                    active={study.learned}
                    icon="mdi:skip-next"
                    onClick={() => onSelect(next.id)}
                  >
                    Next: {next.name}
                  </DeckButton>
                )}
                <DeckButton
                  active={isDone && !study.learned}
                  icon="mdi:refresh"
                  onClick={study.startDrill}
                >
                  {isDone ? "Drill again" : "Restart"}
                </DeckButton>
              </>
            )}
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            gap={0.25}
            sx={{ ml: "auto", flexShrink: 0 }}
          >
            <DeckButton subtle icon="mdi:chart-line" onClick={analyze}>
              Analyze
            </DeckButton>
          </Stack>
        </InspectorDeckRow>
      </InspectorDeck>
    </InspectorShell>
  );
}
