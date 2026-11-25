import { Orientation, squareCenter } from "@/lib/arrows/geometry";
import { BoardDraw } from "@/lib/boardDraw";

const clampPercent = (value: number) => Math.min(96.5, Math.max(3.5, value));

/** A terminal result is board state, independent of engine/annotation toggles. */
export default function DrawBadges({
  result,
  orientation,
}: {
  result: BoardDraw | null;
  orientation: Orientation;
}) {
  if (!result) return null;
  return result.kings.map((king) => {
    const { x, y } = squareCenter(king.square, orientation);
    const left = clampPercent((x + 0.38) * 12.5);
    const top = clampPercent((y - 0.38) * 12.5);

    return (
      <span
        key={king.square}
        role="img"
        aria-label={`${result.reason}: ${king.color === "w" ? "White" : "Black"} king`}
        data-draw-square={king.square}
        title={result.reason}
        style={{
          position: "absolute",
          left: `${left}%`,
          top: `${top}%`,
          transform: "translate(-50%, -50%)",
          width: "max(16px, 5.2%)",
          aspectRatio: "1",
          borderRadius: "50%",
          backgroundColor: "#6e737d",
          color: "#ffffff",
          border: "1.5px solid rgba(255, 255, 255, 0.92)",
          boxShadow: "0 1px 4px rgba(0, 0, 0, 0.48)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize:
            "max(9px, min(14px, calc(var(--board-size, 400px) * 0.027)))",
          lineHeight: 1,
          letterSpacing: "-0.04em",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 21,
        }}
      >
        ½
      </span>
    );
  });
}
