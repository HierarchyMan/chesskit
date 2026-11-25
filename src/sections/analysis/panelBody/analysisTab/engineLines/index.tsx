import {
  Box,
  Button,
  ButtonBase,
  Collapse,
  List,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";
import LineEvaluation from "./lineEvaluation";
import {
  boardAtom,
  currentPositionAtom,
  engineLinesExpandedAtom,
  engineMultiPvAtom,
  engineNameAtom,
} from "../../../states";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { LineEval } from "@/types/eval";
import { positionFor } from "@/lib/currentPosition";
import { EngineFailureAlert } from "@/components/engineDownloadAlert";
import { DEFAULT_ENGINE } from "@/constants";
import { engineLabel } from "@/lib/engine/models";
import { getGameResult } from "@/lib/gameResult";
import { useAnalysisEngine } from "../../../engineContext";
import { AnalysisOverlay } from "../../../hooks/useAnalysisOverlay";
import { AnalysisFailure } from "../../../overlayPanel";
import VisualizeContinuation from "../visualizeContinuation";

interface Props {
  overlay?: AnalysisOverlay;
}

export default function EngineLines({ overlay }: Props) {
  const board = useAtomValue(boardAtom);
  const linesNumber = useAtomValue(engineMultiPvAtom);
  const engineName = useAtomValue(engineNameAtom);
  const position = positionFor(useAtomValue(currentPositionAtom), board.fen());
  const engine = useAnalysisEngine();
  const setEngineName = useSetAtom(engineNameAtom);
  const [expanded, setExpanded] = useAtom(engineLinesExpandedAtom);

  const isGameOver = board.isGameOver();
  const gameResult = isGameOver ? getGameResult(board, null) : null;
  const displayName = engineLabel(engineName).small;
  const topLine = position?.eval?.lines?.[0];
  const liveDepth = topLine?.depth ?? 0;

  const threatsOn = !!(overlay?.prefs.enabled && overlay?.prefs.threats);

  const linesSkeleton: LineEval[] = Array.from({ length: linesNumber }).map(
    (_, i) => ({ pv: [`${i}`], depth: 0, multiPv: i + 1 })
  );

  // The search may hold more lines than the list is set to show.
  const engineLines = position?.eval?.lines?.length
    ? position.eval.lines.slice(0, linesNumber)
    : linesSkeleton;

  const handleHoverRank = (rank: number | null) => {
    if (!overlay) return;
    if (rank === null) {
      overlay.setFocus(null);
      return;
    }
    overlay.setFocus({
      kind: rank === 1 ? "best" : "candidate",
      rank,
      side: board.turn(),
    });
  };

  return (
    <Box
      sx={{
        flexShrink: 0,
        borderBottom: 1,
        borderColor: "divider",
        px: 1.5,
        py: 0.75,
      }}
    >
      <AnalysisFailure />

      {/* Slim Engine Header Row */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ minHeight: 28 }}
      >
        <ButtonBase
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={
            expanded ? "Collapse engine lines" : "Expand engine lines"
          }
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            minWidth: 0,
            py: 0.25,
            px: 0.4,
            ml: -0.4,
            borderRadius: 1,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Icon
            icon={expanded ? "mdi:chevron-down" : "mdi:chevron-right"}
            height={16}
            style={{ opacity: 0.7, flexShrink: 0 }}
          />
          <Typography variant="caption" fontWeight={600} noWrap>
            {displayName}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {isGameOver
              ? "· Game over"
              : liveDepth > 0
                ? `· depth ${liveDepth}`
                : engine.status === "error"
                  ? "· Offline"
                  : "· Searching…"}
          </Typography>
        </ButtonBase>

        {overlay && !isGameOver && (
          <Tooltip
            title={
              threatsOn
                ? "Hide opponent threats (X)"
                : "Show what the opponent threatens if they moved now (X)"
            }
            disableInteractive
          >
            <Button
              size="small"
              variant={threatsOn ? "contained" : "text"}
              color={threatsOn ? "warning" : "inherit"}
              onClick={() =>
                overlay.update({
                  enabled: true,
                  threats: !threatsOn,
                })
              }
              startIcon={<Icon icon="mdi:alert-decagram-outline" height={14} />}
              sx={{
                minHeight: 24,
                py: 0.15,
                px: 0.85,
                fontSize: "0.72rem",
                lineHeight: 1.3,
                color: threatsOn ? undefined : "text.secondary",
                bgcolor: threatsOn ? undefined : "action.hover",
                "&:hover": threatsOn
                  ? undefined
                  : { bgcolor: "action.selected" },
                whiteSpace: "nowrap",
              }}
            >
              Threats (X)
            </Button>
          </Tooltip>
        )}
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ pt: 0.5 }}>
          {engine.status === "error" ? (
            <EngineFailureAlert
              state={engine}
              retryLabel="Retry analysis"
              onUseDefault={() => setEngineName(DEFAULT_ENGINE)}
            />
          ) : isGameOver && gameResult ? (
            <Stack
              direction="row"
              alignItems="center"
              gap={0.75}
              sx={{
                px: 1,
                py: 0.65,
                borderRadius: 1,
                bgcolor: "action.hover",
              }}
            >
              <Icon icon="mdi:flag-checkered" height={16} />
              <Typography variant="body2" fontWeight={600}>
                {gameResult.reason} ·{" "}
                {gameResult.result === "1/2-1/2" ? "½-½" : gameResult.result}
              </Typography>
            </Stack>
          ) : (
            <List
              sx={{
                width: "100%",
                p: 0,
                display: "flex",
                flexDirection: "column",
                gap: 0.35,
              }}
              onMouseLeave={() => handleHoverRank(null)}
            >
              {engineLines.map((line, index) => (
                <LineEvaluation
                  key={line.multiPv}
                  line={line}
                  onHover={handleHoverRank}
                  action={
                    index === 0 ? <VisualizeContinuation compact /> : null
                  }
                />
              ))}
            </List>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
