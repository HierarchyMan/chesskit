import { getMaterialDifference, getNetMaterialPieces } from "@/lib/chess";
import { Color } from "@/types/enums";
import { Box, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { Chess } from "chess.js";

export interface Props {
  fen: string;
  color: Color;
  game?: Chess;
}

const PIECE_SIZE = 16;

export default function CapturedPieces({ fen, color, game }: Props) {
  const activeFen = fen || game?.fen() || "";

  const netPieces = useMemo(
    () => (activeFen ? getNetMaterialPieces(activeFen, color) : []),
    [activeFen, color]
  );

  const materialDiff = useMemo(() => {
    if (!activeFen) return 0;
    try {
      const diff = getMaterialDifference(activeFen);
      return color === Color.White ? diff : -diff;
    } catch {
      return 0;
    }
  }, [activeFen, color]);

  const isEmpty = !netPieces.length && materialDiff <= 0;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.5}
      sx={{
        height: PIECE_SIZE,
        minHeight: PIECE_SIZE,
        maxHeight: PIECE_SIZE,
        flexShrink: 0,
        minWidth: 0,
        overflow: "hidden",
        visibility: isEmpty ? "hidden" : "visible",
      }}
      aria-hidden={isEmpty || undefined}
      aria-label={
        isEmpty
          ? undefined
          : `Material advantage for ${color === Color.White ? "White" : "Black"}`
      }
    >
      <Stack direction="row" alignItems="center" spacing={0.35}>
        {netPieces.map(({ piece, count }) => {
          const isBlackPiece = piece.startsWith("b");
          return (
            <Stack
              direction="row"
              alignItems="center"
              key={piece}
              sx={{ "& > *:not(:first-of-type)": { ml: "-7px" } }}
            >
              {Array.from({ length: count }).map((_, index) => (
                <Box
                  key={`${piece}-${index}`}
                  sx={(theme) => ({
                    width: PIECE_SIZE,
                    height: PIECE_SIZE,
                    flexShrink: 0,
                    backgroundImage: `url(/piece/cardinal/${piece}.svg)`,
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    filter:
                      theme.palette.mode === "dark" && isBlackPiece
                        ? "drop-shadow(0 0 1.25px rgba(255, 255, 255, 0.78)) drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45))"
                        : "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2))",
                  })}
                />
              ))}
            </Stack>
          );
        })}
      </Stack>

      {materialDiff > 0 && (
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{
            fontSize: "0.75rem",
            fontWeight: 600,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          +{materialDiff}
        </Typography>
      )}
    </Stack>
  );
}
