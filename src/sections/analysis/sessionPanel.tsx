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
  getGameDatabase,
  getStoredAnalysisSession,
  getOriginalAnalysisSession,
  hasOriginalAnalysisSession,
  listAnalysisSessionSummaries,
  saveAnalysisSession,
} from "@/lib/gameDatabase";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
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

const clearedVariationsAtom = atom<AnalysisSession | null>(null);

async function deleteStoredAnalysisSession(id: string) {
  const db = await getGameDatabase();
  const tx = db.transaction(
    [
      "analysisSessions",
      "analysisSessionStates",
      "analysisSessionSummaries",
      "analysisSessionArchives",
    ],
    "readwrite"
  );
  await Promise.all([
    tx.objectStore("analysisSessions").delete(id),
    tx.objectStore("analysisSessionStates").delete(id),
    tx.objectStore("analysisSessionSummaries").delete(id),
    tx.objectStore("analysisSessionArchives").delete(id),
  ]);
  await tx.done;
  if (typeof BroadcastChannel !== "undefined") {
    const ch = new BroadcastChannel("chesskit-session-metadata");
    ch.postMessage(id);
    ch.close();
  }
}

export default function SessionPanel() {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const [session, setSession] = useAtom(analysisSessionAtom);
  const [branches, setBranches] = useAtom(storeAnalysisBranchesAtom);
  const state = useAtomValue(analysisSaveStateAtom);
  const revision = useAtomValue(analysisSessionsRevisionAtom);
  const setRevision = useSetAtom(analysisSessionsRevisionAtom);
  const restore = useSetAtom(restoreAnalysisSessionAtom);
  const setCleared = useSetAtom(clearedVariationsAtom);

  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<AnalysisSessionSummary[]>([]);
  const [error, setError] = useState("");
  const [hasOriginal, setHasOriginal] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<AnalysisSessionSummary | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open && session) {
      setTitleDraft(session.title);
    }
  }, [open, session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const commitTitle = (raw: string) => {
    const nextTitle = raw.trim() || "Analysis session";
    setTitleDraft(nextTitle);
    if (nextTitle !== session.title) {
      setSession({
        ...session,
        title: nextTitle,
        updatedAt: new Date().toISOString(),
      });
    }
  };

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

  const handleDeleteSession = async (target: AnalysisSessionSummary) => {
    setDeleteTarget(null);
    try {
      await deleteStoredAnalysisSession(target.id);
      const remaining = sessions.filter((row) => row.id !== target.id);
      setSessions(remaining);
      setRevision((value) => value + 1);

      if (target.id === session.id) {
        const nextRow = remaining[0];
        const nextSession = nextRow
          ? ((await getAnalysisSession(nextRow.id)) ?? newAnalysisSession())
          : newAnalysisSession();
        await changeSession(nextSession, false);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to delete the session."
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

  const statusTooltip =
    state.status === "saved"
      ? "Saved on this device · Click to manage sessions"
      : state.status === "saving"
        ? "Saving session…"
        : state.status === "error"
          ? "Save error · Click to manage sessions"
          : "Opening session…";

  const statusColor =
    state.status === "error"
      ? "error.main"
      : state.status === "saving"
        ? "warning.main"
        : "success.main";

  return (
    <>
      <Tooltip title={statusTooltip} enterDelay={400}>
        <ButtonBase
          onClick={() => setOpen(true)}
          aria-label={`Session: ${session.title}. Open sessions and options`}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            minWidth: 0,
            flex: 1,
            px: 0.75,
            py: 0.5,
            borderRadius: 1,
            textAlign: "left",
            transition: "background-color 120ms ease",
            "&:hover": { bgcolor: "action.hover" },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
            },
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: statusColor,
              flexShrink: 0,
              opacity: state.status === "saved" ? 0.8 : 1,
            }}
          />
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ minWidth: 0, flex: 1 }}
          >
            {session.title}
          </Typography>
          <Icon
            icon="mdi:chevron-down"
            height={16}
            style={{ opacity: 0.65, flexShrink: 0 }}
          />
        </ButtonBase>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => {
          commitTitle(titleDraft);
          setOpen(false);
        }}
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
            <Icon icon="mdi:folder-outline" height={22} />
            <Typography variant="h6" fontWeight={600} component="span">
              Analysis sessions
            </Typography>
          </Stack>
          <Tooltip title="Close">
            <IconButton
              size="small"
              aria-label="Close sessions dialog"
              onClick={() => {
                commitTitle(titleDraft);
                setOpen(false);
              }}
            >
              <Icon icon="mdi:close" height={20} />
            </IconButton>
          </Tooltip>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Session name"
              value={titleDraft}
              onChange={(event) => {
                const value = event.target.value;
                setTitleDraft(value);
                if (value.trim()) {
                  setSession({
                    ...session,
                    title: value,
                    updatedAt: new Date().toISOString(),
                  });
                }
              }}
              onBlur={() => commitTitle(titleDraft)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitTitle(titleDraft);
                  (event.target as HTMLInputElement).blur();
                }
              }}
              helperText="Cleared names default to “Analysis session” when finished."
            />

            <Box
              sx={{
                p: 1.25,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
              }}
            >
              <FormControlLabel
                labelPlacement="start"
                sx={{
                  m: 0,
                  width: "100%",
                  justifyContent: "space-between",
                }}
                control={
                  <Switch
                    size="small"
                    checked={branches}
                    onChange={(_, checked) => setBranches(checked)}
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={600}>
                    Record variations automatically
                  </Typography>
                }
              />
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.5 }}
              >
                Keep alternative moves you explore as saved variations for
                replay. Turning this off pauses recording without deleting
                existing variations.
              </Typography>
            </Box>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              flexWrap="wrap"
            >
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Icon icon="mdi:plus" height={16} />}
                  onClick={() => {
                    void changeSession(newAnalysisSession());
                  }}
                >
                  New session
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Icon icon="mdi:download" height={16} />}
                  onClick={download}
                >
                  Backup
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Icon icon="mdi:upload" height={16} />}
                  onClick={() => file.current?.click()}
                >
                  Restore
                </Button>
                {hasOriginal && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      <Icon icon="mdi:archive-arrow-down-outline" height={16} />
                    }
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
                    Original backup
                  </Button>
                )}
              </Stack>

              {!!session.branches.length && (
                <Button
                  size="small"
                  color="error"
                  variant="text"
                  startIcon={
                    <Icon icon="mdi:delete-sweep-outline" height={16} />
                  }
                  onClick={() => setConfirmClear(true)}
                >
                  Clear variations
                </Button>
              )}

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

            <Typography variant="caption" color="text.secondary">
              Sessions are saved locally in this browser. Export a backup to
              keep them if browser storage is cleared.
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}

            <Divider />

            <Stack spacing={0.75}>
              <Typography variant="subtitle2" fontWeight={600}>
                Saved sessions ({sessions.length})
              </Typography>
              {sessions.map((saved) => {
                const isActive = saved.id === session.id;
                const variationText =
                  saved.branchCount === 1
                    ? "1 variation"
                    : `${saved.branchCount} variations`;
                return (
                  <Stack
                    key={saved.id}
                    direction="row"
                    gap={0.75}
                    alignItems="center"
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      border: 1,
                      borderColor: isActive ? "primary.main" : "divider",
                      bgcolor: isActive ? "action.selected" : undefined,
                    }}
                  >
                    <ButtonBase
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        justifyContent: "flex-start",
                        textAlign: "left",
                        py: 0.5,
                        borderRadius: 0.5,
                      }}
                      onClick={() => {
                        void getAnalysisSession(saved.id)
                          .then((next) => {
                            if (next) return changeSession(next);
                            throw new Error(
                              "This session is no longer available."
                            );
                          })
                          .catch((reason) => setError(String(reason)));
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {saved.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          noWrap
                        >
                          {new Date(saved.updatedAt).toLocaleString()} ·{" "}
                          {variationText}
                        </Typography>
                      </Box>
                    </ButtonBase>
                    <Tooltip title={`Backup ${saved.title}`}>
                      <IconButton
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
                        <Icon icon="mdi:download" height={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={`Delete ${saved.title}`}>
                      <IconButton
                        size="small"
                        aria-label={`Delete ${saved.title}`}
                        onClick={() => setDeleteTarget(saved)}
                        sx={{
                          color: "text.secondary",
                          "&:hover": { color: "error.main" },
                        }}
                      >
                        <Icon icon="mdi:delete-outline" height={18} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              commitTitle(titleDraft);
              setOpen(false);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm clear variations */}
      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear all variations?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This removes all {session.branches.length} saved{" "}
            {session.branches.length === 1 ? "variation" : "variations"} from “
            {session.title}” and keeps only the main game. You can undo right
            after.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setCleared(session);
              restore(clearAnalysisBranches(session));
              setConfirmClear(false);
              setOpen(false);
            }}
          >
            Clear variations
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm delete session */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete analysis session?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Permanently delete “{deleteTarget?.title}” and its saved variations
            from this device? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleteTarget) void handleDeleteSession(deleteTarget);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Conditional error alerts, undo banner, and variation switcher shown below the slim header only when needed. */
export function SessionBanners() {
  const session = useAtomValue(analysisSessionAtom);
  const state = useAtomValue(analysisSaveStateAtom);
  const sourceError = useAtomValue(analysisSourceErrorAtom);
  const requestSave = useSetAtom(analysisSaveRequestAtom);
  const restore = useSetAtom(restoreAnalysisSessionAtom);
  const arranging = useAtomValue(arrangeModeAtom);
  const [cleared, setCleared] = useAtom(clearedVariationsAtom);
  const router = useRouter();

  if (!session) return null;

  const activeLine = sessionLine(session);
  const hasVariations = !arranging && session.branches.length > 0;
  const hasReports = !arranging && (activeLine.reports?.length ?? 0) > 0;
  const hasUndo = cleared?.id === session.id;

  if (
    !state.error &&
    !sourceError &&
    !hasVariations &&
    !hasReports &&
    !hasUndo
  ) {
    return null;
  }

  return (
    <Stack
      spacing={0.75}
      sx={{
        px: 1.5,
        py: 0.75,
        flexShrink: 0,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {state.error && (
        <Alert
          severity="error"
          sx={{ py: 0.25 }}
          action={
            <Stack direction="row" gap={0.5}>
              <Button
                size="small"
                onClick={() => requestSave((value) => value + 1)}
              >
                Retry
              </Button>
              <Button
                size="small"
                onClick={async () => {
                  const next = copyAnalysisSession(session);
                  await saveAnalysisSession(next);
                  await router.replace(
                    { pathname: "/analysis", query: { sessionId: next.id } },
                    undefined,
                    { scroll: false }
                  );
                  restore(next);
                }}
              >
                Save copy
              </Button>
            </Stack>
          }
        >
          {state.error}
        </Alert>
      )}

      {sourceError && (
        <Alert severity="error" sx={{ py: 0.25 }}>
          {sourceError} Your current session has been kept.
        </Alert>
      )}

      {(hasVariations || hasReports) && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          {hasVariations ? (
            <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
              <Select
                aria-label="Active variation"
                value={session.selectedLineId}
                onChange={(event) =>
                  restore(selectAnalysisLine(session, event.target.value))
                }
                sx={{
                  "& .MuiSelect-select": {
                    py: 0.5,
                    fontSize: "0.8rem",
                  },
                }}
              >
                <MenuItem value="main">Main game</MenuItem>
                {session.branches.map((line, index) => (
                  <MenuItem key={line.id} value={line.id}>
                    {analysisLineLabel(session, line, index)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Box sx={{ flex: 1 }} />
          )}
          {hasReports && (
            <ReportHistory key={session.selectedLineId} line={activeLine} />
          )}
        </Stack>
      )}

      {hasUndo && cleared && (
        <Alert
          severity="info"
          sx={{ py: 0 }}
          action={
            <Button
              size="small"
              onClick={() => {
                restore({
                  ...session,
                  branches: [
                    ...cleared.branches.filter(
                      (line) =>
                        !session.branches.some(
                          (current) => current.id === line.id
                        )
                    ),
                    ...session.branches,
                  ],
                  updatedAt: new Date().toISOString(),
                });
                setCleared(null);
              }}
            >
              Undo
            </Button>
          }
        >
          Variations cleared.
        </Alert>
      )}
    </Stack>
  );
}
