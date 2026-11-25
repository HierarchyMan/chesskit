import { LineEval } from "@/types/eval";
import { Box, ButtonBase, ListItem, Skeleton, Typography } from "@mui/material";
import { useAtomValue } from "jotai";
import { ReactNode } from "react";
import { boardAtom } from "../../../states";
import { getLineEvalLabel, moveLineUciToSan } from "@/lib/chess";
import { useChessActions } from "@/hooks/useChessActions";
import PrettyMoveSan from "@/components/prettyMoveSan";
import { arrowPaletteAtom } from "@/lib/arrows/paletteAtom";
import { colorWithOpacity, ownerColor, rankedStyle } from "@/lib/arrows/style";

interface Props {
  line: LineEval;
  onHover?: (rank: number | null) => void;
  action?: ReactNode;
}

export default function LineEvaluation({ line, onHover, action }: Props) {
  const board = useAtomValue(boardAtom);
  const palette = useAtomValue(arrowPaletteAtom);
  const { addMoves } = useChessActions(boardAtom);
  const lineLabel = getLineEvalLabel(line);

  const isBlackCp =
    (line.cp !== undefined && line.cp < 0) ||
    (line.mate !== undefined && line.mate < 0);

  const showSkeleton = line.depth < 6;

  const fen = board.fen();
  const uciToSan = moveLineUciToSan(fen);
  const turn = board.turn();
  const startFullmove = Number(fen.split(" ")[5]) || 1;

  const style = rankedStyle(line.multiPv, ownerColor(turn, turn, palette));
  const stripeColor = colorWithOpacity(
    style.color,
    Math.min(1, style.opacity + 0.15)
  );

  const getColorFromMoveIdx = (moveIdx: number): "w" | "b" =>
    moveIdx % 2 === 0 ? turn : turn === "w" ? "b" : "w";

  const getMoveNumberPrefix = (moveIdx: number, moveColor: "w" | "b") => {
    const moveNumber =
      startFullmove + Math.floor((moveIdx + (turn === "b" ? 1 : 0)) / 2);
    if (moveColor === "w") return `${moveNumber}.`;
    return moveIdx === 0 ? `${moveNumber}...` : "";
  };

  return (
    <ListItem
      disablePadding
      onMouseEnter={() => onHover?.(line.multiPv)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(line.multiPv)}
      onBlur={() => onHover?.(null)}
      sx={{
        alignItems: "flex-start",
        py: 0.45,
        pl: 1,
        pr: 0.5,
        gap: 0.85,
        borderLeft: "3px solid",
        borderLeftColor: showSkeleton ? "divider" : stripeColor,
        borderRadius: "0 6px 6px 0",
        transition: "background-color 120ms ease",
        "&:hover": {
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.03)"
              : "rgba(0,0,0,0.025)",
        },
      }}
    >
      <Box
        component="span"
        sx={{
          mt: 0.15,
          px: 0.65,
          py: 0.2,
          minWidth: 46,
          textAlign: "center",
          fontSize: "0.78rem",
          fontWeight: 700,
          lineHeight: 1.35,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          bgcolor: isBlackCp ? "#1e2026" : "#f4f5f7",
          color: isBlackCp ? "#f4f5f7" : "#141519",
        }}
      >
        {showSkeleton ? (
          <Skeleton
            variant="rounded"
            animation="wave"
            width={34}
            height={16}
            sx={{ mx: "auto" }}
          />
        ) : (
          lineLabel
        )}
      </Box>

      <Typography
        component="div"
        variant="body2"
        sx={{
          minWidth: 0,
          flex: 1,
          fontSize: "0.84rem",
          lineHeight: 1.65,
          overflowWrap: "anywhere",
        }}
      >
        {showSkeleton ? (
          <Skeleton
            variant="rounded"
            animation="wave"
            width="85%"
            height={18}
          />
        ) : (
          line.pv.map((uci, i) => {
            const san = uciToSan(uci);
            const moveColor = getColorFromMoveIdx(i);
            const prefix = getMoveNumberPrefix(i, moveColor);

            return (
              <Box
                component="span"
                key={i}
                sx={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  mr: 0.45,
                }}
              >
                {prefix && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      mr: 0.25,
                      fontVariantNumeric: "tabular-nums",
                      userSelect: "none",
                    }}
                  >
                    {prefix}
                  </Typography>
                )}
                <PrettyMoveSan
                  san={san}
                  color={moveColor}
                  typographyProps={{ fontSize: "0.84rem" }}
                  boxProps={{
                    component: ButtonBase,
                    onClick: () => {
                      addMoves(line.pv.slice(0, i + 1), board);
                    },
                    sx: {
                      cursor: "pointer",
                      border: 0,
                      background: "none",
                      color: "inherit",
                      font: "inherit",
                      px: 0.35,
                      py: 0.1,
                      borderRadius: 0.5,
                      transition: "background-color 120ms ease",
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                      "&:focus-visible": {
                        outline: "2px solid",
                        outlineColor: "primary.main",
                      },
                    },
                  }}
                />
              </Box>
            );
          })
        )}
      </Typography>

      {action && <Box sx={{ flexShrink: 0, mt: 0.05 }}>{action}</Box>}
    </ListItem>
  );
}
