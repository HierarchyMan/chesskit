import { ENGINE_LABELS } from "@/constants";
import { useChessActions } from "@/hooks/useChessActions";
import { getEndgame } from "@/lib/endgames";
import { BotStrength, CHALLENGE_STRENGTH } from "@/lib/engine/strength";
import { Odds, getOddsFen } from "@/lib/odds";
import { loadGameFromText, normalizeFen } from "@/lib/pgn";
import { Color, EngineName } from "@/types/enums";
import { Chess } from "chess.js";
import { useStore } from "jotai";
import { useCallback } from "react";
import {
  activeCoachAtom,
  activeGameModeAtom,
  coachAtom,
  boardFlippedAtom,
  botStrengthAtom,
  challengeIdAtom,
  challengeStatusAtom,
  colorChoiceAtom,
  enginePlayNameAtom,
  gameAtom,
  gameEndAtom,
  gameIdAtom,
  gameModeAtom,
  hintArrowsAtom,
  isGameInProgressAtom,
  oddsAtom,
  playerColorAtom,
  savedGameIdAtom,
  startingPositionAtom,
} from "./states";

const botLabel = (engine: EngineName, strength: BotStrength): string => {
  const name = ENGINE_LABELS[engine].small;
  if (strength.mode === "depth") return `${name} (depth ${strength.depth})`;
  if (strength.mode === "max") return `${name} (max)`;
  return name;
};

const resolveStartFen = (
  startingText: string,
  odds: Odds,
  botColor: Color
): string | undefined => {
  if (odds !== "none") return getOddsFen(odds, botColor);

  const input = startingText.trim();
  if (!input) return undefined;

  if (input.startsWith("[") || /(^|\s)1\s*\./.test(input)) {
    return loadGameFromText(input).fen();
  }

  const fen = normalizeFen(input);
  if (!fen) throw new Error("That is not a valid FEN or PGN");
  return fen;
};

export const useStartGame = () => {
  const store = useStore();
  const { reset: resetGame } = useChessActions(gameAtom);

  const startGame = useCallback(
    (overrides?: {
      playerColor?: Color;
      challengeId?: string;
    }): string | undefined => {
      const challenge = overrides?.challengeId
        ? getEndgame(overrides.challengeId)
        : undefined;
      if (overrides?.challengeId && !challenge) {
        return "That endgame does not exist.";
      }

      const choice =
        overrides?.playerColor ??
        (challenge
          ? challenge.player === "w"
            ? Color.White
            : Color.Black
          : store.get(colorChoiceAtom));
      const playerColor =
        choice === "random"
          ? Math.random() < 0.5
            ? Color.White
            : Color.Black
          : choice;
      const botColor = playerColor === Color.White ? Color.Black : Color.White;

      const engineName = store.get(enginePlayNameAtom);
      const strength = challenge
        ? CHALLENGE_STRENGTH
        : store.get(botStrengthAtom);

      let startFen: string | undefined;
      try {
        startFen = challenge
          ? challenge.fen
          : resolveStartFen(
              store.get(startingPositionAtom),
              store.get(oddsAtom),
              botColor
            );
        if (startFen && new Chess(startFen).isGameOver()) {
          return "That position is already finished.";
        }
      } catch (error) {
        return error instanceof Error
          ? `${error.message}.`
          : "Unreadable start position.";
      }

      const bot = {
        name: botLabel(engineName, strength),
        rating: strength.mode === "elo" ? strength.elo : undefined,
      };
      const human = { name: "You" };

      resetGame({
        white: playerColor === Color.White ? human : bot,
        black: playerColor === Color.Black ? human : bot,
        fen: startFen,
      });

      store.set(playerColorAtom, playerColor);
      store.set(
        activeGameModeAtom,
        challenge ? "casual" : store.get(gameModeAtom)
      );
      store.set(
        activeCoachAtom,
        !challenge &&
          store.get(gameModeAtom) === "casual" &&
          store.get(coachAtom)
      );
      store.set(challengeIdAtom, challenge?.id ?? null);
      store.set(challengeStatusAtom, "active");
      store.set(gameEndAtom, null);
      store.set(savedGameIdAtom, null);
      store.set(boardFlippedAtom, false);
      store.set(hintArrowsAtom, []);
      store.set(gameIdAtom, store.get(gameIdAtom) + 1);
      store.set(isGameInProgressAtom, true);

      return undefined;
    },
    [store, resetGame]
  );

  const backToSetup = useCallback(() => {
    resetGame({ noHeaders: true });
    store.set(isGameInProgressAtom, false);
    store.set(gameEndAtom, null);
    store.set(savedGameIdAtom, null);
    store.set(hintArrowsAtom, []);
    store.set(boardFlippedAtom, false);
    store.set(challengeIdAtom, null);
    store.set(challengeStatusAtom, "active");
  }, [store, resetGame]);

  const startChallenge = useCallback(
    (id: string) => startGame({ challengeId: id }),
    [startGame]
  );

  return { startGame, startChallenge, backToSetup };
};

export type StartGame = ReturnType<typeof useStartGame>;
export const botStrengthLabel = botLabel;
export const opposite = (color: Color): Color =>
  color === Color.White ? Color.Black : Color.White;
