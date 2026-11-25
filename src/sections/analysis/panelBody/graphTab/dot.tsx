import { DotProps } from "recharts";
import { ChartItemData } from "./types";
import { CLASSIFICATION_COLORS } from "@/constants";

export default function CustomDot({
  cx,
  cy,
  payload,
}: DotProps & { payload?: ChartItemData }) {
  if (typeof cx !== "number" || typeof cy !== "number") return null;

  const moveColor = payload?.moveClassification
    ? CLASSIFICATION_COLORS[payload.moveClassification]
    : "#8b949e";

  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.75}
      stroke="#ffffff"
      strokeWidth={1.25}
      fill={moveColor}
      fillOpacity={1}
    />
  );
}
