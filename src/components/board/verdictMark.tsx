import { Orientation, squareCenter } from "@/lib/arrows/geometry";
import { useMotionScale } from "@/hooks/useMotionScale";
import { VerdictCue } from "./cues";

const POP =
  "@keyframes chesskit-mark-pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}";
const POP_MS = 160;

const COLORS = { correct: "#2e9d57", wrong: "#d83a3a" } as const;

/**
 * A tick or a cross in the corner of the square a move went to. Like the
 * move-quality mark it sits on the board rather than inside a square, so the
 * arrows do not cover it.
 */
export default function VerdictMark({
  verdict,
  orientation,
}: {
  verdict: VerdictCue;
  orientation: Orientation;
}) {
  const popMs = Math.round(POP_MS * useMotionScale());
  const { x, y } = squareCenter(verdict.square, orientation);
  const size = "min(40px, calc(var(--board-size) * 0.06))";

  return (
    <div
      role="img"
      aria-label={verdict.kind === "correct" ? "Correct move" : "Wrong move"}
      style={{
        position: "absolute",
        width: size,
        height: size,
        left: `calc(${(x + 0.5) * 12.5}% - ${size} / 2)`,
        top: `calc(${(y - 0.5) * 12.5}% - ${size} / 2)`,
        zIndex: 20,
        pointerEvents: "none",
        userSelect: "none",
        animation: popMs ? `chesskit-mark-pop ${popMs}ms ease-out` : "none",
      }}
    >
      <style>{POP}</style>
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="11"
          fill={COLORS[verdict.kind]}
          stroke="#ffffff"
          strokeWidth="1.6"
        />
        <path
          d={
            verdict.kind === "correct"
              ? "M6.6 12.4l3.6 3.6 7.2-7.6"
              : "M8 8l8 8M16 8l-8 8"
          }
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
