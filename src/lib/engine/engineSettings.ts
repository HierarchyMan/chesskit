import { storedAtom } from "@/lib/storedAtom";

/**
 * Engine settings that apply to every engine, each clamped to what the engine
 * itself advertises (a browser build has one thread, for instance).
 */

const isIntegerBetween =
  (min: number, max: number) =>
  (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max;

export interface EngineRuntimeSettings {
  hashMb: number;
  threads: number;
}

// 16 MB is what the engines use when nobody sets it.
export const DEFAULT_HASH_MB = 16;
export const HASH_CHOICES = [16, 32, 64, 128, 256, 512, 1024];
export const engineHashMbAtom = storedAtom(
  "engine-hash-mb",
  DEFAULT_HASH_MB,
  isIntegerBetween(1, 4096)
);

// Only native engines (through the bridge) can use more than one thread.
export const MAX_NATIVE_THREADS = 64;
export const nativeThreadsAtom = storedAtom(
  "engine-native-threads",
  1,
  isIntegerBetween(1, MAX_NATIVE_THREADS)
);

// How long a bot thinks per move at full strength, when no clock limits it.
export const DEFAULT_FULL_STRENGTH_MS = 3000;
export const MIN_FULL_STRENGTH_MS = 1000;
export const MAX_FULL_STRENGTH_MS = 30_000;
export const fullStrengthMsAtom = storedAtom(
  "bot-full-strength-ms",
  DEFAULT_FULL_STRENGTH_MS,
  isIntegerBetween(MIN_FULL_STRENGTH_MS, MAX_FULL_STRENGTH_MS)
);

// How deep the advisor engine searches each move for the joke engines.
export const DEFAULT_ADVISOR_DEPTH = 10;
export const jokeAdvisorDepthAtom = storedAtom(
  "joke-advisor-depth",
  DEFAULT_ADVISOR_DEPTH,
  isIntegerBetween(1, 20)
);

// Leaves one core for the browser and the rest of the computer.
export const recommendedNativeThreads = (): number =>
  typeof navigator === "undefined"
    ? 1
    : Math.max(
        1,
        Math.min(MAX_NATIVE_THREADS, (navigator.hardwareConcurrency || 2) - 1)
      );
