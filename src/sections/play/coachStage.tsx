import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import { CLASSIFICATION_COLORS } from "@/constants";
import {
  classificationName,
  WORTH_VISUALIZING,
} from "@/lib/classificationLabels";
import {
  COACH_PERSONAS,
  CoachDefinition,
  parseLinkifiedText,
} from "@/lib/coachBridge";
import type { CascadeBoardProjection, CascadeBranch } from "@/lib/coachCascade";
import { useChessActions } from "@/hooks/useChessActions";
import {
  coachPersonaIdAtom,
  coachVoiceEnabledAtom,
  gameAtom,
  isGameInProgressAtom,
  reviewPlyAtom,
} from "./states";
import type { useMoveCoach } from "./useMoveCoach";
import type { useInteractiveCoach } from "./useInteractiveCoach";

interface Props {
  moveCoach: ReturnType<typeof useMoveCoach>;
  interactive: ReturnType<typeof useInteractiveCoach>;
  cascade: CascadeBoardProjection;
  onShowWhy: () => void;
  onCascadeTogglePlay?: () => void;
  onCascadePrev?: () => void;
  onCascadeNext?: () => void;
  onCascadeReplay?: () => void;
  onCascadeSwitchBranch?: (branch: CascadeBranch) => void;
  onCascadeExit?: () => void;
  onCascadeTryAgain?: () => void;
}

export default function CoachStage({
  moveCoach,
  interactive,
  cascade,
  onShowWhy,
  onCascadeTogglePlay,
  onCascadePrev,
  onCascadeNext,
  onCascadeReplay,
  onCascadeSwitchBranch,
  onCascadeExit,
  onCascadeTryAgain,
}: Props) {
  const game = useAtomValue(gameAtom);
  const isInProgress = useAtomValue(isGameInProgressAtom);
  const reviewing = useAtomValue(reviewPlyAtom) !== null;
  const { goToMove } = useChessActions(gameAtom);
  const [personaId, setPersonaId] = useAtom(coachPersonaIdAtom);
  const [voiceEnabled, setVoiceEnabled] = useAtom(coachVoiceEnabledAtom);

  const [personaMenuAnchor, setPersonaMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [termPopover, setTermPopover] = useState<{
    anchor: HTMLElement;
    loading: boolean;
    def: CoachDefinition | null;
  } | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [textOverflows, setTextOverflows] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const shownMessages = interactive.replyMessages;
  const replyKey = cascade.active
    ? `cascade:${cascade.branch}:${cascade.stepIndex}`
    : shownMessages[0]?.id;

  const fitText = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const top = body.scrollTop;
    body.style.setProperty("--coach-text-size", "0.95rem");
    const compact = body.scrollHeight > body.clientHeight;
    if (compact) body.style.setProperty("--coach-text-size", "0.875rem");
    const overflow = body.scrollHeight > body.clientHeight;
    body.dataset.coachFit = overflow
      ? "scroll"
      : compact
        ? "compact"
        : "normal";
    body.scrollTop = overflow ? top : 0;
    setTextOverflows(overflow);
  }, []);

  useLayoutEffect(() => {
    fitText();
  }, [fitText, shownMessages, cascade.caption]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    if (!body || !content) return;
    const observer = new ResizeObserver(fitText);
    observer.observe(body);
    observer.observe(content);
    return () => observer.disconnect();
  }, [fitText]);

  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [replyKey]);

  const persona =
    COACH_PERSONAS.find((p) => p.id === personaId) ?? COACH_PERSONAS[0];

  const feedback = moveCoach.feedback;
  const classification = feedback?.classification;
  const accentColor = classification
    ? CLASSIFICATION_COLORS[classification]
    : "#3b82f6";

  const canShowWhy =
    !cascade.active &&
    feedback?.status === "done" &&
    !!feedback.story &&
    !!classification &&
    WORTH_VISUALIZING.includes(classification);

  const hasUndoChoice = interactive.choices.some(
    (c) =>
      c.action.toLowerCase().includes("undo") ||
      c.title.toLowerCase().includes("take back") ||
      c.title.toLowerCase().includes("undo")
  );

  const canTryAgain =
    !cascade.active &&
    !hasUndoChoice &&
    !reviewing &&
    interactive.isMistake &&
    isInProgress &&
    moveCoach.playerMoveIndex >= 0 &&
    game.history().length > 0;

  const handleTermClick = async (
    event: React.MouseEvent<HTMLElement>,
    url: string
  ) => {
    const anchor = event.currentTarget;
    setTermPopover({ anchor, loading: true, def: null });
    const def = await interactive.defineTerm(url);
    setTermPopover((prev) =>
      prev && prev.anchor === anchor ? { anchor, loading: false, def } : prev
    );
  };

  const renderRichText = (html: string) => {
    const segments = parseLinkifiedText(html);
    return segments.map((seg, idx) => {
      if (seg.kind === "term") {
        return (
          <Box
            key={idx}
            component="button"
            type="button"
            onClick={(e) => void handleTermClick(e, seg.url)}
            sx={{
              display: "inline",
              p: 0,
              m: 0,
              border: 0,
              background: "none",
              font: "inherit",
              fontWeight: 600,
              color: "primary.main",
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textUnderlineOffset: "3px",
              cursor: "pointer",
              "&:hover": {
                textDecorationStyle: "solid",
              },
            }}
          >
            {seg.label}
          </Box>
        );
      }
      if (seg.kind === "square") {
        return (
          <Box
            key={idx}
            component="button"
            type="button"
            title={`Highlight square ${seg.square}`}
            onClick={() => interactive.highlightSquare(seg.square)}
            sx={{
              display: "inline",
              px: 0.45,
              py: 0,
              mx: 0.15,
              border: "1px solid",
              borderColor: "rgba(99, 130, 246, 0.45)",
              borderRadius: 1,
              bgcolor: "rgba(99, 130, 246, 0.12)",
              font: "inherit",
              fontWeight: 700,
              color: "#6382f6",
              cursor: "pointer",
              "&:hover": {
                bgcolor: "rgba(99, 130, 246, 0.24)",
              },
            }}
          >
            {seg.label}
          </Box>
        );
      }
      if (seg.kind === "strong") {
        return <strong key={idx}>{seg.text}</strong>;
      }
      return <span key={idx}>{seg.text}</span>;
    });
  };

  return (
    <Box
      data-coach-stage
      sx={{
        width: "100%",
        height: { xs: 236, sm: 248 },
        "@media (max-height: 550px)": { height: 214 },
        flexShrink: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: cascade.active ? "rgba(245, 184, 46, 0.55)" : "divider",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "rgba(28, 28, 35, 0.92)" : "#ffffff",
        boxShadow: (theme) =>
          theme.palette.mode === "dark"
            ? "0 6px 20px rgba(0, 0, 0, 0.32)"
            : "0 4px 16px rgba(15, 23, 42, 0.07)",
        px: 1.5,
        py: 1.15,
        transition: "border-color 200ms ease, box-shadow 200ms ease",
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 0.65,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ height: 32, minHeight: 32, flexShrink: 0 }}
        >
          <Stack
            direction="row"
            alignItems="center"
            gap={0.85}
            minWidth={0}
            flexWrap="nowrap"
            sx={{ overflow: "hidden" }}
          >
            <Tooltip title={`${persona.name} — click to switch coach`}>
              <Box
                component="button"
                type="button"
                aria-label="Switch coach"
                onClick={(e) => setPersonaMenuAnchor(e.currentTarget)}
                sx={{
                  p: 0,
                  border: "2px solid",
                  borderColor: cascade.active ? "#f5b82e" : accentColor,
                  borderRadius: "50%",
                  overflow: "hidden",
                  width: 29,
                  height: 29,
                  flexShrink: 0,
                  alignSelf: "center",
                  cursor: "pointer",
                  background: "none",
                  transition: "transform 160ms ease, border-color 200ms ease",
                  "&:hover": { transform: "scale(1.05)" },
                }}
              >
                <Image
                  src={persona.avatar}
                  alt={persona.name}
                  width={29}
                  height={29}
                  style={{
                    objectFit: "cover",
                    display: "block",
                    width: "100%",
                    height: "100%",
                  }}
                />
              </Box>
            </Tooltip>
            <Typography
              variant="caption"
              fontWeight={700}
              noWrap
              sx={{ letterSpacing: 0.2 }}
            >
              {interactive.positionCoaching ? "Position coach" : persona.name}
            </Typography>

            {!cascade.active &&
              feedback?.status === "done" &&
              classification && (
                <Chip
                  size="small"
                  label={`${feedback.playedSan} · ${classificationName(classification)}`}
                  icon={
                    <Image
                      src={`/icons/${classification}.png`}
                      alt=""
                      width={13}
                      height={13}
                      style={{ marginLeft: 5 }}
                    />
                  }
                  sx={{
                    height: 20,
                    maxWidth: 190,
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    color: "#fff",
                    backgroundColor: CLASSIFICATION_COLORS[classification],
                    "& .MuiChip-label": {
                      px: 0.85,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                />
              )}

            {cascade.active && (
              <Chip
                size="small"
                label={`${
                  cascade.branch === "better" ? "Stronger line" : "Showing why"
                } · ${cascade.stepIndex}/${cascade.maxStep}`}
                sx={{
                  height: 20,
                  fontSize: "0.69rem",
                  fontWeight: 700,
                  bgcolor: "rgba(245, 184, 46, 0.22)",
                  color: "#f5b82e",
                  fontVariantNumeric: "tabular-nums",
                  "& .MuiChip-label": { px: 0.85 },
                }}
              />
            )}

            {!cascade.active &&
              interactive.coachBusy &&
              shownMessages.length > 0 && (
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={0.5}
                  sx={{ flexShrink: 0, ml: 0.25 }}
                >
                  <CircularProgress size={11} thickness={5} />
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ color: "text.secondary", fontSize: "0.72rem" }}
                  >
                    Thinking…
                  </Typography>
                </Stack>
              )}
          </Stack>

          <Stack direction="row" alignItems="center" gap={0.25} flexShrink={0}>
            <Button
              size="small"
              aria-label="Coach reply history"
              disabled={!interactive.messages.length}
              onClick={() => setHistoryOpen(true)}
              sx={{ minWidth: 0, px: 0.65, fontSize: "0.72rem" }}
            >
              History
            </Button>
            <Tooltip
              title={
                voiceEnabled ? "Mute coach voice" : "Read coach messages aloud"
              }
            >
              <IconButton
                size="small"
                aria-label={
                  voiceEnabled ? "Mute coach voice" : "Enable coach voice"
                }
                onClick={() => {
                  if (
                    voiceEnabled &&
                    typeof window !== "undefined" &&
                    "speechSynthesis" in window
                  ) {
                    window.speechSynthesis.cancel();
                  }
                  setVoiceEnabled(!voiceEnabled);
                }}
                sx={{
                  p: 0.35,
                  flexShrink: 0,
                  color: voiceEnabled ? "primary.main" : "text.secondary",
                }}
              >
                <Icon
                  icon={voiceEnabled ? "mdi:volume-high" : "mdi:volume-off"}
                  width={17}
                />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <Box
          ref={bodyRef}
          data-coach-transcript
          role="region"
          aria-label={
            cascade.active ? "Coach demonstration" : "Current coach reply"
          }
          tabIndex={textOverflows ? 0 : undefined}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarGutter: "stable",
            overscrollBehaviorY: textOverflows ? "contain" : "auto",
            overflowWrap: "anywhere",
          }}
        >
          <Stack
            ref={contentRef}
            spacing={0.55}
            role={cascade.active ? undefined : "log"}
            aria-label={cascade.active ? undefined : "Coach reply"}
          >
            {cascade.active ? (
              <Box
                sx={{
                  px: 1.35,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.045)"
                      : "rgba(15, 23, 42, 0.04)",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "var(--coach-text-size, 0.95rem)",
                    lineHeight: 1.4,
                    whiteSpace: "pre-line",
                  }}
                >
                  {cascade.san ? <strong>{cascade.san}: </strong> : null}
                  {cascade.caption ?? "Step through the line on the board."}
                </Typography>
              </Box>
            ) : (
              <>
                {shownMessages.length === 0 ? (
                  <Box
                    sx={{
                      px: 1.35,
                      py: 0.75,
                      borderRadius: 2,
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.045)"
                          : "rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <Stack direction="row" alignItems="center" gap={1}>
                      {!interactive.ready && (
                        <CircularProgress size={13} thickness={5} />
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "var(--coach-text-size, 0.95rem)",
                          color: "text.secondary",
                        }}
                      >
                        {!interactive.ready
                          ? "Connecting to your coach…"
                          : interactive.positionCoaching
                            ? "Position coaching gives move feedback and hints for this game."
                            : "Play a move to get feedback."}
                      </Typography>
                    </Stack>
                  </Box>
                ) : (
                  shownMessages.map((msg, i) => {
                    const isLatest = i === shownMessages.length - 1;
                    return (
                      <Box
                        key={msg.id}
                        data-coach-message
                        className={msg.wiggleTick ? "ck-wiggle" : undefined}
                        sx={{
                          position: "relative",
                          px: 1.35,
                          py: 0.7,
                          borderRadius: 2,
                          bgcolor: (theme) =>
                            theme.palette.mode === "dark"
                              ? isLatest
                                ? "rgba(255, 255, 255, 0.055)"
                                : "rgba(255, 255, 255, 0.03)"
                              : isLatest
                                ? "rgba(15, 23, 42, 0.05)"
                                : "rgba(15, 23, 42, 0.025)",
                          opacity: isLatest ? 1 : 0.78,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: "var(--coach-text-size, 0.95rem)",
                            lineHeight: 1.4,
                            whiteSpace: "pre-line",
                          }}
                        >
                          {renderRichText(msg.html)}
                        </Typography>
                      </Box>
                    );
                  })
                )}
              </>
            )}
          </Stack>
        </Box>

        {/* Fixed single-row action bar: never wraps or changes height; Hint stays anchored on the left */}
        <Stack
          direction="row"
          alignItems="center"
          gap={0.65}
          flexWrap="nowrap"
          sx={{
            height: 30,
            minHeight: 30,
            maxHeight: 30,
            flexShrink: 0,
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {cascade.active ? (
            <>
              {cascade.hasBetterBranch && onCascadeSwitchBranch && (
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={cascade.branch}
                  onChange={(_, val: CascadeBranch | null) => {
                    if (val) onCascadeSwitchBranch(val);
                  }}
                  sx={{
                    flexShrink: 0,
                    "& .MuiToggleButton-root": {
                      py: 0.1,
                      px: 0.8,
                      fontSize: "0.7rem",
                      lineHeight: 1.4,
                      textTransform: "none",
                      whiteSpace: "nowrap",
                    },
                  }}
                >
                  <ToggleButton value="played">Refutation</ToggleButton>
                  <ToggleButton value="better">Best line</ToggleButton>
                </ToggleButtonGroup>
              )}

              <Stack
                direction="row"
                alignItems="center"
                gap={0.15}
                sx={{ flexShrink: 0 }}
              >
                <Tooltip title="Previous step">
                  <span>
                    <IconButton
                      size="small"
                      onClick={onCascadePrev}
                      disabled={cascade.stepIndex <= 0}
                      aria-label="Previous step"
                      sx={{ p: 0.35 }}
                    >
                      <Icon icon="mdi:chevron-left" width={18} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={cascade.playing ? "Pause" : "Play"}>
                  <IconButton
                    size="small"
                    onClick={onCascadeTogglePlay}
                    aria-label={
                      cascade.playing ? "Pause cascade" : "Play cascade"
                    }
                    sx={{ p: 0.35 }}
                  >
                    <Icon
                      icon={cascade.playing ? "mdi:pause" : "mdi:play"}
                      width={18}
                    />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Next step">
                  <span>
                    <IconButton
                      size="small"
                      onClick={onCascadeNext}
                      disabled={cascade.stepIndex >= cascade.maxStep}
                      aria-label="Next step"
                      sx={{ p: 0.35 }}
                    >
                      <Icon icon="mdi:chevron-right" width={18} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Replay">
                  <IconButton
                    size="small"
                    onClick={onCascadeReplay}
                    aria-label="Replay cascade"
                    sx={{ p: 0.35 }}
                  >
                    <Icon icon="mdi:replay" width={16} />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Box sx={{ flex: 1 }} />

              {cascade.canTryAgain && onCascadeTryAgain && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={onCascadeTryAgain}
                  sx={{
                    py: 0.2,
                    px: 1.05,
                    minHeight: 26,
                    fontSize: "0.74rem",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Try again
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                onClick={onCascadeExit}
                sx={{
                  py: 0.2,
                  px: 1.05,
                  minHeight: 26,
                  fontSize: "0.74rem",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {cascade.exitLabel}
              </Button>
            </>
          ) : (
            <>
              {isInProgress && (
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!interactive.canRequestHint}
                  startIcon={
                    <Icon icon="mdi:lightbulb-on-outline" width={15} />
                  }
                  onClick={() => void interactive.requestHint()}
                  sx={{
                    py: 0.2,
                    px: 1.1,
                    minHeight: 26,
                    fontSize: "0.75rem",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Hint
                </Button>
              )}

              {interactive.choices.map((choice, idx) => (
                <Button
                  key={choice.action}
                  size="small"
                  variant={idx === 0 ? "contained" : "outlined"}
                  color={
                    choice.action.toLowerCase().includes("undo")
                      ? "warning"
                      : "primary"
                  }
                  onClick={() => void interactive.sendChoice(choice)}
                  sx={{
                    py: 0.2,
                    px: 1.15,
                    minHeight: 26,
                    fontSize: "0.75rem",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {choice.title}
                </Button>
              ))}

              {canShowWhy && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Icon icon="mdi:play-circle-outline" width={15} />}
                  onClick={onShowWhy}
                  sx={{
                    py: 0.2,
                    px: 1.15,
                    minHeight: 26,
                    fontSize: "0.75rem",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Show why
                </Button>
              )}

              {canTryAgain && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<Icon icon="mdi:undo-variant" width={15} />}
                  onClick={() => goToMove(moveCoach.playerMoveIndex, game)}
                  sx={{
                    py: 0.2,
                    px: 1.1,
                    minHeight: 26,
                    fontSize: "0.75rem",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Try again
                </Button>
              )}
            </>
          )}
        </Stack>
      </Box>

      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="coach-reply-history-title"
      >
        <DialogTitle id="coach-reply-history-title">
          Coach reply history
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            {interactive.messages.map((message) => (
              <Typography
                key={message.id}
                variant="body2"
                sx={{ overflowWrap: "anywhere", whiteSpace: "pre-line" }}
              >
                {message.plain}
              </Typography>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setHistoryOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Coach Persona Switcher Menu */}
      <Menu
        anchorEl={personaMenuAnchor}
        open={!!personaMenuAnchor}
        onClose={() => setPersonaMenuAnchor(null)}
        slotProps={{ paper: { sx: { maxHeight: 320, width: 240 } } }}
      >
        {COACH_PERSONAS.map((p) => (
          <MenuItem
            key={p.id}
            selected={p.id === persona.id}
            onClick={() => {
              setPersonaId(p.id);
              setPersonaMenuAnchor(null);
            }}
          >
            <ListItemAvatar sx={{ minWidth: 42 }}>
              <Avatar
                src={p.avatar}
                alt={p.name}
                sx={{ width: 32, height: 32 }}
              />
            </ListItemAvatar>
            <ListItemText
              primary={p.name}
              secondary={p.role}
              slotProps={{
                primary: { fontSize: "0.84rem", fontWeight: 600 },
                secondary: { fontSize: "0.72rem" },
              }}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Clickable Chess Term Glossary Popover */}
      <Popover
        open={!!termPopover}
        anchorEl={termPopover?.anchor ?? null}
        onClose={() => setTermPopover(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              maxWidth: 310,
              borderRadius: 2.5,
              border: "1px solid",
              borderColor: "divider",
            },
          },
        }}
      >
        {termPopover?.loading ? (
          <Stack direction="row" alignItems="center" gap={1}>
            <CircularProgress size={15} />
            <Typography variant="caption">Loading definition…</Typography>
          </Stack>
        ) : termPopover?.def ? (
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" fontWeight={700}>
              {termPopover.def.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: "0.82rem",
                color: "text.secondary",
                lineHeight: 1.48,
              }}
            >
              {renderRichText(termPopover.def.html)}
            </Typography>
          </Stack>
        ) : null}
      </Popover>
    </Box>
  );
}
