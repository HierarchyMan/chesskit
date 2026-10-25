import { Orientation, squareCenter } from "@/lib/arrows/geometry";
import { BoardDraw } from "@/lib/boardDraw";
import { useAtomValue } from "jotai";
import Image from "next/image";
import { pieceSetAtom } from "./states";

/** A terminal result is board state, independent of engine/annotation toggles. */
export default function DrawBadges({
  result,
  orientation,
}: {
  result: BoardDraw | null;
  orientation: Orientation;
}) {
  const pieceSet = useAtomValue(pieceSetAtom);
  if (!result) return null;
  return result.kings.map((king) => {
    const { x, y } = squareCenter(king.square, orientation);
    return (
      <span
        key={king.square}
        role="img"
        aria-label={`${result.reason}: ${king.color === "w" ? "White" : "Black"} king`}
        data-draw-square={king.square}
        title={result.reason}
        style={{
          position: "absolute",
          left: `${(x + 0.4) * 12.5}%`,
          top: `${(y - 0.4) * 12.5}%`,
          transform: "translate(-50%, -50%)",
          width: "max(12px, 4.75%)",
          aspectRatio: "1",
          borderRadius: "50%",
          backgroundColor: "#a0a0a0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 21,
        }}
      >
        <Image
          src={`/piece/${pieceSet}/${king.color}K.svg`}
          alt=""
          width={40}
          height={40}
          draggable={false}
          style={{
            width: "90%",
            height: "90%",
            objectFit: "contain",
            transform: "rotate(90deg)",
          }}
        />
      </span>
    );
  });
}
