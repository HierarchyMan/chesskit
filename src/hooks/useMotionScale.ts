import { pieceMotionAtom } from "@/components/board/states";
import { motionScale } from "@/lib/pieceMotion";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * The multiplier every animated part of a board applies to its own duration:
 * 0 means no motion. It follows the user's piece-animation choice, and only
 * its "system" choice looks at the operating system's reduced-motion setting.
 */
export const useMotionScale = () => {
  const mode = useAtomValue(pieceMotionAtom);
  const [systemReduces, setSystemReduces] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(REDUCED);
    const update = () => setSystemReduces(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return motionScale(mode, systemReduces);
};
