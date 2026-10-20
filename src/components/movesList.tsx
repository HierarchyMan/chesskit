import PrettyMoveSan from "@/components/prettyMoveSan";
import { Box, ButtonBase, Typography } from "@mui/material";
import { useEffect, useRef } from "react";

interface Props {
  moves: string[];
  startsWithBlack?: boolean;
  firstMoveNumber?: number;
  currentPly?: number;
  onSelect?: (ply: number) => void;
  maxHeight?: number | string;
  emptyText?: string;
}

export default function MovesList({
  moves,
  startsWithBlack = false,
  firstMoveNumber = 1,
  currentPly,
  onSelect,
  maxHeight = 240,
  emptyText = "No moves yet",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const offset = startsWithBlack ? 1 : 0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const active = container.querySelector<HTMLElement>("[data-active='true']");
    if (!active) {
      container.scrollTop = container.scrollHeight;
      return;
    }

    const top = active.offsetTop - container.offsetTop;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (top + active.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = top + active.offsetHeight - container.clientHeight;
    }
  }, [currentPly, moves.length]);

  if (!moves.length) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.6, py: 1 }}>
        {emptyText}
      </Typography>
    );
  }

  const rowCount = Math.ceil((moves.length + offset) / 2);

  const renderCell = (ply: number) => {
    const san = moves[ply];
    if (san === undefined) return <Box />;

    const color = (ply + offset) % 2 === 0 ? "w" : "b";
    const active = currentPly !== undefined && currentPly - 1 === ply;

    return (
      <ButtonBase
        data-active={active}
        disabled={!onSelect}
        onClick={() => onSelect?.(ply + 1)}
        sx={{
          justifyContent: "flex-start",
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          fontSize: "0.95rem",
          backgroundColor: active ? "primary.main" : undefined,
          color: active ? "primary.contrastText" : undefined,
          "&:hover": { backgroundColor: active ? "primary.main" : "action.hover" },
        }}
      >
        <PrettyMoveSan san={san} color={active ? (color === "w" ? "b" : "w") : color} />
      </ButtonBase>
    );
  };

  return (
    <Box ref={containerRef} sx={{ maxHeight, overflowY: "auto", position: "relative" }}>
      {Array.from({ length: rowCount }).map((_, row) => {
        const whitePly = row * 2 - offset;
        const blackPly = whitePly + 1;

        return (
          <Box
            key={row}
            sx={{
              display: "grid",
              gridTemplateColumns: "2.4rem 1fr 1fr",
              alignItems: "center",
              backgroundColor: row % 2 ? "action.hover" : undefined,
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" sx={{ opacity: 0.55, pl: 0.75 }}>
              {firstMoveNumber + row}.
            </Typography>
            {renderCell(whitePly < 0 ? -1 : whitePly)}
            {renderCell(blackPly)}
          </Box>
        );
      })}
    </Box>
  );
}
