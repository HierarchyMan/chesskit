import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceLayout } from "@/components/boardWorkspace";
import Image from "next/image";
import { Icon } from "@iconify/react";
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
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
  alpha,
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

const COMPACT_ACTION_SX = {
  py: 0.25,
  px: 1.05,
  minHeight: 28,
  fontSize: "0.75rem",
  fontWeight: 600,
  borderRadius: 1,
  whiteSpace: "nowrap",
  flexShrink: 0,
  textTransform: "none",
} as const;

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
  const { isCompactPhone } = useWorkspaceLayout();
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

  const bodyRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const prevReplyStartRef = useRef(interactive.replyStart);
  const prevMessageCountRef = useRef(0);
  const [scrolledUp, setScrolledUp] = useState(false);

  const allMessages = interactive.messages;
  const replyStart = interactive.replyStart;
  const lastWiggle = allMessages[allMessages.length - 1]?.wiggleTick ?? 0;

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    stickToBottomRef.current = true;
    setScrolledUp(false);
  }, []);

  const handleFeedScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 28;
    stickToBottomRef.current = atBottom;
    setScrolledUp(!atBottom && el.scrollHeight > el.clientHeight + 8);
  }, []);

  // Auto-scroll smoothly when new coach commentary arrives (unless user scrolled up mid-turn).
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    if (cascade.active) {
      el.scrollTop = 0;
      setScrolledUp(false);
      return;
    }

    const startedNewTurn = replyStart !== prevReplyStartRef.current;
    const hadPreviousMessages = prevMessageCountRef.current > 0;
    prevReplyStartRef.current = replyStart;
    prevMessageCountRef.current = allMessages.length;

    if (startedNewTurn || stickToBottomRef.current) {
      scrollToBottom(hadPreviousMessages);
    }
  }, [
    allMessages.length,
    replyStart,
    lastWiggle,
    cascade.active,
    cascade.branch,
    cascade.stepIndex,
    scrollToBottom,
  ]);

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
            sx={(theme) => ({
              display: "inline",
              px: 0.45,
              py: 0,
              mx: 0.15,
              border: "1px solid",
              borderColor: alpha(theme.palette.primary.main, 0.4),
              borderRadius: 0.75,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              font: "inherit",
              fontWeight: 700,
              color: "primary.main",
              cursor: "pointer",
              "&:hover": {
                bgcolor: alpha(theme.palette.primary.main, 0.24),
              },
            })}
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
      sx={(theme) => ({
        width: "100%",
        height: isCompactPhone ? 136 : { xs: 196, sm: 216 },
        "@media (max-height: 680px)": { height: isCompactPhone ? 124 : 176 },
        "@media (max-height: 550px)": { height: isCompactPhone ? 114 : 152 },
        flexShrink: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        border: isCompactPhone ? "1px solid" : undefined,
        borderRadius: isCompactPhone ? 1.25 : 0,
        borderBottom: "1px solid",
        borderColor: cascade.active
          ? alpha("#f5b82e", 0.55)
          : theme.palette.divider,
        bgcolor: cascade.active
          ? alpha("#f5b82e", theme.palette.mode === "dark" ? 0.08 : 0.09)
          : isCompactPhone
            ? theme.palette.background.paper
            : theme.palette.mode === "dark"
              ? alpha(theme.palette.common.white, 0.022)
              : alpha(theme.palette.primary.main, 0.025),
        px: isCompactPhone ? 1.1 : 1.5,
        py: isCompactPhone ? 0.75 : 1,
        transition: "border-color 200ms ease, background-color 200ms ease",
      })}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
        }}
      >
        {/* Header: discoverable coach persona switcher + move verdict + voice toggle */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={0.75}
          sx={{ height: 30, minHeight: 30, flexShrink: 0 }}
        >
          <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            minWidth={0}
            flexWrap="nowrap"
            sx={{ overflow: "hidden" }}
          >
            <Tooltip title="Switch coach">
              <ButtonBase
                aria-label="Switch coach"
                aria-haspopup="menu"
                aria-expanded={!!personaMenuAnchor}
                onClick={(e) => setPersonaMenuAnchor(e.currentTarget)}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.7,
                  pl: 0.25,
                  pr: 0.65,
                  py: 0.25,
                  ml: -0.25,
                  borderRadius: 1,
                  minWidth: 0,
                  flexShrink: 0,
                  transition: "background-color 140ms ease",
                  "&:hover": { bgcolor: "action.hover" },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                  },
                }}
              >
                <Box
                  sx={{
                    border: "2px solid",
                    borderColor: cascade.active ? "#f5b82e" : accentColor,
                    borderRadius: "50%",
                    overflow: "hidden",
                    width: 26,
                    height: 26,
                    flexShrink: 0,
                    transition: "border-color 200ms ease",
                  }}
                >
                  <Image
                    src={persona.avatar}
                    alt={persona.name}
                    width={26}
                    height={26}
                    style={{
                      objectFit: "cover",
                      display: "block",
                      width: "100%",
                      height: "100%",
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  noWrap
                  sx={{ fontSize: "0.78rem", letterSpacing: 0.1 }}
                >
                  {interactive.positionCoaching
                    ? "Position coach"
                    : persona.name}
                </Typography>
                <Icon
                  icon="mdi:chevron-down"
                  width={15}
                  style={{ opacity: 0.65, flexShrink: 0 }}
                />
              </ButtonBase>
            </Tooltip>

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
                  sx={(theme) => ({
                    height: 21,
                    maxWidth: 185,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color:
                      theme.palette.mode === "dark"
                        ? theme.palette.common.white
                        : theme.palette.text.primary,
                    bgcolor: alpha(
                      CLASSIFICATION_COLORS[classification],
                      theme.palette.mode === "dark" ? 0.24 : 0.16
                    ),
                    border: "1px solid",
                    borderColor: alpha(
                      CLASSIFICATION_COLORS[classification],
                      0.45
                    ),
                    "& .MuiChip-label": {
                      px: 0.75,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  })}
                />
              )}

            {cascade.active && (
              <Chip
                size="small"
                label={`${
                  cascade.branch === "better" ? "Stronger line" : "Showing why"
                } · ${cascade.stepIndex}/${cascade.maxStep}`}
                sx={{
                  height: 21,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  bgcolor: alpha("#f5b82e", 0.2),
                  color: "#f5b82e",
                  border: "1px solid",
                  borderColor: alpha("#f5b82e", 0.4),
                  fontVariantNumeric: "tabular-nums",
                  "& .MuiChip-label": { px: 0.8 },
                }}
              />
            )}

            {!cascade.active &&
              interactive.coachBusy &&
              allMessages.length > 0 && (
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={0.5}
                  sx={{ flexShrink: 0 }}
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
              aria-pressed={voiceEnabled}
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
                p: 0.4,
                borderRadius: 1,
                flexShrink: 0,
                color: voiceEnabled ? "primary.main" : "text.secondary",
                bgcolor: voiceEnabled
                  ? (theme) => alpha(theme.palette.primary.main, 0.12)
                  : "transparent",
              }}
            >
              <Icon
                icon={voiceEnabled ? "mdi:volume-high" : "mdi:volume-off"}
                width={17}
              />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Scrollable live commentary feed (full game history + latest highlighted at bottom) */}
        <Box
          sx={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}
        >
          <Box
            ref={bodyRef}
            onScroll={handleFeedScroll}
            data-coach-transcript
            role="region"
            aria-label={
              cascade.active ? "Coach demonstration" : "Coach commentary feed"
            }
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarGutter: "stable",
              overscrollBehaviorY: "contain",
              overflowWrap: "anywhere",
              pr: 0.25,
            }}
          >
            <Stack
              spacing={0.6}
              role={cascade.active ? undefined : "log"}
              aria-live={cascade.active ? undefined : "polite"}
              aria-label={cascade.active ? undefined : "Coach commentary"}
            >
              {cascade.active ? (
                <Box
                  sx={(theme) => ({
                    px: 1.2,
                    py: 0.75,
                    borderRadius: 1,
                    borderLeft: "2.5px solid #f5b82e",
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.common.white, 0.05)
                        : alpha(theme.palette.common.black, 0.04),
                  })}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: "0.875rem",
                      lineHeight: 1.45,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {cascade.san ? <strong>{cascade.san}: </strong> : null}
                    {cascade.caption ?? "Step through the line on the board."}
                  </Typography>
                </Box>
              ) : allMessages.length === 0 ? (
                <Box
                  sx={(theme) => ({
                    px: 1.2,
                    py: 0.75,
                    borderRadius: 1,
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.common.white, 0.035)
                        : alpha(theme.palette.common.black, 0.035),
                  })}
                >
                  <Stack direction="row" alignItems="center" gap={1}>
                    {!interactive.ready && (
                      <CircularProgress size={13} thickness={5} />
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: "0.875rem",
                        lineHeight: 1.45,
                        color: "text.secondary",
                      }}
                    >
                      {!interactive.ready
                        ? "Connecting to your coach…"
                        : interactive.positionCoaching
                          ? "Position coaching gives move feedback and hints for this game."
                          : "Play a move to start live coaching."}
                    </Typography>
                  </Stack>
                </Box>
              ) : (
                allMessages.map((msg, index) => {
                  const isCurrentReply = index >= replyStart;
                  const showTurnDivider =
                    index > 0 && (msg.startsGroup || index === replyStart);

                  return (
                    <Box key={msg.id}>
                      {showTurnDivider && (
                        <Stack
                          direction="row"
                          alignItems="center"
                          gap={0.75}
                          sx={{ my: 0.45 }}
                        >
                          <Box
                            sx={{
                              flex: 1,
                              height: "1px",
                              bgcolor: "divider",
                              opacity: isCurrentReply ? 0.9 : 0.55,
                            }}
                          />
                          {msg.moveTag && (
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: "0.66rem",
                                fontWeight: 600,
                                color: isCurrentReply
                                  ? "text.secondary"
                                  : "text.disabled",
                                fontVariantNumeric: "tabular-nums",
                                letterSpacing: 0.2,
                              }}
                            >
                              {msg.moveTag}
                            </Typography>
                          )}
                          <Box
                            sx={{
                              flex: 1,
                              height: "1px",
                              bgcolor: "divider",
                              opacity: isCurrentReply ? 0.9 : 0.55,
                            }}
                          />
                        </Stack>
                      )}
                      <Box
                        data-coach-message
                        className={msg.wiggleTick ? "ck-wiggle" : undefined}
                        sx={(theme) => ({
                          position: "relative",
                          px: isCurrentReply ? 1.15 : 1.05,
                          py: isCurrentReply ? 0.65 : 0.5,
                          borderRadius: 1,
                          borderLeft: isCurrentReply
                            ? "2.5px solid"
                            : "2.5px solid transparent",
                          borderLeftColor: isCurrentReply
                            ? accentColor
                            : "transparent",
                          bgcolor: isCurrentReply
                            ? theme.palette.mode === "dark"
                              ? alpha(theme.palette.common.white, 0.06)
                              : alpha(theme.palette.common.black, 0.045)
                            : theme.palette.mode === "dark"
                              ? alpha(theme.palette.common.white, 0.024)
                              : alpha(theme.palette.common.black, 0.022),
                          opacity: isCurrentReply ? 1 : 0.68,
                          transition:
                            "opacity 150ms ease, background-color 150ms ease",
                          "&:hover": { opacity: 1 },
                        })}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: "0.875rem",
                            lineHeight: 1.45,
                            whiteSpace: "pre-line",
                          }}
                        >
                          {renderRichText(msg.html)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Stack>
          </Box>

          {!cascade.active && scrolledUp && (
            <Button
              size="small"
              variant="contained"
              onClick={() => scrollToBottom(true)}
              endIcon={<Icon icon="mdi:arrow-down" width={13} />}
              sx={{
                position: "absolute",
                right: 10,
                bottom: 4,
                minHeight: 22,
                py: 0.15,
                px: 0.9,
                fontSize: "0.7rem",
                fontWeight: 600,
                borderRadius: 999,
                boxShadow: 2,
                textTransform: "none",
              }}
            >
              Latest
            </Button>
          )}
        </Box>

        {/* Coach Action Row */}
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
                      py: 0.15,
                      px: 0.85,
                      fontSize: "0.72rem",
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
                      sx={{ p: 0.35, borderRadius: 1 }}
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
                    sx={{ p: 0.35, borderRadius: 1 }}
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
                      sx={{ p: 0.35, borderRadius: 1 }}
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
                    sx={{ p: 0.35, borderRadius: 1 }}
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
                  sx={COMPACT_ACTION_SX}
                >
                  Try again
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={onCascadeExit}
                sx={{
                  ...COMPACT_ACTION_SX,
                  borderColor: "divider",
                }}
              >
                {cascade.exitLabel}
              </Button>
            </>
          ) : (
            <>
              {isInProgress && (
                <Tooltip title="Ask coach for a hint (H)">
                  <span>
                    <Button
                      size="small"
                      variant="text"
                      disabled={!interactive.canRequestHint}
                      startIcon={
                        <Icon icon="mdi:lightbulb-on-outline" width={15} />
                      }
                      onClick={() => void interactive.requestHint()}
                      sx={(theme) => ({
                        ...COMPACT_ACTION_SX,
                        bgcolor: theme.palette.action.hover,
                        color: theme.palette.text.primary,
                        "&:hover": {
                          bgcolor: alpha(theme.palette.primary.main, 0.16),
                          color: theme.palette.primary.main,
                        },
                      })}
                    >
                      Hint
                    </Button>
                  </span>
                </Tooltip>
              )}

              {interactive.choices.map((choice, idx) => {
                const isUndo = choice.action.toLowerCase().includes("undo");
                return (
                  <Button
                    key={choice.action}
                    size="small"
                    variant={idx === 0 ? "contained" : "outlined"}
                    color={isUndo ? "warning" : "primary"}
                    onClick={() => void interactive.sendChoice(choice)}
                    sx={COMPACT_ACTION_SX}
                  >
                    {choice.title}
                  </Button>
                );
              })}

              {canShowWhy && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Icon icon="mdi:play-circle-outline" width={15} />}
                  onClick={onShowWhy}
                  sx={COMPACT_ACTION_SX}
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
                  sx={COMPACT_ACTION_SX}
                >
                  Try again
                </Button>
              )}
            </>
          )}
        </Stack>
      </Box>

      {/* Coach Persona Switcher Menu */}
      <Menu
        anchorEl={personaMenuAnchor}
        open={!!personaMenuAnchor}
        onClose={() => setPersonaMenuAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              maxHeight: 320,
              width: 244,
              borderRadius: 1.5,
            },
          },
        }}
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
              borderRadius: 1.5,
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
