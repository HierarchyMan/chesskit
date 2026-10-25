import { moveStoryAtom } from "@/lib/moveStoryState";
import { classificationName } from "@/lib/classificationLabels";
import Panel from "@/components/panel";
import { CLASSIFICATION_COLORS } from "@/constants";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { MistakeEntry } from "@/lib/mistakes";
import { useMistakes } from "@/hooks/useMistakes";
import { buildMoveStory } from "@/lib/visualize/moveStory";
import { NAV_ITEMS } from "@/sections/layout/navItems";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Grid2 as Grid,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import { useSetAtom } from "jotai";
import NextLink from "next/link";
import { useMemo } from "react";

const MODES = [
  {
    id: "play",
    title: "Play with a coach",
    text: "A casual game where every move of yours is rated, with Visualize and Try again for the weak ones.",
    href: "/play",
    icon: "mdi:school-outline",
    accent: "#22ac38",
  },
  {
    id: "puzzles",
    title: "Practice your mistakes",
    text: "Replay the positions where you went wrong and find the better move.",
    href: "/puzzles?mode=mistakes",
    icon: "mdi:target",
    accent: "#df5353",
  },
  {
    id: "tactics",
    title: "Tactics",
    href: "/puzzles",
    text: "Fresh puzzles to sharpen your eye.",
    icon: "mdi:puzzle-outline",
    accent: "#a06bd6",
  },
  {
    id: "openings",
    title: "Openings",
    href: "/openings",
    text: "Learn the main lines and why they work.",
    icon: "mdi:book-open-page-variant-outline",
    accent: "#dbac86",
  },
  {
    id: "endgames",
    title: "Endgames",
    href: "/endgames",
    text: "Practise the key endings against the engine.",
    icon: "mdi:chess-king",
    accent: "#19d4af",
  },
  {
    id: "vision",
    title: "Board vision",
    href: "/vision",
    text: "Learn the squares and knight routes.",
    icon: "mdi:eye-outline",
    accent: "#f2be1f",
  },
];

const CHECKLIST = [
  "What did my opponent's last move change? Look for new threats.",
  "Are any of my pieces unprotected or attacked?",
  "Can I give a check, make a capture or create a threat?",
  "Before I move: what is the most forcing reply my opponent has?",
];

export default function LearnPage() {
  const { games } = useGameDatabase(true);
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
        <Typography sx={{ opacity: 0.75 }}>
          Pick a way to practise. Whenever a move isn&apos;t the best, press
          <b> Visualize</b> to watch what it leads to.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {MODES.map((mode) => (
          <Grid key={mode.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              variant="outlined"
              sx={{ height: "100%", borderColor: alpha(mode.accent, 0.45) }}
            >
              <CardActionArea
                component={NextLink}
                href={mode.href}
                sx={{ p: 2, height: "100%" }}
              >
                <Stack direction="row" gap={2}>
                  <Box
                    sx={{
                      width: 46,
                      height: 46,
                      borderRadius: 2.5,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: alpha(mode.accent, 0.16),
                      color: mode.accent,
                    }}
                  >
                    <Icon icon={mode.icon} height={26} />
                  </Box>
                  <Box>
                    <Typography fontWeight={600}>{mode.title}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.75 }}>
                      {mode.text}
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Panel
            title="Your biggest mistakes"
            actions={
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                from {analyzedGames.length} analyzed game
                {analyzedGames.length === 1 ? "" : "s"}
              </Typography>
            }
          >
            {mistakesLoading || mistakesError ? (
              <Typography role="status">
                {mistakesError || "Loading mistakes…"}
              </Typography>
            ) : mistakes.length === 0 ? (
              <Stack spacing={1.5} alignItems="flex-start">
                <Typography sx={{ opacity: 0.8 }}>
                  Play a game against a bot or import a PGN, analyze it, and the
                  moves that cost you the most will show up here. Then you can
                  visualize each one and practise the better move.
                </Typography>
                <Stack direction="row" gap={1}>
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
                {mistakes.map((mistake) => (
                  <Stack
                    key={`${mistake.gameId}-${mistake.ply}`}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    py={1}
                  >
                    <Box minWidth={0}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Typography fontWeight={600} noWrap>
                          {mistake.moveNumber}
                          {mistake.color === "w" ? "." : "..."} {mistake.san}
                        </Typography>
                        <Chip
                          size="small"
                          label={classificationName(mistake.classification)}
                          sx={{
                            textTransform: "capitalize",
                            color: "#fff",
                            backgroundColor:
                              CLASSIFICATION_COLORS[mistake.classification],
                          }}
                        />
                      </Stack>
                      <Typography variant="body2" noWrap sx={{ opacity: 0.7 }}>
                        {mistake.gameLabel} · cost{" "}
                        {Math.round(mistake.lostPercentage)}% win chance
                      </Typography>
                    </Box>
                    <Stack direction="row" gap={0.75} flexShrink={0}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Icon icon="mdi:eye-outline" height={16} />}
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
                ))}
              </Stack>
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Panel title="The blunder-check routine">
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
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Doing these four checks before each move prevents most blunders,
                at every level.
              </Typography>
            </Stack>
          </Panel>
        </Grid>
      </Grid>

      <Typography variant="caption" sx={{ opacity: 0.55 }}>
        {NAV_ITEMS.length} tools available from the menu on the left.
      </Typography>
    </Stack>
  );
}
