import { DEFAULT_ENGINE } from "@/constants";
import {
  BotStrength,
  DEFAULT_STRENGTH,
  clampDepth,
  clampElo,
} from "@/lib/engine/strength";
import { GameEnd } from "@/lib/gameResult";
import { Odds } from "@/lib/odds";
import { storedAtom } from "@/lib/storedAtom";
import { Color, EngineName } from "@/types/enums";
import { CurrentPosition } from "@/types/eval";
import { Chess } from "chess.js";
import { atom } from "jotai";
import { Arrow } from "react-chessboard/dist/chessboard/types";

export type GameMode = "casual" | "formal";
export type ColorChoice = Color | "random";

export interface TimeControl {
  minutes: number;
  increment: number;
}

export const gameAtom = atom(new Chess());
export const gameDataAtom = atom<CurrentPosition>({});
export const playerColorAtom = atom<Color>(Color.White);
export const isGameInProgressAtom = atom(false);
export const gameIdAtom = atom(0);
export const activeGameModeAtom = atom<GameMode>("casual");
export const gameEndAtom = atom<GameEnd | null>(null);
export const clocksAtom = atom<{ w: number; b: number } | null>(null);
export const savedGameIdAtom = atom<number | null>(null);
export const startingPositionAtom = atom("");
export const boardFlippedAtom = atom(false);
export const hintArrowsAtom = atom<Arrow[]>([]);
export const botThinkingAtom = atom(false);

const isEngineName = (value: unknown): value is EngineName =>
  Object.values(EngineName).includes(value as EngineName);

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

const initialStrength = (): BotStrength => {
  const legacyElo = readLegacyElo();

  return {
    ...DEFAULT_STRENGTH,
    elo: legacyElo === undefined ? DEFAULT_STRENGTH.elo : clampElo(legacyElo),
    depth: clampDepth(DEFAULT_STRENGTH.depth),
  };
};

export const enginePlayNameAtom = storedAtom<EngineName>(
  "engine-play-name",
  DEFAULT_ENGINE,
  isEngineName
);

export const botStrengthAtom = storedAtom<BotStrength>(
  "bot-strength",
  initialStrength(),
  isBotStrength
);

export const gameModeAtom = storedAtom<GameMode>(
  "play-game-mode",
  "casual",
  (value): value is GameMode => value === "casual" || value === "formal"
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
