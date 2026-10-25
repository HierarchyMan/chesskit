import { AnalysisLine, replayAnalysis } from "@/lib/analysisSession";
import { classificationName } from "@/lib/classificationLabels";
import { getLineEvalLabel, moveLineUciToSan } from "@/lib/chess";
import MiniBoard from "@/components/board/miniBoard";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCopyText } from "@/hooks/useCopyText";
import { Chess } from "chess.js";
import { recordedDrawAtEnd } from "@/lib/boardDraw";

/** Read-only report playback has no connection to the study's move-recording atoms. */
export default function ReportHistory({ line }: { line: AnalysisLine }) {
  const reports = line.reports ?? [];
  const [open, setOpen] = useState(false);
  const [reportIndex, setReportIndex] = useState(0);
  const [ply, setPly] = useState(0);
  const { copy, feedback } = useCopyText();
  const report = reports[Math.min(reportIndex, reports.length - 1)];
  const full = useMemo(
    () => (report ? replayAnalysis(report) : undefined),
    [report]
  );
  const cursor = Math.min(ply, full?.history().length ?? 0);
  const board = useMemo(
    () => (report ? replayAnalysis(report, cursor) : undefined),
    [report, cursor]
  );
  if (!reports.length || !report || !board || !full) return null;
  const position = report.evaluation.positions[cursor];
  return (
    <>
      <Button
        size="small"
        onClick={() => {
          setReportIndex(reports.length - 1);
          setPly(0);
          setOpen(true);
        }}
      >
        Past reports ({reports.length})
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Saved analysis reports</DialogTitle>
        <DialogContent>
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
            <Typography variant="body2">
              Accuracy: White{" "}
              {report.evaluation.accuracy.white?.toFixed(1) ?? "—"}% · Black{" "}
              {report.evaluation.accuracy.black?.toFixed(1) ?? "—"}%
            </Typography>
            <Stack alignItems="center">
              <div
                style={{
                  width: "min(100%, 360px)",
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
              max={Math.max(1, full.history().length)}
              disabled={!full.history().length}
              step={1}
              onChange={(_, value) => setPly(value as number)}
            />
            <Stack direction="row" justifyContent="space-between">
              <Button disabled={!cursor} onClick={() => setPly(cursor - 1)}>
                Previous
              </Button>
              <Typography>
                {cursor ? full.history()[cursor - 1] : "Starting position"} ·{" "}
                {cursor}/{full.history().length}
              </Typography>
              <Button
                disabled={cursor >= full.history().length}
                onClick={() => setPly(cursor + 1)}
              >
                Next
              </Button>
            </Stack>
            {board.getComment() && (
              <Typography variant="body2">{board.getComment()}</Typography>
            )}
            {position?.moveClassification && (
              <Typography>
                {classificationName(position.moveClassification)}
              </Typography>
            )}
            {position?.lines.map((line) => {
              const san = moveLineUciToSan(board.fen());
              return (
                <Typography variant="body2" key={line.multiPv}>
                  {getLineEvalLabel(line)} ·{" "}
                  {line.pv.map((move) => san(move)).join(" ")}
                </Typography>
              );
            })}
            <Typography variant="caption">
              {report.evaluation.settings.engine} · depth{" "}
              {report.evaluation.settings.depth}. This report describes its
              saved prefix; playback leaves the current study where it was.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void copy(report.pgn, "Report line PGN")}>
            Copy report line PGN
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
