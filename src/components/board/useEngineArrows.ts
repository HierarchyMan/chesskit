import { LastMoveFeedback, buildEngineArrows } from "@/lib/arrows/engineArrows";
import { applyFocus } from "@/lib/arrows/legend";
import {
  ArrowCapabilities,
  ArrowPrefs,
  effectivePrefs,
} from "@/lib/arrows/prefs";
import { ArrowFocus, BoardArrow } from "@/lib/arrows/types";
import { positionFor } from "@/lib/currentPosition";
import { useThreats } from "@/hooks/useThreats";
import { CurrentPosition } from "@/types/eval";
import { arrowTuningAtom } from "@/lib/arrows/tuningAtom";
import { PrimitiveAtom, useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";

const NONE: readonly BoardArrow[] = [];

interface Options {
  position: CurrentPosition;
  fen: string;
  prefsAtom: PrimitiveAtom<ArrowPrefs>;
  /** Module-level, so the memoised result below stays stable. */
  capabilities: ArrowCapabilities;
  /**
   * Arrows a panel publishes from the engine's own answers: the top moves it
   * shows, the move a bot has chosen, or a hint. They are engine arrows, so
   * the master switch covers them as well.
   */
  extra?: readonly BoardArrow[];
  /** The graded last move, when the board's own snapshot does not have it. */
  feedback?: LastMoveFeedback;
}

/**
 * Everything a board draws for the engine: what the user asked for, the arrows
 * a panel adds, and the focus a legend entry or a hovered row puts on them.
 * One of these belongs to each displayed board, and the board and its side
 * panel both read it, so their arrows and their focus can never disagree.
 */
export const useEngineArrows = ({
  position,
  fen,
  prefsAtom,
  capabilities,
  extra = NONE,
  feedback,
}: Options) => {
  const [stored, setStored] = useAtom(prefsAtom);
  const tuning = useAtomValue(arrowTuningAtom);
  const [focus, setFocus] = useState<ArrowFocus | null>(null);

  // A focus is for the position it was made on, so a new position clears it.
  useEffect(() => setFocus(null), [fen]);

  const prefs = useMemo(
    () => effectivePrefs(stored, capabilities),
    [stored, capabilities]
  );
  // Threats are measured against the position's own evaluation, and are drawn
  // only where the mode offers them and the user switched them on.
  const threats = useThreats({
    fen,
    main: positionFor(position, fen).eval,
    enabled: prefs.enabled && prefs.threats,
  });
  const built = useMemo(
    () =>
      buildEngineArrows(position, fen, prefs, tuning, { threats, feedback }),
    [position, fen, prefs, tuning, threats, feedback]
  );
  // The master switch covers every automatic arrow, wherever it came from.
  // These come first, so the hover state they carry wins a tie.
  const arrows = useMemo(
    () => applyFocus([...(prefs.enabled ? extra : NONE), ...built], focus),
    [extra, built, focus, prefs.enabled]
  );

  const update = useCallback(
    (change: Partial<ArrowPrefs>) =>
      setStored((current) => ({ ...current, ...change })),
    [setStored]
  );

  return { arrows, prefs, update, setFocus };
};
