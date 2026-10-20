import { GridRect, RawImage } from "@/lib/scan/gridDetect";
import { Box } from "@mui/material";
import { KeyboardEvent, PointerEvent, useRef } from "react";

type Mode = "move" | "tl" | "tr" | "bl" | "br";

interface DragState {
  mode: Mode;
  startX: number;
  startY: number;
  grid: GridRect;
}

interface Props {
  src: string;
  raw: RawImage;
  grid: GridRect;
  onChange: (grid: GridRect) => void;
}

const MIN_SIZE = 64;
const HANDLE = 18;

const clampGrid = (grid: GridRect, raw: RawImage): GridRect => {
  const size = Math.max(MIN_SIZE, Math.min(grid.size, raw.width, raw.height));
  return {
    size,
    x: Math.max(0, Math.min(grid.x, raw.width - size)),
    y: Math.max(0, Math.min(grid.y, raw.height - size)),
  };
};

const CORNERS: {
  mode: Mode;
  sx: Record<string, string | number>;
  cursor: string;
}[] = [
  {
    mode: "tl",
    sx: { left: -HANDLE / 2, top: -HANDLE / 2 },
    cursor: "nwse-resize",
  },
  {
    mode: "tr",
    sx: { right: -HANDLE / 2, top: -HANDLE / 2 },
    cursor: "nesw-resize",
  },
  {
    mode: "bl",
    sx: { left: -HANDLE / 2, bottom: -HANDLE / 2 },
    cursor: "nesw-resize",
  },
  {
    mode: "br",
    sx: { right: -HANDLE / 2, bottom: -HANDLE / 2 },
    cursor: "nwse-resize",
  },
];

export default function GridFrame({ src, raw, grid, onChange }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const startDrag = (mode: Mode) => (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      grid,
    };
  };

  const onMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;

    const dx = ((event.clientX - drag.startX) * raw.width) / rect.width;
    const dy = ((event.clientY - drag.startY) * raw.height) / rect.height;
    const { x, y, size } = drag.grid;
    const right = x + size;
    const bottom = y + size;

    switch (drag.mode) {
      case "move":
        onChange(clampGrid({ x: x + dx, y: y + dy, size }, raw));
        break;
      case "br": {
        const next = Math.max(size + dx, size + dy);
        onChange(
          clampGrid(
            { x, y, size: Math.min(next, raw.width - x, raw.height - y) },
            raw
          )
        );
        break;
      }
      case "tl": {
        const next = Math.min(Math.max(size - dx, size - dy), right, bottom);
        onChange(
          clampGrid({ x: right - next, y: bottom - next, size: next }, raw)
        );
        break;
      }
      case "tr": {
        const next = Math.min(
          Math.max(size + dx, size - dy),
          raw.width - x,
          bottom
        );
        onChange(clampGrid({ x, y: bottom - next, size: next }, raw));
        break;
      }
      case "bl": {
        const next = Math.min(
          Math.max(size - dx, size + dy),
          right,
          raw.height - y
        );
        onChange(clampGrid({ x: right - next, y, size: next }, raw));
        break;
      }
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number, number]> = {
      ArrowLeft: [-step, 0, 0],
      ArrowRight: [step, 0, 0],
      ArrowUp: [0, -step, 0],
      ArrowDown: [0, step, 0],
      "+": [0, 0, step * 2],
      "=": [0, 0, step * 2],
      "-": [0, 0, -step * 2],
    };
    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    event.stopPropagation();
    onChange(
      clampGrid(
        { x: grid.x + move[0], y: grid.y + move[1], size: grid.size + move[2] },
        raw
      )
    );
  };

  return (
    <Box
      ref={wrapperRef}
      sx={{
        position: "relative",
        lineHeight: 0,
        userSelect: "none",
        touchAction: "none",
        borderRadius: 2,
        overflow: "hidden",
        border: 1,
        borderColor: "divider",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Picture of a chess board"
        draggable={false}
        style={{ width: "100%", display: "block" }}
      />

      <Box
        tabIndex={0}
        role="group"
        aria-label="Board frame. Drag to move, drag the corners to resize, or use the arrow keys."
        onPointerDown={startDrag("move")}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        sx={{
          position: "absolute",
          left: `${(grid.x / raw.width) * 100}%`,
          top: `${(grid.y / raw.height) * 100}%`,
          width: `${(grid.size / raw.width) * 100}%`,
          height: `${(grid.size / raw.height) * 100}%`,
          border: "2px solid #22ac38",
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.35)",
          cursor: "move",
          outline: "none",
          "&:focus-visible": { borderColor: "#3894eb" },
          backgroundImage: `
            repeating-linear-gradient(to right, rgba(34,172,56,0.7) 0 1px, transparent 1px 12.5%),
            repeating-linear-gradient(to bottom, rgba(34,172,56,0.7) 0 1px, transparent 1px 12.5%)`,
        }}
      >
        {CORNERS.map((corner) => (
          <Box
            key={corner.mode}
            onPointerDown={startDrag(corner.mode)}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            sx={{
              position: "absolute",
              width: HANDLE,
              height: HANDLE,
              borderRadius: "50%",
              backgroundColor: "#22ac38",
              border: "2px solid #fff",
              cursor: corner.cursor,
              ...corner.sx,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
