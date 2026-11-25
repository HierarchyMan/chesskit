import MiniBoard from "@/components/board/miniBoard";
import {
  BOARD_THEMES,
  BoardThemeName,
  autoQueenAtom,
  boardHueAtom,
  boardThemeAtom,
  pieceMotionAtom,
  pieceSetAtom,
  showCoordinatesAtom,
  soundEnabledAtom,
} from "@/components/board/states";
import { playPremovesAtom } from "@/sections/play/states";
import { PIECE_MOTION_CHOICES, PieceMotion } from "@/lib/pieceMotion";
import { puzzleShowSetupAtom } from "@/sections/puzzles/states";
import { PIECE_SETS } from "@/constants";
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Slider as MuiSlider,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  settingsOpenAtom,
  settingsTabAtom,
  SettingsTab,
} from "../layout/states";
import ModelsTab from "./modelsTab";
import ArrowsTab from "./arrowsTab";
import EngineTab from "./engineTab";

const PREVIEW_FEN =
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

const formatPieceSet = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");

export default function SettingsDialog() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [tab, setTab] = useAtom(settingsTabAtom);
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTab>>(
    () => new Set([tab])
  );

  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set([...prev, tab])));
  }, [tab]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      fullScreen={isSmall}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1, pr: 2 }}
      >
        <Icon icon="mdi:cog-outline" height={22} />
        <Box sx={{ flexGrow: 1 }}>Settings</Box>
        <IconButton
          onClick={() => setOpen(false)}
          aria-label="Close"
          edge="end"
          size="small"
        >
          <Icon icon="mdi:close" height={20} />
        </IconButton>
      </DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, value: SettingsTab) => setTab(value)}
        variant="fullWidth"
        sx={{ px: 1, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}
      >
        <Tab
          value="board"
          label="Board"
          icon={<Icon icon="mdi:chess-pawn" height={18} />}
          iconPosition="start"
          sx={{ minHeight: 46 }}
        />
        <Tab
          value="arrows"
          label="Arrows"
          icon={<Icon icon="mdi:arrow-top-right" height={18} />}
          iconPosition="start"
          sx={{ minHeight: 46 }}
        />
        <Tab
          value="engine"
          label="Engine"
          icon={<Icon icon="mdi:chip" height={18} />}
          iconPosition="start"
          sx={{ minHeight: 46 }}
        />
        <Tab
          value="models"
          label="Models"
          icon={<Icon icon="mdi:database-outline" height={18} />}
          iconPosition="start"
          sx={{ minHeight: 46 }}
        />
      </Tabs>
      <DialogContent
        dividers
        sx={{
          pt: 2.5,
          minHeight: { xs: 0, sm: 380 },
          maxHeight: { xs: "none", sm: "72vh" },
        }}
      >
        {/* Keep visited tabs mounted so switching tabs never loses expanded sections or scroll */}
        {visitedTabs.has("board") && (
          <Box sx={{ display: tab === "board" ? "block" : "none" }}>
            <BoardTab />
          </Box>
        )}
        {visitedTabs.has("arrows") && (
          <Box sx={{ display: tab === "arrows" ? "block" : "none" }}>
            <ArrowsTab />
          </Box>
        )}
        {visitedTabs.has("engine") && (
          <Box sx={{ display: tab === "engine" ? "block" : "none" }}>
            <EngineTab />
          </Box>
        )}
        {visitedTabs.has("models") && (
          <Box sx={{ display: tab === "models" ? "block" : "none" }}>
            <ModelsTab />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button variant="contained" onClick={() => setOpen(false)}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BoardTab() {
  const [pieceSet, setPieceSet] = useAtom(pieceSetAtom);
  const [boardTheme, setBoardTheme] = useAtom(boardThemeAtom);
  const [hue, setHue] = useAtom(boardHueAtom);
  const [coordinates, setCoordinates] = useAtom(showCoordinatesAtom);
  const [sound, setSound] = useAtom(soundEnabledAtom);
  const [autoQueen, setAutoQueen] = useAtom(autoQueenAtom);
  const [premoves, setPremoves] = useAtom(playPremovesAtom);
  const [motion, setMotion] = useAtom(pieceMotionAtom);
  const [puzzleSetup, setPuzzleSetup] = useAtom(puzzleShowSetupAtom);
  const isDark = useTheme().palette.mode === "dark";

  return (
    <Grid container spacing={3} alignItems="flex-start">
      <Grid size={{ xs: 12, sm: 5 }} display="flex" justifyContent="center">
        <MiniBoard fen={PREVIEW_FEN} size={210} animationDuration={0} />
      </Grid>

      <Grid size={{ xs: 12, sm: 7 }}>
        <Stack spacing={2.5}>
          <Stack spacing={2}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.2 }}
            >
              Board &amp; Pieces
            </Typography>

            <Box>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Board colors
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {(Object.keys(BOARD_THEMES) as BoardThemeName[]).map((name) => {
                  const theme = BOARD_THEMES[name];
                  const active = boardTheme === name;
                  return (
                    <ButtonBase
                      key={name}
                      title={theme.label}
                      aria-label={`${theme.label} board`}
                      aria-pressed={active}
                      onClick={() => setBoardTheme(name)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        overflow: "hidden",
                        outline: active ? "2.5px solid" : "1px solid",
                        outlineColor: active ? "primary.main" : "divider",
                        outlineOffset: active ? 1 : 0,
                        background: `conic-gradient(${theme.dark} 25%, ${theme.light} 0 50%, ${theme.dark} 0 75%, ${theme.light} 0)`,
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>

            <FormControl fullWidth size="small">
              <InputLabel id="settings-piece-label">Piece set</InputLabel>
              <Select
                labelId="settings-piece-label"
                input={<OutlinedInput label="Piece set" />}
                value={pieceSet}
                onChange={(event) =>
                  setPieceSet(event.target.value as (typeof PIECE_SETS)[number])
                }
              >
                {PIECE_SETS.map((name) => (
                  <MenuItem key={name} value={name}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Image
                        loading="lazy"
                        src={`/piece/${name}/${isDark ? "w" : "b"}N.svg`}
                        alt={`${formatPieceSet(name)} knight`}
                        width={22}
                        height={22}
                      />
                      {formatPieceSet(name)}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="settings-motion-label">
                Piece animation
              </InputLabel>
              <Select
                labelId="settings-motion-label"
                input={<OutlinedInput label="Piece animation" />}
                value={motion}
                onChange={(event) =>
                  setMotion(event.target.value as PieceMotion)
                }
              >
                {PIECE_MOTION_CHOICES.map(({ id, label }) => (
                  <MenuItem key={id} value={id}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                mb={0.25}
              >
                <Typography variant="body2" fontWeight={500}>
                  Board hue
                </Typography>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: "action.selected",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {hue}°
                  </Typography>
                  <Button
                    size="small"
                    color="inherit"
                    disabled={hue === 0}
                    onClick={() => setHue(0)}
                    sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: "0.75rem" }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>
              <MuiSlider
                size="small"
                value={hue}
                min={0}
                max={360}
                aria-label="Board hue"
                onChange={(_, next) => setHue(next as number)}
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={coordinates}
                  onChange={(_, value) => setCoordinates(value)}
                />
              }
              label={<Typography variant="body2">Show coordinates</Typography>}
            />
          </Stack>

          <Divider />

          <Stack spacing={0.75}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.2 }}
            >
              Gameplay &amp; Audio
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={sound}
                  onChange={(_, value) => setSound(value)}
                />
              }
              label={<Typography variant="body2">Move sounds</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoQueen}
                  onChange={(_, value) => setAutoQueen(value)}
                />
              }
              label={
                <Typography variant="body2">Auto-promote to queen</Typography>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={premoves}
                  onChange={(_, value) => setPremoves(value)}
                />
              }
              label={
                <Typography variant="body2">Allow premoves in Play</Typography>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={puzzleSetup}
                  onChange={(_, value) => setPuzzleSetup(value)}
                />
              }
              label={
                <Typography variant="body2">
                  Puzzles: show opponent&apos;s setup move
                </Typography>
              }
            />
          </Stack>
        </Stack>
      </Grid>
    </Grid>
  );
}
