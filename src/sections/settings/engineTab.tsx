import { EngineField } from "@/components/enginePicker";
import MaxStrengthGuide from "@/components/maxStrengthGuide";
import {
  engineAdvancedOpenAtom,
  engineSettingsSectionAtom,
} from "../layout/states";
import { DEFAULT_ENGINE, engineLabel } from "@/constants";
import {
  useEffectiveAdvice,
  useEffectiveArenaEval,
  useEffectiveBotDrawEvalDepth,
  useEffectiveCoachDialogue,
  useEffectiveCoachGrading,
  useEffectiveJokeAdvisorDepth,
  useEffectiveThreatDepth,
} from "@/hooks/useEffectiveEngineSettings";
import {
  ARROW_TUNING_DEFAULTS,
  THREAT_DEPTH_RANGE,
  THREAT_SENSITIVITY_LABELS,
  THREATS_SHOWN_RANGE,
  ThreatSensitivity,
} from "@/lib/arrows/tuning";
import { arrowTuningAtom } from "@/lib/arrows/tuningAtom";
import {
  DEFAULT_ANALYSIS_DEPTH,
  DEFAULT_ANALYSIS_MULTIPV,
  ENGINE_PRESETS,
  ENGINE_PRESET_DESCRIPTIONS,
  ENGINE_PRESET_IDS,
  ENGINE_PRESET_LABELS,
  EnginePresetId,
  matchEnginePreset,
} from "@/lib/engine/enginePresets";
import {
  ADVICE_DEPTH_RANGE,
  ADVICE_INHERIT_MODES,
  ADVICE_MULTIPV_RANGE,
  ADVISOR_DEPTH_RANGE,
  ARENA_EVAL_DEPTH_RANGE,
  ARENA_EVAL_INHERIT_MODES,
  ARENA_EVAL_MULTIPV_RANGE,
  BOT_DRAW_EVAL_DEPTH_RANGE,
  DEFAULT_BOT_REPLY_SPEED,
  BOT_REPLY_SPEEDS,
  BOT_REPLY_SPEED_LABELS,
  BotReplySpeed,
  BOT_DRAW_EVAL_INHERIT_MODES,
  COACH_DIALOGUE_DEPTH_RANGE,
  COACH_DIALOGUE_INHERIT_MODES,
  COACH_DIALOGUE_MOVETIME_RANGE,
  COACH_DIALOGUE_MULTIPV_RANGE,
  COACH_GRADING_DEPTH_RANGE,
  COACH_GRADING_INHERIT_MODES,
  COACH_GRADING_MULTIPV_RANGE,
  DEFAULT_ADVICE_DEPTH,
  DEFAULT_ADVICE_MULTIPV,
  DEFAULT_ADVISOR_DEPTH,
  DEFAULT_ARENA_EVAL_DEPTH,
  DEFAULT_ARENA_EVAL_MULTIPV,
  DEFAULT_BOT_DRAW_EVAL_DEPTH,
  DEFAULT_COACH_DIALOGUE_DEPTH,
  DEFAULT_COACH_DIALOGUE_MOVETIME_MS,
  DEFAULT_COACH_DIALOGUE_MULTIPV,
  DEFAULT_COACH_GRADING_DEPTH,
  DEFAULT_COACH_GRADING_MULTIPV,
  DEFAULT_FULL_STRENGTH_MS,
  DEFAULT_HASH_MB,
  HASH_CHOICES,
  JOKE_ADVISOR_INHERIT_MODES,
  MAX_FULL_STRENGTH_MS,
  MAX_NATIVE_THREADS,
  MIN_FULL_STRENGTH_MS,
  SettingsInheritMode,
  THREATS_INHERIT_MODES,
  adviceDepthAtom,
  adviceInheritAtom,
  adviceMultiPvAtom,
  botReplySpeedAtom,
  arenaEvalDepthAtom,
  arenaEvalInheritAtom,
  arenaEvalMultiPvAtom,
  botDrawEvalDepthAtom,
  botDrawEvalInheritAtom,
  coachDialogueDepthAtom,
  coachDialogueInheritAtom,
  coachDialogueMovetimeMsAtom,
  coachDialogueMultiPvAtom,
  coachGradingDepthAtom,
  coachGradingInheritAtom,
  coachGradingMultiPvAtom,
  engineHashMbAtom,
  fullStrengthMsAtom,
  jokeAdvisorDepthAtom,
  jokeAdvisorInheritAtom,
  nativeThreadsAtom,
  recommendedNativeThreads,
  threatsInheritAtom,
} from "@/lib/engine/engineSettings";
import {
  ENGINE_FEATURES,
  EngineFeature,
  featureEngineAtoms,
  isEngineInheritSource,
  resolveEngineChoice,
} from "@/lib/engine/featureEngines";
import { getRecommendedWorkersNb } from "@/lib/engine/worker";
import {
  engineDepthAtom,
  engineMultiPvAtom,
  engineNameAtom,
  engineWorkersNbAtom,
  useCloudEvalAtom,
} from "@/sections/analysis/states";
import { enginePlayNameAtom } from "@/sections/play/states";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  ClickAwayListener,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  MenuItem,
  OutlinedInput,
  Popover,
  Select,
  Slider as MuiSlider,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import { MouseEvent, ReactNode, useMemo, useState } from "react";
import FeatureEngineSelect from "./featureEngineSelect";

type EngineSectionId =
  | "analysis"
  | "coach"
  | "coachDialogue"
  | "advice"
  | "threats"
  | "evaluator"
  | "bots"
  | "power";

const DEFAULT_ANALYSIS_WORKERS = 8;

const featureById = (id: EngineFeature) =>
  ENGINE_FEATURES.find((entry) => entry.id === id)!;

const formatMovetime = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 2)} s` : `${ms} ms`;

const formatHash = (mb: number): string =>
  mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;

const SETTINGS_SOURCE_LABELS: Record<SettingsInheritMode, string> = {
  custom: "Custom",
  analysis: "Analysis",
  coach: "Coach",
  bot: "Bot",
};

const SETTINGS_SOURCE_FULL: Record<
  Exclude<SettingsInheritMode, "custom">,
  string
> = {
  analysis: "Analysis & Editor",
  coach: "Coach · Move Grading",
  bot: "Bot opponent",
};

interface SettingSliderProps {
  label: string;
  value: number;
  setValue: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  marksFilter?: number;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  infoContent?: ReactNode;
}

function SettingSlider({
  label,
  value,
  setValue,
  min,
  max,
  step = 1,
  marksFilter,
  disabled = false,
  formatValue = (v) => `${v}`,
  infoContent,
}: SettingSliderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleOpen = (event: MouseEvent<HTMLElement>) =>
    setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const marks = useMemo(() => {
    if (!marksFilter || step !== 1) return undefined;
    return Array.from({ length: max - min + 1 }, (_, i) => ({
      value: i + min,
      label: `${i + min}`,
    })).filter((_, i) => i % marksFilter === 0);
  }, [marksFilter, max, min, step]);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        mb={0.25}
      >
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Typography
            variant="body2"
            fontWeight={500}
            color={disabled ? "text.disabled" : "text.primary"}
          >
            {label}
          </Typography>
          {!!infoContent && (
            <>
              <ClickAwayListener onClickAway={handleClose}>
                <IconButton
                  size="small"
                  aria-label={`Help about ${label}`}
                  onClick={handleOpen}
                  onMouseEnter={handleOpen}
                  onMouseLeave={handleClose}
                  sx={{ p: 0.25, color: "text.secondary" }}
                >
                  <Icon icon="mdi:info-outline" height={16} />
                </IconButton>
              </ClickAwayListener>
              <Popover
                open={!!anchorEl}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
                sx={{ pointerEvents: "none" }}
                disableRestoreFocus
              >
                <Typography variant="body2" sx={{ p: 1.75, maxWidth: 360 }}>
                  {infoContent}
                </Typography>
              </Popover>
            </>
          )}
        </Stack>
        <Typography
          variant="caption"
          fontWeight={600}
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 1,
            bgcolor: disabled ? "action.disabledBackground" : "action.selected",
            color: disabled ? "text.disabled" : "text.primary",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {formatValue(value)}
        </Typography>
      </Stack>

      <MuiSlider
        size="small"
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        marks={marks}
        value={value}
        valueLabelDisplay="off"
        aria-label={label}
        onChange={(_, next) => setValue(next as number)}
        sx={{
          "& .MuiSlider-markLabel": {
            fontSize: "0.72rem",
            lineHeight: 1.1,
          },
          mb: marks ? 1.5 : 0.25,
        }}
      />
    </Box>
  );
}

interface InheritSettingsGroupProps<T extends SettingsInheritMode> {
  label?: string;
  mode: T;
  modes: readonly T[];
  onChange: (next: T) => void;
  inheritedSummary?: string;
  children: ReactNode;
}

/**
 * Wraps a role's specific search controls with an Inherit selector.
 * When inheriting from Analysis, Coach, or Bot, the inner controls visibly
 * gray out and lock while displaying the live inherited values.
 */
function InheritSettingsGroup<T extends SettingsInheritMode>({
  label = "Search settings",
  mode,
  modes,
  onChange,
  inheritedSummary,
  children,
}: InheritSettingsGroupProps<T>) {
  const inherited = mode !== "custom";
  const sourceName =
    mode !== "custom"
      ? SETTINGS_SOURCE_FULL[mode as Exclude<SettingsInheritMode, "custom">]
      : undefined;

  return (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
      >
        <Typography variant="body2" fontWeight={600}>
          {label}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          aria-label={`${label} inheritance`}
          onChange={(_, next: T | null) => next && onChange(next)}
          sx={{
            "& .MuiToggleButton-root": {
              py: 0.3,
              px: 1.15,
              fontSize: "0.75rem",
              textTransform: "none",
            },
          }}
        >
          {modes.map((option) => (
            <ToggleButton key={option} value={option}>
              {option === "custom"
                ? SETTINGS_SOURCE_LABELS[option]
                : `Inherit ${SETTINGS_SOURCE_LABELS[option]}`}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Stack
        direction="row"
        alignItems="center"
        gap={0.75}
        sx={{
          px: 1.25,
          py: 0.75,
          minHeight: 34,
          borderRadius: 1,
          border: 1,
          borderStyle: inherited ? "dashed" : "solid",
          borderColor: inherited ? "divider" : "transparent",
          bgcolor: inherited ? "action.hover" : "transparent",
          transition: "background-color 150ms ease, border-color 150ms ease",
        }}
      >
        <Icon
          icon={inherited ? "mdi:link-variant" : "mdi:tune"}
          height={15}
          style={{ flexShrink: 0, opacity: inherited ? 1 : 0.6 }}
        />
        <Typography variant="caption" color="text.secondary">
          {inherited && sourceName ? (
            <>
              Inheriting from <b>{sourceName}</b>
              {inheritedSummary ? ` (${inheritedSummary})` : ""}. Switch to
              Custom to tune individually.
            </>
          ) : (
            "Using custom search values for this role. Choose an inherit option to link it."
          )}
        </Typography>
      </Stack>

      <Box
        aria-disabled={inherited}
        sx={{
          p: 1.5,
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          bgcolor: inherited ? "action.disabledBackground" : "transparent",
          opacity: inherited ? 0.45 : 1,
          pointerEvents: inherited ? "none" : "auto",
          transition: "opacity 150ms ease, background-color 150ms ease",
        }}
      >
        <Stack spacing={2}>{children}</Stack>
      </Box>
    </Stack>
  );
}

interface SectionHeaderProps {
  icon: string;
  title: string;
  subtitle: string;
  isModified: boolean;
  onReset: () => void;
}

function SectionHeader({
  icon,
  title,
  subtitle,
  isModified,
  onReset,
}: SectionHeaderProps) {
  return (
    <Stack spacing={0.75}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              color: "primary.main",
              flexShrink: 0,
            }}
          >
            <Icon icon={icon} height={18} />
          </Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            {title}
          </Typography>
        </Stack>
        <Button
          size="small"
          color="inherit"
          disabled={!isModified}
          startIcon={<Icon icon="mdi:restore" height={16} />}
          onClick={onReset}
          sx={{ flexShrink: 0, opacity: isModified ? 0.9 : 0.4 }}
        >
          Reset
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" lineHeight={1.45}>
        {subtitle}
      </Typography>
    </Stack>
  );
}

export default function EngineTab() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));
  const [rawSection, setRawSection] = useAtom(engineSettingsSectionAtom);
  const section = rawSection as EngineSectionId;
  const setSection = (next: EngineSectionId) => setRawSection(next);
  const [guideOpen, setGuideOpen] = useState(false);
  const [advanced, setAdvanced] = useAtom(engineAdvancedOpenAtom);

  // Analysis & Editor
  const [engineName, setEngineName] = useAtom(engineNameAtom);
  const [depth, setDepth] = useAtom(engineDepthAtom);
  const [multiPv, setMultiPv] = useAtom(engineMultiPvAtom);
  const [workers, setWorkers] = useAtom(engineWorkersNbAtom);
  const [cloud, setCloud] = useAtom(useCloudEvalAtom);
  const botEngine = useAtomValue(enginePlayNameAtom);

  // Feature engines
  const [coachChoice, setCoachChoice] = useAtom(featureEngineAtoms.coach);
  const [dialogueChoice, setDialogueChoice] = useAtom(
    featureEngineAtoms.coachDialogue
  );
  const [adviceChoice, setAdviceChoice] = useAtom(featureEngineAtoms.advice);
  const [threatsChoice, setThreatsChoice] = useAtom(featureEngineAtoms.threats);
  const [evaluatorChoice, setEvaluatorChoice] = useAtom(
    featureEngineAtoms.evaluator
  );
  const [jokesChoice, setJokesChoice] = useAtom(featureEngineAtoms.jokes);

  // Coach Grading
  const [coachInherit, setCoachInherit] = useAtom(coachGradingInheritAtom);
  const [coachDepth, setCoachDepth] = useAtom(coachGradingDepthAtom);
  const [coachMultiPv, setCoachMultiPv] = useAtom(coachGradingMultiPvAtom);
  const effCoach = useEffectiveCoachGrading();

  // Coach Dialogue (Dr. Wolf)
  const [dialogueInherit, setDialogueInherit] = useAtom(
    coachDialogueInheritAtom
  );
  const [dialogueDepth, setDialogueDepth] = useAtom(coachDialogueDepthAtom);
  const [dialogueMultiPv, setDialogueMultiPv] = useAtom(
    coachDialogueMultiPvAtom
  );
  const [dialogueMovetimeMs, setDialogueMovetimeMs] = useAtom(
    coachDialogueMovetimeMsAtom
  );
  const effDialogue = useEffectiveCoachDialogue();

  // Play Suggestions
  const [adviceInherit, setAdviceInherit] = useAtom(adviceInheritAtom);
  const [adviceDepth, setAdviceDepth] = useAtom(adviceDepthAtom);
  const [adviceMultiPv, setAdviceMultiPv] = useAtom(adviceMultiPvAtom);
  const effAdvice = useEffectiveAdvice();

  // Threats (shared with Arrows tab)
  const [threatsInherit, setThreatsInherit] = useAtom(threatsInheritAtom);
  const [arrowTuning, setArrowTuning] = useAtom(arrowTuningAtom);
  const effThreat = useEffectiveThreatDepth();

  // Arena Evaluation
  const [arenaInherit, setArenaInherit] = useAtom(arenaEvalInheritAtom);
  const [arenaDepth, setArenaDepth] = useAtom(arenaEvalDepthAtom);
  const [arenaMultiPv, setArenaMultiPv] = useAtom(arenaEvalMultiPvAtom);
  const effArena = useEffectiveArenaEval();

  // Bots & Jokes
  const [thinkMs, setThinkMs] = useAtom(fullStrengthMsAtom);
  const [botSpeed, setBotSpeed] = useAtom(botReplySpeedAtom);
  const [drawEvalInherit, setDrawEvalInherit] = useAtom(botDrawEvalInheritAtom);
  const [drawEvalDepth, setDrawEvalDepth] = useAtom(botDrawEvalDepthAtom);
  const effDrawEval = useEffectiveBotDrawEvalDepth();
  const [advisorInherit, setAdvisorInherit] = useAtom(jokeAdvisorInheritAtom);
  const [advisorDepth, setAdvisorDepth] = useAtom(jokeAdvisorDepthAtom);
  const effAdvisor = useEffectiveJokeAdvisorDepth();

  // Hardware & Power
  const [hashMb, setHashMb] = useAtom(engineHashMbAtom);
  const [threads, setThreads] = useAtom(nativeThreadsAtom);

  // Resolved engine labels for sidebar summaries
  const resolveCtx = { coachChoice, botEngine };
  const labelFor = (choice: typeof coachChoice) => {
    const name = engineLabel(
      resolveEngineChoice(choice, engineName, resolveCtx)
    ).small;
    return isEngineInheritSource(choice) ? `↳ ${name}` : name;
  };

  const analysisModified =
    engineName !== DEFAULT_ENGINE ||
    depth !== DEFAULT_ANALYSIS_DEPTH ||
    multiPv !== DEFAULT_ANALYSIS_MULTIPV ||
    workers !== DEFAULT_ANALYSIS_WORKERS ||
    cloud !== false;

  const coachModified =
    coachChoice !== "analysis" ||
    coachInherit !== "custom" ||
    coachDepth !== DEFAULT_COACH_GRADING_DEPTH ||
    coachMultiPv !== DEFAULT_COACH_GRADING_MULTIPV;

  const dialogueModified =
    dialogueChoice !== "analysis" ||
    dialogueInherit !== "custom" ||
    dialogueDepth !== DEFAULT_COACH_DIALOGUE_DEPTH ||
    dialogueMultiPv !== DEFAULT_COACH_DIALOGUE_MULTIPV ||
    dialogueMovetimeMs !== DEFAULT_COACH_DIALOGUE_MOVETIME_MS;

  const adviceModified =
    adviceChoice !== "analysis" ||
    adviceInherit !== "custom" ||
    adviceDepth !== DEFAULT_ADVICE_DEPTH ||
    adviceMultiPv !== DEFAULT_ADVICE_MULTIPV;

  const threatsModified =
    threatsChoice !== "analysis" ||
    threatsInherit !== "custom" ||
    arrowTuning.threatDepth !== ARROW_TUNING_DEFAULTS.threatDepth ||
    arrowTuning.threatsShown !== ARROW_TUNING_DEFAULTS.threatsShown ||
    arrowTuning.threatSensitivity !== ARROW_TUNING_DEFAULTS.threatSensitivity;

  const arenaModified =
    evaluatorChoice !== "analysis" ||
    arenaInherit !== "custom" ||
    arenaDepth !== DEFAULT_ARENA_EVAL_DEPTH ||
    arenaMultiPv !== DEFAULT_ARENA_EVAL_MULTIPV;

  const botsModified =
    thinkMs !== DEFAULT_FULL_STRENGTH_MS ||
    botSpeed !== DEFAULT_BOT_REPLY_SPEED ||
    drawEvalInherit !== "custom" ||
    drawEvalDepth !== DEFAULT_BOT_DRAW_EVAL_DEPTH ||
    jokesChoice !== "analysis" ||
    advisorInherit !== "custom" ||
    advisorDepth !== DEFAULT_ADVISOR_DEPTH;

  const powerModified = hashMb !== DEFAULT_HASH_MB || threads !== 1;

  const modifiedCount = [
    analysisModified,
    coachModified,
    dialogueModified,
    adviceModified,
    threatsModified,
    arenaModified,
    botsModified,
    powerModified,
  ].filter(Boolean).length;

  const resetAnalysis = () => {
    setEngineName(DEFAULT_ENGINE);
    setDepth(DEFAULT_ANALYSIS_DEPTH);
    setMultiPv(DEFAULT_ANALYSIS_MULTIPV);
    setWorkers(DEFAULT_ANALYSIS_WORKERS);
    setCloud(false);
  };

  const resetCoach = () => {
    setCoachChoice("analysis");
    setCoachInherit("custom");
    setCoachDepth(DEFAULT_COACH_GRADING_DEPTH);
    setCoachMultiPv(DEFAULT_COACH_GRADING_MULTIPV);
  };

  const resetDialogue = () => {
    setDialogueChoice("analysis");
    setDialogueInherit("custom");
    setDialogueDepth(DEFAULT_COACH_DIALOGUE_DEPTH);
    setDialogueMultiPv(DEFAULT_COACH_DIALOGUE_MULTIPV);
    setDialogueMovetimeMs(DEFAULT_COACH_DIALOGUE_MOVETIME_MS);
  };

  const resetAdvice = () => {
    setAdviceChoice("analysis");
    setAdviceInherit("custom");
    setAdviceDepth(DEFAULT_ADVICE_DEPTH);
    setAdviceMultiPv(DEFAULT_ADVICE_MULTIPV);
  };

  const resetThreats = () => {
    setThreatsChoice("analysis");
    setThreatsInherit("custom");
    setArrowTuning((current) => ({
      ...current,
      threatDepth: ARROW_TUNING_DEFAULTS.threatDepth,
      threatsShown: ARROW_TUNING_DEFAULTS.threatsShown,
      threatSensitivity: ARROW_TUNING_DEFAULTS.threatSensitivity,
    }));
  };

  const resetArena = () => {
    setEvaluatorChoice("analysis");
    setArenaInherit("custom");
    setArenaDepth(DEFAULT_ARENA_EVAL_DEPTH);
    setArenaMultiPv(DEFAULT_ARENA_EVAL_MULTIPV);
  };

  const resetBots = () => {
    setThinkMs(DEFAULT_FULL_STRENGTH_MS);
    setBotSpeed(DEFAULT_BOT_REPLY_SPEED);
    setDrawEvalInherit("custom");
    setDrawEvalDepth(DEFAULT_BOT_DRAW_EVAL_DEPTH);
    setJokesChoice("analysis");
    setAdvisorInherit("custom");
    setAdvisorDepth(DEFAULT_ADVISOR_DEPTH);
  };

  const resetPower = () => {
    setHashMb(DEFAULT_HASH_MB);
    setThreads(1);
  };

  const resetAll = () => {
    resetAnalysis();
    resetCoach();
    resetDialogue();
    resetAdvice();
    resetThreats();
    resetArena();
    resetBots();
    resetPower();
  };

  const currentPreset = matchEnginePreset({
    analysisDepth: depth,
    analysisMultiPv: multiPv,
    coachGradingDepth: coachDepth,
    coachGradingMultiPv: coachMultiPv,
    coachDialogueDepth: dialogueDepth,
    coachDialogueMultiPv: dialogueMultiPv,
    coachDialogueMovetimeMs: dialogueMovetimeMs,
    adviceDepth,
    adviceMultiPv,
    threatDepth: arrowTuning.threatDepth,
    arenaEvalDepth: arenaDepth,
    arenaEvalMultiPv: arenaMultiPv,
    botDrawEvalDepth: drawEvalDepth,
  });
  const applyPreset = (id: EnginePresetId) => {
    const p = ENGINE_PRESETS[id];
    setDepth(p.analysisDepth);
    setMultiPv(p.analysisMultiPv);
    setCoachDepth(p.coachGradingDepth);
    setCoachMultiPv(p.coachGradingMultiPv);
    setDialogueDepth(p.coachDialogueDepth);
    setDialogueMultiPv(p.coachDialogueMultiPv);
    setDialogueMovetimeMs(p.coachDialogueMovetimeMs);
    setAdviceDepth(p.adviceDepth);
    setAdviceMultiPv(p.adviceMultiPv);
    setArrowTuning((current) => ({ ...current, threatDepth: p.threatDepth }));
    setArenaDepth(p.arenaEvalDepth);
    setArenaMultiPv(p.arenaEvalMultiPv);
    setDrawEvalDepth(p.botDrawEvalDepth);
  };

  const navItems: {
    id: EngineSectionId;
    group: "roles" | "global";
    label: string;
    shortLabel: string;
    icon: string;
    summary: string;
    modified: boolean;
  }[] = [
    {
      id: "analysis",
      group: "roles",
      label: "Analysis & Editor",
      shortLabel: "Analysis",
      icon: "mdi:magnify",
      summary: `${engineLabel(engineName).small} · d${depth} · ${multiPv}L`,
      modified: analysisModified,
    },
    {
      id: "coach",
      group: "roles",
      label: "Coach · Grading",
      shortLabel: "Grading",
      icon: "mdi:school-outline",
      summary: `${labelFor(coachChoice)} · d${effCoach.depth} · ${effCoach.multiPv}L`,
      modified: coachModified,
    },
    {
      id: "coachDialogue",
      group: "roles",
      label: "Coach · Dialogue",
      shortLabel: "Dialogue",
      icon: "mdi:chat-processing-outline",
      summary: `${labelFor(dialogueChoice)} · ${
        effDialogue.movetimeMs > 0
          ? formatMovetime(effDialogue.movetimeMs)
          : `d${effDialogue.depth}`
      } · ${effDialogue.multiPv}L`,
      modified: dialogueModified,
    },
    {
      id: "advice",
      group: "roles",
      label: "Play Suggestions",
      shortLabel: "Hints",
      icon: "mdi:lightbulb-on-outline",
      summary: `${labelFor(adviceChoice)} · d${effAdvice.depth} · ${effAdvice.multiPv}L`,
      modified: adviceModified,
    },
    {
      id: "threats",
      group: "roles",
      label: "Threats",
      shortLabel: "Threats",
      icon: "mdi:alert-outline",
      summary: `${labelFor(threatsChoice)} · d${effThreat.depth} · ${arrowTuning.threatsShown} max`,
      modified: threatsModified,
    },
    {
      id: "evaluator",
      group: "roles",
      label: "Arena Evaluation",
      shortLabel: "Arena",
      icon: "mdi:sword-cross",
      summary: `${labelFor(evaluatorChoice)} · d${effArena.depth} · ${effArena.multiPv}L`,
      modified: arenaModified,
    },
    {
      id: "bots",
      group: "global",
      label: "Bots & Jokes",
      shortLabel: "Bots",
      icon: "mdi:robot-outline",
      summary: `${thinkMs / 1000}s full · d${effAdvisor.depth} advisor`,
      modified: botsModified,
    },
    {
      id: "power",
      group: "global",
      label: "Hardware & Power",
      shortLabel: "Power",
      icon: "mdi:tune-variant",
      summary: `${formatHash(hashMb)} · ${threads} ${threads === 1 ? "thread" : "threads"}`,
      modified: powerModified,
    },
  ];

  const dialogueInherited = dialogueInherit !== "custom";
  const dialogueMode: "time" | "depth" =
    effDialogue.movetimeMs > 0 ? "time" : "depth";

  const activePreset =
    !dialogueInherited && dialogueMovetimeMs === 180 && dialogueMultiPv === 2
      ? "fast"
      : !dialogueInherited &&
          dialogueMovetimeMs === 450 &&
          dialogueMultiPv === 3
        ? "balanced"
        : !dialogueInherited &&
            dialogueMovetimeMs === 0 &&
            dialogueDepth === 12 &&
            dialogueMultiPv === 3
          ? "deep"
          : null;

  const renderSection = () => {
    switch (section) {
      case "analysis":
        return (
          <Stack spacing={2.5}>
            <SectionHeader
              icon="mdi:magnify"
              title="Analysis & Editor"
              subtitle="Primary engine for game analysis, live evaluation, and the board editor. Every role set to inherit from Analysis follows these settings."
              isModified={analysisModified}
              onReset={resetAnalysis}
            />
            <EngineField
              label="Analysis engine"
              role="analysis"
              value={engineName}
              onChange={(next) => {
                if (next !== "analysis") setEngineName(next);
              }}
              helper="Bots in Play and the Arena have their own engine pickers. Download extra engines or check the native bridge in Models."
            />
            <Divider />
            <SettingSlider
              label="Search depth"
              value={depth}
              setValue={setDepth}
              min={6}
              max={30}
              marksFilter={4}
              formatValue={(v) => `Depth ${v}`}
              infoContent="How many half-moves ahead the analysis engine searches before finishing a position."
            />
            <SettingSlider
              label="Engine lines listed (MultiPV)"
              value={multiPv}
              setValue={setMultiPv}
              min={2}
              max={6}
              marksFilter={1}
              formatValue={(v) => `${v} lines`}
              infoContent="Number of top candidate variations evaluated and displayed in Analysis."
            />
            <SettingSlider
              label="Full-game analysis workers"
              value={workers}
              setValue={setWorkers}
              min={1}
              max={12}
              marksFilter={1}
              formatValue={(v) => `${v} ${v === 1 ? "worker" : "workers"}`}
              infoContent={
                <>
                  Parallel browser workers used when reviewing a whole game. The
                  recommended value for this device is{" "}
                  {getRecommendedWorkersNb()}.
                </>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={cloud}
                  onChange={(_, value) => setCloud(value)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">
                    Use Lichess cloud evaluations when available
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Fetches deep cached scores for known openings and endgames.
                  </Typography>
                </Box>
              }
            />
          </Stack>
        );

      case "coach":
        return (
          <Stack spacing={2.5}>
            <SectionHeader
              icon="mdi:school-outline"
              title="Coach · Move Grading"
              subtitle="Grades each move you make against a bot, updates the live evaluation bar, and detects missed tactics for review."
              isModified={coachModified}
              onReset={resetCoach}
            />
            <FeatureEngineSelect
              feature={featureById("coach")}
              label="Grading engine"
            />
            <Divider />
            <InheritSettingsGroup
              mode={coachInherit}
              modes={COACH_GRADING_INHERIT_MODES}
              onChange={setCoachInherit}
              inheritedSummary={`Depth ${effCoach.depth} · ${effCoach.multiPv} ${effCoach.multiPv === 1 ? "line" : "lines"}`}
            >
              <SettingSlider
                label="Grading search depth"
                disabled={coachInherit !== "custom"}
                value={effCoach.depth}
                setValue={setCoachDepth}
                min={COACH_GRADING_DEPTH_RANGE.min}
                max={COACH_GRADING_DEPTH_RANGE.max}
                marksFilter={4}
                formatValue={(v) => `Depth ${v}`}
                infoContent="Deeper searches grade subtle positional mistakes more accurately, while shallower depths grade moves faster."
              />
              <SettingSlider
                label="Lines evaluated (MultiPV)"
                disabled={coachInherit !== "custom"}
                value={effCoach.multiPv}
                setValue={setCoachMultiPv}
                min={COACH_GRADING_MULTIPV_RANGE.min}
                max={COACH_GRADING_MULTIPV_RANGE.max}
                marksFilter={1}
                formatValue={(v) => `${v} ${v === 1 ? "line" : "lines"}`}
                infoContent="Evaluating 2–3 lines lets the coach distinguish unique winning moves ('only move') from routine ones."
              />
            </InheritSettingsGroup>
          </Stack>
        );

      case "coachDialogue":
        return (
          <Stack spacing={2.5}>
            <SectionHeader
              icon="mdi:chat-processing-outline"
              title="Coach · Interactive Dialogue"
              subtitle="Evaluates board ideas for Coach David's real-time commentary, warnings, and in-game hints. Inherit from Coach Grading, Analysis, or the Bot, or tune independently."
              isModified={dialogueModified}
              onReset={resetDialogue}
            />
            <FeatureEngineSelect
              feature={featureById("coachDialogue")}
              label="Dialogue engine"
            />
            <Divider />
            <InheritSettingsGroup
              mode={dialogueInherit}
              modes={COACH_DIALOGUE_INHERIT_MODES}
              onChange={setDialogueInherit}
              inheritedSummary={`${
                effDialogue.movetimeMs > 0
                  ? formatMovetime(effDialogue.movetimeMs)
                  : `Depth ${effDialogue.depth}`
              } · ${effDialogue.multiPv} ${effDialogue.multiPv === 1 ? "line" : "lines"}`}
            >
              <Stack spacing={1}>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  color={dialogueInherited ? "text.disabled" : "text.primary"}
                >
                  Quick presets
                </Typography>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Chip
                    label="Fast · 180 ms · 2L"
                    size="small"
                    disabled={dialogueInherited}
                    clickable={!dialogueInherited}
                    color={activePreset === "fast" ? "primary" : "default"}
                    variant={activePreset === "fast" ? "filled" : "outlined"}
                    onClick={() => {
                      setDialogueMovetimeMs(180);
                      setDialogueDepth(7);
                      setDialogueMultiPv(2);
                    }}
                  />
                  <Chip
                    label="Balanced · 450 ms · 3L"
                    size="small"
                    disabled={dialogueInherited}
                    clickable={!dialogueInherited}
                    color={activePreset === "balanced" ? "primary" : "default"}
                    variant={
                      activePreset === "balanced" ? "filled" : "outlined"
                    }
                    onClick={() => {
                      setDialogueMovetimeMs(450);
                      setDialogueDepth(10);
                      setDialogueMultiPv(3);
                    }}
                  />
                  <Chip
                    label="Deep · Depth 12 · 3L"
                    size="small"
                    disabled={dialogueInherited}
                    clickable={!dialogueInherited}
                    color={activePreset === "deep" ? "primary" : "default"}
                    variant={activePreset === "deep" ? "filled" : "outlined"}
                    onClick={() => {
                      setDialogueMovetimeMs(0);
                      setDialogueDepth(12);
                      setDialogueMultiPv(3);
                    }}
                  />
                </Stack>
              </Stack>

              <Stack spacing={0.75}>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  color={dialogueInherited ? "text.disabled" : "text.primary"}
                >
                  Search stop rule
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  disabled={dialogueInherited}
                  value={dialogueMode}
                  aria-label="Coach dialogue search stop rule"
                  onChange={(_, mode: "time" | "depth" | null) => {
                    if (!mode) return;
                    if (mode === "time") {
                      setDialogueMovetimeMs(
                        dialogueMovetimeMs > 0
                          ? dialogueMovetimeMs
                          : DEFAULT_COACH_DIALOGUE_MOVETIME_MS
                      );
                    } else {
                      setDialogueMovetimeMs(0);
                    }
                  }}
                >
                  <ToggleButton value="time">Time budget (ms)</ToggleButton>
                  <ToggleButton value="depth">Fixed depth</ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary">
                  {dialogueMode === "time"
                    ? "Caps every dialogue check to a fixed millisecond budget so Coach David replies crisply without delaying the bot."
                    : "Searches every dialogue check to an exact ply depth before replying (slower on complex positions, more consistent tactics)."}
                </Typography>
              </Stack>

              {dialogueMode === "time" ? (
                <SettingSlider
                  label="Time budget per check"
                  disabled={dialogueInherited}
                  value={effDialogue.movetimeMs}
                  setValue={setDialogueMovetimeMs}
                  min={COACH_DIALOGUE_MOVETIME_RANGE.min}
                  max={COACH_DIALOGUE_MOVETIME_RANGE.max}
                  step={50}
                  formatValue={formatMovetime}
                  infoContent="How long the engine thinks for each position check requested by Coach David. 150–300 ms feels near-instant."
                />
              ) : (
                <SettingSlider
                  label="Dialogue search depth"
                  disabled={dialogueInherited}
                  value={effDialogue.depth}
                  setValue={setDialogueDepth}
                  min={COACH_DIALOGUE_DEPTH_RANGE.min}
                  max={COACH_DIALOGUE_DEPTH_RANGE.max}
                  marksFilter={2}
                  formatValue={(v) => `Depth ${v}`}
                  infoContent="Exact ply depth searched for every Coach David commentary and hint check."
                />
              )}

              <SettingSlider
                label="Candidate lines (MultiPV)"
                disabled={dialogueInherited}
                value={effDialogue.multiPv}
                setValue={setDialogueMultiPv}
                min={COACH_DIALOGUE_MULTIPV_RANGE.min}
                max={COACH_DIALOGUE_MULTIPV_RANGE.max}
                marksFilter={1}
                formatValue={(v) => `${v} ${v === 1 ? "line" : "lines"}`}
                infoContent="More lines help Coach David spot alternative good moves, at the cost of splitting search effort."
              />
            </InheritSettingsGroup>
          </Stack>
        );

      case "advice":
        return (
          <Stack spacing={2.5}>
            <SectionHeader
              icon="mdi:lightbulb-on-outline"
              title="Play Suggestions & Hints"
              subtitle="Powers the Hints panel and optional live suggestion arrows on the board during casual games against a bot."
              isModified={adviceModified}
              onReset={resetAdvice}
            />
            <FeatureEngineSelect
              feature={featureById("advice")}
              label="Suggestions engine"
            />
            <Divider />
            <InheritSettingsGroup
              mode={adviceInherit}
              modes={ADVICE_INHERIT_MODES}
              onChange={setAdviceInherit}
              inheritedSummary={`Depth ${effAdvice.depth} · ${effAdvice.multiPv} ${effAdvice.multiPv === 1 ? "move" : "moves"}`}
            >
              <SettingSlider
                label="Suggestions search depth"
                disabled={adviceInherit !== "custom"}
                value={effAdvice.depth}
                setValue={setAdviceDepth}
                min={ADVICE_DEPTH_RANGE.min}
                max={ADVICE_DEPTH_RANGE.max}
                marksFilter={4}
                formatValue={(v) => `Depth ${v}`}
                infoContent="Depth searched for board suggestion arrows and the Play Hints panel."
              />
              <SettingSlider
                label="Hint moves listed (MultiPV)"
                disabled={adviceInherit !== "custom"}
                value={effAdvice.multiPv}
                setValue={setAdviceMultiPv}
                min={ADVICE_MULTIPV_RANGE.min}
                max={ADVICE_MULTIPV_RANGE.max}
                marksFilter={1}
                formatValue={(v) => `${v} ${v === 1 ? "move" : "moves"}`}
                infoContent="How many top candidate moves appear when you open Hints during a casual game."
              />
            </InheritSettingsGroup>
          </Stack>
        );

      case "threats":
        return (
          <Stack spacing={2.5}>
            <SectionHeader
              icon="mdi:alert-outline"
              title="Threats"
              subtitle="Runs a separate pass-the-turn search in Analysis and Play to reveal what the opponent would win if it were their move."
              isModified={threatsModified}
              onReset={resetThreats}
            />
            <FeatureEngineSelect
              feature={featureById("threats")}
              label="Threats engine"
            />
            <Divider />
            <InheritSettingsGroup
              label="Threat depth"
              mode={threatsInherit}
              modes={THREATS_INHERIT_MODES}
              onChange={setThreatsInherit}
              inheritedSummary={`Depth ${effThreat.depth}`}
            >
              <SettingSlider
                label="Threat search depth"
                disabled={threatsInherit !== "custom"}
                value={effThreat.depth}
                setValue={(threatDepth) =>
                  setArrowTuning((current) => ({ ...current, threatDepth }))
                }
                min={THREAT_DEPTH_RANGE.min}
                max={THREAT_DEPTH_RANGE.max}
                marksFilter={2}
                formatValue={(v) => `Depth ${v}`}
                infoContent="How deep the pass-the-turn threat search runs. Synced with the Arrows settings tab."
              />
            </InheritSettingsGroup>
            <SettingSlider
              label="Maximum threats shown (MultiPV)"
              value={arrowTuning.threatsShown}
              setValue={(threatsShown) =>
                setArrowTuning((current) => ({ ...current, threatsShown }))
              }
              min={THREATS_SHOWN_RANGE.min}
              max={THREATS_SHOWN_RANGE.max}
              marksFilter={1}
              formatValue={(v) => `${v} ${v === 1 ? "threat" : "threats"}`}
            />
            <Stack spacing={0.75}>
              <Typography variant="body2" fontWeight={500}>
                Threat sensitivity
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={arrowTuning.threatSensitivity}
                aria-label="Threat sensitivity"
                onChange={(_, value: ThreatSensitivity | null) =>
                  value &&
                  setArrowTuning((current) => ({
                    ...current,
                    threatSensitivity: value,
                  }))
                }
              >
                {(
                  Object.keys(THREAT_SENSITIVITY_LABELS) as ThreatSensitivity[]
                ).map((key) => (
                  <ToggleButton key={key} value={key}>
                    {THREAT_SENSITIVITY_LABELS[key].label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary">
                {THREAT_SENSITIVITY_LABELS[arrowTuning.threatSensitivity].help}
              </Typography>
            </Stack>
          </Stack>
        );

      case "evaluator":
        return (
          <Stack spacing={2.5}>
            <SectionHeader
              icon="mdi:sword-cross"
              title="Arena Evaluation"
              subtitle="Scores every position, annotates moves, and calculates White/Black accuracy during Engine Arena matches."
              isModified={arenaModified}
              onReset={resetArena}
            />
            <FeatureEngineSelect
              feature={featureById("evaluator")}
              label="Arena evaluator engine"
            />
            <Divider />
            <InheritSettingsGroup
              mode={arenaInherit}
              modes={ARENA_EVAL_INHERIT_MODES}
              onChange={setArenaInherit}
              inheritedSummary={`Depth ${effArena.depth} · ${effArena.multiPv} ${effArena.multiPv === 1 ? "line" : "lines"}`}
            >
              <SettingSlider
                label="Arena evaluation depth"
                disabled={arenaInherit !== "custom"}
                value={effArena.depth}
                setValue={setArenaDepth}
                min={ARENA_EVAL_DEPTH_RANGE.min}
                max={ARENA_EVAL_DEPTH_RANGE.max}
                marksFilter={4}
                formatValue={(v) => `Depth ${v}`}
                infoContent="Depth searched per move by the Arena's background evaluator."
              />
              <SettingSlider
                label="Lines evaluated (MultiPV)"
                disabled={arenaInherit !== "custom"}
                value={effArena.multiPv}
                setValue={setArenaMultiPv}
                min={ARENA_EVAL_MULTIPV_RANGE.min}
                max={ARENA_EVAL_MULTIPV_RANGE.max}
                marksFilter={1}
                formatValue={(v) => `${v} ${v === 1 ? "line" : "lines"}`}
                infoContent="Multiple lines improve move classification and best-move arrows in the Arena."
              />
            </InheritSettingsGroup>
          </Stack>
        );

      case "bots":
        return (
          <Stack spacing={2.5}>
            <SectionHeader
              icon="mdi:robot-outline"
              title="Bots & Joke Engines"
              subtitle="Controls full-strength bot think budgets, draw-offer checks, and the real engine advising joke bots."
              isModified={botsModified}
              onReset={resetBots}
            />
            <FormControl fullWidth size="small">
              <InputLabel id="bot-reply-speed-label">
                Play reply pace
              </InputLabel>
              <Select
                labelId="bot-reply-speed-label"
                input={<OutlinedInput label="Play reply pace" />}
                value={botSpeed}
                onChange={(event) =>
                  setBotSpeed(event.target.value as BotReplySpeed)
                }
              >
                {BOT_REPLY_SPEEDS.map((speed) => (
                  <MenuItem key={speed} value={speed}>
                    {BOT_REPLY_SPEED_LABELS[speed]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <SettingSlider
              label="Full-strength bot think time"
              value={thinkMs / 1000}
              setValue={(seconds) => setThinkMs(Math.round(seconds * 1000))}
              min={MIN_FULL_STRENGTH_MS / 1000}
              max={MAX_FULL_STRENGTH_MS / 1000}
              formatValue={(v) => `${v} s`}
              infoContent="How long a bot thinks per move when set to full strength without a tighter game clock."
            />
            <InheritSettingsGroup
              label="Draw-offer check depth"
              mode={drawEvalInherit}
              modes={BOT_DRAW_EVAL_INHERIT_MODES}
              onChange={setDrawEvalInherit}
              inheritedSummary={`Depth ${effDrawEval.depth}`}
            >
              <SettingSlider
                label="Draw-offer evaluation depth"
                disabled={drawEvalInherit !== "custom"}
                value={effDrawEval.depth}
                setValue={setDrawEvalDepth}
                min={BOT_DRAW_EVAL_DEPTH_RANGE.min}
                max={BOT_DRAW_EVAL_DEPTH_RANGE.max}
                marksFilter={4}
                formatValue={(v) => `Depth ${v}`}
                infoContent="How deeply the bot evaluates the board before deciding whether to accept or decline your draw offer."
              />
            </InheritSettingsGroup>
            <Divider />
            <Typography variant="subtitle2" fontWeight={600}>
              Joke engines&apos; advisor
            </Typography>
            <FeatureEngineSelect
              feature={featureById("jokes")}
              label="Advisor engine"
            />
            <InheritSettingsGroup
              label="Advisor search depth"
              mode={advisorInherit}
              modes={JOKE_ADVISOR_INHERIT_MODES}
              onChange={setAdvisorInherit}
              inheritedSummary={`Depth ${effAdvisor.depth}`}
            >
              <SettingSlider
                label="Advisor search depth"
                disabled={advisorInherit !== "custom"}
                value={effAdvisor.depth}
                setValue={setAdvisorDepth}
                min={ADVISOR_DEPTH_RANGE.min}
                max={ADVISOR_DEPTH_RANGE.max}
                marksFilter={2}
                formatValue={(v) => `Depth ${v}`}
                infoContent="How deep the advisor searches each move for Drawfish, Worstfish, Pacifist, and Bongcloud. Deeper is slower but sharper at their jokes."
              />
            </InheritSettingsGroup>
          </Stack>
        );

      case "power":
        return (
          <Stack spacing={2.5}>
            <SectionHeader
              icon="mdi:tune-variant"
              title="Hardware & Power"
              subtitle="Global engine memory and native CPU thread limits applied across every engine instance (each engine clamps to what it supports)."
              isModified={powerModified}
              onReset={resetPower}
            />
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
                    {formatHash(mb)}
                    {mb === DEFAULT_HASH_MB ? " (default)" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <SettingSlider
              label="Threads for native engines"
              value={threads}
              setValue={setThreads}
              min={1}
              max={Math.min(
                MAX_NATIVE_THREADS,
                Math.max(2, recommendedNativeThreads())
              )}
              marksFilter={4}
              formatValue={(v) => `${v} ${v === 1 ? "thread" : "threads"}`}
              infoContent="Only native engines connected through the local bridge (such as Reckless) use multiple threads. Browser WASM engines always use 1."
            />

            <Divider />

            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              gap={1.5}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  <Icon icon="mdi:rocket-launch-outline" height={18} />
                }
                onClick={() => setGuideOpen(true)}
              >
                How to get maximum strength
              </Button>
              <Button
                size="small"
                color="warning"
                variant="outlined"
                disabled={modifiedCount === 0}
                startIcon={<Icon icon="mdi:restore" height={18} />}
                onClick={resetAll}
              >
                Reset all engine settings
                {modifiedCount > 0 ? ` (${modifiedCount})` : ""}
              </Button>
            </Stack>
          </Stack>
        );
    }
  };

  const roleItems = navItems.filter((item) => item.group === "roles");
  const globalItems = navItems.filter((item) => item.group === "global");

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="subtitle1" fontWeight={700}>
          Search presets
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Set search effort across Chesskit. Each role keeps its engine and
          inheritance choices.
        </Typography>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
          gap: 1.25,
        }}
      >
        {ENGINE_PRESET_IDS.map((id) => {
          const active = currentPreset === id;
          return (
            <ButtonBase
              key={id}
              aria-pressed={active}
              onClick={() => applyPreset(id)}
              sx={{
                display: "block",
                textAlign: "left",
                p: 1.5,
                border: 1,
                borderRadius: 1,
                borderColor: active ? "primary.main" : "divider",
                bgcolor: active
                  ? (t) => alpha(t.palette.primary.main, 0.12)
                  : "background.paper",
                "&:hover": {
                  bgcolor: active
                    ? (t) => alpha(t.palette.primary.main, 0.18)
                    : "action.hover",
                },
                "&.Mui-focusVisible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2,
                },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={0.75}
              >
                <Typography
                  fontWeight={700}
                  variant="body2"
                  color={active ? "primary.main" : "text.primary"}
                >
                  {ENGINE_PRESET_LABELS[id]}
                </Typography>
                {active && <Icon icon="mdi:check-circle" height={16} />}
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.25, display: "block" }}
              >
                {ENGINE_PRESET_DESCRIPTIONS[id]}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
      >
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography variant="caption" role="status" color="text.secondary">
            {currentPreset === "custom"
              ? "Custom search settings"
              : `${ENGINE_PRESET_LABELS[currentPreset]} search settings`}
          </Typography>
          <Button
            size="small"
            color="inherit"
            startIcon={<Icon icon="mdi:rocket-launch-outline" height={16} />}
            onClick={() => setGuideOpen(true)}
            sx={{ fontSize: "0.78rem" }}
          >
            Max strength guide
          </Button>
          {modifiedCount > 0 && (
            <Button
              size="small"
              color="warning"
              startIcon={<Icon icon="mdi:restore" height={16} />}
              onClick={resetAll}
              sx={{ fontSize: "0.78rem" }}
            >
              Reset all ({modifiedCount})
            </Button>
          )}
        </Stack>
        <Button
          size="small"
          variant={advanced ? "outlined" : "text"}
          aria-expanded={advanced}
          aria-controls="advanced-engine-settings"
          endIcon={
            <Icon
              icon={advanced ? "mdi:chevron-up" : "mdi:chevron-down"}
              height={18}
            />
          }
          onClick={() => setAdvanced(!advanced)}
        >
          {advanced ? "Hide advanced" : "Advanced settings"}
        </Button>
      </Stack>
      <Collapse in={advanced} unmountOnExit id="advanced-engine-settings">
        <Box
          sx={{
            display: "flex",
            flexDirection: isCompact ? "column" : "row",
            gap: isCompact ? 2 : 0,
            minHeight: isCompact ? undefined : 460,
            mx: isCompact ? 0 : -1,
          }}
        >
          {isCompact ? (
            <Stack
              direction="row"
              gap={0.75}
              sx={{
                overflowX: "auto",
                pb: 0.75,
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              {navItems.map((item) => {
                const active = section === item.id;
                return (
                  <Chip
                    key={item.id}
                    clickable
                    size="small"
                    icon={<Icon icon={item.icon} height={15} />}
                    label={
                      <Stack direction="row" alignItems="center" gap={0.6}>
                        <span>{item.shortLabel}</span>
                        {item.modified && (
                          <Box
                            component="span"
                            title="Customized from default"
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              bgcolor: active
                                ? "primary.contrastText"
                                : "primary.main",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </Stack>
                    }
                    color={active ? "primary" : "default"}
                    variant={active ? "filled" : "outlined"}
                    onClick={() => setSection(item.id)}
                    sx={{ flexShrink: 0 }}
                  />
                );
              })}
            </Stack>
          ) : (
            <Box
              sx={{
                width: 248,
                flexShrink: 0,
                pr: 1.5,
                borderRight: 1,
                borderColor: "divider",
              }}
            >
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ px: 1.25, fontSize: "0.68rem", letterSpacing: "0.08em" }}
              >
                Engine roles
              </Typography>
              <List dense disablePadding sx={{ mt: 0.25, mb: 1.5 }}>
                {roleItems.map((item) => {
                  const active = section === item.id;
                  return (
                    <ListItemButton
                      key={item.id}
                      selected={active}
                      onClick={() => setSection(item.id)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        px: 1.25,
                        py: 0.85,
                        alignItems: "flex-start",
                        gap: 1.1,
                        "&.Mui-selected": {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
                          "&:hover": {
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                          },
                        },
                      }}
                    >
                      <Box
                        sx={{
                          mt: 0.2,
                          color: active ? "primary.main" : "text.secondary",
                          flexShrink: 0,
                        }}
                      >
                        <Icon icon={item.icon} height={18} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          <Typography
                            variant="body2"
                            fontWeight={active ? 700 : 500}
                            noWrap
                            sx={{ lineHeight: 1.25 }}
                          >
                            {item.label}
                          </Typography>
                          {item.modified && (
                            <Box
                              component="span"
                              title="Customized from default"
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: "primary.main",
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          display="block"
                          sx={{
                            fontSize: "0.7rem",
                            fontVariantNumeric: "tabular-nums",
                            mt: 0.15,
                          }}
                        >
                          {item.summary}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  );
                })}
              </List>

              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ px: 1.25, fontSize: "0.68rem", letterSpacing: "0.08em" }}
              >
                Bots &amp; hardware
              </Typography>
              <List dense disablePadding sx={{ mt: 0.25 }}>
                {globalItems.map((item) => {
                  const active = section === item.id;
                  return (
                    <ListItemButton
                      key={item.id}
                      selected={active}
                      onClick={() => setSection(item.id)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        px: 1.25,
                        py: 0.85,
                        alignItems: "flex-start",
                        gap: 1.1,
                        "&.Mui-selected": {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
                          "&:hover": {
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                          },
                        },
                      }}
                    >
                      <Box
                        sx={{
                          mt: 0.2,
                          color: active ? "primary.main" : "text.secondary",
                          flexShrink: 0,
                        }}
                      >
                        <Icon icon={item.icon} height={18} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          <Typography
                            variant="body2"
                            fontWeight={active ? 700 : 500}
                            noWrap
                            sx={{ lineHeight: 1.25 }}
                          >
                            {item.label}
                          </Typography>
                          {item.modified && (
                            <Box
                              component="span"
                              title="Customized from default"
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: "primary.main",
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          display="block"
                          sx={{
                            fontSize: "0.7rem",
                            fontVariantNumeric: "tabular-nums",
                            mt: 0.15,
                          }}
                        >
                          {item.summary}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          )}

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              pl: isCompact ? 0 : 2.5,
              pr: isCompact ? 0 : 0.5,
            }}
          >
            {renderSection()}
          </Box>
        </Box>
      </Collapse>
      <MaxStrengthGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Stack>
  );
}
