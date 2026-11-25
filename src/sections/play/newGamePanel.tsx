import Panel from "@/components/panel";
import StrengthControl from "@/components/strengthControl";
import { EngineFailureAlert } from "@/components/engineDownloadAlert";
import { EngineField } from "@/components/enginePicker";
import { DEFAULT_ENGINE, engineLabel } from "@/constants";
import { EngineState } from "@/hooks/useEngine";
import { ODDS_OPTIONS } from "@/lib/odds";
import { Color, EngineId } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useAtom } from "jotai";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  ColorChoice,
  GameMode,
  botStrengthAtom,
  coachAtom,
  colorChoiceAtom,
  enginePlayNameAtom,
  gameModeAtom,
  oddsAtom,
  playEvalBarAtom,
  playerColorAtom,
  startingPositionAtom,
  timeControlAtom,
} from "./states";
import { useStartGame } from "./useStartGame";
import { playSetupPosition } from "@/lib/setupPosition";
import { setHandoff } from "@/lib/handoff";

const TIME_PRESETS: { label: string; minutes: number; increment: number }[] = [
  { label: "No clock", minutes: 0, increment: 0 },
  { label: "1+0", minutes: 1, increment: 0 },
  { label: "3+0", minutes: 3, increment: 0 },
  { label: "3+2", minutes: 3, increment: 2 },
  { label: "5+0", minutes: 5, increment: 0 },
  { label: "5+3", minutes: 5, increment: 3 },
  { label: "10+0", minutes: 10, increment: 0 },
  { label: "15+10", minutes: 15, increment: 10 },
  { label: "30+0", minutes: 30, increment: 0 },
];

const TOGGLE_GROUP_SX = {
  "& .MuiToggleButton-root": {
    py: 0.5,
    minHeight: 34,
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.82rem",
  },
} as const;

interface Props {
  botEngine: EngineState;
}

export default function NewGamePanel({ botEngine }: Props) {
  const [engineName, setEngineName] = useAtom(enginePlayNameAtom);
  const [strength, setStrength] = useAtom(botStrengthAtom);
  const [mode, setMode] = useAtom(gameModeAtom);
  const [coach, setCoach] = useAtom(coachAtom);
  const [evalBar, setEvalBar] = useAtom(playEvalBarAtom);
  const [colorChoice, setColorChoice] = useAtom(colorChoiceAtom);
  const [timeControl, setTimeControl] = useAtom(timeControlAtom);
  const [odds, setOdds] = useAtom(oddsAtom);
  const [startingPosition, setStartingPosition] = useAtom(startingPositionAtom);
  const [playerColor, setPlayerColor] = useAtom(playerColorAtom);
  const [showPosition, setShowPosition] = useState(false);
  const [error, setError] = useState("");
  const { startGame } = useStartGame();
  const router = useRouter();

  useEffect(() => {
    setPlayerColor(
      colorChoice === "random"
        ? Math.random() < 0.5
          ? Color.White
          : Color.Black
        : colorChoice
    );
  }, [colorChoice, setPlayerColor]);

  useEffect(() => {
    if (startingPosition) setShowPosition(true);
  }, [startingPosition]);

  const ready = botEngine.status === "ready";
  const setup = playSetupPosition(
    startingPosition,
    odds,
    playerColor === Color.White ? Color.Black : Color.White
  );

  const handleStart = () => {
    const message = startGame();
    setError(message ?? "");
  };

  return (
    <Panel title="New game" sx={{ maxHeight: "none", borderBottom: 0 }}>
      <Stack spacing={2.25}>
        {/* Settings are remembered, so Start leads: on a tall screen it sits
            right under the board instead of after a form that can expand. */}
        <Stack spacing={1}>
          <Button
            variant="contained"
            size="large"
            disabled={!ready || !!setup.error}
            onClick={handleStart}
            startIcon={<Icon icon="mdi:play" height={22} />}
            sx={{ borderRadius: 1, fontWeight: 700 }}
          >
            {ready
              ? "Start game"
              : botEngine.status === "error"
                ? "Engine unavailable"
                : "Loading engine…"}
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
          {setup.error && (
            <Typography variant="caption" color="error.main">
              The starting position below is not valid.
            </Typography>
          )}
        </Stack>

        <Section title="Opponent">
          <Stack spacing={1.25}>
            <EngineField
              label="Opponent engine"
              role="play"
              value={engineName}
              onChange={(next) => {
                if (next !== "analysis") setEngineName(next);
              }}
            />

            <EngineStatusLine
              engine={botEngine}
              engineName={engineName}
              onUseDefault={() => setEngineName(DEFAULT_ENGINE)}
            />

            <StrengthControl
              value={strength}
              onChange={setStrength}
              engineName={engineName}
            />
          </Stack>
        </Section>

        <Section title="You play as">
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={colorChoice}
            onChange={(_, value: ColorChoice | null) =>
              value && setColorChoice(value)
            }
            sx={TOGGLE_GROUP_SX}
          >
            <ToggleButton value={Color.White}>White</ToggleButton>
            <ToggleButton value="random">Random</ToggleButton>
            <ToggleButton value={Color.Black}>Black</ToggleButton>
          </ToggleButtonGroup>
        </Section>

        <Section title="Game type">
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={mode}
            onChange={(_, value: GameMode | null) => value && setMode(value)}
            sx={TOGGLE_GROUP_SX}
          >
            <ToggleButton value="casual">Casual</ToggleButton>
            <ToggleButton value="formal">Formal</ToggleButton>
          </ToggleButtonGroup>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.75, fontSize: "0.8rem", lineHeight: 1.45 }}
          >
            {mode === "casual"
              ? "Hints, top moves, live coach, and takebacks are available."
              : "No hints, coach, or takebacks — every move counts."}
          </Typography>
          {mode === "casual" && (
            <Stack
              spacing={0.25}
              sx={{
                mt: 1,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: "action.hover",
              }}
            >
              <FormControlLabel
                labelPlacement="start"
                sx={{
                  m: 0,
                  minHeight: 34,
                  justifyContent: "space-between",
                  gap: 1.5,
                }}
                control={
                  <Switch
                    size="small"
                    checked={coach}
                    onChange={(_, checked) => setCoach(checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Live coach
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", lineHeight: 1.3 }}
                    >
                      Rate moves and explain mistakes on the board
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                labelPlacement="start"
                sx={{
                  m: 0,
                  minHeight: 32,
                  justifyContent: "space-between",
                  gap: 1.5,
                }}
                control={
                  <Switch
                    size="small"
                    checked={evalBar}
                    onChange={(_, checked) => setEvalBar(checked)}
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    Evaluation bar beside the board
                  </Typography>
                }
              />
            </Stack>
          )}
        </Section>

        <Section title="Time control">
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {TIME_PRESETS.map((preset) => {
              const selected =
                preset.minutes === timeControl.minutes &&
                preset.increment === timeControl.increment;

              return (
                <Chip
                  key={preset.label}
                  label={preset.label}
                  size="small"
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  onClick={() =>
                    setTimeControl({
                      minutes: preset.minutes,
                      increment: preset.increment,
                    })
                  }
                  sx={{
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: selected ? 700 : 500,
                  }}
                />
              );
            })}
          </Stack>
        </Section>

        <Section title="Handicap">
          <FormControl size="small" fullWidth>
            <Select
              value={odds}
              onChange={(event) => setOdds(event.target.value as typeof odds)}
              inputProps={{ "aria-label": "Handicap" }}
            >
              {ODDS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                  {option.value !== "none" && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      {option.hint}
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Section>

        <Box>
          <Button
            size="small"
            color="inherit"
            onClick={() => setShowPosition((value) => !value)}
            startIcon={
              <Icon
                icon={showPosition ? "mdi:chevron-up" : "mdi:chevron-down"}
                height={18}
              />
            }
            disabled={odds !== "none"}
            sx={{
              px: 0.75,
              ml: -0.75,
              borderRadius: 1,
              color: "text.secondary",
              textTransform: "none",
            }}
          >
            Start from a position
          </Button>
          <Collapse in={showPosition && odds === "none"}>
            <Stack spacing={1} mt={1}>
              <TextField
                size="small"
                multiline
                minRows={2}
                maxRows={6}
                label="FEN or PGN"
                value={startingPosition}
                onChange={(event) => setStartingPosition(event.target.value)}
                error={!!setup.error}
                helperText={
                  setup.error ??
                  "The board previews this starting position. Clear to use the standard position."
                }
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:pencil-ruler" height={18} />}
                disabled={!!setup.error}
                onClick={() => {
                  setHandoff({ kind: "fen", fen: setup.fen }, "/editor");
                  void router.push("/editor");
                }}
                sx={{ alignSelf: "flex-start", borderRadius: 1 }}
              >
                Build one in the board editor
              </Button>
            </Stack>
          </Collapse>
        </Box>
      </Stack>
    </Panel>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{
          fontWeight: 700,
          letterSpacing: "0.08em",
          lineHeight: 1.4,
          display: "block",
        }}
      >
        {title}
      </Typography>
      <Box mt={0.5}>{children}</Box>
    </Box>
  );
}

function EngineStatusLine({
  engine,
  engineName,
  onUseDefault,
}: {
  engine: EngineState;
  engineName: EngineId;
  onUseDefault: () => void;
}) {
  if (engine.status === "ready") {
    return (
      <Stack direction="row" alignItems="center" gap={0.6}>
        <Box
          aria-hidden
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: "success.main",
            flexShrink: 0,
          }}
        />
        <Typography variant="caption" color="success.main" fontWeight={600}>
          {engineLabel(engineName).small} is ready
        </Typography>
      </Stack>
    );
  }

  if (engine.status === "error") {
    return <EngineFailureAlert state={engine} onUseDefault={onUseDefault} />;
  }

  return (
    <Typography variant="caption" color="text.secondary">
      Loading {engineLabel(engineName).small}…
    </Typography>
  );
}
