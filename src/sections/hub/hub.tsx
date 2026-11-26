import Panel from "@/components/panel";
import { OPENING_LINES } from "@/data/openingLines";
import { useRecentGames } from "@/hooks/useGameDatabase";
import { ENDGAMES } from "@/lib/endgames";
import { statsAtom } from "@/lib/stats";
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
import { useAtomValue, useSetAtom } from "jotai";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { importDialogAtom } from "../layout/states";

const greeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 5) return "Burning the midnight oil?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const QUICK_ACTIONS: {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}[] = [
  {
    id: "play",
    title: "Play vs Bot",
    subtitle: "Any rating, with optional live coach feedback",
    href: "/play",
    icon: "mdi:chess-pawn",
  },
  {
    id: "analysis",
    title: "Analyze Game",
    subtitle: "Deep engine lines, accuracy, and move review",
    href: "/analysis",
    icon: "mdi:chart-line",
  },
  {
    id: "puzzles",
    title: "Tactics Puzzles",
    subtitle: "Rated puzzles, daily tactics, and your mistakes",
    href: "/puzzles",
    icon: "mdi:puzzle-outline",
  },
  {
    id: "learn",
    title: "Training Hub",
    subtitle: "Openings, endgames, board vision, and review",
    href: "/learn",
    icon: "mdi:school-outline",
  },
];

const formatPlayer = (name?: string, rating?: number): string => {
  const label = name?.trim() || "Unknown";
  return rating ? `${label} (${rating})` : label;
};

const formatResult = (result?: string): string => {
  if (!result) return "—";
  if (result === "1/2-1/2") return "½–½";
  return result;
};

const formatTimeControl = (tc?: string): string | undefined => {
  if (!tc || tc === "-" || tc === "?") return undefined;
  const match = tc.match(/^(\d+)(?:\+(\d+))?$/);
  if (!match) return tc;
  const baseSec = Number(match[1]);
  const inc = match[2] ? Number(match[2]) : 0;
  if (baseSec >= 60 && baseSec % 60 === 0) return `${baseSec / 60}+${inc}`;
  return inc ? `${baseSec}s+${inc}` : `${baseSec}s`;
};

export default function Hub() {
  const router = useRouter();
  const setImportDialog = useSetAtom(importDialogAtom);

  useEffect(() => {
    const { gameId, lichessGameId } = router.query;
    if (gameId || lichessGameId) {
      void router.replace({ pathname: "/analysis", query: router.query });
    }
  }, [router]);

  return (
    <Stack spacing={3} sx={{ maxWidth: 1120, mx: "auto", py: 1 }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          <span suppressHydrationWarning>{greeting()}</span>
        </Typography>
        <Typography color="text.secondary">
          Chesskit — play, analyze, and sharpen your game.
        </Typography>
      </Box>

      {/* Compact import strip */}
      <Card
        variant="outlined"
        sx={(theme) => ({
          borderRadius: 1.5,
          borderStyle: "dashed",
          borderColor: alpha(theme.palette.primary.main, 0.5),
          bgcolor: alpha(theme.palette.primary.main, 0.06),
        })}
      >
        <CardActionArea
          onClick={() => setImportDialog({ open: true })}
          sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5 }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            gap={1.5}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "8px",
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon icon="mdi:clipboard-plus-outline" height={20} />
            </Box>
            <Box flexGrow={1} minWidth={0}>
              <Typography variant="subtitle2" fontWeight={600}>
                Import a game, position, or board screenshot
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Drop a file, paste PGN / FEN / Lichess link with Ctrl/⌘+V, or
                click to open Import.
              </Typography>
            </Box>
            <Button
              variant="contained"
              component="span"
              size="small"
              startIcon={<Icon icon="mdi:import" height={16} />}
            >
              Import
            </Button>
          </Stack>
        </CardActionArea>
      </Card>

      {/* 4 Primary Quick Actions */}
      <Grid container spacing={2}>
        {QUICK_ACTIONS.map((action) => (
          <Grid key={action.id} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                borderRadius: 1.5,
                borderColor: "divider",
                transition: "transform 0.15s, border-color 0.15s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: "primary.main",
                },
              }}
            >
              <CardActionArea
                component={NextLink}
                prefetch={false}
                href={action.href}
                sx={{ p: 2, height: "100%" }}
              >
                <Stack spacing={1.25}>
                  <Box
                    sx={(theme) => ({
                      width: 40,
                      height: 40,
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: "primary.main",
                    })}
                  >
                    <Icon icon={action.icon} height={22} />
                  </Box>
                  <Box>
                    <Typography fontWeight={600} fontSize="1rem">
                      {action.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {action.subtitle}
                    </Typography>
                  </Box>
                </Stack>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} alignItems="stretch">
        <Grid size={{ xs: 12, md: 7 }}>
          <RecentGames />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Progress />
        </Grid>
      </Grid>
    </Stack>
  );
}

function RecentGames() {
  const recent = useRecentGames();
  const setImportDialog = useSetAtom(importDialogAtom);

  return (
    <Panel
      sx={{ height: "100%", borderRadius: 1.5 }}
      title={
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon icon="mdi:history" height={20} />
          <Typography fontWeight={600}>Recent games</Typography>
        </Stack>
      }
      actions={
        <Button
          size="small"
          component={NextLink}
          prefetch={false}
          href="/database"
          endIcon={<Icon icon="mdi:chevron-right" height={16} />}
        >
          All games
        </Button>
      }
    >
      {recent.length === 0 ? (
        <Stack spacing={1.5} alignItems="flex-start" py={1}>
          <Typography variant="body2" color="text.secondary">
            No saved games yet. Play a bot or import a PGN and your recent games
            will appear here for instant review.
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              size="small"
              variant="contained"
              component={NextLink}
              href="/play"
              startIcon={<Icon icon="mdi:chess-pawn" height={16} />}
            >
              Play a game
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Icon icon="mdi:import" height={16} />}
              onClick={() => setImportDialog({ open: true })}
            >
              Import game
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
          {recent.map((game) => {
            const tc = formatTimeControl(game.timeControl);
            const meta = [
              game.date && game.date !== "????.??.??" ? game.date : undefined,
              tc,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <CardActionArea
                key={game.id}
                component={NextLink}
                prefetch={false}
                href={`/analysis?gameId=${game.id}`}
                sx={{
                  px: 1,
                  py: 1.25,
                  mx: -1,
                  width: "calc(100% + 16px)",
                  borderRadius: 1,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1.5}
                >
                  <Box minWidth={0} flex={1}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      noWrap
                      sx={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatPlayer(game.white?.name, game.white?.rating)} vs{" "}
                      {formatPlayer(game.black?.name, game.black?.rating)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      display="block"
                      sx={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {meta || "Saved game"}
                    </Typography>
                  </Box>

                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={0.75}
                    flexShrink={0}
                  >
                    {game.hasEvaluation && (
                      <Chip
                        size="small"
                        color="success"
                        variant="outlined"
                        label="Analyzed"
                        sx={{ height: 22, fontSize: "0.72rem" }}
                      />
                    )}
                    <Chip
                      size="small"
                      variant="outlined"
                      label={formatResult(game.result)}
                      sx={{
                        height: 22,
                        minWidth: 46,
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                    <Icon icon="mdi:chevron-right" height={18} />
                  </Stack>
                </Stack>
              </CardActionArea>
            );
          })}
        </Stack>
      )}
    </Panel>
  );
}

function Progress() {
  const stats = useAtomValue(statsAtom);
  const { puzzles, games, openings, endgames, vision } = stats;

  const openingsLearned = OPENING_LINES.filter(({ id }) =>
    openings.learned.includes(id)
  ).length;
  const endgamesDone = ENDGAMES.filter(({ id }) =>
    endgames.completed.includes(id)
  ).length;

  const tiles: {
    label: string;
    value: string;
    icon: string;
    hint: string;
    href: string;
    wide?: boolean;
  }[] = [
    {
      label: "Puzzle rating",
      value: String(puzzles.rating),
      icon: "mdi:puzzle-outline",
      hint: `${puzzles.solved} solved · streak ${puzzles.streak} (best ${puzzles.bestStreak})`,
      href: "/puzzles",
      wide: true,
    },
    {
      label: "Games vs bots",
      value: `${games.won}W · ${games.drawn}D · ${games.lost}L`,
      icon: "mdi:chess-pawn",
      hint: `${games.played} game${games.played === 1 ? "" : "s"} played`,
      href: "/play",
    },
    {
      label: "Openings",
      value: `${openingsLearned}/${OPENING_LINES.length}`,
      icon: "mdi:book-open-page-variant-outline",
      hint: "Lines learned",
      href: "/openings",
    },
    {
      label: "Endgames",
      value: `${endgamesDone}/${ENDGAMES.length}`,
      icon: "mdi:chess-king",
      hint: "Challenges completed",
      href: "/endgames",
    },
    {
      label: "Board vision",
      value: String(vision.bestScore),
      icon: "mdi:eye-outline",
      hint: `Best round · ${vision.sessions} played`,
      href: "/vision",
    },
  ];

  return (
    <Panel
      sx={{ height: "100%", borderRadius: 1.5 }}
      title={
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon icon="mdi:trending-up" height={20} />
          <Typography fontWeight={600}>Your progress</Typography>
        </Stack>
      }
    >
      <Grid container spacing={1.25}>
        {tiles.map((tile) => (
          <Grid key={tile.label} size={{ xs: tile.wide ? 12 : 6 }}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                borderRadius: "10px",
                borderColor: "divider",
                transition: "border-color 0.15s",
                "&:hover": { borderColor: "primary.main" },
              }}
            >
              <CardActionArea
                component={NextLink}
                prefetch={false}
                href={tile.href}
                sx={{ p: 1.5, height: "100%" }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={0.5}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    gap={0.75}
                    color="text.secondary"
                  >
                    <Icon icon={tile.icon} height={16} />
                    <Typography variant="caption">{tile.label}</Typography>
                  </Stack>
                  <Icon icon="mdi:chevron-right" height={14} />
                </Stack>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  mt={0.25}
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {tile.value}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {tile.hint}
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Panel>
  );
}
