import {
  AnalysisSession,
  analysisSessionBackup,
  clearAnalysisBranches,
  copyAnalysisSession,
  newAnalysisSession,
  parseAnalysisSessionBackup,
  replayAnalysis,
} from "@/lib/analysisSession";
import { listAnalysisSessions, saveAnalysisSession } from "@/lib/gameDatabase";
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
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  analysisSourceErrorAtom,
  analysisSaveRequestAtom,
  analysisSaveStateAtom,
  analysisSessionAtom,
  analysisSessionsRevisionAtom,
  restoreAnalysisSessionAtom,
  storeAnalysisBranchesAtom,
} from "./sessionAtoms";
import {
  arrangeModeAtom,
  boardOrientationAtom,
  editablePositionAtom,
} from "./states";

export default function SessionPanel() {
  const [session, setSession] = useAtom(analysisSessionAtom);
  const [branches, setBranches] = useAtom(storeAnalysisBranchesAtom);
  const state = useAtomValue(analysisSaveStateAtom);
  const sourceError = useAtomValue(analysisSourceErrorAtom);
  const revision = useAtomValue(analysisSessionsRevisionAtom);
  const requestSave = useSetAtom(analysisSaveRequestAtom);
  const restore = useSetAtom(restoreAnalysisSessionAtom);
  const setOrientation = useSetAtom(boardOrientationAtom);
  const setArrange = useSetAtom(arrangeModeAtom);
  const arranging = useAtomValue(arrangeModeAtom);
  const setPosition = useSetAtom(editablePositionAtom);
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [error, setError] = useState("");
  const [cleared, setCleared] = useState<AnalysisSession | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let current = true;
    void listAnalysisSessions()
      .then((rows) => {
        if (current) setSessions(rows);
      })
      .catch((reason) => {
        if (current) setError(String(reason));
      });
    return () => {
      current = false;
    };
  }, [open, revision]);

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
      setOrientation(next.orientation);
      setArrange(!!next.draft);
      if (next.draft) setPosition(next.draft);
      setOpen(false);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to open the session."
      );
    }
  };

  const download = () => {
    const exported = branches
      ? session
      : { ...session, branches: [], selectedLineId: "main", cursorPly: 0 };
    const url = URL.createObjectURL(
      new Blob([analysisSessionBackup(exported)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "chesskit-analysis-session.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <Box width="100%" sx={{ px: 1 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
      >
        <Box sx={{ minWidth: 0 }}>
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
        <Button size="small" onClick={() => setOpen(true)}>
          Sessions & options
        </Button>
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
      {branches && !arranging && (
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
                restore({
                  ...session,
                  selectedLineId: event.target.value,
                  cursorPly: 0,
                })
              }
            >
              <MenuItem value="main">Main game</MenuItem>
              {session.branches.map((line, index) => (
                <MenuItem key={line.id} value={line.id}>
                  Branch {index + 1}: {replayAnalysis(line).history().join(" ")}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!!session.branches.length && (
            <Button
              size="small"
              color="warning"
              onClick={() => {
                setCleared(session);
                restore(clearAnalysisBranches(session));
              }}
            >
              Clear branches
            </Button>
          )}
        </Stack>
      )}
      {branches && cleared?.id === session.id && (
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
                  title: event.target.value || "Analysis session",
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
              label="Store analysis branches"
            />
            <Typography variant="body2">
              Off by default. Enable to save alternatives you play while
              analyzing and replay them later. Turning it off hides saved
              branches and stops recording new ones; Clear branches removes
              them.
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button
                variant="outlined"
                onClick={() => {
                  void changeSession(newAnalysisSession());
                }}
              >
                New session
              </Button>
              <Button onClick={download}>
                {branches
                  ? "Download session backup"
                  : "Download main game backup"}
              </Button>
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
                    if (!branches) {
                      next.branches = [];
                      next.selectedLineId = "main";
                      next.cursorPly = 0;
                    }
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
              backups to preserve them if browser data is cleared. Branches are
              included in backups only when branch storage is enabled.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <Typography fontWeight={600}>Reopen a session</Typography>
            {sessions.map((saved) => (
              <Button
                key={saved.id}
                variant={saved.id === session.id ? "outlined" : "text"}
                sx={{ justifyContent: "flex-start", textAlign: "left" }}
                onClick={() => {
                  void changeSession(saved);
                }}
              >
                {saved.title} · {new Date(saved.updatedAt).toLocaleString()}
                {branches ? ` · ${saved.branches.length} branches` : ""}
              </Button>
            ))}
            <Button onClick={() => setOpen(false)}>Close</Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
