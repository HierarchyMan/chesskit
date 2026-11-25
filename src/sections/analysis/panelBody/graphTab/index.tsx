import { Box, useTheme } from "@mui/material";
import { useAtomValue } from "jotai";
import { useVisibleAtomValue } from "@/hooks/useVisibleAtomValue";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DotProps } from "recharts";
import {
  boardAtom,
  currentPositionAtom,
  gameAtom,
  gameEvalAtom,
} from "../../states";
import { useCallback, useMemo } from "react";
import type { ReactElement } from "react";
import CustomTooltip from "./tooltip";
import { ChartItemData } from "./types";
import { PositionEval } from "@/types/eval";
import { CLASSIFICATION_COLORS } from "@/constants";
import CustomDot from "./dot";
import { MoveClassification } from "@/types/enums";
import { useChessActions } from "@/hooks/useChessActions";
import { getPositionWinPercentage } from "@/lib/engine/helpers/winPercentage";
import type { Move } from "chess.js";

const MARKED_CLASSIFICATIONS = new Set<MoveClassification>([
  MoveClassification.Splendid,
  MoveClassification.Perfect,
  MoveClassification.Inaccuracy,
  MoveClassification.Mistake,
  MoveClassification.Blunder,
]);

export default function GraphTab({ hidden = false }: { hidden?: boolean }) {
  const theme = useTheme();
  const gameEval = useAtomValue(gameEvalAtom);
  const currentPosition = useVisibleAtomValue(currentPositionAtom, !hidden);
  const { goToMove } = useChessActions(boardAtom);
  const game = useAtomValue(gameAtom);

  const verboseMoves = useMemo(() => game.history({ verbose: true }), [game]);

  const chartData: ChartItemData[] = useMemo(
    () =>
      gameEval?.positions.map((position, index) =>
        formatEvalToChartData(position, index, verboseMoves[index - 1])
      ) ?? [],
    [gameEval, verboseMoves]
  );

  const boardMoveColor = currentPosition.eval?.moveClassification
    ? CLASSIFICATION_COLORS[currentPosition.eval.moveClassification]
    : theme.palette.primary.main;

  // Deterministically mark only meaningful classifications.
  const renderDot = useCallback(
    (
      dotProps: DotProps & { payload?: ChartItemData }
    ): ReactElement<SVGElement> => {
      const payload = dotProps.payload;
      const moveClass = payload?.moveClassification;
      if (moveClass && MARKED_CLASSIFICATIONS.has(moveClass)) {
        return <CustomDot {...dotProps} key={dotProps.key} payload={payload} />;
      }
      return <svg key={dotProps.key} />;
    },
    []
  );

  if (!gameEval || hidden) return null;

  const isDark = theme.palette.mode === "dark";
  const blackSideFill = isDark ? "#23262e" : "#3a3e47";
  const whiteSideFill = isDark ? "#e6e8ec" : "#f7f8fa";

  return (
    <Box
      sx={{
        width: "100%",
        height: 160,
        bgcolor: blackSideFill,
        borderRadius: 1.5,
        border: 1,
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 4, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            const payload = e?.activePayload?.[0]?.payload as
              | ChartItemData
              | undefined;
            if (!payload) return;
            goToMove(payload.moveNb, game);
          }}
          style={{ cursor: "pointer" }}
        >
          <XAxis dataKey="moveNb" hide />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            content={<CustomTooltip />}
            isAnimationActive={false}
            cursor={{
              stroke: theme.palette.primary.main,
              strokeWidth: 1.5,
              strokeOpacity: 0.45,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill={whiteSideFill}
            fillOpacity={1}
            dot={renderDot}
            activeDot={<CustomDot />}
            isAnimationActive={false}
          />
          <ReferenceLine
            y={50}
            stroke={isDark ? "#9ca3af" : "#6b7280"}
            strokeWidth={1.25}
            strokeDasharray="3 3"
            strokeOpacity={0.65}
          />
          {currentPosition.currentMoveIdx !== undefined && (
            <ReferenceLine
              x={currentPosition.currentMoveIdx}
              stroke={boardMoveColor}
              strokeWidth={3}
              strokeOpacity={0.8}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

const formatMoveLabel = (index: number, move?: Move): string => {
  if (index === 0 || !move) return "Start";
  const moveNumber = Number(move.before.split(" ")[5]) || Math.ceil(index / 2);
  return move.color === "w"
    ? `${moveNumber}. ${move.san}`
    : `${moveNumber}... ${move.san}`;
};

const formatEvalToChartData = (
  position: PositionEval,
  index: number,
  move?: Move
): ChartItemData => {
  const line = position.lines?.[0];
  let value = 50;

  if (line && (line.cp !== undefined || line.mate !== undefined)) {
    value = getPositionWinPercentage(position);
  }

  return {
    moveNb: index,
    value,
    cp: line?.cp,
    mate: line?.mate,
    moveClassification: position.moveClassification,
    moveLabel: formatMoveLabel(index, move),
  };
};
