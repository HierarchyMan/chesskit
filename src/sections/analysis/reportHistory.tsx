import { AnalysisLine, replayAnalysis } from "@/lib/analysisSession";
import { classificationName } from "@/lib/classificationLabels";
import { getLineEvalLabel, moveLineUciToSan } from "@/lib/chess";
import { CLASSIFICATION_COLORS } from "@/constants";
import MiniBoard from "@/components/board/miniBoard";
import PrettyMoveSan from "@/components/prettyMoveSan";
import { Icon } from "@iconify/react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCopyText } from "@/hooks/useCopyText";
import { Chess } from "chess.js";
import { recordedDrawAtEnd } from "@/lib/boardDraw";

const formatMovePrefix = (fen: string, plyIndex: number, turn: "w" | "b") => {
  const startMove = Number(fen.split(" ")[5]) || 1;
  const startTurn = fen.split(" ")[1] === "b" ? "b" : "w";
  const moveNum =
    startMove + Math.floor((plyIndex + (startTurn === "b" ? 1 : 0)) / 2);
  if (turn === "w") return `${moveNum}.`;
  return plyIndex === 0 ? `${moveNum}...` : "";
};

/** Read-only report playback has no connection to the study's move-recording atoms. */
export default function ReportHistory({ line }: { line: AnalysisLine }) {
  const reports = line.reports ?? [];
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [reportIndex, setReportIndex] = useState(0);
  const [ply, setPly] = useState(0);
  const { copy, feedback } = useCopyText();
  const report = reports[Math.min(reportIndex, reports.length - 1)];
  const full = useMemo(
    () => (report ? replayAnalysis(report) : undefined),
    [report]
  );
  const verboseHistory = useMemo(
    () => full?.history({ verbose: true }) ?? [],
    [full]
  );
  const maxPly = verboseHistory.length;
  const cursor = Math.min(ply, maxPly);
  const board = useMemo(
    () => (report ? replayAnalysis(report, cursor) : undefined),
    [report, cursor]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.stopImmediatePropagation();
        event.preventDefault();
        setPly((value) => Math.max(0, value - 1));
      } else if (event.key === "ArrowRight") {
        event.stopImmediatePropagation();
        event.preventDefault();
        setPly((value) => Math.min(maxPly, value + 1));
      } else if (event.key === "Home") {
        event.stopImmediatePropagation();
        event.preventDefault();
        setPly(0);
      } else if (event.key === "End") {
        event.stopImmediatePropagation();
        event.preventDefault();
        setPly(maxPly);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, maxPly]);

  if (!reports.length || !report || !board || !full) return null;

  const position = report.evaluation.positions[cursor];
  const currentMove = cursor > 0 ? verboseHistory[cursor - 1] : undefined;
  const currentMoveNumber = currentMove
    ? Number(currentMove.before.split(" ")[5]) || 1
    : 1;

  return (
    <>
      <Button
        size="small"
        variant="text"
        startIcon={<Icon icon="mdi:history" height={16} />}
        onClick={() => {
          setReportIndex(reports.length - 1);
          setPly(0);
          setOpen(true);
        }}
        sx={{
          minWidth: 0,
          px: 0.75,
          py: 0.25,
          fontSize: "0.75rem",
          whiteSpace: "nowrap",
        }}
      >
        Reports ({reports.length})
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={isSmall}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            py: 1.5,
          }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Icon icon="mdi:history" height={22} />
            <Typography variant="h6" fontWeight={600} component="span">
              Saved analysis reports
            </Typography>
          </Stack>
          <Tooltip title="Close">
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              aria-label="Close saved reports"
            >
              <Icon icon="mdi:close" height={20} />
            </IconButton>
          </Tooltip>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="Report"
              value={Math.min(reportIndex, reports.length - 1)}
              onChange={(event) => {
                setReportIndex(Number(event.target.value));
                setPly(0);
              }}
            >
              {reports.map((saved, index) => (
                <MenuItem key={saved.id} value={index}>
                  {new Date(saved.evaluation.settings.date).toLocaleString()} ·{" "}
                  {saved.evaluation.positions.length - 1} plies · depth{" "}
                  {saved.evaluation.settings.depth}
                </MenuItem>
              ))}
            </TextField>
            <Typography
              variant="body2"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              Accuracy: White{" "}
              <strong>
                {report.evaluation.accuracy.white?.toFixed(1) ?? "—"}%
              </strong>{" "}
              · Black{" "}
              <strong>
                {report.evaluation.accuracy.black?.toFixed(1) ?? "—"}%
              </strong>
            </Typography>
            <Stack alignItems="center">
              <div
                style={{
                  width: "min(100%, 340px)",
                  aspectRatio: "1",
                  position: "relative",
                }}
              >
                <div
                  style={{ position: "absolute", inset: 0, overflow: "hidden" }}
                >
                  <ReportBoard game={board} full={full} />
                </div>
              </div>
            </Stack>
            <Slider
              aria-label="Report replay position"
              value={cursor}
              min={0}
              max={Math.max(1, maxPly)}
              disabled={!maxPly}
              step={1}
              onChange={(_, value) => setPly(value as number)}
            />
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
            >
              <Button
                size="small"
                variant="outlined"
                disabled={!cursor}
                startIcon={<Icon icon="mdi:chevron-left" height={18} />}
                onClick={() => setPly(cursor - 1)}
              >
                Previous
              </Button>
              <Stack
                direction="row"
                alignItems="center"
                gap={1}
                flexWrap="wrap"
                justifyContent="center"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {currentMove ? (
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      {currentMoveNumber}
                      {currentMove.color === "w" ? "." : "..."}
                    </Typography>
                    <PrettyMoveSan
                      san={currentMove.san}
                      color={currentMove.color}
                      typographyProps={{ fontWeight: 600, fontSize: "0.9rem" }}
                    />
                  </Stack>
                ) : (
                  <Typography variant="body2" fontWeight={600}>
                    Starting position
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  ({cursor}/{maxPly})
                </Typography>
                {position?.moveClassification && (
                  <Chip
                    size="small"
                    icon={
                      <Image
                        src={`/icons/${position.moveClassification}.png`}
                        alt=""
                        width={14}
                        height={14}
                      />
                    }
                    label={classificationName(position.moveClassification)}
                    sx={{
                      height: 22,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      borderColor:
                        CLASSIFICATION_COLORS[position.moveClassification],
                      color: CLASSIFICATION_COLORS[position.moveClassification],
                    }}
                    variant="outlined"
                  />
                )}
              </Stack>
              <Button
                size="small"
                variant="outlined"
                disabled={cursor >= maxPly}
                endIcon={<Icon icon="mdi:chevron-right" height={18} />}
                onClick={() => setPly(cursor + 1)}
              >
                Next
              </Button>
            </Stack>
            {board.getComment() && (
              <Typography variant="body2">{board.getComment()}</Typography>
            )}
            {!!position?.lines.length && (
              <Stack spacing={0.5}>
                {position.lines.map((pvLine) => {
                  const fen = board.fen();
                  const san = moveLineUciToSan(fen);
                  const startTurn = board.turn();
                  return (
                    <Stack
                      key={pvLine.multiPv}
                      direction="row"
                      alignItems="baseline"
                      gap={1}
                    >
                      <Box
                        component="span"
                        sx={{
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          minWidth: 48,
                          color: "text.primary",
                        }}
                      >
                        {getLineEvalLabel(pvLine)}
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        component="div"
                        sx={{ lineHeight: 1.5 }}
                      >
                        {pvLine.pv.slice(0, 8).map((move, i) => {
                          const color =
                            i % 2 === 0
                              ? startTurn
                              : startTurn === "w"
                                ? "b"
                                : "w";
                          const prefix = formatMovePrefix(fen, i, color);
                          return (
                            <Box
                              component="span"
                              key={i}
                              sx={{ mr: 0.6, display: "inline-block" }}
                            >
                              {prefix ? `${prefix} ` : ""}
                              <PrettyMoveSan
                                san={san(move)}
                                color={color}
                                typographyProps={{ fontSize: "0.82rem" }}
                              />
                            </Box>
                          );
                        })}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            )}
            <Typography variant="caption" color="text.secondary">
              {report.evaluation.settings.engine} · depth{" "}
              {report.evaluation.settings.depth}. Use ← / → to step through this
              saved report; playback leaves your active study untouched.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Icon icon="mdi:content-copy" height={16} />}
            onClick={() => void copy(report.pgn, "Report line PGN")}
          >
            Copy report PGN
          </Button>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      {feedback}
    </>
  );
}

function ReportBoard({ game, full }: { game: Chess; full: Chess }) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(320);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => setSize(Math.floor(element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} style={{ width: "100%", aspectRatio: "1" }}>
      <MiniBoard
        fen={game.fen()}
        game={game}
        recordedDraw={recordedDrawAtEnd(game, full)}
        size={size}
      />
    </div>
  );
}
