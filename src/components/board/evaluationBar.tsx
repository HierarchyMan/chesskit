import { Box, Grid2 as Grid, Typography } from "@mui/material";
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
 * position, and only dims to say so. Snapping to 50% and "?" on every move made
 * the bar flicker through a false "equal" before each real number, which reads
 * as the position changing when only the number is late. A fresh game starts
 * from the neutral bar again.
 */
export default function EvaluationBar({
  height,
  boardOrientation,
  currentPositionAtom = noPositionAtom,
  fen,
}: Props) {
  const [lastEval, setLastEval] = useState<typeof EMPTY_BAR | null>(null);
  const position = positionFor(useAtomValue(currentPositionAtom), fen);
  const motion = useMotionScale();
  const slide = motion ? `height ${motion}s, opacity ${motion}s` : "none";
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

  return (
    <Grid
      container
      justifyContent="center"
      alignItems="center"
      width={{ xs: "1.6rem", sm: "2rem" }}
      height={height}
      border="1px solid black"
      borderRadius={{ xs: "3px", sm: "5px" }}
      sx={{
        contain: "layout",
        opacity: pending ? 0.6 : 1,
        transition: slide,
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
          backgroundColor:
            boardOrientation === Color.White ? "#424242" : "white",
          transition: slide,
        }}
        height={`${
          boardOrientation === Color.White
            ? 100 - displayedEval.whiteBarPercentage
            : displayedEval.whiteBarPercentage
        }%`}
        width="100%"
        borderRadius={
          displayedEval.whiteBarPercentage === 100
            ? { xs: "3px", sm: "5px" }
            : { xs: "3px 3px 0 0", sm: "5px 5px 0 0" }
        }
      >
        <Typography
          color={boardOrientation === Color.White ? "white" : "black"}
          textAlign="center"
          width="100%"
          fontSize={{ xs: "0.9rem", sm: "1rem" }}
        >
          {(displayedEval.whiteBarPercentage < 50 &&
            boardOrientation === Color.White) ||
          (displayedEval.whiteBarPercentage >= 50 &&
            boardOrientation === Color.Black)
            ? displayedEval.label
            : ""}
        </Typography>
      </Box>

      <Box
        sx={{
          backgroundColor:
            boardOrientation === Color.White ? "white" : "#424242",
          transition: slide,
        }}
        height={`${
          boardOrientation === Color.White
            ? displayedEval.whiteBarPercentage
            : 100 - displayedEval.whiteBarPercentage
        }%`}
        width="100%"
        display="flex"
        alignItems="flex-end"
        borderRadius={
          displayedEval.whiteBarPercentage === 100
            ? { xs: "3px", sm: "5px" }
            : { xs: "0 0 3px 3px", sm: "0 0 5px 5px" }
        }
      >
        <Typography
          color={boardOrientation === Color.White ? "black" : "white"}
          textAlign="center"
          width="100%"
          fontSize={{ xs: "0.9rem", sm: "1rem" }}
        >
          {(displayedEval.whiteBarPercentage >= 50 &&
            boardOrientation === Color.White) ||
          (displayedEval.whiteBarPercentage < 50 &&
            boardOrientation === Color.Black)
            ? displayedEval.label
            : ""}
        </Typography>
      </Box>
    </Grid>
  );
}
