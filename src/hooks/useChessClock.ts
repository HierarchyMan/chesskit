import { Color } from "@/types/enums";
import { Chess } from "chess.js";
import { PrimitiveAtom, useAtom } from "jotai";
import { useEffect, useRef } from "react";

interface Options {
  clocksAtom: PrimitiveAtom<{ w: number; b: number } | null>;
  game: Chess;
  running: boolean;
  gameId: number;
  initialMs: number;
  incrementMs: number;
  onTimeout: (loser: Color) => void;
}

const TICK_MS = 100;
const FIRST_MOVES_FREE_PLIES = 2;

export const useChessClock = ({
  clocksAtom,
  game,
  running,
  gameId,
  initialMs,
  incrementMs,
  onTimeout,
}: Options) => {
  const [clocks, setClocks] = useAtom(clocksAtom);
  const clocksRef = useRef(clocks);
  const lastTickRef = useRef(0);
  const previousPliesRef = useRef(0);
  const onTimeoutRef = useRef(onTimeout);

  const plies = game.history().length;
  const turn = game.turn();
  const timed = initialMs > 0;
  const isTicking = running && timed && plies >= FIRST_MOVES_FREE_PLIES;

  const turnRef = useRef(turn);
  const tickingRef = useRef(isTicking);

  useEffect(() => {
    clocksRef.current = clocks;
    onTimeoutRef.current = onTimeout;
    turnRef.current = turn;
    tickingRef.current = isTicking;
  });

  useEffect(() => {
    previousPliesRef.current = 0;
    lastTickRef.current = performance.now();

    const next = timed ? { w: initialMs, b: initialMs } : null;
    clocksRef.current = next;
    setClocks(next);
  }, [gameId, timed, initialMs, setClocks]);

  useEffect(() => {
    if (!timed || !clocksRef.current) return;

    if (
      plies > previousPliesRef.current &&
      plies > FIRST_MOVES_FREE_PLIES &&
      incrementMs > 0
    ) {
      const mover = turn === "w" ? "b" : "w";
      const next = {
        ...clocksRef.current,
        [mover]: clocksRef.current[mover] + incrementMs,
      };
      clocksRef.current = next;
      setClocks(next);
    }

    previousPliesRef.current = plies;
    lastTickRef.current = performance.now();
  }, [plies, turn, timed, incrementMs, setClocks]);

  useEffect(() => {
    if (!isTicking) return;

    lastTickRef.current = performance.now();

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;

      const current = clocksRef.current;
      if (!tickingRef.current || !current) return;

      const side = turnRef.current;
      const next = { ...current, [side]: Math.max(0, current[side] - elapsed) };
      clocksRef.current = next;
      setClocks(next);

      if (next[side] <= 0) {
        tickingRef.current = false;
        onTimeoutRef.current(side === "w" ? Color.White : Color.Black);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [isTicking, setClocks]);
};
