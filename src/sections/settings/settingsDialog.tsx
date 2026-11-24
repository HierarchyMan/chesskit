import Slider from "@/components/slider";
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
  FormControl,
  FormControlLabel,
  Grid2 as Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import Image from "next/image";
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

export default function SettingsDialog() {
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [tab, setTab] = useAtom(settingsTabAtom);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle sx={{ pb: 0 }}>Settings</DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, value: SettingsTab) => setTab(value)}
        variant="fullWidth"
        sx={{ px: 1, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          value="engine"
          label="Engine"
          icon={<Icon icon="mdi:chip" height={20} />}
          iconPosition="start"
        />
        <Tab
          value="arrows"
          label="Arrows"
          icon={<Icon icon="mdi:arrow-top-right" height={20} />}
          iconPosition="start"
        />
        <Tab
          value="board"
          label="Board"
          icon={<Icon icon="mdi:chess-pawn" height={20} />}
          iconPosition="start"
        />
        <Tab
          value="models"
          label="Models"
          icon={<Icon icon="mdi:database-outline" height={20} />}
          iconPosition="start"
        />
      </Tabs>
      <DialogContent sx={{ pt: 2.5, height: "min(68vh, 580px)" }}>
        {tab === "engine" && <EngineTab />}
        {tab === "arrows" && <ArrowsTab />}
        {tab === "board" && <BoardTab />}
        {tab === "models" && <ModelsTab />}
      </DialogContent>
      <DialogActions sx={{ m: 1 }}>
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
        <MiniBoard fen={PREVIEW_FEN} size={200} animationDuration={0} />
      </Grid>

      <Grid size={{ xs: 12, sm: 7 }}>
        <Typography variant="subtitle2" gutterBottom>
          Board colours
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
          {(Object.keys(BOARD_THEMES) as BoardThemeName[]).map((name) => {
            const theme = BOARD_THEMES[name];
            return (
              <ButtonBase
                key={name}
                title={theme.label}
                aria-label={`${theme.label} board`}
                onClick={() => setBoardTheme(name)}
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  overflow: "hidden",
                  outline: boardTheme === name ? "3px solid" : "1px solid",
                  outlineColor:
                    boardTheme === name ? "primary.main" : "divider",
                  background: `conic-gradient(${theme.dark} 25%, ${theme.light} 0 50%, ${theme.dark} 0 75%, ${theme.light} 0)`,
                }}
              />
            );
          })}
        </Stack>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
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
                    alt={`${name} knight`}
                    width={24}
                    height={24}
                  />
                  {name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel id="settings-motion-label">Piece animation</InputLabel>
          <Select
            labelId="settings-motion-label"
            input={<OutlinedInput label="Piece animation" />}
            value={motion}
            onChange={(event) => setMotion(event.target.value as PieceMotion)}
          >
            {PIECE_MOTION_CHOICES.map(({ id, label }) => (
              <MenuItem key={id} value={id}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Slider
          label="Board hue"
          value={hue}
          setValue={setHue}
          min={0}
          max={360}
          size={12}
        />

        <Stack mt={1}>
          <FormControlLabel
            control={
              <Switch
                checked={coordinates}
                onChange={(_, value) => setCoordinates(value)}
              />
            }
            label="Show coordinates"
          />
          <FormControlLabel
            control={
              <Switch
                checked={sound}
                onChange={(_, value) => setSound(value)}
              />
            }
            label="Move sounds"
          />
          <FormControlLabel
            control={
              <Switch
                checked={autoQueen}
                onChange={(_, value) => setAutoQueen(value)}
              />
            }
            label="Automatically promote to queen"
          />
          <FormControlLabel
            control={
              <Switch
                checked={premoves}
                onChange={(_, value) => setPremoves(value)}
              />
            }
            label="Allow premoves in Play"
          />
          <FormControlLabel
            control={
              <Switch
                checked={puzzleSetup}
                onChange={(_, value) => setPuzzleSetup(value)}
              />
            }
            label="Puzzles: play the opponent's last move first"
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
