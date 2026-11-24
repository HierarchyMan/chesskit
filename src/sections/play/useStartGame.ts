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
  activeTimeControlAtom,
  timeControlAtom,
  reviewPlyAtom,
  clocksAtom,
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
      restart?: boolean;
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
      const restarting = overrides?.restart === true;
      const mode = challenge
        ? "casual"
        : store.get(restarting ? activeGameModeAtom : gameModeAtom);
      const coaching =
        mode === "casual" &&
        store.get(restarting ? activeCoachAtom : coachAtom);
      const timeControl = challenge
        ? { minutes: 0, increment: 0 }
        : store.get(restarting ? activeTimeControlAtom : timeControlAtom);

      const engineName = store.get(enginePlayNameAtom);
      const strength = challenge
        ? CHALLENGE_STRENGTH
        : store.get(botStrengthAtom);

      let startFen: string | undefined;
      try {
        if (challenge) {
          startFen = challenge.fen;
        } else if (restarting) {
          const current = store.get(gameAtom);
          startFen =
            current.history({ verbose: true })[0]?.before ?? current.fen();
        } else {
          const setup = playSetupPosition(
            store.get(startingPositionAtom),
            store.get(oddsAtom),
            botColor
          );
          if (setup.error) return setup.error;
          startFen = setup.fen;
        }
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
      store.set(activeGameModeAtom, mode);
      store.set(activeCoachAtom, coaching);
      const initialMs = timeControl.minutes * 60_000;
      store.set(activeTimeControlAtom, timeControl);
      store.set(
        clocksAtom,
        initialMs > 0 ? { w: initialMs, b: initialMs } : null
      );
      store.set(reviewPlyAtom, null);
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
    store.set(isGameInProgressAtom, false);
    resetGame({ noHeaders: true });
    store.set(activeCoachAtom, false);
    store.set(reviewPlyAtom, null);
    store.set(activeTimeControlAtom, { minutes: 0, increment: 0 });
    store.set(clocksAtom, null);
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

  const restartGame = useCallback(
    () =>
      startGame({
        playerColor: store.get(playerColorAtom),
        challengeId: store.get(challengeIdAtom) ?? undefined,
        restart: true,
      }),
    [startGame, store]
  );

  return { startGame, startChallenge, backToSetup, restartGame };
};

export type StartGame = ReturnType<typeof useStartGame>;
export const botStrengthLabel = botLabel;
export const opposite = (color: Color): Color =>
  color === Color.White ? Color.Black : Color.White;
