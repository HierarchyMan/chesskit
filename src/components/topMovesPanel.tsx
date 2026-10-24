import PrettyMoveSan from "@/components/prettyMoveSan";
import { EngineStatus } from "@/hooks/useEngine";
import { useTopMoves } from "@/hooks/useTopMoves";
import { MoveSide, TopMove, formatLine } from "@/lib/engine/topMoves";
import { UciEngine } from "@/lib/engine/uciEngine";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { BoardArrow } from "@/lib/arrows/types";
import { arrowFromUci } from "@/lib/arrows/uci";
import { colorWithOpacity, ownerColor, rankedStyle } from "@/lib/arrows/style";

interface Props {
  fen: string;
  positionKey?: string;
  engine: UciEngine | null;
  engineStatus?: EngineStatus;
  engineError?: string;
  onRetryEngine?: () => void;
  side: MoveSide;
  onSideChange?: (side: MoveSide) => void;
  count?: number;
  depth?: number;
  onArrows?: (arrows: BoardArrow[]) => void;
  onPlay?: (move: TopMove) => void;
  playLabel?: string;
}

const sideName = (fen: string, side: MoveSide): string => {
  const turn = fen.split(" ")[1] === "b" ? "Black" : "White";
  const other = turn === "White" ? "Black" : "White";
  return side === "mover" ? turn : other;
};

export default function TopMovesPanel({
  fen,
  positionKey,
  engine,
  engineStatus,
  engineError,
  onRetryEngine,
  side,
  onSideChange,
  count = 3,
  depth = 14,
  onArrows,
  onPlay,
  playLabel = "Play",
}: Props) {
  const { status, moves, queryFen, message } = useTopMoves({
    engine,
    fen,
    side,
    positionKey,
    depth,
    count,
  });
  const hoverKey = `${positionKey ?? ""}|${fen}|${side}`;
  const [hoverChoice, setHoverChoice] = useState<{
    key: string;
    rank: number;
  } | null>(null);
  const hovered = hoverChoice?.key === hoverKey ? hoverChoice.rank : null;

  useEffect(() => {
    if (!onArrows) return;

    const mover = queryFen?.split(" ")[1] === "b" ? "b" : "w";
    onArrows(
      moves.map((move) =>
        arrowFromUci(move.uci, {
          kind: move.rank === 1 ? "best" : "candidate",
          rank: move.rank,
          side: mover,
          dimmed: hovered !== null && move.rank - 1 !== hovered,
        })
      )
    );
  }, [moves, hovered, onArrows, queryFen]);

  useEffect(() => () => onArrows?.([]), [onArrows]);

  // Whose moves these are, and whose move it is on the board: the same rule as
  // the arrows, so a row's mark is the colour its arrow is drawn in.
  const turnColor = queryFen?.split(" ")[1] === "b" ? "b" : "w";
  const displayedTurn = fen.split(" ")[1] === "b" ? "b" : "w";
  const rowMark = (rank: number) => {
    const style = rankedStyle(rank, ownerColor(turnColor, displayedTurn));
    return {
      color: colorWithOpacity(style.color, Math.min(1, style.opacity + 0.2)),
      width: Math.max(2, Math.round(style.width * 20)),
    };
  };
  const isLoading = status === "loading";
  const engineFailed = engineStatus === "error";

  const description = useMemo(() => {
    const name = sideName(fen, side);
    return side === "mover"
      ? `Best moves for ${name} (to move)`
      : `What ${name} would play if it were their turn`;
  }, [fen, side]);

  return (
    <Stack spacing={1.25}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
      >
        <Typography variant="subtitle2">{description}</Typography>
        {onSideChange && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={side}
            onChange={(_, value: MoveSide | null) =>
              value && onSideChange(value)
            }
            aria-label="Which side to show"
          >
            <ToggleButton value="mover" sx={{ py: 0.25, px: 1.25 }}>
              {sideName(fen, "mover")}
            </ToggleButton>
            <ToggleButton value="opponent" sx={{ py: 0.25, px: 1.25 }}>
              {sideName(fen, "opponent")}
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      {side === "opponent" && (
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          A what-if, not a real move: it shows what that side would do if it
          could move right now, which reveals its threats.
        </Typography>
      )}

      {isLoading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {engineFailed && (
        <Alert
          severity="error"
          action={
            onRetryEngine && (
              <Button color="inherit" size="small" onClick={onRetryEngine}>
                Retry
              </Button>
            )
          }
        >
          {engineError ?? "The engine did not start."}
        </Alert>
      )}

      {status === "error" && !engineFailed && (
        <Alert severity="info">{message}</Alert>
      )}

      {!engineFailed && status !== "error" && moves.length === 0 && (
        <Stack spacing={0.75}>
          {Array.from({ length: count }).map((_, index) => (
            <Skeleton key={index} variant="rounded" height={34} />
          ))}
        </Stack>
      )}

      {moves.map((move) => (
        <Stack
          key={`${move.rank}-${move.uci}`}
          direction="row"
          alignItems="center"
          gap={1}
          tabIndex={0}
          onMouseEnter={() =>
            setHoverChoice({ key: hoverKey, rank: move.rank - 1 })
          }
          onMouseLeave={() => setHoverChoice(null)}
          onFocus={() => setHoverChoice({ key: hoverKey, rank: move.rank - 1 })}
          onBlur={() => setHoverChoice(null)}
          sx={{
            p: 0.75,
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
            borderLeft: `${rowMark(move.rank).width}px solid`,
            borderLeftColor: rowMark(move.rank).color,
          }}
        >
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography fontWeight={700} component="span">
                <PrettyMoveSan san={move.san} color={turnColor} />
              </Typography>
              <Box
                component="span"
                sx={{
                  px: 0.75,
                  borderRadius: 1,
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  border: "1px solid #424242",
                  backgroundColor: isBlackAdvantage(move) ? "#000" : "#fff",
                  color: isBlackAdvantage(move) ? "#fff" : "#000",
                }}
              >
                {move.evalLabel}
              </Box>
            </Stack>
            {move.pvSan.length > 1 && (
              <>
                <Typography variant="caption" display="block">
                  Then {turnColor === "w" ? "Black" : "White"} answers{" "}
                  <b>
                    <PrettyMoveSan
                      san={move.pvSan[1]}
                      color={turnColor === "w" ? "b" : "w"}
                    />
                  </b>
                </Typography>
                <Typography
                  variant="caption"
                  noWrap
                  display="block"
                  sx={{ opacity: 0.6 }}
                >
                  {formatLine(queryFen ?? fen, move.pvSan.slice(0, 7))}
                </Typography>
              </>
            )}
          </Box>
          {onPlay && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Icon icon="mdi:play" height={16} />}
              onClick={() => onPlay(move)}
            >
              {playLabel}
            </Button>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

const isBlackAdvantage = (move: TopMove): boolean =>
  (move.cp !== undefined && move.cp < 0) ||
  (move.mate !== undefined && move.mate < 0);
