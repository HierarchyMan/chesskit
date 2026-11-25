import { Box, Typography } from "@mui/material";
import { PrimitiveAtom, atom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { getEvaluationBarValue } from "@/lib/chess";
import { Color } from "@/types/enums";
import { CurrentPosition } from "@/types/eval";
import { positionFor } from "@/lib/currentPosition";
import { useMotionScale } from "@/hooks/useMotionScale";

const noPositionAtom = atom<CurrentPosition>({});

const EMPTY_BAR = { whiteBarPercentage: 50, label: "—" };

interface Props {
  height: number;
  boardOrientation?: Color;
  currentPositionAtom?: PrimitiveAtom<CurrentPosition>;
  fen: string;
}

/**
 * The bar holds the last settled reading while the engine works on the new
 * position instead of snapping to 50% and "?" on every move. A fresh game
 * starts from the neutral bar again.
 */
export default function EvaluationBar({
  height,
  boardOrientation = Color.White,
  currentPositionAtom = noPositionAtom,
  fen,
}: Props) {
  const [lastEval, setLastEval] = useState<typeof EMPTY_BAR | null>(null);
  const position = positionFor(useAtomValue(currentPositionAtom), fen);
  const motion = useMotionScale();
  const heightTransition = motion
    ? `height ${motion}s cubic-bezier(0.22, 1, 0.36, 1)`
    : "none";
  const opacityTransition = motion
    ? `opacity ${Math.max(0.25, motion)}s ease`
    : "none";
  const evaluation = position.eval;
  const currentLine = evaluation?.lines[0];
  const exactEval =
    currentLine &&
    !currentLine.bound &&
    (currentLine.cp !== undefined || currentLine.mate !== undefined)
      ? evaluation
      : undefined;

  useEffect(() => {
    if (exactEval) setLastEval(getEvaluationBarValue(exactEval));
  }, [exactEval]);

  const displayedEval = exactEval
    ? getEvaluationBarValue(exactEval)
    : (lastEval ?? EMPTY_BAR);
  const pending = !exactEval;

  const isWhiteBottom = boardOrientation === Color.White;
  const topPercentage = isWhiteBottom
    ? 100 - displayedEval.whiteBarPercentage
    : displayedEval.whiteBarPercentage;
  const bottomPercentage = isWhiteBottom
    ? displayedEval.whiteBarPercentage
    : 100 - displayedEval.whiteBarPercentage;

  const showTopLabel =
    (displayedEval.whiteBarPercentage < 50 && isWhiteBottom) ||
    (displayedEval.whiteBarPercentage >= 50 && !isWhiteBottom);

  const labelSx = {
    textAlign: "center",
    width: "100%",
    fontSize: { xs: "0.62rem", sm: "0.68rem" },
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    px: "1px",
    py: 0.5,
    userSelect: "none",
  } as const;

  return (
    <Box
      width={{ xs: "1.6rem", sm: "2rem" }}
      height={height}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: "6px",
        border: 1,
        borderColor: "divider",
        contain: "layout",
        opacity: pending && !lastEval ? 0.78 : 1,
        transition: opacityTransition,
      }}
      role="img"
      aria-busy={pending}
      aria-label={
        pending
          ? lastEval
            ? `Updating evaluation. Previous reading: ${lastEval.label}`
            : "Evaluation pending"
          : `Position evaluation: ${displayedEval.label}`
      }
      title={pending ? "Updating evaluation…" : undefined}
    >
      <Box
        sx={{
          backgroundColor: isWhiteBottom ? "#34363c" : "#eeeff2",
          height: `${topPercentage}%`,
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          overflow: "hidden",
          transition: heightTransition,
        }}
      >
        <Typography color={isWhiteBottom ? "#f4f5f7" : "#1c1e22"} sx={labelSx}>
          {showTopLabel ? displayedEval.label : ""}
        </Typography>
      </Box>

      <Box
        sx={{
          backgroundColor: isWhiteBottom ? "#eeeff2" : "#34363c",
          height: `${bottomPercentage}%`,
          width: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          overflow: "hidden",
          transition: heightTransition,
        }}
      >
        <Typography color={isWhiteBottom ? "#1c1e22" : "#f4f5f7"} sx={labelSx}>
          {!showTopLabel ? displayedEval.label : ""}
        </Typography>
      </Box>

      <Box
        aria-hidden
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: "1px",
          bgcolor: "rgba(128, 128, 128, 0.48)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
    </Box>
  );
}
