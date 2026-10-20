import Slider from "@/components/slider";
import MiniBoard from "@/components/board/miniBoard";
import {
  BOARD_THEMES,
  BoardThemeName,
  boardHueAtom,
  boardThemeAtom,
  pieceSetAtom,
  showCoordinatesAtom,
  soundEnabledAtom,
} from "@/components/board/states";
import { ENGINE_LABELS, PIECE_SETS } from "@/constants";
import { isEngineSupported } from "@/lib/engine/shared";
import { getRecommendedWorkersNb } from "@/lib/engine/worker";
import { probeRecklessBridge } from "@/lib/engine/reckless";
import { EngineName } from "@/types/enums";
import {
  engineDepthAtom,
  engineMultiPvAtom,
  engineNameAtom,
  engineWorkersNbAtom,
  showBestMoveArrowAtom,
  showPlayerMoveIconAtom,
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
import { useAtom, useAtomValue } from "jotai";
import Image from "next/image";
import { useState } from "react";
import { settingsOpenAtom } from "../layout/states";

const PREVIEW_FEN =
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

export default function SettingsDialog() {
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [tab, setTab] = useState(0);

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
        onChange={(_, value) => setTab(value)}
        variant="fullWidth"
        sx={{ px: 1, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label="Engine"
          icon={<Icon icon="mdi:chip" height={20} />}
          iconPosition="start"
        />
        <Tab
          label="Board"
          icon={<Icon icon="mdi:chess-pawn" height={20} />}
          iconPosition="start"
        />
        <Tab
          label="Reckless"
          icon={<Icon icon="mdi:lightning-bolt" height={20} />}
          iconPosition="start"
        />
      </Tabs>
      <DialogContent sx={{ pt: 3, minHeight: 420 }}>
        {tab === 0 && <EngineTab />}
        {tab === 1 && <BoardTab />}
        {tab === 2 && <RecklessTab />}
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
  const [showArrow, setShowArrow] = useAtom(showBestMoveArrowAtom);
  const [showIcon, setShowIcon] = useAtom(showPlayerMoveIconAtom);

  return (
    <Grid container spacing={3} justifyContent="center">
      <Grid size={12}>
        <FormControl fullWidth>
          <InputLabel id="settings-engine-label">Analysis engine</InputLabel>
          <Select
            labelId="settings-engine-label"
            input={<OutlinedInput label="Analysis engine" />}
            value={engineName}
            onChange={(event) =>
              setEngineName(event.target.value as EngineName)
            }
          >
            {Object.values(EngineName).map((name) => (
              <MenuItem
                key={name}
                value={name}
                disabled={!isEngineSupported(name)}
              >
                {ENGINE_LABELS[name].full}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          Used for analysis, hints, the editor and the coach. Bots in Play and
          the Arena have their own engine pickers.
        </Typography>
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
        label="Number of lines"
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
          <FormControlLabel
            control={
              <Switch
                checked={showArrow}
                onChange={(_, value) => setShowArrow(value)}
              />
            }
            label="Show the engine's best move arrow in analysis"
          />
          <FormControlLabel
            control={
              <Switch
                checked={showIcon}
                onChange={(_, value) => setShowIcon(value)}
              />
            }
            label="Show the quality icon on played moves"
          />
        </Stack>
      </Grid>
    </Grid>
  );
}

function BoardTab() {
  const [pieceSet, setPieceSet] = useAtom(pieceSetAtom);
  const [boardTheme, setBoardTheme] = useAtom(boardThemeAtom);
  const [hue, setHue] = useAtom(boardHueAtom);
  const [coordinates, setCoordinates] = useAtom(showCoordinatesAtom);
  const [sound, setSound] = useAtom(soundEnabledAtom);
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
        </Stack>
      </Grid>
    </Grid>
  );
}

function RecklessTab() {
  const [status, setStatus] = useState<"unknown" | "checking" | "up" | "down">(
    "unknown"
  );
  const engineName = useAtomValue(engineNameAtom);

  const check = async () => {
    setStatus("checking");
    setStatus((await probeRecklessBridge()) ? "up" : "down");
  };

  return (
    <Stack spacing={2}>
      <Typography>
        Reckless is a native engine, so it runs outside the browser through a
        small local bridge. The bridge listens only on this computer and only
        accepts connections from this app.
      </Typography>
      <Typography>
        To start it, double-click <b>start-reckless-bridge.bat</b>, or use
        <b> start-chess.bat</b> to start the bridge and the app together.
      </Typography>
      <Stack direction="row" alignItems="center" gap={2}>
        <Button
          variant="outlined"
          onClick={check}
          disabled={status === "checking"}
        >
          Check bridge
        </Button>
        <Typography
          color={
            status === "up"
              ? "success.main"
              : status === "down"
                ? "error.main"
                : undefined
          }
        >
          {status === "up" && "Reckless bridge is running."}
          {status === "down" && "The bridge is not running."}
          {status === "checking" && "Checking…"}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ opacity: 0.8 }}>
        Currently selected analysis engine: {ENGINE_LABELS[engineName].full}.
        Pick Reckless from the engine menu in the top bar.
      </Typography>
    </Stack>
  );
}
