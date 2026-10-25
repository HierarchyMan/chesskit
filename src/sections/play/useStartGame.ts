import { engineLabel } from "@/constants";
import { useChessActions } from "@/hooks/useChessActions";
import { getEndgame } from "@/lib/endgames";
import { BotStrength, CHALLENGE_STRENGTH } from "@/lib/engine/strength";
import { effectiveStrength } from "@/lib/engine/botMove";
import { playSetupPosition } from "@/lib/setupPosition";
import { Color, EngineId } from "@/types/enums";
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

const botLabel = (engine: EngineId, chosen: BotStrength): string => {
  const name = engineLabel(engine).small;
  const strength = effectiveStrength(engine, chosen);
  if (!strength) return name;
  if (strength.mode === "depth") return `${name} (depth ${strength.depth})`;
  if (strength.mode === "max") return `${name} (max)`;
  return name;
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
        choice === "random" ? store.get(playerColorAtom) : choice;
      const botColor = playerColor === Color.White ? Color.Black : Color.White;

      const engineName = store.get(enginePlayNameAtom);
      const strength = challenge
        ? CHALLENGE_STRENGTH
        : store.get(botStrengthAtom);

      let startFen: string | undefined;
      try {
        const setup = playSetupPosition(
          store.get(startingPositionAtom),
          store.get(oddsAtom),
          botColor
        );
        if (!challenge && setup.error) return setup.error;
        startFen = challenge ? challenge.fen : setup.fen;
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
        rating:
          effectiveStrength(engineName, strength)?.mode === "elo"
            ? strength.elo
            : undefined,
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
