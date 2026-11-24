import { THREAT_DEPTH_RANGE } from "@/lib/arrows/tuning";
import { arrowTuningAtom } from "@/lib/arrows/tuningAtom";
import {
  ADVICE_DEPTH_RANGE,
  ADVICE_MULTIPV_RANGE,
  ADVISOR_DEPTH_RANGE,
  ARENA_EVAL_DEPTH_RANGE,
  ARENA_EVAL_MULTIPV_RANGE,
  BOT_DRAW_EVAL_DEPTH_RANGE,
  COACH_GRADING_DEPTH_RANGE,
  COACH_GRADING_MULTIPV_RANGE,
  adviceDepthAtom,
  adviceInheritAtom,
  adviceMultiPvAtom,
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
  fullStrengthMsAtom,
  getBotEffectiveSearch,
  jokeAdvisorDepthAtom,
  jokeAdvisorInheritAtom,
  resolveCoachDialogueSearch,
  resolveInheritedDepth,
  resolveInheritedMultiPv,
  threatsInheritAtom,
} from "@/lib/engine/engineSettings";
import { engineDepthAtom, engineMultiPvAtom } from "@/sections/analysis/states";
import { botStrengthAtom } from "@/sections/play/states";
import { useAtomValue, useStore } from "jotai";

type JotaiStore = ReturnType<typeof useStore>;

export const getEffectiveCoachGradingFromStore = (store: JotaiStore) => {
  const inheritMode = store.get(coachGradingInheritAtom);
  const customDepth = store.get(coachGradingDepthAtom);
  const customMultiPv = store.get(coachGradingMultiPvAtom);
  const analysisDepth = store.get(engineDepthAtom);
  const analysisMultiPv = store.get(engineMultiPvAtom);
  const bot = getBotEffectiveSearch(
    store.get(botStrengthAtom),
    store.get(fullStrengthMsAtom)
  );
  return {
    inheritMode,
    depth: resolveInheritedDepth(
      inheritMode,
      customDepth,
      COACH_GRADING_DEPTH_RANGE,
      { analysisDepth, botDepth: bot.depth }
    ),
    multiPv: resolveInheritedMultiPv(
      inheritMode,
      customMultiPv,
      COACH_GRADING_MULTIPV_RANGE,
      { analysisMultiPv }
    ),
  };
};

export const getEffectiveCoachDialogueFromStore = (store: JotaiStore) => {
  const inheritMode = store.get(coachDialogueInheritAtom);
  const custom = {
    depth: store.get(coachDialogueDepthAtom),
    multiPv: store.get(coachDialogueMultiPvAtom),
    movetimeMs: store.get(coachDialogueMovetimeMsAtom),
  };
  const analysisDepth = store.get(engineDepthAtom);
  const analysisMultiPv = store.get(engineMultiPvAtom);
  const coach = getEffectiveCoachGradingFromStore(store);
  const bot = getBotEffectiveSearch(
    store.get(botStrengthAtom),
    store.get(fullStrengthMsAtom)
  );
  return {
    inheritMode,
    ...resolveCoachDialogueSearch(inheritMode, custom, {
      analysisDepth,
      analysisMultiPv,
      coachDepth: coach.depth,
      coachMultiPv: coach.multiPv,
      botDepth: bot.depth,
      botMovetimeMs: bot.movetimeMs,
    }),
  };
};

export const useEffectiveCoachGrading = () => {
  const inheritMode = useAtomValue(coachGradingInheritAtom);
  const customDepth = useAtomValue(coachGradingDepthAtom);
  const customMultiPv = useAtomValue(coachGradingMultiPvAtom);
  const analysisDepth = useAtomValue(engineDepthAtom);
  const analysisMultiPv = useAtomValue(engineMultiPvAtom);
  const botStrength = useAtomValue(botStrengthAtom);
  const fullStrengthMs = useAtomValue(fullStrengthMsAtom);
  const bot = getBotEffectiveSearch(botStrength, fullStrengthMs);

  return {
    inheritMode,
    depth: resolveInheritedDepth(
      inheritMode,
      customDepth,
      COACH_GRADING_DEPTH_RANGE,
      { analysisDepth, botDepth: bot.depth }
    ),
    multiPv: resolveInheritedMultiPv(
      inheritMode,
      customMultiPv,
      COACH_GRADING_MULTIPV_RANGE,
      { analysisMultiPv }
    ),
  };
};

export const useEffectiveCoachDialogue = () => {
  const inheritMode = useAtomValue(coachDialogueInheritAtom);
  const depth = useAtomValue(coachDialogueDepthAtom);
  const multiPv = useAtomValue(coachDialogueMultiPvAtom);
  const movetimeMs = useAtomValue(coachDialogueMovetimeMsAtom);
  const analysisDepth = useAtomValue(engineDepthAtom);
  const analysisMultiPv = useAtomValue(engineMultiPvAtom);
  const coach = useEffectiveCoachGrading();
  const botStrength = useAtomValue(botStrengthAtom);
  const fullStrengthMs = useAtomValue(fullStrengthMsAtom);
  const bot = getBotEffectiveSearch(botStrength, fullStrengthMs);

  return {
    inheritMode,
    ...resolveCoachDialogueSearch(
      inheritMode,
      { depth, multiPv, movetimeMs },
      {
        analysisDepth,
        analysisMultiPv,
        coachDepth: coach.depth,
        coachMultiPv: coach.multiPv,
        botDepth: bot.depth,
        botMovetimeMs: bot.movetimeMs,
      }
    ),
  };
};

export const useEffectiveAdvice = () => {
  const inheritMode = useAtomValue(adviceInheritAtom);
  const customDepth = useAtomValue(adviceDepthAtom);
  const customMultiPv = useAtomValue(adviceMultiPvAtom);
  const analysisDepth = useAtomValue(engineDepthAtom);
  const analysisMultiPv = useAtomValue(engineMultiPvAtom);
  const botStrength = useAtomValue(botStrengthAtom);
  const fullStrengthMs = useAtomValue(fullStrengthMsAtom);
  const bot = getBotEffectiveSearch(botStrength, fullStrengthMs);

  return {
    inheritMode,
    depth: resolveInheritedDepth(inheritMode, customDepth, ADVICE_DEPTH_RANGE, {
      analysisDepth,
      botDepth: bot.depth,
    }),
    multiPv: resolveInheritedMultiPv(
      inheritMode,
      customMultiPv,
      ADVICE_MULTIPV_RANGE,
      { analysisMultiPv }
    ),
  };
};

export const useEffectiveThreatDepth = () => {
  const inheritMode = useAtomValue(threatsInheritAtom);
  const tuning = useAtomValue(arrowTuningAtom);
  const analysisDepth = useAtomValue(engineDepthAtom);
  const botStrength = useAtomValue(botStrengthAtom);
  const fullStrengthMs = useAtomValue(fullStrengthMsAtom);
  const bot = getBotEffectiveSearch(botStrength, fullStrengthMs);

  return {
    inheritMode,
    depth: resolveInheritedDepth(
      inheritMode,
      tuning.threatDepth,
      THREAT_DEPTH_RANGE,
      { analysisDepth, botDepth: bot.depth }
    ),
  };
};

export const useEffectiveArenaEval = () => {
  const inheritMode = useAtomValue(arenaEvalInheritAtom);
  const customDepth = useAtomValue(arenaEvalDepthAtom);
  const customMultiPv = useAtomValue(arenaEvalMultiPvAtom);
  const analysisDepth = useAtomValue(engineDepthAtom);
  const analysisMultiPv = useAtomValue(engineMultiPvAtom);

  return {
    inheritMode,
    depth: resolveInheritedDepth(
      inheritMode,
      customDepth,
      ARENA_EVAL_DEPTH_RANGE,
      { analysisDepth }
    ),
    multiPv: resolveInheritedMultiPv(
      inheritMode,
      customMultiPv,
      ARENA_EVAL_MULTIPV_RANGE,
      { analysisMultiPv }
    ),
  };
};

export const useEffectiveBotDrawEvalDepth = () => {
  const inheritMode = useAtomValue(botDrawEvalInheritAtom);
  const customDepth = useAtomValue(botDrawEvalDepthAtom);
  const analysisDepth = useAtomValue(engineDepthAtom);
  const botStrength = useAtomValue(botStrengthAtom);
  const fullStrengthMs = useAtomValue(fullStrengthMsAtom);
  const bot = getBotEffectiveSearch(botStrength, fullStrengthMs);

  return {
    inheritMode,
    depth: resolveInheritedDepth(
      inheritMode,
      customDepth,
      BOT_DRAW_EVAL_DEPTH_RANGE,
      { analysisDepth, botDepth: bot.depth }
    ),
  };
};

export const useEffectiveJokeAdvisorDepth = () => {
  const inheritMode = useAtomValue(jokeAdvisorInheritAtom);
  const customDepth = useAtomValue(jokeAdvisorDepthAtom);
  const analysisDepth = useAtomValue(engineDepthAtom);

  return {
    inheritMode,
    depth: resolveInheritedDepth(
      inheritMode,
      customDepth,
      ADVISOR_DEPTH_RANGE,
      { analysisDepth }
    ),
  };
};
