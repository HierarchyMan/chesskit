import Slider from "@/components/slider";
import MiniBoard from "@/components/board/miniBoard";
import {
  BOARD_THEMES,
  BoardThemeName,
  boardHueAtom,
  boardThemeAtom,
  pieceMotionAtom,
  pieceSetAtom,
  showCoordinatesAtom,
  soundEnabledAtom,
} from "@/components/board/states";
import { PIECE_MOTION_CHOICES, PieceMotion } from "@/lib/pieceMotion";
import { puzzleShowSetupAtom } from "@/sections/puzzles/states";
import { PIECE_SETS } from "@/constants";
import { getRecommendedWorkersNb } from "@/lib/engine/worker";
import { EngineField } from "@/components/enginePicker";
import MaxStrengthGuide from "@/components/maxStrengthGuide";
import {
  DEFAULT_HASH_MB,
  HASH_CHOICES,
  MAX_FULL_STRENGTH_MS,
  MAX_NATIVE_THREADS,
  MIN_FULL_STRENGTH_MS,
  engineHashMbAtom,
  fullStrengthMsAtom,
  jokeAdvisorDepthAtom,
  nativeThreadsAtom,
  recommendedNativeThreads,
} from "@/lib/engine/engineSettings";
import {
  engineDepthAtom,
  engineMultiPvAtom,
  engineNameAtom,
  engineWorkersNbAtom,
  useCloudEvalAtom,
} from "@/sections/analysis/states";
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
import { useState } from "react";
import Image from "next/image";
import {
  settingsOpenAtom,
  settingsTabAtom,
  SettingsTab,
} from "../layout/states";
import ModelsTab from "./modelsTab";
import ArrowsTab from "./arrowsTab";
import FeatureEngineSelect from "./featureEngineSelect";
import { ENGINE_FEATURES } from "@/lib/engine/featureEngines";

const PREVIEW_FEN =
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

export default function SettingsDialog() {
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [tab, setTab] = useAtom(settingsTabAtom);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
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
      <DialogContent sx={{ pt: 3, minHeight: 420 }}>
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

function EngineTab() {
  const [engineName, setEngineName] = useAtom(engineNameAtom);
  const [depth, setDepth] = useAtom(engineDepthAtom);
  const [multiPv, setMultiPv] = useAtom(engineMultiPvAtom);
  const [workers, setWorkers] = useAtom(engineWorkersNbAtom);
  const [cloud, setCloud] = useAtom(useCloudEvalAtom);
  const [hashMb, setHashMb] = useAtom(engineHashMbAtom);
  const [threads, setThreads] = useAtom(nativeThreadsAtom);
  const [thinkMs, setThinkMs] = useAtom(fullStrengthMsAtom);
  const [advisorDepth, setAdvisorDepth] = useAtom(jokeAdvisorDepthAtom);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={12}>
        <EngineField
          label="Analysis engine"
          role="analysis"
          value={engineName}
          onChange={(next) => {
            if (next !== "analysis") setEngineName(next);
          }}
        />
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          Used for analysis and the editor, and by every feature below unless
          you give it an engine of its own. Bots in Play and the Arena have
          their own engine pickers. Download engines and check the bridge in the
          Models tab.
        </Typography>
      </Grid>

      <Grid size={12}>
        <Stack spacing={2}>
          <Typography variant="subtitle2">
            Engines for other features
          </Typography>
          {ENGINE_FEATURES.map((feature) => (
            <FeatureEngineSelect key={feature.id} feature={feature} />
          ))}
        </Stack>
      </Grid>

      <Slider
        label="Search depth"
        value={depth}
        setValue={setDepth}
        min={10}
        max={30}
        marksFilter={2}
      />
      <Slider
        label="Engine lines listed"
        value={multiPv}
        setValue={setMultiPv}
        min={2}
        max={6}
        marksFilter={1}
        size={6}
      />
      <Slider
        label="Analysis threads"
        value={workers}
        setValue={setWorkers}
        min={1}
        max={12}
        marksFilter={1}
        infoContent={
          <>
            More threads means faster full-game analysis, as long as your device
            can handle them. The estimated best value for this device is{" "}
            {getRecommendedWorkersNb()}.
          </>
        }
      />

      <Grid size={12}>
        <Stack>
          <FormControlLabel
            control={
              <Switch
                checked={cloud}
                onChange={(_, value) => setCloud(value)}
              />
            }
            label="Use Lichess cloud evaluations when available"
          />
        </Stack>
      </Grid>

      <Grid size={12}>
        <Stack spacing={1}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            flexWrap="wrap"
          >
            <Typography variant="subtitle2">Engine power</Typography>
            <Button
              size="small"
              startIcon={<Icon icon="mdi:rocket-launch-outline" height={18} />}
              onClick={() => setGuideOpen(true)}
            >
              How to get maximum strength
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Each engine keeps these within what it supports.
          </Typography>
        </Stack>
      </Grid>
      <Slider
        label="Bot think time at full strength (seconds)"
        value={thinkMs / 1000}
        setValue={(seconds) => setThinkMs(Math.round(seconds * 1000))}
        min={MIN_FULL_STRENGTH_MS / 1000}
        max={MAX_FULL_STRENGTH_MS / 1000}
      />
      <Grid size={12}>
        <FormControl fullWidth size="small">
          <InputLabel id="settings-hash-label">
            Hash (memory per engine)
          </InputLabel>
          <Select
            labelId="settings-hash-label"
            input={<OutlinedInput label="Hash (memory per engine)" />}
            value={HASH_CHOICES.includes(hashMb) ? hashMb : DEFAULT_HASH_MB}
            onChange={(event) => setHashMb(Number(event.target.value))}
          >
            {HASH_CHOICES.map((mb) => (
              <MenuItem key={mb} value={mb}>
                {mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`}
                {mb === DEFAULT_HASH_MB ? " (default)" : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Slider
        label="Threads for native engines"
        value={threads}
        setValue={setThreads}
        min={1}
        max={Math.min(
          MAX_NATIVE_THREADS,
          Math.max(2, recommendedNativeThreads())
        )}
        marksFilter={4}
        infoContent={
          <>
            Only engines through the bridge, such as Reckless, use more than one
            thread. Browser engines always use one.
          </>
        }
      />
      <Slider
        label="Joke engines' advisor depth"
        value={advisorDepth}
        setValue={setAdvisorDepth}
        min={1}
        max={20}
        marksFilter={2}
        infoContent={
          <>
            How deep the advisor searches each move for Drawfish, Worstfish,
            Pacifist and Bongcloud. Deeper is slower but better at their jokes.
          </>
        }
      />
      <MaxStrengthGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Grid>
  );
}

function BoardTab() {
  const [pieceSet, setPieceSet] = useAtom(pieceSetAtom);
  const [boardTheme, setBoardTheme] = useAtom(boardThemeAtom);
  const [hue, setHue] = useAtom(boardHueAtom);
  const [coordinates, setCoordinates] = useAtom(showCoordinatesAtom);
  const [sound, setSound] = useAtom(soundEnabledAtom);
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
