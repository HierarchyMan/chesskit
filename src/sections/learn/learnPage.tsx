import { moveStoryAtom } from "@/lib/moveStoryState";
import { classificationName } from "@/lib/classificationLabels";
import Panel from "@/components/panel";
import { CLASSIFICATION_COLORS } from "@/constants";
import { OPENING_LINES } from "@/data/openingLines";
import { ENDGAMES } from "@/lib/endgames";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { MistakeEntry } from "@/lib/mistakes";
import { useMistakes } from "@/hooks/useMistakes";
import { statsAtom } from "@/lib/stats";
import { buildMoveStory } from "@/lib/visualize/moveStory";
import { MoveClassification } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Grid2 as Grid,
  LinearProgress,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import { useAtomValue, useSetAtom } from "jotai";
import NextLink from "next/link";
import { useMemo } from "react";

const DARK_INK_CLASSIFICATIONS = new Set<MoveClassification>([
  MoveClassification.Inaccuracy,
  MoveClassification.Mistake,
  MoveClassification.Opening,
  MoveClassification.Forced,
  MoveClassification.Splendid,
]);

const CHECKLIST = [
  "What did my opponent's last move change? Look for new threats.",
  "Are any of my pieces unprotected or attacked?",
  "Can I give a check, make a capture, or create a threat?",
  "Before I move: what is the most forcing reply my opponent has?",
];

export default function LearnPage() {
  const { games } = useGameDatabase(true);
  const stats = useAtomValue(statsAtom);
  const setStory = useSetAtom(moveStoryAtom);

  const analyzedGames = useMemo(
    () => games.filter((game) => game.eval),
    [games]
  );
  const {
    entries: mistakes,
    loading: mistakesLoading,
    error: mistakesError,
  } = useMistakes(games, true, 12);

  const openingsLearned = OPENING_LINES.filter(({ id }) =>
    stats.openings.learned.includes(id)
  ).length;
  const endgamesCompleted = ENDGAMES.filter(({ id }) =>
    stats.endgames.completed.includes(id)
  ).length;

  const modes = [
    {
      id: "play",
      title: "Play with a coach",
      text: "A guided game where every move is reviewed, with Visualize and Try again for misses.",
      href: "/play",
      icon: "mdi:school-outline",
      accent: "#22ac38",
      badge:
        stats.games.played > 0
          ? `${stats.games.played} game${stats.games.played === 1 ? "" : "s"}`
          : undefined,
    },
    {
      id: "puzzles",
      title: "Practice your mistakes",
      text: "Replay the positions where you went wrong and find the stronger move.",
      href: "/puzzles?mode=mistakes",
      icon: "mdi:target",
      accent: "#df5353",
      badge: mistakes.length > 0 ? `${mistakes.length} ready` : undefined,
    },
    {
      id: "tactics",
      title: "Tactics",
      href: "/puzzles",
      text: "Fresh puzzles to sharpen your tactical vision.",
      icon: "mdi:puzzle-outline",
      accent: "#a06bd6",
      badge:
        stats.puzzles.solved + stats.puzzles.failed > 0
          ? `${stats.puzzles.rating} · ${stats.puzzles.streak} streak`
          : `Rating ${stats.puzzles.rating}`,
    },
    {
      id: "openings",
      title: "Openings",
      href: "/openings",
      text: "Learn the main lines and the plans behind them.",
      icon: "mdi:book-open-page-variant-outline",
      accent: "#dbac86",
      badge: `${openingsLearned}/${OPENING_LINES.length} learned`,
    },
    {
      id: "endgames",
      title: "Endgames",
      href: "/endgames",
      text: "Practice key winning and drawing endings against the engine.",
      icon: "mdi:chess-king",
      accent: "#19d4af",
      badge: `${endgamesCompleted}/${ENDGAMES.length} done`,
    },
    {
      id: "vision",
      title: "Board vision",
      href: "/vision",
      text: "Train coordinates, square colors, and knight routes.",
      icon: "mdi:eye-outline",
      accent: "#f2be1f",
      badge:
        stats.vision.bestScore > 0
          ? `Best ${stats.vision.bestScore}`
          : undefined,
    },
  ];

  const visualize = (mistake: MistakeEntry) =>
    setStory({
      open: true,
      classification: mistake.classification,
      story: buildMoveStory({
        fenBefore: mistake.fenBefore,
        playedUci: mistake.playedUci,
        beforeLines: mistake.beforeLines,
        afterLines: mistake.afterLines,
      }),
    });

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100, mx: "auto", py: 1 }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Learn
        </Typography>
        <Typography color="text.secondary">
          Pick a way to practice. Whenever a move isn&apos;t the best, choose{" "}
          <b>Visualize</b> to see what it leads to.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {modes.map((mode) => (
          <Grid key={mode.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                borderRadius: "12px",
                borderColor: "divider",
                transition: "transform 0.15s, border-color 0.15s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: alpha(mode.accent, 0.7),
                },
              }}
            >
              <CardActionArea
                component={NextLink}
                href={mode.href}
                sx={{ p: 2, height: "100%" }}
              >
                <Stack direction="row" gap={1.75} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "10px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: alpha(mode.accent, 0.15),
                      color: mode.accent,
                    }}
                  >
                    <Icon icon={mode.icon} height={24} />
                  </Box>
                  <Stack spacing={0.5} minWidth={0} flex={1}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={0.75}
                      flexWrap="wrap"
                    >
                      <Typography fontWeight={600}>{mode.title}</Typography>
                      {mode.badge && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={mode.badge}
                          sx={{
                            height: 22,
                            fontSize: "0.72rem",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {mode.text}
                    </Typography>
                  </Stack>
                </Stack>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 7 }}>
          <Panel
            sx={{ borderRadius: "12px" }}
            title="Your biggest mistakes"
            actions={
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                from {analyzedGames.length} analyzed game
                {analyzedGames.length === 1 ? "" : "s"}
              </Typography>
            }
          >
            {mistakesLoading ? (
              <Stack spacing={1} role="status">
                <Typography variant="body2" color="text.secondary">
                  Loading mistakes…
                </Typography>
                <LinearProgress />
              </Stack>
            ) : mistakesError ? (
              <Alert severity="error">{mistakesError}</Alert>
            ) : mistakes.length === 0 ? (
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography variant="body2" color="text.secondary">
                  Play a game against a bot or import a PGN, analyze it, and the
                  moves that cost you the most will appear here so you can
                  visualize and practice them.
                </Typography>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Button
                    component={NextLink}
                    href="/play"
                    variant="contained"
                    size="small"
                  >
                    Play a game
                  </Button>
                  <Button
                    component={NextLink}
                    href="/analysis"
                    variant="outlined"
                    size="small"
                  >
                    Analyze a game
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Stack
                divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}
              >
                {mistakes.map((mistake) => {
                  const darkInk = DARK_INK_CLASSIFICATIONS.has(
                    mistake.classification
                  );
                  return (
                    <Stack
                      key={`${mistake.gameId}-${mistake.ply}`}
                      direction={{ xs: "column", sm: "row" }}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      justifyContent="space-between"
                      gap={1}
                      py={1.25}
                    >
                      <Box minWidth={0} width={{ xs: "100%", sm: "auto" }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          gap={1}
                          flexWrap="wrap"
                        >
                          <Typography
                            fontWeight={600}
                            noWrap
                            sx={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {mistake.moveNumber}
                            {mistake.color === "w" ? "." : "..."} {mistake.san}
                          </Typography>
                          <Chip
                            size="small"
                            label={classificationName(mistake.classification)}
                            sx={{
                              fontWeight: 600,
                              color: darkInk ? "#111" : "#fff",
                              backgroundColor:
                                CLASSIFICATION_COLORS[mistake.classification],
                            }}
                          />
                        </Stack>
                        <Typography
                          variant="body2"
                          noWrap
                          color="text.secondary"
                          sx={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {mistake.gameLabel} · cost{" "}
                          {Math.round(mistake.lostPercentage)}% win chance
                        </Typography>
                      </Box>
                      <Stack direction="row" gap={0.75} flexShrink={0}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={
                            <Icon icon="mdi:eye-outline" height={16} />
                          }
                          onClick={() => visualize(mistake)}
                        >
                          Visualize
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          component={NextLink}
                          href={`/puzzles?mode=mistakes&focus=${mistake.gameId}-${mistake.ply}`}
                        >
                          Practice
                        </Button>
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Panel
            sx={{ borderRadius: "12px" }}
            title="The blunder-check routine"
          >
            <Stack spacing={1.25}>
              {CHECKLIST.map((item, index) => (
                <Stack
                  key={item}
                  direction="row"
                  gap={1.25}
                  alignItems="flex-start"
                >
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      flexShrink: 0,
                      borderRadius: "50%",
                      border: 1,
                      borderColor: "primary.main",
                      color: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="body2">{item}</Typography>
                </Stack>
              ))}
              <Typography variant="caption" color="text.secondary">
                Running through these four checks before each move prevents most
                blunders at every level.
              </Typography>
            </Stack>
          </Panel>
        </Grid>
      </Grid>
    </Stack>
  );
}
