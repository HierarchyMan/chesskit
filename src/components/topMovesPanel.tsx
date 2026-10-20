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
import { Arrow, Square } from "react-chessboard/dist/chessboard/types";

export const TOP_MOVE_COLORS = ["#22ac38", "#3894eb", "#e69f00", "#a06bd6", "#df5353", "#74b038"];

interface Props {
  fen: string;
  engine: UciEngine | null;
  engineStatus?: EngineStatus;
  engineError?: string;
  onRetryEngine?: () => void;
  side: MoveSide;
  onSideChange?: (side: MoveSide) => void;
  count?: number;
  depth?: number;
  onArrows?: (arrows: Arrow[]) => void;
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
  const { status, moves, queryFen, message, request } = useTopMoves({
    engine,
    depth,
    count,
  });
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    request(fen, side);
  }, [request, fen, side]);

  useEffect(() => {
    if (!onArrows) return;

    const arrows = moves
      .filter((move) => hovered === null || move.rank - 1 === hovered)
      .map(
        (move) =>
          [
            move.uci.slice(0, 2) as Square,
            move.uci.slice(2, 4) as Square,
            TOP_MOVE_COLORS[(move.rank - 1) % TOP_MOVE_COLORS.length],
          ] as Arrow
      );
    onArrows(arrows);
  }, [moves, hovered, onArrows]);

  useEffect(() => () => onArrows?.([]), [onArrows]);

  const turnColor = queryFen?.split(" ")[1] === "b" ? "b" : "w";
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
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Typography variant="subtitle2">{description}</Typography>
        {onSideChange && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={side}
            onChange={(_, value: MoveSide | null) => value && onSideChange(value)}
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
          onMouseEnter={() => setHovered(move.rank - 1)}
          onMouseLeave={() => setHovered(null)}
          sx={{
            p: 0.75,
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
            borderLeft: "4px solid",
            borderLeftColor: TOP_MOVE_COLORS[(move.rank - 1) % TOP_MOVE_COLORS.length],
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
              <Typography variant="caption" noWrap display="block" sx={{ opacity: 0.7 }}>
                {formatLine(queryFen ?? fen, move.pvSan.slice(0, 7))}
              </Typography>
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
