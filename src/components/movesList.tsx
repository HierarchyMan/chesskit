import PrettyMoveSan from "@/components/prettyMoveSan";
import { Box, ButtonBase, Typography } from "@mui/material";
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
  emptyText?: string;
  annotations?: MoveAnnotation[];
}

export default function MovesList({
  moves,
  startsWithBlack = false,
  firstMoveNumber = 1,
  currentPly,
  onSelect,
  maxHeight = 240,
  emptyText = "No moves yet",
  annotations,
}: Props) {
  const pageFlow = useWorkspacePageFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const offset = startsWithBlack ? 1 : 0;

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
    const annotation = annotations?.[ply];

    return (
      <ButtonBase
        data-active={active}
        disabled={!onSelect}
        onClick={() => onSelect?.(ply + 1)}
        aria-label={
          annotation
            ? `${san}: ${annotation.classification ? classificationName(annotation.classification) : annotation.status === "error" ? "evaluation unavailable" : "analysis pending"}`
            : undefined
        }
        sx={{
          justifyContent: "flex-start",
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          fontSize: "0.95rem",
          backgroundColor: active ? "primary.main" : undefined,
          color: active ? "primary.contrastText" : undefined,
          gap: 0.5,
          flexWrap: annotations ? "wrap" : undefined,
          minWidth: 0,
          "&:hover": {
            backgroundColor: active ? "primary.main" : "action.hover",
          },
        }}
      >
        <PrettyMoveSan
          san={san}
          color={active ? (color === "w" ? "b" : "w") : color}
        />
        {annotation && (
          <>
            {annotation.classification && (
              <Image
                src={`/icons/${annotation.classification}.png`}
                alt=""
                width={16}
                height={16}
              />
            )}
            <Typography component="span" variant="caption">
              {annotation.classification
                ? classificationName(annotation.classification)
                : annotation.status === "error"
                  ? "Unavailable"
                  : "Pending"}
              {annotation.evaluation
                ? ` · ${getLineEvalLabel(annotation.evaluation)}`
                : ""}
            </Typography>
          </>
        )}
      </ButtonBase>
    );
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        maxHeight: pageFlow ? "none" : maxHeight,
        overflowY: pageFlow || maxHeight === "none" ? "visible" : "auto",
        position: "relative",
      }}
    >
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
