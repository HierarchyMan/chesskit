import Panel from "@/components/panel";
import StrengthControl from "@/components/strengthControl";
import { ENGINE_LABELS } from "@/constants";
import { EngineState } from "@/hooks/useEngine";
import { isEngineSupported } from "@/lib/engine/shared";
import { ODDS_OPTIONS } from "@/lib/odds";
import { Color, EngineName } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useAtom, useSetAtom } from "jotai";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  ColorChoice,
  GameMode,
  botStrengthAtom,
  colorChoiceAtom,
  enginePlayNameAtom,
  gameModeAtom,
  oddsAtom,
  playerColorAtom,
  startingPositionAtom,
  timeControlAtom,
} from "./states";
import { useStartGame } from "./useStartGame";

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

interface Props {
  botEngine: EngineState;
}

export default function NewGamePanel({ botEngine }: Props) {
  const [engineName, setEngineName] = useAtom(enginePlayNameAtom);
  const [strength, setStrength] = useAtom(botStrengthAtom);
  const [mode, setMode] = useAtom(gameModeAtom);
  const [colorChoice, setColorChoice] = useAtom(colorChoiceAtom);
  const [timeControl, setTimeControl] = useAtom(timeControlAtom);
  const [odds, setOdds] = useAtom(oddsAtom);
  const [startingPosition, setStartingPosition] = useAtom(startingPositionAtom);
  const setPlayerColor = useSetAtom(playerColorAtom);
  const [showPosition, setShowPosition] = useState(false);
  const [error, setError] = useState("");
  const { startGame } = useStartGame();
  const router = useRouter();

  useEffect(() => {
    if (colorChoice !== "random") setPlayerColor(colorChoice);
  }, [colorChoice, setPlayerColor]);

  useEffect(() => {
    if (startingPosition) setShowPosition(true);
  }, [startingPosition]);

  const ready = botEngine.status === "ready";

  const handleStart = () => {
    const message = startGame();
    setError(message ?? "");
  };

  return (
    <Panel title="New game" sx={{ maxHeight: "none" }}>
      <Stack spacing={2.5}>
        <Section title="Opponent">
          <Stack spacing={1.5}>
            <FormControl size="small" fullWidth>
              <InputLabel id="play-engine-label">Engine</InputLabel>
              <Select
                labelId="play-engine-label"
                input={<OutlinedInput label="Engine" />}
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

            <EngineStatusLine engine={botEngine} engineName={engineName} />

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
          >
            <ToggleButton value="casual">Casual</ToggleButton>
            <ToggleButton value="formal">Formal</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.75 }}>
            {mode === "casual"
              ? "Hints, top moves for either side and takebacks are available. Great for learning."
              : "No hints and no takebacks, like a real game. Every move counts."}
          </Typography>
        </Section>

        <Section title="Time">
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
                      sx={{ ml: 1, opacity: 0.65 }}
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
              />
            }
            disabled={odds !== "none"}
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
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:pencil-ruler" height={18} />}
                onClick={() => router.push("/editor")}
              >
                Build one in the board editor
              </Button>
            </Stack>
          </Collapse>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Button
          variant="contained"
          size="large"
          disabled={!ready}
          onClick={handleStart}
          startIcon={<Icon icon="mdi:play" height={22} />}
        >
          {ready
            ? "Start game"
            : botEngine.status === "error"
              ? "Engine unavailable"
              : "Loading engine…"}
        </Button>
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
        sx={{ opacity: 0.7, letterSpacing: "0.08em" }}
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
}: {
  engine: EngineState;
  engineName: EngineName;
}) {
  if (engine.status === "ready") {
    return (
      <Typography variant="body2" color="success.main">
        {ENGINE_LABELS[engineName].small} is ready.
      </Typography>
    );
  }

  if (engine.status === "error") {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={engine.retry}>
            Retry
          </Button>
        }
      >
        {engine.error ?? "The engine did not start."}
      </Alert>
    );
  }

  return (
    <Typography variant="body2" sx={{ opacity: 0.75 }}>
      Loading {ENGINE_LABELS[engineName].small}
      {ENGINE_LABELS[engineName].sizeMb > 20
        ? ` (${ENGINE_LABELS[engineName].sizeMb}MB, first time only)`
        : ""}
      …
    </Typography>
  );
}
