import { engineLabel } from "@/constants";
import { useRecentGames } from "@/hooks/useGameDatabase";
import { OPENING_LINES } from "@/data/openingLines";
import { ENDGAMES } from "@/lib/endgames";
import { useModels } from "@/hooks/useModels";
import { statsAtom } from "@/lib/stats";
import { engineNameAtom } from "@/sections/analysis/states";
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
import { ReactNode, useEffect } from "react";
import { NAV_GROUPS, NAV_ITEMS, NavItem } from "../layout/navItems";
import {
  importDialogAtom,
  settingsOpenAtom,
  settingsTabAtom,
} from "../layout/states";

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
}[] = [
  {
    id: "play",
    title: "Play a bot",
    subtitle: "Any strength, from beginner to Reckless",
    href: "/play",
  },
  {
    id: "analysis",
    title: "Analyze a game",
    subtitle: "Paste a PGN or load from Lichess",
    href: "/analysis",
  },
  {
    id: "puzzles",
    title: "Solve puzzles",
    subtitle: "Sharpen your tactics",
    href: "/puzzles",
  },
  {
    id: "learn",
    title: "Learn with a coach",
    subtitle: "See why moves work",
    href: "/learn",
  },
];

export default function Hub() {
  const router = useRouter();
  const setImportDialog = useSetAtom(importDialogAtom);

  useEffect(() => {
    const { gameId, lichessGameId } = router.query;
    if (gameId || lichessGameId) {
      router.replace({ pathname: "/analysis", query: router.query });
    }
  }, [router]);

  const quickItems = QUICK_ACTIONS.map((action) => ({
    ...action,
    item: NAV_ITEMS.find((item) => item.id === action.id) as NavItem,
  }));

  return (
    <Stack spacing={3} sx={{ maxWidth: 1180, mx: "auto", py: 1 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        gap={1}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <span suppressHydrationWarning>{greeting()}</span>
          </Typography>
          <Typography sx={{ opacity: 0.75 }}>
            What would you like to work on today?
          </Typography>
        </Box>
        <EngineStatus />
      </Stack>

      <Card
        variant="outlined"
        sx={{
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: "primary.main",
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
        }}
      >
        <CardActionArea
          onClick={() => setImportDialog({ open: true })}
          sx={{ p: { xs: 2, sm: 3 } }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems="center"
            gap={2.5}
            textAlign={{ xs: "center", sm: "left" }}
          >
            <Icon
              icon="mdi:clipboard-plus-outline"
              height={52}
              color="#3B9AC6"
            />
            <Box flexGrow={1}>
              <Typography variant="h6" fontWeight={600}>
                Paste or drop anything chess
              </Typography>
              <Typography sx={{ opacity: 0.8 }}>
                A PGN, a FEN, a Lichess link, a PGN file or a screenshot of a
                board. You can also press Ctrl+V on any page.
              </Typography>
            </Box>
            <Button variant="contained" component="span" size="large">
              Import
            </Button>
          </Stack>
        </CardActionArea>
      </Card>

      <Grid container spacing={2}>
        {quickItems.map(({ id, title, subtitle, href, item }) => (
          <Grid key={id} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              variant="outlined"
              sx={{ height: "100%", borderColor: alpha(item.accent, 0.5) }}
            >
              <CardActionArea
                component={NextLink}
                prefetch={false}
                href={href}
                sx={{ p: 2, height: "100%" }}
              >
                <Stack gap={1.5}>
                  <IconBadge icon={item.icon} accent={item.accent} />
                  <Box>
                    <Typography fontWeight={600} fontSize="1.1rem">
                      {title}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.75 }}>
                      {subtitle}
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
          <RecentGames />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Progress />
        </Grid>
      </Grid>

      {NAV_GROUPS.map((group) => (
        <Box key={group}>
          <Typography
            variant="overline"
            sx={{ opacity: 0.7, letterSpacing: "0.1em" }}
          >
            {group}
          </Typography>
          <Grid container spacing={2} mt={0}>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
              <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <FeatureCard item={item} />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Stack>
  );
}

function IconBadge({ icon, accent }: { icon: string; accent: string }) {
  return (
    <Box
      sx={{
        width: 46,
        height: 46,
        borderRadius: 2.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: alpha(accent, 0.16),
        color: accent,
        flexShrink: 0,
      }}
    >
      <Icon icon={icon} height={26} />
    </Box>
  );
}

function FeatureCard({ item }: { item: NavItem }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        transition: "transform 0.15s, border-color 0.15s",
        "&:hover": { transform: "translateY(-2px)", borderColor: item.accent },
      }}
    >
      <CardActionArea
        component={NextLink}
        prefetch={false}
        href={item.href}
        sx={{ p: 2, height: "100%" }}
      >
        <Stack direction="row" gap={2} alignItems="flex-start">
          <IconBadge icon={item.icon} accent={item.accent} />
          <Box>
            <Typography fontWeight={600}>{item.label}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              {item.description}
            </Typography>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%", p: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={1.5}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon icon={icon} height={22} />
          <Typography fontWeight={600}>{title}</Typography>
        </Stack>
        {action}
      </Stack>
      {children}
    </Card>
  );
}

function RecentGames() {
  const recent = useRecentGames();
  const router = useRouter();

  return (
    <Panel
      title="Recent games"
      icon="mdi:history"
      action={
        <Button
          size="small"
          component={NextLink}
          prefetch={false}
          href="/database"
        >
          All games
        </Button>
      }
    >
      {recent.length === 0 ? (
        <Typography sx={{ opacity: 0.75 }}>
          No saved games yet. Import a PGN, or play a bot and your games will
          show up here, ready to analyze.
        </Typography>
      ) : (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
          {recent.map((game) => (
            <Stack
              key={game.id}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              py={1}
            >
              <Box minWidth={0}>
                <Typography noWrap fontWeight={500}>
                  {game.white.name} vs {game.black.name}
                </Typography>
                <Typography variant="body2" noWrap sx={{ opacity: 0.7 }}>
                  {[
                    game.result,
                    game.date,
                    game.hasEvaluation ? "analyzed" : undefined,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  router.push({
                    pathname: "/analysis",
                    query: { gameId: game.id },
                  })
                }
              >
                Open
              </Button>
            </Stack>
          ))}
        </Stack>
      )}
    </Panel>
  );
}

function Progress() {
  const stats = useAtomValue(statsAtom);
  const { puzzles, games, openings, endgames, vision } = stats;

  const tiles: { label: string; value: string; icon: string; hint: string }[] =
    [
      {
        label: "Puzzle rating",
        value: String(puzzles.rating),
        icon: "mdi:puzzle-outline",
        hint: `${puzzles.solved} solved · best streak ${puzzles.bestStreak}`,
      },
      {
        label: "Games vs bots",
        value: `${games.won}-${games.drawn}-${games.lost}`,
        icon: "mdi:chess-pawn",
        hint: `${games.played} played (won-drawn-lost)`,
      },
      {
        label: "Openings learned",
        value: `${openings.learned.length}/${OPENING_LINES.length}`,
        icon: "mdi:book-open-page-variant-outline",
        hint: "A clean drill adds one",
      },
      {
        label: "Endgames done",
        value: `${endgames.completed.length}/${ENDGAMES.length}`,
        icon: "mdi:chess-king",
        hint: "Win it or hold the draw",
      },
      {
        label: "Board vision",
        value: String(vision.bestScore),
        icon: "mdi:eye-outline",
        hint: `best round · ${vision.sessions} played`,
      },
      {
        label: "Streak",
        value: String(puzzles.streak),
        icon: "mdi:fire",
        hint: `best puzzle streak ${puzzles.bestStreak}`,
      },
    ];

  return (
    <Panel title="Your progress" icon="mdi:trending-up">
      <Grid container spacing={1.5}>
        {tiles.map((tile) => (
          <Grid key={tile.label} size={6}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                height: "100%",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                gap={0.75}
                sx={{ opacity: 0.75 }}
              >
                <Icon icon={tile.icon} height={16} />
                <Typography variant="caption">{tile.label}</Typography>
              </Stack>
              <Typography variant="h5" fontWeight={700}>
                {tile.value}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {tile.hint}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Panel>
  );
}

function EngineStatus() {
  const engineName = useAtomValue(engineNameAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsTab = useSetAtom(settingsTabAtom);
  const { bridge, refresh } = useModels();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openModels = () => {
    setSettingsTab("models");
    setSettingsOpen(true);
  };

  return (
    <Stack direction="row" gap={1} flexWrap="wrap">
      <Chip
        icon={<Icon icon="mdi:chip" height={18} />}
        label={`Analysis: ${engineLabel(engineName).small}`}
        variant="outlined"
        onClick={() => setSettingsOpen(true)}
      />
      <Chip
        icon={<Icon icon="mdi:lightning-bolt" height={18} />}
        label={
          bridge === "up"
            ? "Reckless: ready"
            : bridge === "down"
              ? "Reckless: bridge off"
              : "Reckless: checking…"
        }
        color={bridge === "up" ? "success" : "default"}
        variant="outlined"
        onClick={openModels}
      />
    </Stack>
  );
}
