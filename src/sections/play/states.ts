import { DEFAULT_ENGINE } from "@/constants";
import {
  BotStrength,
  DEFAULT_STRENGTH,
  clampDepth,
  clampElo,
} from "@/lib/engine/strength";
import { ChallengeStatus } from "@/lib/endgames";
import { GameEnd } from "@/lib/gameResult";
import { Odds } from "@/lib/odds";
import { storedAtom } from "@/lib/storedAtom";
import { chessPathKey } from "@/lib/chessHistory";
import { createArrowPrefsAtom } from "@/lib/arrows/prefsAtom";
import { createPositionArrowsAtom } from "@/lib/engine/topMoves";
import { Color, EngineId } from "@/types/enums";
import { isEngineId } from "@/lib/engine/models";
import { Chess } from "chess.js";
import { atom } from "jotai";

export type GameMode = "casual" | "formal";
export type ColorChoice = Color | "random";

export interface TimeControl {
  minutes: number;
  increment: number;
}

export const gameAtom = atom(new Chess());
export const playerColorAtom = atom<Color>(Color.White);
export const isGameInProgressAtom = atom(false);
export const gameIdAtom = atom(0);
export const reviewPlyAtom = atom<number | null>(null);
export const activeGameModeAtom = atom<GameMode>("casual");
export const activeCoachAtom = atom(false);
export const gameEndAtom = atom<GameEnd | null>(null);
export const clocksAtom = atom<{ w: number; b: number } | null>(null);
export const savedGameIdAtom = atom<number | null>(null);
export const startingPositionAtom = atom("");
export const boardFlippedAtom = atom(false);
export const hintPositionKeyAtom = atom(
  (get) => `${get(gameIdAtom)}|${chessPathKey(get(gameAtom))}`
);
export const hintArrowsAtom = createPositionArrowsAtom(hintPositionKeyAtom);
export const playArrowPrefsAtom = createArrowPrefsAtom("play");
export const botThinkingAtom = atom(false);
export const challengeIdAtom = atom<string | null>(null);
export const challengeStatusAtom = atom<ChallengeStatus>("active");

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isBotStrength = (value: unknown): value is BotStrength =>
  isObject(value) &&
  (value.mode === "elo" || value.mode === "depth" || value.mode === "max") &&
  typeof value.elo === "number" &&
  typeof value.depth === "number";

const isTimeControl = (value: unknown): value is TimeControl =>
  isObject(value) &&
  typeof value.minutes === "number" &&
  typeof value.increment === "number";

const readLegacyElo = (): number | undefined => {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem("engine-elo");
    const elo = raw ? Number(JSON.parse(raw)) : NaN;
    return Number.isFinite(elo) ? elo : undefined;
  } catch {
    return undefined;
  }
};

const DEFAULT_BOT_STRENGTH: BotStrength = {
  ...DEFAULT_STRENGTH,
  depth: clampDepth(DEFAULT_STRENGTH.depth),
};

const legacyBotStrength = (): BotStrength | undefined => {
  const legacyElo = readLegacyElo();
  if (legacyElo === undefined) return undefined;

  return { ...DEFAULT_BOT_STRENGTH, elo: clampElo(legacyElo) };
};

export const enginePlayNameAtom = storedAtom<EngineId>(
  "engine-play-name",
  DEFAULT_ENGINE,
  isEngineId
);

export const botStrengthAtom = storedAtom<BotStrength>(
  "bot-strength",
  DEFAULT_BOT_STRENGTH,
  isBotStrength,
  legacyBotStrength
);

export const gameModeAtom = storedAtom<GameMode>(
  "play-game-mode",
  "casual",
  (value): value is GameMode => value === "casual" || value === "formal"
);

export const coachAtom = storedAtom<boolean>(
  "play-coach",
  true,
  (value): value is boolean => typeof value === "boolean"
);

/** Shown beside the board during casual Play games, independently of Coach. */
export const playEvalBarAtom = storedAtom<boolean>(
  "play-eval-bar",
  true,
  (value): value is boolean => typeof value === "boolean"
);

/** Allow engine suggestion/threat arrows on the board even while Coach is active (off by default). */
export const playArrowsWithCoachAtom = storedAtom<boolean>(
  "play-arrows-with-coach",
  false,
  (value): value is boolean => typeof value === "boolean"
);

export const colorChoiceAtom = storedAtom<ColorChoice>(
  "play-color-choice",
  Color.White,
  (value): value is ColorChoice =>
    value === Color.White || value === Color.Black || value === "random"
);

export const timeControlAtom = storedAtom<TimeControl>(
  "play-time-control",
  { minutes: 0, increment: 0 },
  isTimeControl
);

export const oddsAtom = storedAtom<Odds>(
  "play-odds",
  "none",
  (value): value is Odds =>
    ["none", "pawn", "knight", "bishop", "rook", "queen"].includes(
      value as string
    )
);

export const coachPersonaIdAtom = storedAtom<string>(
  "play-coach-persona",
  "David",
  (value): value is string => typeof value === "string" && value.length > 0
);

export const coachVoiceEnabledAtom = storedAtom<boolean>(
  "play-coach-voice",
  false,
  (value): value is boolean => typeof value === "boolean"
);

/** True while an in-board coach refutation cascade is playing, pausing bot replies. */
export const playCascadeActiveAtom = atom(false);

export const activeTimeControlAtom = atom<TimeControl>({
  minutes: 0,
  increment: 0,
});

export const playPremovesAtom = storedAtom<boolean>(
  "play-premoves",
  true,
  (value): value is boolean => typeof value === "boolean"
);
