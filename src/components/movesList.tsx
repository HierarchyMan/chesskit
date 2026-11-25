import PrettyMoveSan from "@/components/prettyMoveSan";
import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useRef } from "react";
import { LineEval } from "@/types/eval";
import { MoveClassification } from "@/types/enums";
import { getLineEvalLabel } from "@/lib/chess";
import { classificationName } from "@/lib/classificationLabels";
import Image from "next/image";
import { useWorkspacePageFlow } from "./boardWorkspace";

interface MoveAnnotation {
  classification?: MoveClassification;
  evaluation?: LineEval;
  status?: "error";
}

interface Props {
  moves: string[];
  startsWithBlack?: boolean;
  firstMoveNumber?: number;
  currentPly?: number;
  onSelect?: (ply: number) => void;
  maxHeight?: number | string;
  fixedHeight?: boolean;
  emptyText?: string;
  annotations?: MoveAnnotation[];
}

const formatCompactEval = (line: Pick<LineEval, "cp" | "mate">): string => {
  if (line.mate) {
    return `${line.mate > 0 ? "+" : "-"}M${Math.abs(line.mate)}`;
  }
  if (line.cp !== undefined) {
    const pawns = line.cp / 100;
    const sign = line.cp > 0 ? "+" : "";
    return `${sign}${Math.abs(pawns) >= 10 ? pawns.toFixed(0) : pawns.toFixed(1)}`;
  }
  return "";
};

export default function MovesList({
  moves,
  startsWithBlack = false,
  firstMoveNumber = 1,
  currentPly,
  onSelect,
  maxHeight = 240,
  fixedHeight = false,
  emptyText = "No moves yet",
  annotations,
}: Props) {
  const pageFlow = useWorkspacePageFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const offset = startsWithBlack ? 1 : 0;
  const boundedHeight = fixedHeight && !pageFlow && maxHeight !== "none";

  useEffect(() => {
    const list = containerRef.current;
    // Never move the document (or create a nested scroller) to follow new moves.
    if (!list || pageFlow) return;
    const container =
      maxHeight === "none"
        ? (list.closest<HTMLElement>("[data-inspector-scroller]") ?? list)
        : list;

    const active = list.querySelector<HTMLElement>("[data-active='true']");
    if (!active) {
      container.scrollTop = container.scrollHeight;
      return;
    }

    const top =
      active.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (
      top + active.offsetHeight >
      container.scrollTop + container.clientHeight
    ) {
      container.scrollTop = top + active.offsetHeight - container.clientHeight;
    }
  }, [currentPly, moves.length, maxHeight, pageFlow]);

  if (!moves.length) {
    return (
      <Box
        sx={{
          height: boundedHeight ? maxHeight : undefined,
          minHeight: boundedHeight ? maxHeight : 0,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          {emptyText}
        </Typography>
      </Box>
    );
  }

  const rowCount = Math.ceil((moves.length + offset) / 2);

  const renderCell = (ply: number) => {
    const san = moves[ply];
    if (san === undefined) return <Box />;

    const color = (ply + offset) % 2 === 0 ? "w" : "b";
    const active = currentPly !== undefined && currentPly - 1 === ply;
    const annotation = annotations?.[ply];
    const hasClassification = Boolean(annotation?.classification);
    const hasEval = Boolean(
      annotation?.evaluation &&
        (annotation.evaluation.cp !== undefined ||
          annotation.evaluation.mate !== undefined)
    );
    const hasError = annotation?.status === "error";

    const tooltipParts: string[] = [];
    if (annotation?.classification) {
      tooltipParts.push(classificationName(annotation.classification));
    } else if (hasError) {
      tooltipParts.push("Evaluation unavailable");
    }
    if (hasEval && annotation?.evaluation) {
      tooltipParts.push(getLineEvalLabel(annotation.evaluation));
    }
    const tooltipTitle = tooltipParts.length
      ? `${san} — ${tooltipParts.join(" · ")}`
      : "";

    const compactEval =
      hasEval && annotation?.evaluation
        ? formatCompactEval(annotation.evaluation)
        : "";

    const cell = (
      <ButtonBase
        data-active={active}
        disabled={!onSelect}
        onClick={() => onSelect?.(ply + 1)}
        aria-label={
          tooltipParts.length ? `${san}: ${tooltipParts.join(", ")}` : san
        }
        sx={(theme) => {
          const activeBg = alpha(
            theme.palette.primary.main,
            theme.palette.mode === "dark" ? 0.24 : 0.18
          );
          const activeHoverBg = alpha(
            theme.palette.primary.main,
            theme.palette.mode === "dark" ? 0.3 : 0.24
          );
          return {
            justifyContent: "flex-start",
            px: 0.75,
            py: 0.25,
            minHeight: 28,
            borderRadius: 0.75,
            color: "text.primary",
            backgroundColor: active ? activeBg : "transparent",
            boxShadow: active
              ? `inset 2px 0 0 ${theme.palette.primary.main}`
              : "none",
            gap: 0.5,
            flexWrap: "nowrap",
            minWidth: 0,
            overflow: "hidden",
            transition: "background-color 120ms ease",
            "&:hover": {
              backgroundColor: active ? activeHoverBg : "action.hover",
            },
          };
        }}
      >
        <Box component="span" sx={{ flexShrink: 0, lineHeight: 1.2 }}>
          <PrettyMoveSan
            san={san}
            color={color}
            typographyProps={{
              fontSize: "0.875rem",
              fontWeight: active ? 700 : 500,
              lineHeight: 1.2,
            }}
          />
        </Box>
        {hasClassification && annotation?.classification && (
          <Image
            src={`/icons/${annotation.classification}.png`}
            alt=""
            width={15}
            height={15}
            style={{ flexShrink: 0 }}
          />
        )}
        {compactEval && (
          <Typography
            component="span"
            variant="caption"
            noWrap
            sx={{
              ml: "auto",
              pl: 0.25,
              fontSize: "0.7rem",
              lineHeight: 1,
              color: "text.secondary",
              opacity: active ? 0.9 : 0.65,
              fontVariantNumeric: "tabular-nums",
              flexShrink: 0,
            }}
          >
            {compactEval}
          </Typography>
        )}
      </ButtonBase>
    );

    if (!tooltipTitle) return cell;

    return (
      <Tooltip title={tooltipTitle} disableInteractive placement="top">
        <Box component="span" sx={{ display: "grid", minWidth: 0 }}>
          {cell}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        height: boundedHeight ? maxHeight : undefined,
        minHeight: boundedHeight ? maxHeight : 0,
        maxHeight: pageFlow ? "none" : maxHeight,
        flex: !boundedHeight && maxHeight === "none" ? "1 1 auto" : undefined,
        overflowY: pageFlow || maxHeight === "none" ? "visible" : "auto",
        scrollbarGutter: boundedHeight ? "stable" : undefined,
        position: "relative",
      }}
    >
      {Array.from({ length: rowCount }).map((_, row) => {
        const whitePly = row * 2 - offset;
        const blackPly = whitePly + 1;

        return (
          <Box
            key={row}
            sx={(theme) => ({
              display: "grid",
              gridTemplateColumns: "2.35rem minmax(0, 1fr) minmax(0, 1fr)",
              alignItems: "center",
              columnGap: 0.25,
              backgroundColor:
                row % 2
                  ? alpha(
                      theme.palette.text.primary,
                      theme.palette.mode === "dark" ? 0.035 : 0.03
                    )
                  : "transparent",
              borderRadius: 0.75,
              "&:hover": {
                backgroundColor: alpha(
                  theme.palette.text.primary,
                  theme.palette.mode === "dark" ? 0.06 : 0.05
                ),
              },
            })}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: "0.78rem",
                opacity: 0.65,
                pl: 0.75,
                fontVariantNumeric: "tabular-nums",
                userSelect: "none",
              }}
            >
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
