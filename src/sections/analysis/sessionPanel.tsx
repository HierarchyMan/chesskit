import {
  AnalysisSession,
  analysisSessionBackup,
  clearAnalysisBranches,
  copyAnalysisSession,
  newAnalysisSession,
  parseAnalysisSessionBackup,
  analysisLineLabel,
  selectAnalysisLine,
  sessionLine,
} from "@/lib/analysisSession";
import {
  AnalysisSessionSummary,
  getAnalysisSession,
  getStoredAnalysisSession,
  getOriginalAnalysisSession,
  hasOriginalAnalysisSession,
  listAnalysisSessionSummaries,
  saveAnalysisSession,
} from "@/lib/gameDatabase";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import ReportHistory from "./reportHistory";
import {
  analysisSourceErrorAtom,
  analysisSaveRequestAtom,
  analysisSaveStateAtom,
  analysisSessionAtom,
  analysisSessionsRevisionAtom,
  restoreAnalysisSessionAtom,
  storeAnalysisBranchesAtom,
} from "./sessionAtoms";
import { arrangeModeAtom } from "./states";

const REMEMBER_HELP =
  "Record new moves for back and forward replay. Turning this off keeps all remembered moves.";

export default function SessionPanel() {
  const [session, setSession] = useAtom(analysisSessionAtom);
  const [branches, setBranches] = useAtom(storeAnalysisBranchesAtom);
  const state = useAtomValue(analysisSaveStateAtom);
  const sourceError = useAtomValue(analysisSourceErrorAtom);
  const revision = useAtomValue(analysisSessionsRevisionAtom);
  const requestSave = useSetAtom(analysisSaveRequestAtom);
  const restore = useSetAtom(restoreAnalysisSessionAtom);
  const arranging = useAtomValue(arrangeModeAtom);
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<AnalysisSessionSummary[]>([]);
  const [error, setError] = useState("");
  const [hasOriginal, setHasOriginal] = useState(false);
  const [cleared, setCleared] = useState<AnalysisSession | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let current = true;
    void hasOriginalAnalysisSession(session?.id ?? "")
      .then((exists) => {
        if (current) setHasOriginal(exists);
      })
      .catch(() => undefined);
    void listAnalysisSessionSummaries()
      .then((rows) => {
        if (current) setSessions(rows);
      })
      .catch((reason) => {
        if (current) setError(String(reason));
      });
    return () => {
      current = false;
    };
  }, [open, revision, session?.id]);

  if (!session) return null;
  const changeSession = async (
    next: AnalysisSession,
    preserveOutgoing = true
  ) => {
    if (next.id === session.id) next = session;
    try {
      // Preserve the outgoing session before changing the active identity/URL.
      if (preserveOutgoing) await saveAnalysisSession(session);
      await saveAnalysisSession(next);
      await router.replace(
        { pathname: "/analysis", query: { sessionId: next.id } },
        undefined,
        { scroll: false }
      );
      restore(next);
      setOpen(false);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to open the session."
      );
    }
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([analysisSessionBackup(session)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "chesskit-analysis-session.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Box width="100%" sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="nowrap"
        gap={1}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={600} noWrap>
            {session.title}
          </Typography>
          <Typography variant="caption" role="status">
            {state.status === "saved"
              ? "Saved on this device"
              : state.status === "saving"
                ? "Saving…"
                : state.status === "error"
                  ? "Not saved"
                  : "Opening session…"}
          </Typography>
        </Box>
        <Stack
          direction="row"
          alignItems="center"
          gap={0.5}
          sx={{ flexShrink: 0 }}
        >
          {!arranging && (
            <Tooltip title={REMEMBER_HELP}>
              <FormControlLabel
                sx={{ m: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={branches}
                    onChange={(_, checked) => setBranches(checked)}
                  />
                }
                label={<Typography variant="caption">Remember</Typography>}
              />
            </Tooltip>
          )}
          <Button
            size="small"
            aria-label="Sessions and options"
            onClick={() => setOpen(true)}
            sx={{ minWidth: 0, px: 0.5 }}
          >
            Sessions
          </Button>
        </Stack>
      </Stack>
      {state.error && (
        <Alert
          severity="error"
          action={
            <Button
              size="small"
              onClick={() => requestSave((value) => value + 1)}
            >
              Retry save
            </Button>
          }
        >
          {state.error} Your current work is still open.
          <Button
            size="small"
            onClick={() => {
              void changeSession(copyAnalysisSession(session), false);
            }}
          >
            Save as new session
          </Button>
        </Alert>
      )}
      {sourceError && (
        <Alert severity="error">
          {sourceError} Your current session has been kept.
        </Alert>
      )}
      {(branches || session.branches.length > 0) && !arranging && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
          <FormControl size="small" fullWidth sx={{ minWidth: 0 }}>
            <InputLabel id="analysis-variation-label">
              Saved analysis line
            </InputLabel>
            <Select
              labelId="analysis-variation-label"
              label="Saved analysis line"
              value={session.selectedLineId}
              onChange={(event) =>
                restore(selectAnalysisLine(session, event.target.value))
              }
            >
              <MenuItem value="main">Main game</MenuItem>
              {session.branches.map((line, index) => (
                <MenuItem key={line.id} value={line.id}>
                  {analysisLineLabel(session, line, index)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      )}
      {!arranging && (
        <ReportHistory
          key={session.selectedLineId}
          line={sessionLine(session)}
        />
      )}
      {cleared?.id === session.id && (
        <Button
          size="small"
          onClick={() => {
            restore({
              ...session,
              branches: [
                ...cleared.branches.filter(
                  (line) =>
                    !session.branches.some((current) => current.id === line.id)
                ),
                ...session.branches,
              ],
              updatedAt: new Date().toISOString(),
            });
            setCleared(null);
          }}
        >
          Undo clear branches
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Analysis sessions & options</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Session name"
              value={session.title}
              onChange={(event) =>
                setSession({
                  ...session,
                  title: event.target.value.trim()
                    ? event.target.value
                    : "Analysis session",
                  updatedAt: new Date().toISOString(),
                })
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={branches}
                  onChange={(_, checked) => setBranches(checked)}
                />
              }
              label="Remember"
            />
            <Typography variant="body2">
              Off by default. Enable to remember every new move, including
              alternatives, for replay. Turning it off only stops recording.
              Saved lines stay available. Clear branches removes alternatives
              and offers Undo.
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {!!session.branches.length && (
                <Button
                  color="warning"
                  onClick={() => {
                    setCleared(session);
                    restore(clearAnalysisBranches(session));
                    setOpen(false);
                  }}
                >
                  Clear variations
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={() => {
                  void changeSession(newAnalysisSession());
                }}
              >
                New session
              </Button>
              <Button onClick={download}>Download session backup</Button>
              {hasOriginal && (
                <Button
                  onClick={() => {
                    void getOriginalAnalysisSession(session.id)
                      .then((original) => {
                        if (!original) {
                          setError("The original backup is unavailable.");
                          return;
                        }
                        const url = URL.createObjectURL(
                          new Blob(
                            [
                              JSON.stringify(
                                {
                                  format: "chesskit-analysis-session",
                                  session: original,
                                },
                                null,
                                2
                              ),
                            ],
                            { type: "application/json" }
                          )
                        );
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "chesskit-original-session.json";
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 0);
                      })
                      .catch((reason) => setError(String(reason)));
                  }}
                >
                  Download original backup
                </Button>
              )}
              <Button onClick={() => file.current?.click()}>
                Restore session backup
              </Button>
              <input
                ref={file}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (event) => {
                  const selected = event.target.files?.[0];
                  event.target.value = "";
                  if (!selected) return;
                  try {
                    const imported = parseAnalysisSessionBackup(
                      await selected.text()
                    );
                    const next = copyAnalysisSession(imported);
                    await changeSession(next);
                  } catch (reason) {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Unable to restore backup."
                    );
                  }
                }}
              />
            </Stack>
            <Typography variant="caption">
              Sessions are stored in this browser on this device. Download
              backups to preserve them if browser data is cleared. Backups
              include every saved line, whether Remember is on or off.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <Typography fontWeight={600}>Reopen a session</Typography>
            {sessions.map((saved) => (
              <Stack key={saved.id} direction="row" gap={1} alignItems="center">
                <Button
                  variant={saved.id === session.id ? "outlined" : "text"}
                  sx={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    flex: 1,
                  }}
                  onClick={() => {
                    void getAnalysisSession(saved.id)
                      .then((next) => {
                        if (next) return changeSession(next);
                        throw new Error("This session is no longer available.");
                      })
                      .catch((reason) => setError(String(reason)));
                  }}
                >
                  {saved.title} · {new Date(saved.updatedAt).toLocaleString()}
                  {` · ${saved.branchCount} branches`}
                </Button>
                <Button
                  size="small"
                  aria-label={`Download backup of ${saved.title}`}
                  onClick={() => {
                    void getStoredAnalysisSession(saved.id)
                      .then((record) => {
                        if (!record)
                          throw new Error(
                            "This session is no longer available."
                          );
                        const url = URL.createObjectURL(
                          new Blob(
                            [
                              JSON.stringify(
                                {
                                  format: "chesskit-analysis-session",
                                  session: record,
                                },
                                null,
                                2
                              ),
                            ],
                            { type: "application/json" }
                          )
                        );
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "chesskit-saved-session.json";
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 0);
                      })
                      .catch((reason) => setError(String(reason)));
                  }}
                >
                  Backup
                </Button>
              </Stack>
            ))}
            <Button onClick={() => setOpen(false)}>Close</Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
