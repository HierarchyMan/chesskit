import { ArrowOverlayControls } from "@/components/board/arrowOverlay";
import {
  useWorkspacePageFlow,
  type VerticalWorkspaceSlots,
} from "@/components/boardWorkspace";
import {
  InspectorPopover,
  PopoverSectionLabel,
  PopoverSwitchRow,
} from "@/components/inspector/inspectorPopover";
import {
  DeckButton,
  InspectorPill,
} from "@/components/inspector/inspectorShell";
import {
  VerticalContextStrip,
  VerticalLiveStrip,
  WorkspaceActionBar,
} from "@/components/inspector/workspaceActionBar";
import MovesList from "@/components/movesList";
import StrengthControl from "@/components/strengthControl";
import { ToolbarButton } from "@/components/ToolbarButton";
import TopMovesPanel from "@/components/topMovesPanel";
import { engineLabel } from "@/constants";
import { useChessActions } from "@/hooks/useChessActions";
import {
  useEffectiveAdvice,
  useEffectiveBotDrawEvalDepth,
} from "@/hooks/useEffectiveEngineSettings";
import { EngineState, useEngineState } from "@/hooks/useEngine";
import { useFeatureEngineName } from "@/hooks/useFeatureEngineName";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { BoardArrow } from "@/lib/arrows/types";
import { copyToClipboard } from "@/lib/clipboard";
import { getEndgame } from "@/lib/endgames";
import { effectiveStrength } from "@/lib/engine/botMove";
import { engineFeatureLabel } from "@/lib/engine/featureEngines";
import { getEngineModel } from "@/lib/engine/models";
import { CHALLENGE_STRENGTH, scoreFromLine } from "@/lib/engine/strength";
import {
  effectiveMoveSide,
  MoveSideChoice,
  resetMoveSideChoice,
} from "@/lib/engine/topMoves";
import { getGameResult, getOutcomeFor } from "@/lib/gameResult";
import { EngineName } from "@/types/enums";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useRouter } from "next/router";
import { useCallback, useMemo, useState } from "react";
import ChallengeCard from "./challengeCard";
import {
  activeCoachAtom,
  activeGameModeAtom,
  boardFlippedAtom,
  botErrorAtom,
  botRetryTickAtom,
  botStrengthAtom,
  botThinkingAtom,
  challengeIdAtom,
  enginePlayNameAtom,
  gameAtom,
  gameEndAtom,
  gameIdAtom,
  hintArrowsAtom,
  hintPositionKeyAtom,
  isGameInProgressAtom,
  playArrowsWithCoachAtom,
  playCascadeActiveAtom,
  playEvalBarAtom,
  playerColorAtom,
  queuedStartSourceAtom,
  reviewPlyAtom,
  savedGameIdAtom,
  startingPositionAtom,
} from "./states";
import { useInteractiveCoach } from "./useInteractiveCoach";
import { useMoveCoach } from "./useMoveCoach";
import { usePlayOverlay } from "./usePlayOverlay";
import { opposite, useStartGame } from "./useStartGame";

interface Props {
  botEngine: EngineState;
  overlay: ReturnType<typeof usePlayOverlay>;
  coach: ReturnType<typeof useMoveCoach>;
  interactive: ReturnType<typeof useInteractiveCoach>;
  coachSlotRef: (el: HTMLDivElement | null) => void;
}

export default function GamePanel({
  botEngine,
  overlay,
  coach,
  interactive,
  coachSlotRef,
}: Props) {
  const store = useStore();
  const pageFlow = useWorkspacePageFlow();
  const gameId = useAtomValue(gameIdAtom);
  const inCascade = useAtomValue(playCascadeActiveAtom);
  const [reviewPly, setReviewPly] = useAtom(reviewPlyAtom);
  const [evalBar, setEvalBar] = useAtom(playEvalBarAtom);
  const [arrowsWithCoach, setArrowsWithCoach] = useAtom(
    playArrowsWithCoachAtom
  );
  const { backToSetup, restartGame } = useStartGame();
  const [casualExit, setCasualExit] = useState<"restart" | "discard">(
    "restart"
  );
  const [casualExitOpen, setCasualExitOpen] = useState(false);
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const confirmCasualExit = (action: "restart" | "discard") => {
    setOptionsAnchor(null);
    setCasualExit(action);
    setCasualExitOpen(true);
  };
  const [offeringDraw, setOfferingDraw] = useState(false);
  const [strengthOpen, setStrengthOpen] = useState(false);
  const game = useAtomValue(gameAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const [isInProgress, setIsInProgress] = useAtom(isGameInProgressAtom);
  const activeMode = useAtomValue(activeGameModeAtom);
  const [coachActive, setCoachActive] = useAtom(activeCoachAtom);
  const [end, setEnd] = useAtom(gameEndAtom);
  const botThinking = useAtomValue(botThinkingAtom);
  const [botError, setBotError] = useAtom(botErrorAtom);
  const bumpBotRetry = useSetAtom(botRetryTickAtom);
  const [queuedSource, setQueuedSource] = useAtom(queuedStartSourceAtom);
  const setStartingPosition = useSetAtom(startingPositionAtom);
  const [botEngineName, setBotEngineName] = useAtom(enginePlayNameAtom);
  const [savedStrength, setSavedStrength] = useAtom(botStrengthAtom);
  const challengeId = useAtomValue(challengeIdAtom);
  const challenge = challengeId ? getEndgame(challengeId) : undefined;
  const strength = challenge ? CHALLENGE_STRENGTH : savedStrength;
  const shownStrength = effectiveStrength(botEngineName, strength);
  const setFlipped = useSetAtom(boardFlippedAtom);
  const setHintArrows = useSetAtom(hintArrowsAtom);
  const positionKey = useAtomValue(hintPositionKeyAtom);
  const publishHintArrows = useCallback(
    (arrows: BoardArrow[]) => setHintArrows({ positionKey, arrows }),
    [setHintArrows, positionKey]
  );
  const analysisEngineName = useFeatureEngineName("advice");
  const { depth: adviceDepth, multiPv: adviceMultiPv } = useEffectiveAdvice();
  const { depth: botDrawEvalDepth } = useEffectiveBotDrawEvalDepth();
  const { goToMove, undoMove } = useChessActions(gameAtom);

  const [hintsOpen, setHintsOpen] = useState(false);
  const fen = game.fen();
  const [hintSideChoice, setHintSideChoice] = useState<MoveSideChoice>({
    side: "mover",
    fen,
    positionKey,
  });
  const currentHintChoice = resetMoveSideChoice(
    hintSideChoice,
    fen,
    positionKey
  );
  const hintSide = effectiveMoveSide(currentHintChoice, fen, positionKey);
  // Forget the relative what-if after any position visit, including takebacks.
  if (currentHintChoice !== hintSideChoice) {
    setHintSideChoice(currentHintChoice);
  }
  const [confirmResign, setConfirmResign] = useState(false);
  const [notice, setNotice] = useState("");

  const hintEngine = useEngineState(
    hintsOpen && activeMode === "casual" ? analysisEngineName : undefined,
    engineFeatureLabel("advice")
  );

  const isCasual = activeMode === "casual";
  const history = game.history();
  const livePly = history.length;
  const reviewing = reviewPly !== null && reviewPly < livePly;
  const shownPly = reviewing ? reviewPly : livePly;
  const selectPly = (ply: number) => {
    const next = Math.max(0, Math.min(livePly, ply));
    setReviewPly(next < livePly ? next : null);
  };
  const flip = () => setFlipped((value) => !value);
  const info = useMemo(() => getGameResult(game, end), [game, end]);
  const isPlayerTurn = game.turn() === playerColor;
  const firstMove = game.history({ verbose: true })[0];
  const startsWithBlack = firstMove?.color === "b";
  const firstMoveNumber = Number(firstMove?.before.split(" ")[5]) || 1;

  const strengthLabel =
    shownStrength?.mode === "elo"
      ? `${shownStrength.elo}`
      : shownStrength?.mode === "depth"
        ? `depth ${shownStrength.depth}`
        : shownStrength?.mode === "max"
          ? "Full"
          : "Joke";

  const canChangeStrength =
    isInProgress && isCasual && !challenge && !!shownStrength;

  const undoDisabledReason = !isCasual
    ? "Takebacks are not allowed in formal games"
    : !isInProgress
      ? "The game is over"
      : history.length < (isPlayerTurn ? 2 : 1)
        ? "Nothing to take back yet"
        : "";

  const handleUndo = () => {
    if (undoDisabledReason || inCascade || reviewing) return;
    setReviewPly(null);
    if (isPlayerTurn) goToMove(history.length - 2, game);
    else undoMove();
  };

  const handleResign = () => {
    setConfirmResign(false);
    setEnd({ type: "resign", loser: playerColor });
    setIsInProgress(false);
  };

  const handleOfferDraw = async () => {
    const engine = botEngine.engine;
    if (!engine || !isPlayerTurn || offeringDraw || reviewing || inCascade)
      return;

    // Joke engines score moves by their own taste, so their scores cannot judge a draw.
    if (getEngineModel(botEngineName).playsOwnMoves) {
      if (botEngineName === EngineName.Drawfish) {
        setEnd({ type: "draw-agreed" });
        setIsInProgress(false);
        setNotice("Drawfish accepted your draw offer. Of course it did.");
      } else {
        setNotice(
          `${engineLabel(botEngineName).small} plays on, whatever happens.`
        );
      }
      return;
    }

    setOfferingDraw(true);
    const stillCurrent = () =>
      store.get(gameIdAtom) === gameId &&
      store.get(gameAtom) === game &&
      store.get(isGameInProgressAtom) &&
      store.get(enginePlayNameAtom) === botEngineName;
    try {
      const result = await engine.evaluatePositionWithUpdate({
        fen: game.fen(),
        depth: botDrawEvalDepth,
        multiPv: 2,
        useCloudEval: false,
      });
      if (!stillCurrent()) return;
      const playerScore = scoreFromLine(result.lines[0], game.turn());
      const botScore = -playerScore;

      if (botScore <= 30 && history.length >= 16) {
        setEnd({ type: "draw-agreed" });
        setIsInProgress(false);
        setNotice(
          `${engineLabel(botEngineName).small} accepted your draw offer.`
        );
      } else {
        setNotice(
          history.length < 16
            ? `${engineLabel(botEngineName).small} declined: it is too early for a draw.`
            : `${engineLabel(botEngineName).small} declined the draw offer.`
        );
      }
    } catch (error) {
      if (stillCurrent()) setNotice("The draw offer could not be evaluated.");
      console.error(error);
    } finally {
      setOfferingDraw(false);
    }
  };

  const toggleHints = () => {
    if (hintsOpen) setHintArrows([]);
    setHintsOpen(!hintsOpen);
  };

  const toggleCoach = () => {
    if (!coachActive && hintsOpen) toggleHints();
    setCoachActive(!coachActive);
  };

  useKeyboardShortcut("a", () =>
    overlay.engine.update({ enabled: !overlay.engine.prefs.enabled })
  );
  const arrowDigits = useMemo(
    () =>
      Array.from(
        { length: overlay.capabilities.maxMoves },
        (_, i) => `${i + 1}`
      ),
    [overlay.capabilities.maxMoves]
  );
  useKeyboardShortcut(
    arrowDigits,
    (event) =>
      overlay.engine.update({ enabled: true, moves: Number(event.key) }),
    overlay.capabilities.maxMoves > 0
  );
  useKeyboardShortcut(
    "x",
    () =>
      overlay.engine.update({
        enabled: true,
        threats: !overlay.engine.prefs.threats,
      }),
    overlay.capabilities.threats
  );

  useKeyboardShortcut("f", (event) => {
    event.preventDefault();
    flip();
  });
  useKeyboardShortcut("h", (event) => {
    if (!isCasual || !isInProgress || !isPlayerTurn || reviewing || inCascade)
      return;
    event.preventDefault();
    if (coachActive) void interactive.requestHint();
    else toggleHints();
  });
  useKeyboardShortcut("z", (event) => {
    if (undoDisabledReason || inCascade || reviewing || event.repeat) return;
    event.preventDefault();
    handleUndo();
  });
  useKeyboardShortcut(["ArrowLeft", "ArrowRight", "Home", "End"], (event) => {
    if (!livePly || inCascade) return;
    event.preventDefault();
    switch (event.key) {
      case "ArrowLeft":
        selectPly(shownPly - 1);
        break;
      case "ArrowRight":
        selectPly(shownPly + 1);
        break;
      case "Home":
        selectPly(0);
        break;
      case "End":
        selectPly(livePly);
        break;
    }
  });

  const handleCasualExit = () => {
    if (casualExit === "restart") {
      const error = restartGame();
      if (error) setNotice(error);
    } else {
      backToSetup();
    }
    setCasualExitOpen(false);
  };

  const outcome = info.over ? getOutcomeFor(info, playerColor) : "drawn";
  const optionsOpen = !!optionsAnchor;
  const moveAnnotations = useMemo(
    () =>
      coach.moves.length > 0
        ? coach.moves.map((entry) => ({
            classification: entry.after?.moveClassification,
            evaluation: entry.after?.lines[0],
            status:
              coach.error && !entry.after?.moveClassification
                ? ("error" as const)
                : undefined,
          }))
        : undefined,
    [coach.moves, coach.error]
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: pageFlow ? "auto" : "100%",
        flex: pageFlow ? undefined : 1,
        minHeight: 0,
        bgcolor: "background.paper",
      }}
    >
      {/* Zone 1 — Slim Context Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{
          px: 1.5,
          py: 0.9,
          minHeight: 46,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={0.65}
          minWidth={0}
          flexWrap="nowrap"
        >
          <Typography
            variant="subtitle2"
            fontWeight={700}
            noWrap
            sx={{ fontSize: "0.875rem" }}
          >
            vs {engineLabel(botEngineName).small}
          </Typography>

          {canChangeStrength ? (
            <Tooltip title="Change bot strength">
              <ButtonBase
                onClick={() => setStrengthOpen(true)}
                aria-label={`Bot strength ${strengthLabel}, click to change`}
                sx={{
                  px: 0.75,
                  height: 20,
                  borderRadius: 999,
                  bgcolor: "action.hover",
                  color: "text.secondary",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                  transition: "background-color 140ms ease, color 140ms ease",
                  "&:hover": {
                    bgcolor: "action.selected",
                    color: "text.primary",
                  },
                }}
              >
                {strengthLabel}
              </ButtonBase>
            </Tooltip>
          ) : (
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                px: 0.75,
                height: 20,
                borderRadius: 999,
                bgcolor: "action.hover",
                color: "text.secondary",
                fontSize: "0.7rem",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {strengthLabel}
            </Box>
          )}

          <Tooltip
            title={
              isCasual
                ? "Casual game: coach, hints, and takebacks available"
                : "Formal game: no hints, coach, or takebacks"
            }
          >
            <Box
              component="span"
              sx={(theme) => ({
                display: "inline-flex",
                alignItems: "center",
                gap: 0.35,
                px: 0.7,
                height: 20,
                borderRadius: 999,
                fontSize: "0.69rem",
                fontWeight: 600,
                flexShrink: 0,
                border: "1px solid",
                borderColor: isCasual
                  ? theme.palette.divider
                  : alpha(theme.palette.warning.main, 0.45),
                bgcolor: isCasual
                  ? "transparent"
                  : alpha(theme.palette.warning.main, 0.14),
                color: isCasual
                  ? theme.palette.text.secondary
                  : theme.palette.warning.main,
              })}
            >
              {!isCasual && <Icon icon="mdi:lock-outline" height={11} />}
              {isCasual ? "Casual" : "Formal"}
            </Box>
          </Tooltip>
        </Stack>

        <StatusBadge
          over={info.over}
          isPlayerTurn={isPlayerTurn}
          botThinking={botThinking}
          inCheck={game.inCheck()}
          inProgress={isInProgress}
        />
      </Stack>

      {/* Zone 2 — Game Result Card / Bot Error / Queued Start Position */}
      {!isInProgress && info.over && (
        <ResultCard
          reason={info.reason}
          outcome={outcome}
          result={info.result}
          opponent={engineLabel(botEngineName).small}
        />
      )}

      {isInProgress && botError && (
        <Box
          sx={{
            px: 1.25,
            py: 0.75,
            flexShrink: 0,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Alert
            severity="error"
            sx={{ py: 0.25 }}
            action={
              <Stack direction="row" gap={0.5} alignItems="center">
                {botError.includes("Fairy-Stockfish") && (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => {
                      setBotError(null);
                      setBotEngineName(EngineName.FairyStockfish14);
                    }}
                  >
                    Use Fairy-SF
                  </Button>
                )}
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    setBotError(null);
                    bumpBotRetry((v) => v + 1);
                  }}
                >
                  Retry
                </Button>
              </Stack>
            }
          >
            {botError}
          </Alert>
        </Box>
      )}

      {queuedSource && (
        <Box
          sx={{
            px: 1.25,
            py: 0.6,
            flexShrink: 0,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Alert
            severity="info"
            sx={{ py: 0.15, "& .MuiAlert-message": { fontSize: "0.78rem" } }}
            action={
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  setQueuedSource(null);
                  setStartingPosition("");
                }}
              >
                Clear
              </Button>
            }
          >
            Next game will inherit the board from {queuedSource}.
          </Alert>
        </Box>
      )}

      {/* Zone 3 — Live Coach Commentary Feed (directly below header, zero buttons above) */}
      <Box
        ref={coachSlotRef}
        sx={{ flexShrink: 0, "&:empty": { display: "none" } }}
      />

      {/* Zone 4 — Challenge / Hints Bands + Flexing Move Sheet */}
      {challenge && <ChallengeCard endgame={challenge} />}

      {isInProgress && isCasual && hintsOpen && (
        <Box
          sx={{
            flexShrink: 0,
            borderBottom: 1,
            borderColor: "divider",
            px: 1.5,
            py: 1,
            maxHeight: pageFlow ? undefined : 210,
            overflowY: pageFlow ? "visible" : "auto",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 0.75 }}
          >
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
            >
              TOP MOVES
            </Typography>
            <IconButton
              size="small"
              aria-label="Hide hints"
              onClick={toggleHints}
              sx={{ p: 0.25 }}
            >
              <Icon icon="mdi:close" height={16} />
            </IconButton>
          </Stack>
          <TopMovesPanel
            fen={fen}
            positionKey={positionKey}
            engine={hintEngine.engine}
            engineState={hintEngine}
            side={hintSide}
            depth={adviceDepth}
            count={adviceMultiPv}
            onSideChange={(side) => {
              setHintArrows([]);
              setHintSideChoice({ side, fen, positionKey });
            }}
            onArrows={publishHintArrows}
          />
        </Box>
      )}

      <Box
        data-inspector-scroller
        sx={{
          flex: pageFlow ? undefined : 1,
          minHeight: pageFlow ? 120 : 140,
          overflowY: pageFlow ? "visible" : "auto",
          overscrollBehavior: pageFlow ? "auto" : "contain",
          scrollbarGutter: pageFlow ? undefined : "stable",
          px: 1.25,
          py: 0.75,
        }}
      >
        <MovesList
          moves={history}
          startsWithBlack={startsWithBlack}
          firstMoveNumber={firstMoveNumber}
          currentPly={shownPly}
          onSelect={inCascade ? undefined : selectPly}
          maxHeight="none"
          emptyText={
            isInProgress
              ? "Play a move on the board to begin."
              : "No moves played."
          }
          annotations={moveAnnotations}
        />
      </Box>

      {/* Zone 5 — Docked Bottom Control Deck */}
      <Box
        sx={(theme) => ({
          flexShrink: 0,
          borderTop: 1,
          borderColor: "divider",
          bgcolor:
            theme.palette.mode === "dark"
              ? alpha(theme.palette.common.white, 0.025)
              : alpha(theme.palette.common.black, 0.018),
        })}
      >
        {/* Row A — Board Navigation & Transport */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={0.5}
          sx={{ px: 1, py: 0.5 }}
        >
          <Stack
            direction="row"
            alignItems="center"
            gap={0.15}
            data-board-shortcuts
          >
            <ToolbarButton
              tooltip="First position (Home)"
              icon="mdi:skip-previous"
              iconHeight={20}
              disabled={!shownPly || inCascade}
              onClick={() => selectPly(0)}
            />
            <ToolbarButton
              tooltip="Previous move (←)"
              icon="mdi:chevron-left"
              iconHeight={22}
              disabled={!shownPly || inCascade}
              onClick={() => selectPly(shownPly - 1)}
            />
            <ToolbarButton
              tooltip="Next move (→)"
              icon="mdi:chevron-right"
              iconHeight={22}
              disabled={!reviewing || inCascade}
              onClick={() => selectPly(shownPly + 1)}
            />
            <ToolbarButton
              tooltip={
                isInProgress ? "Live position (End)" : "Final position (End)"
              }
              icon="mdi:skip-next"
              iconHeight={20}
              active={reviewing ? true : undefined}
              disabled={!reviewing || inCascade}
              onClick={() => selectPly(livePly)}
            />
          </Stack>

          <Stack direction="row" alignItems="center" gap={0.5}>
            <ToolbarButton
              tooltip="Flip board (F)"
              icon="mdi:swap-vertical"
              iconHeight={20}
              onClick={flip}
            />
            {isInProgress && (
              <Tooltip
                title={undoDisabledReason || "Take back your last move (Z)"}
              >
                <span>
                  <Button
                    size="small"
                    variant="text"
                    disabled={!!undoDisabledReason || reviewing || inCascade}
                    onClick={handleUndo}
                    startIcon={<Icon icon="mdi:undo-variant" height={17} />}
                    sx={(theme) => ({
                      minHeight: 32,
                      px: 1.1,
                      borderRadius: 1,
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      textTransform: "none",
                      whiteSpace: "nowrap",
                      color: theme.palette.text.primary,
                      bgcolor: theme.palette.action.hover,
                      "&:hover": {
                        bgcolor: theme.palette.action.selected,
                      },
                      "&.Mui-disabled": {
                        bgcolor: alpha(
                          theme.palette.action.disabledBackground,
                          0.5
                        ),
                      },
                    })}
                  >
                    Take back
                  </Button>
                </span>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* Row B — Training Utilities & Match Controls (fixed single-row slots: never wraps or jumps height) */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={0.45}
          flexWrap="nowrap"
          sx={{
            px: 1,
            py: 0.65,
            minHeight: 43,
            borderTop: 1,
            borderColor: "divider",
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {/* Left — Training utilities & Options */}
          <Stack
            direction="row"
            alignItems="center"
            gap={0.45}
            flexWrap="nowrap"
            sx={{ flexShrink: 0 }}
          >
            {isInProgress && isCasual && (
              <Tooltip
                title={
                  coachActive
                    ? "Ask coach for a hint (H)"
                    : hintsOpen
                      ? "Hide top engine moves (H)"
                      : "Show top engine moves (H)"
                }
              >
                <span>
                  <Button
                    size="small"
                    variant="text"
                    aria-pressed={!coachActive && hintsOpen}
                    disabled={
                      coachActive
                        ? !interactive.canRequestHint
                        : reviewing || inCascade
                    }
                    onClick={() => {
                      if (coachActive) void interactive.requestHint();
                      else toggleHints();
                    }}
                    startIcon={
                      <Icon icon="mdi:lightbulb-on-outline" height={15} />
                    }
                    sx={(theme) => {
                      const active = !coachActive && hintsOpen;
                      return {
                        minHeight: 30,
                        minWidth: 0,
                        px: 0.75,
                        borderRadius: 1,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "none",
                        whiteSpace: "nowrap",
                        border: "1px solid",
                        borderColor: active
                          ? alpha(theme.palette.primary.main, 0.4)
                          : "transparent",
                        bgcolor: active
                          ? alpha(theme.palette.primary.main, 0.16)
                          : theme.palette.action.hover,
                        color: active
                          ? theme.palette.primary.main
                          : theme.palette.text.primary,
                        "&:hover": {
                          bgcolor: active
                            ? alpha(theme.palette.primary.main, 0.24)
                            : theme.palette.action.selected,
                        },
                      };
                    }}
                  >
                    Hint
                  </Button>
                </span>
              </Tooltip>
            )}

            {isInProgress && isCasual && (
              <Tooltip
                title={
                  coachActive
                    ? "Hide interactive coach (history is kept)"
                    : "Show interactive coach"
                }
              >
                <Button
                  size="small"
                  variant="text"
                  aria-pressed={coachActive}
                  onClick={toggleCoach}
                  startIcon={<Icon icon="mdi:school-outline" height={15} />}
                  sx={(theme) => ({
                    minHeight: 30,
                    minWidth: 0,
                    px: 0.75,
                    borderRadius: 1,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    border: "1px solid",
                    borderColor: coachActive
                      ? alpha(theme.palette.primary.main, 0.4)
                      : "transparent",
                    bgcolor: coachActive
                      ? alpha(theme.palette.primary.main, 0.16)
                      : theme.palette.action.hover,
                    color: coachActive
                      ? theme.palette.primary.main
                      : theme.palette.text.secondary,
                    "&:hover": {
                      bgcolor: coachActive
                        ? alpha(theme.palette.primary.main, 0.24)
                        : theme.palette.action.selected,
                      color: coachActive
                        ? theme.palette.primary.main
                        : theme.palette.text.primary,
                    },
                  })}
                >
                  Coach
                </Button>
              </Tooltip>
            )}

            <Tooltip title="Game options & overlays">
              <Button
                size="small"
                variant="text"
                aria-haspopup="true"
                aria-expanded={optionsOpen}
                onClick={(event) => setOptionsAnchor(event.currentTarget)}
                startIcon={<Icon icon="mdi:tune-variant" height={15} />}
                sx={(theme) => ({
                  minHeight: 30,
                  minWidth: 0,
                  px: 0.75,
                  borderRadius: 1,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "none",
                  whiteSpace: "nowrap",
                  color: theme.palette.text.primary,
                  bgcolor: optionsOpen
                    ? theme.palette.action.selected
                    : theme.palette.action.hover,
                  "&:hover": {
                    bgcolor: theme.palette.action.selected,
                  },
                })}
              >
                Options
              </Button>
            </Tooltip>
          </Stack>

          {/* Right — Match-ending diplomacy & resignation (separated from safe utilities) */}
          {isInProgress && (
            <Stack
              direction="row"
              alignItems="center"
              gap={0.25}
              flexWrap="nowrap"
              sx={{ ml: "auto", flexShrink: 0 }}
            >
              <Tooltip
                title={
                  isPlayerTurn
                    ? "Offer a draw to the bot"
                    : "Wait for your turn to offer a draw"
                }
              >
                <span>
                  <Button
                    size="small"
                    variant="text"
                    disabled={
                      !isPlayerTurn ||
                      !botEngine.engine ||
                      offeringDraw ||
                      reviewing ||
                      inCascade
                    }
                    onClick={handleOfferDraw}
                    startIcon={
                      <Icon icon="mdi:handshake-outline" height={15} />
                    }
                    sx={{
                      minHeight: 30,
                      minWidth: 0,
                      px: 0.65,
                      borderRadius: 1,
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      textTransform: "none",
                      whiteSpace: "nowrap",
                      color: "text.secondary",
                      "&:hover": {
                        color: "text.primary",
                        bgcolor: "action.hover",
                      },
                    }}
                  >
                    Draw
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title="Resign this game">
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setConfirmResign(true)}
                  startIcon={<Icon icon="mdi:flag-outline" height={15} />}
                  sx={(theme) => ({
                    minHeight: 30,
                    minWidth: 0,
                    px: 0.65,
                    borderRadius: 1,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    textTransform: "none",
                    whiteSpace: "nowrap",
                    color: theme.palette.text.secondary,
                    "&:hover": {
                      color: theme.palette.error.main,
                      bgcolor: alpha(theme.palette.error.main, 0.12),
                    },
                  })}
                >
                  Resign
                </Button>
              </Tooltip>
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Options & Overlays Popover (inline Board Overlays — no nested popover, no duplicate switches) */}
      <InspectorPopover
        title="Game options"
        open={optionsOpen}
        anchorEl={optionsAnchor}
        onClose={() => {
          setOptionsAnchor(null);
          overlay.engine.setFocus(null);
        }}
        width={316}
      >
        <Stack spacing={1.25}>
          {isInProgress && isCasual && (
            <>
              <Stack spacing={0.25}>
                <PopoverSectionLabel>Assistance</PopoverSectionLabel>
                <PopoverSwitchRow
                  label="Interactive coach"
                  checked={coachActive}
                  onChange={toggleCoach}
                />
                <PopoverSwitchRow
                  label="Evaluation bar"
                  checked={evalBar}
                  onChange={setEvalBar}
                />
                {coachActive && (
                  <PopoverSwitchRow
                    label="Engine arrows with coach"
                    help="Show suggestion and threat arrows while coach is on"
                    checked={arrowsWithCoach}
                    onChange={setArrowsWithCoach}
                  />
                )}
              </Stack>

              {canChangeStrength && (
                <ButtonBase
                  onClick={() => {
                    setOptionsAnchor(null);
                    setStrengthOpen(true);
                  }}
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1,
                    py: 0.75,
                    borderRadius: 1,
                    bgcolor: "action.hover",
                    "&:hover": { bgcolor: "action.selected" },
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={0.85}>
                    <Icon icon="mdi:speedometer" height={17} />
                    <Typography variant="body2" fontWeight={500}>
                      Bot strength
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" gap={0.35}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={600}
                      sx={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {strengthLabel}
                    </Typography>
                    <Icon icon="mdi:chevron-right" height={17} />
                  </Stack>
                </ButtonBase>
              )}

              <Divider />
            </>
          )}

          <Stack spacing={0.75}>
            <PopoverSectionLabel>Board overlays</PopoverSectionLabel>
            <ArrowOverlayControls
              prefs={overlay.engine.prefs}
              capabilities={overlay.capabilities}
              onChange={overlay.engine.update}
              arrows={overlay.engine.arrows}
              nameOf={overlay.nameOf}
              turn={overlay.turn}
              onFocus={overlay.engine.setFocus}
            />
          </Stack>

          {isInProgress && isCasual && (
            <>
              <Divider />
              <Stack spacing={0.25}>
                <Button
                  size="small"
                  variant="text"
                  fullWidth
                  startIcon={<Icon icon="mdi:restart" height={17} />}
                  onClick={() => confirmCasualExit("restart")}
                  sx={{
                    justifyContent: "flex-start",
                    px: 1,
                    minHeight: 34,
                    borderRadius: 1,
                    color: "text.secondary",
                    textTransform: "none",
                    "&:hover": {
                      color: "text.primary",
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  Restart game
                </Button>
                <Button
                  size="small"
                  variant="text"
                  fullWidth
                  startIcon={<Icon icon="mdi:exit-to-app" height={17} />}
                  onClick={() => confirmCasualExit("discard")}
                  sx={(theme) => ({
                    justifyContent: "flex-start",
                    px: 1,
                    minHeight: 34,
                    borderRadius: 1,
                    color: theme.palette.text.secondary,
                    textTransform: "none",
                    "&:hover": {
                      color: theme.palette.error.main,
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                    },
                  })}
                >
                  End practice
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </InspectorPopover>

      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice("")}
        message={notice}
      />

      <Dialog
        open={strengthOpen}
        onClose={() => setStrengthOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Bot strength</DialogTitle>
        <DialogContent dividers>
          <StrengthControl
            value={savedStrength}
            onChange={setSavedStrength}
            engineName={botEngineName}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setStrengthOpen(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={casualExitOpen}
        onClose={() => setCasualExitOpen(false)}
        aria-labelledby="play-exit-title"
      >
        <DialogTitle id="play-exit-title">
          {casualExit === "restart"
            ? "Restart this game?"
            : "End this practice game?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your current moves will be discarded. This practice game won’t count
            as a loss.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setCasualExitOpen(false)}>
            Keep playing
          </Button>
          <Button variant="contained" onClick={handleCasualExit}>
            {casualExit === "restart" ? "Restart game" : "End practice"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmResign} onClose={() => setConfirmResign(false)}>
        <DialogTitle>Resign this game?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The game will end and count as a loss.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmResign(false)}>Keep playing</Button>
          <Button color="error" variant="contained" onClick={handleResign}>
            Resign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function StatusBadge({
  over,
  isPlayerTurn,
  botThinking,
  inCheck,
  inProgress,
}: {
  over: boolean;
  isPlayerTurn: boolean;
  botThinking: boolean;
  inCheck: boolean;
  inProgress: boolean;
}) {
  if (!inProgress || over) return null;

  if (isPlayerTurn && inCheck) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        gap={0.5}
        sx={(theme) => ({
          px: 0.85,
          height: 22,
          borderRadius: 999,
          flexShrink: 0,
          bgcolor: alpha(theme.palette.error.main, 0.16),
          color: theme.palette.error.main,
        })}
      >
        <Icon icon="mdi:alert-circle-outline" height={14} />
        <Typography
          variant="caption"
          fontWeight={700}
          noWrap
          sx={{ fontSize: "0.71rem" }}
        >
          In check
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="flex-end"
      gap={0.6}
      sx={{ flexShrink: 0, minWidth: 82 }}
    >
      {isPlayerTurn ? (
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "success.main",
            flexShrink: 0,
          }}
        />
      ) : (
        <CircularProgress size={12} thickness={5} />
      )}
      <Typography
        variant="caption"
        noWrap
        sx={{
          fontSize: "0.75rem",
          fontWeight: isPlayerTurn ? 600 : 500,
          color: isPlayerTurn ? "text.primary" : "text.secondary",
        }}
      >
        {isPlayerTurn ? "Your move" : botThinking ? "Thinking…" : "Waiting…"}
      </Typography>
    </Stack>
  );
}

function ResultCard({
  reason,
  outcome,
  result,
  opponent,
}: {
  reason: string;
  outcome: "won" | "drawn" | "lost";
  result: string;
  opponent: string;
}) {
  const router = useRouter();
  const game = useAtomValue(gameAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const savedGameId = useAtomValue(savedGameIdAtom);
  const challengeId = useAtomValue(challengeIdAtom);
  const { startGame, startChallenge, backToSetup } = useStartGame();
  const [copied, setCopied] = useState("");

  const headline =
    outcome === "won"
      ? "You won!"
      : outcome === "lost"
        ? `${opponent} won`
        : "Draw";
  const icon =
    outcome === "won"
      ? "mdi:trophy-outline"
      : outcome === "lost"
        ? "mdi:flag-variant-outline"
        : "mdi:handshake-outline";

  const copy = async (label: string, text: string) => {
    if (!(await copyToClipboard(text))) return;
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  };

  return (
    <Box
      sx={(theme) => {
        const tone =
          outcome === "won"
            ? theme.palette.success.main
            : outcome === "lost"
              ? theme.palette.error.main
              : theme.palette.text.secondary;
        return {
          px: 1.5,
          py: 1.25,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: alpha(tone, theme.palette.mode === "dark" ? 0.1 : 0.07),
        };
      }}
    >
      <Stack spacing={1.15}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
            <Box
              sx={(theme) => ({
                width: 34,
                height: 34,
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                bgcolor: alpha(
                  outcome === "won"
                    ? theme.palette.success.main
                    : outcome === "lost"
                      ? theme.palette.error.main
                      : theme.palette.text.primary,
                  0.14
                ),
                color:
                  outcome === "won"
                    ? "success.main"
                    : outcome === "lost"
                      ? "error.main"
                      : "text.primary",
              })}
            >
              <Icon icon={icon} height={21} />
            </Box>
            <Box minWidth={0}>
              <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                {headline}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {reason} · {result}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" gap={0.25} flexShrink={0}>
            <Button
              size="small"
              color="inherit"
              startIcon={
                <Icon
                  icon={copied === "PGN" ? "mdi:check" : "mdi:content-copy"}
                  height={14}
                />
              }
              onClick={() => copy("PGN", game.pgn())}
              sx={{
                minWidth: 0,
                px: 0.75,
                minHeight: 26,
                fontSize: "0.72rem",
                color: "text.secondary",
                borderRadius: 1,
                textTransform: "none",
              }}
            >
              {copied === "PGN" ? "Copied" : "PGN"}
            </Button>
            <Button
              size="small"
              color="inherit"
              startIcon={
                <Icon
                  icon={copied === "FEN" ? "mdi:check" : "mdi:content-copy"}
                  height={14}
                />
              }
              onClick={() => copy("FEN", game.fen())}
              sx={{
                minWidth: 0,
                px: 0.75,
                minHeight: 26,
                fontSize: "0.72rem",
                color: "text.secondary",
                borderRadius: 1,
                textTransform: "none",
              }}
            >
              {copied === "FEN" ? "Copied" : "FEN"}
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          <Button
            size="small"
            variant="contained"
            startIcon={<Icon icon="mdi:chart-line" height={16} />}
            disabled={savedGameId === null}
            onClick={() =>
              router.push({
                pathname: "/analysis",
                query: { gameId: savedGameId },
              })
            }
            sx={{ borderRadius: 1 }}
          >
            Analyze game
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Icon icon="mdi:sync" height={16} />}
            onClick={() =>
              challengeId
                ? startChallenge(challengeId)
                : startGame({ playerColor: opposite(playerColor) })
            }
            sx={{ borderRadius: 1 }}
          >
            {challengeId ? "Try again" : "Rematch"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Icon icon="mdi:plus" height={16} />}
            onClick={backToSetup}
            sx={{ borderRadius: 1 }}
          >
            New game
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

/**
 * Vertical workspace slots for active Play games: keeps bot/strength/status above
 * the board, attaches CoachStage / ResultCard / horizontal Move Ticker directly
 * below the board, anchors < > / Take back / Hint / Options in the 52px sticky
 * thumb bar, and places full move history & challenge tips below the fold.
 */
export function usePlayVerticalSlots({
  botEngine,
  overlay,
  coach,
  interactive,
  coachSlotRef,
}: Props): VerticalWorkspaceSlots {
  const store = useStore();
  const router = useRouter();
  const gameId = useAtomValue(gameIdAtom);
  const inCascade = useAtomValue(playCascadeActiveAtom);
  const [reviewPly, setReviewPly] = useAtom(reviewPlyAtom);
  const [evalBar, setEvalBar] = useAtom(playEvalBarAtom);
  const [arrowsWithCoach, setArrowsWithCoach] = useAtom(
    playArrowsWithCoachAtom
  );
  const { backToSetup, restartGame, startGame, startChallenge } =
    useStartGame();
  const [casualExit, setCasualExit] = useState<"restart" | "discard">(
    "restart"
  );
  const [casualExitOpen, setCasualExitOpen] = useState(false);
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const [offeringDraw, setOfferingDraw] = useState(false);
  const [strengthOpen, setStrengthOpen] = useState(false);
  const game = useAtomValue(gameAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const savedGameId = useAtomValue(savedGameIdAtom);
  const [isInProgress, setIsInProgress] = useAtom(isGameInProgressAtom);
  const activeMode = useAtomValue(activeGameModeAtom);
  const [coachActive, setCoachActive] = useAtom(activeCoachAtom);
  const [end, setEnd] = useAtom(gameEndAtom);
  const botThinking = useAtomValue(botThinkingAtom);
  const [botError, setBotError] = useAtom(botErrorAtom);
  const bumpBotRetry = useSetAtom(botRetryTickAtom);
  const [queuedSource, setQueuedSource] = useAtom(queuedStartSourceAtom);
  const setStartingPosition = useSetAtom(startingPositionAtom);
  const botEngineName = useAtomValue(enginePlayNameAtom);
  const [savedStrength, setSavedStrength] = useAtom(botStrengthAtom);
  const challengeId = useAtomValue(challengeIdAtom);
  const challenge = challengeId ? getEndgame(challengeId) : undefined;
  const strength = challenge ? CHALLENGE_STRENGTH : savedStrength;
  const shownStrength = effectiveStrength(botEngineName, strength);
  const setFlipped = useSetAtom(boardFlippedAtom);
  const setHintArrows = useSetAtom(hintArrowsAtom);
  const positionKey = useAtomValue(hintPositionKeyAtom);
  const publishHintArrows = useCallback(
    (arrows: BoardArrow[]) => setHintArrows({ positionKey, arrows }),
    [setHintArrows, positionKey]
  );
  const analysisEngineName = useFeatureEngineName("advice");
  const { depth: adviceDepth, multiPv: adviceMultiPv } = useEffectiveAdvice();
  const { depth: botDrawEvalDepth } = useEffectiveBotDrawEvalDepth();
  const { goToMove, undoMove } = useChessActions(gameAtom);

  const [hintsOpen, setHintsOpen] = useState(false);
  const fen = game.fen();
  const [hintSideChoice, setHintSideChoice] = useState<MoveSideChoice>({
    side: "mover",
    fen,
    positionKey,
  });
  const currentHintChoice = resetMoveSideChoice(
    hintSideChoice,
    fen,
    positionKey
  );
  const hintSide = effectiveMoveSide(currentHintChoice, fen, positionKey);
  if (currentHintChoice !== hintSideChoice) {
    setHintSideChoice(currentHintChoice);
  }
  const [confirmResign, setConfirmResign] = useState(false);
  const [notice, setNotice] = useState("");

  const hintEngine = useEngineState(
    hintsOpen && activeMode === "casual" ? analysisEngineName : undefined,
    engineFeatureLabel("advice")
  );

  const isCasual = activeMode === "casual";
  const history = game.history();
  const livePly = history.length;
  const reviewing = reviewPly !== null && reviewPly < livePly;
  const shownPly = reviewing ? reviewPly : livePly;
  const selectPly = (ply: number) => {
    const next = Math.max(0, Math.min(livePly, ply));
    setReviewPly(next < livePly ? next : null);
  };
  const flip = () => setFlipped((value) => !value);
  const info = useMemo(() => getGameResult(game, end), [game, end]);
  const isPlayerTurn = game.turn() === playerColor;
  const firstMove = game.history({ verbose: true })[0];
  const startsWithBlack = firstMove?.color === "b";
  const firstMoveNumber = Number(firstMove?.before.split(" ")[5]) || 1;

  const strengthLabel =
    shownStrength?.mode === "elo"
      ? `${shownStrength.elo}`
      : shownStrength?.mode === "depth"
        ? `depth ${shownStrength.depth}`
        : shownStrength?.mode === "max"
          ? "Full"
          : "Joke";

  const canChangeStrength =
    isInProgress && isCasual && !challenge && !!shownStrength;

  const undoDisabledReason = !isCasual
    ? "Takebacks are not allowed in formal games"
    : !isInProgress
      ? "The game is over"
      : history.length < (isPlayerTurn ? 2 : 1)
        ? "Nothing to take back yet"
        : "";

  const handleUndo = () => {
    if (undoDisabledReason || inCascade || reviewing) return;
    setReviewPly(null);
    if (isPlayerTurn) goToMove(history.length - 2, game);
    else undoMove();
  };

  const handleResign = () => {
    setConfirmResign(false);
    setEnd({ type: "resign", loser: playerColor });
    setIsInProgress(false);
  };

  const handleOfferDraw = async () => {
    setOptionsAnchor(null);
    const engine = botEngine.engine;
    if (!engine || !isPlayerTurn || offeringDraw || reviewing || inCascade)
      return;

    if (getEngineModel(botEngineName).playsOwnMoves) {
      if (botEngineName === EngineName.Drawfish) {
        setEnd({ type: "draw-agreed" });
        setIsInProgress(false);
        setNotice("Drawfish accepted your draw offer. Of course it did.");
      } else {
        setNotice(
          `${engineLabel(botEngineName).small} plays on, whatever happens.`
        );
      }
      return;
    }

    setOfferingDraw(true);
    const stillCurrent = () =>
      store.get(gameIdAtom) === gameId &&
      store.get(gameAtom) === game &&
      store.get(isGameInProgressAtom) &&
      store.get(enginePlayNameAtom) === botEngineName;
    try {
      const result = await engine.evaluatePositionWithUpdate({
        fen: game.fen(),
        depth: botDrawEvalDepth,
        multiPv: 2,
        useCloudEval: false,
      });
      if (!stillCurrent()) return;
      const playerScore = scoreFromLine(result.lines[0], game.turn());
      const botScore = -playerScore;
      if (botScore <= 30 && history.length >= 16) {
        setEnd({ type: "draw-agreed" });
        setIsInProgress(false);
        setNotice(
          `${engineLabel(botEngineName).small} accepted your draw offer.`
        );
      } else {
        setNotice(
          history.length < 16
            ? `${engineLabel(botEngineName).small} declined: too early for a draw.`
            : `${engineLabel(botEngineName).small} declined the draw offer.`
        );
      }
    } catch (error) {
      if (stillCurrent()) setNotice("The draw offer could not be evaluated.");
      console.error(error);
    } finally {
      setOfferingDraw(false);
    }
  };

  const toggleHints = () => {
    if (hintsOpen) setHintArrows([]);
    setHintsOpen(!hintsOpen);
  };

  const toggleCoach = () => {
    if (!coachActive && hintsOpen) toggleHints();
    setCoachActive(!coachActive);
  };

  const confirmCasualExit = (action: "restart" | "discard") => {
    setOptionsAnchor(null);
    setCasualExit(action);
    setCasualExitOpen(true);
  };

  const handleCasualExit = () => {
    if (casualExit === "restart") {
      const error = restartGame();
      if (error) setNotice(error);
    } else {
      backToSetup();
    }
    setCasualExitOpen(false);
  };

  const outcome = info.over ? getOutcomeFor(info, playerColor) : "drawn";
  const moveAnnotations = useMemo(
    () =>
      coach.moves.length > 0
        ? coach.moves.map((entry) => ({
            classification: entry.after?.moveClassification,
            evaluation: entry.after?.lines[0],
            status:
              coach.error && !entry.after?.moveClassification
                ? ("error" as const)
                : undefined,
          }))
        : undefined,
    [coach.moves, coach.error]
  );

  return {
    reserveHeight: overlay.coachEnabled ? 220 : 176,
    contextBar: (
      <VerticalContextStrip
        left={
          <>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              vs {engineLabel(botEngineName).small}
            </Typography>
            <InspectorPill
              label={strengthLabel}
              onClick={
                canChangeStrength ? () => setStrengthOpen(true) : undefined
              }
              tooltip={canChangeStrength ? "Change bot strength" : undefined}
            />
            <InspectorPill
              tone={isCasual ? "neutral" : "warning"}
              icon={!isCasual ? "mdi:lock-outline" : undefined}
              label={isCasual ? "Casual" : "Formal"}
            />
          </>
        }
        right={
          <StatusBadge
            over={info.over}
            isPlayerTurn={isPlayerTurn}
            botThinking={botThinking}
            inCheck={game.inCheck()}
            inProgress={isInProgress}
          />
        }
      />
    ),
    liveStrip: (
      <Stack spacing={0.75} sx={{ flexShrink: 0 }}>
        {!isInProgress && info.over && (
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 1.25,
              overflow: "hidden",
            }}
          >
            <ResultCard
              reason={info.reason}
              outcome={outcome}
              result={info.result}
              opponent={engineLabel(botEngineName).small}
            />
          </Box>
        )}

        {isInProgress && botError && (
          <Alert
            severity="error"
            sx={{ py: 0.25 }}
            action={
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  setBotError(null);
                  bumpBotRetry((v) => v + 1);
                }}
              >
                Retry
              </Button>
            }
          >
            {botError}
          </Alert>
        )}

        {/* Live Coach Stage mounts directly under the board when enabled */}
        <Box
          ref={coachSlotRef}
          sx={{ flexShrink: 0, "&:empty": { display: "none" } }}
        />

        {/* Compact horizontal move ticker when coach is off and game is active */}
        {isInProgress && !overlay.coachEnabled && (
          <VerticalLiveStrip minHeight={38} sx={{ px: 1, py: 0.55 }}>
            {history.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                Play a move on the board to begin.
              </Typography>
            ) : (
              <Stack
                direction="row"
                alignItems="center"
                gap={0.5}
                sx={{
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              >
                {history.map((san, idx) => {
                  const ply = idx + 1;
                  const active = shownPly === ply;
                  const isWhite = (idx + (startsWithBlack ? 1 : 0)) % 2 === 0;
                  const moveNum =
                    firstMoveNumber +
                    Math.floor((idx + (startsWithBlack ? 1 : 0)) / 2);
                  return (
                    <ButtonBase
                      key={ply}
                      onClick={() => !inCascade && selectPly(ply)}
                      sx={(theme) => ({
                        px: 0.7,
                        py: 0.25,
                        borderRadius: 0.75,
                        flexShrink: 0,
                        fontSize: "0.78rem",
                        fontWeight: active ? 700 : 500,
                        fontVariantNumeric: "tabular-nums",
                        bgcolor: active
                          ? alpha(theme.palette.primary.main, 0.2)
                          : "transparent",
                        color: active ? "primary.main" : "text.primary",
                      })}
                    >
                      {(isWhite || idx === 0) && (
                        <Box
                          component="span"
                          sx={{ color: "text.secondary", mr: 0.35 }}
                        >
                          {moveNum}
                          {isWhite ? "." : "…"}
                        </Box>
                      )}
                      {san}
                    </ButtonBase>
                  );
                })}
              </Stack>
            )}
          </VerticalLiveStrip>
        )}
      </Stack>
    ),
    actionBar: (
      <>
        <WorkspaceActionBar
          left={
            isInProgress ? (
              <>
                <ToolbarButton
                  tooltip="Previous move"
                  icon="mdi:chevron-left"
                  iconHeight={22}
                  disabled={!shownPly || inCascade}
                  onClick={() => selectPly(shownPly - 1)}
                />
                <ToolbarButton
                  tooltip="Next move"
                  icon="mdi:chevron-right"
                  iconHeight={22}
                  disabled={!reviewing || inCascade}
                  onClick={() => selectPly(shownPly + 1)}
                />
                {isCasual ? (
                  <>
                    <DeckButton
                      icon="mdi:undo-variant"
                      disabled={!!undoDisabledReason || reviewing || inCascade}
                      onClick={handleUndo}
                    >
                      Undo
                    </DeckButton>
                    <DeckButton
                      active={!coachActive && hintsOpen}
                      icon="mdi:lightbulb-on-outline"
                      disabled={
                        coachActive
                          ? !interactive.canRequestHint
                          : reviewing || inCascade
                      }
                      onClick={() => {
                        if (coachActive) void interactive.requestHint();
                        else toggleHints();
                      }}
                    >
                      Hint
                    </DeckButton>
                  </>
                ) : (
                  <ToolbarButton
                    tooltip="Flip board"
                    icon="mdi:swap-vertical"
                    iconHeight={20}
                    onClick={flip}
                  />
                )}
              </>
            ) : (
              <>
                <ToolbarButton
                  tooltip="First position"
                  icon="mdi:skip-previous"
                  iconHeight={20}
                  disabled={!shownPly || inCascade}
                  onClick={() => selectPly(0)}
                />
                <ToolbarButton
                  tooltip="Previous move"
                  icon="mdi:chevron-left"
                  iconHeight={22}
                  disabled={!shownPly || inCascade}
                  onClick={() => selectPly(shownPly - 1)}
                />
                <ToolbarButton
                  tooltip="Next move"
                  icon="mdi:chevron-right"
                  iconHeight={22}
                  disabled={!reviewing || inCascade}
                  onClick={() => selectPly(shownPly + 1)}
                />
                <ToolbarButton
                  tooltip="Final position"
                  icon="mdi:skip-next"
                  iconHeight={20}
                  active={reviewing ? true : undefined}
                  disabled={!reviewing || inCascade}
                  onClick={() => selectPly(livePly)}
                />
              </>
            )
          }
          right={
            isInProgress ? (
              <>
                {!isCasual && (
                  <>
                    <DeckButton
                      subtle
                      icon="mdi:handshake-outline"
                      disabled={
                        !isPlayerTurn ||
                        !botEngine.engine ||
                        offeringDraw ||
                        reviewing ||
                        inCascade
                      }
                      onClick={() => void handleOfferDraw()}
                    >
                      Draw
                    </DeckButton>
                    <DeckButton
                      subtle
                      danger
                      icon="mdi:flag-outline"
                      onClick={() => setConfirmResign(true)}
                    >
                      Resign
                    </DeckButton>
                  </>
                )}
                <DeckButton
                  active={!!optionsAnchor}
                  icon="mdi:tune-variant"
                  onClick={(event) => setOptionsAnchor(event.currentTarget)}
                >
                  Options
                </DeckButton>
              </>
            ) : (
              <>
                <DeckButton
                  active
                  icon="mdi:chart-line"
                  disabled={savedGameId === null}
                  onClick={() =>
                    void router.push({
                      pathname: "/analysis",
                      query: { gameId: savedGameId },
                    })
                  }
                >
                  Analyze
                </DeckButton>
                <ToolbarButton
                  tooltip={challengeId ? "Try again" : "Rematch"}
                  icon="mdi:sync"
                  iconHeight={20}
                  onClick={() =>
                    challengeId
                      ? startChallenge(challengeId)
                      : startGame({ playerColor: opposite(playerColor) })
                  }
                />
              </>
            )
          }
        />

        <InspectorPopover
          title="Game options"
          open={!!optionsAnchor}
          anchorEl={optionsAnchor}
          onClose={() => {
            setOptionsAnchor(null);
            overlay.engine.setFocus(null);
          }}
          width={316}
        >
          <Stack spacing={1.25}>
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="mdi:swap-vertical" height={16} />}
                onClick={() => {
                  flip();
                  setOptionsAnchor(null);
                }}
              >
                Flip board
              </Button>
              {isInProgress && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      <Icon icon="mdi:handshake-outline" height={16} />
                    }
                    disabled={
                      !isPlayerTurn ||
                      !botEngine.engine ||
                      offeringDraw ||
                      reviewing ||
                      inCascade
                    }
                    onClick={() => void handleOfferDraw()}
                  >
                    Offer draw
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<Icon icon="mdi:flag-outline" height={16} />}
                    onClick={() => {
                      setOptionsAnchor(null);
                      setConfirmResign(true);
                    }}
                  >
                    Resign
                  </Button>
                </>
              )}
            </Stack>

            {isInProgress && isCasual && (
              <>
                <Divider />
                <Stack spacing={0.25}>
                  <PopoverSectionLabel>Assistance</PopoverSectionLabel>
                  <PopoverSwitchRow
                    label="Interactive coach"
                    checked={coachActive}
                    onChange={toggleCoach}
                  />
                  <PopoverSwitchRow
                    label="Evaluation bar"
                    checked={evalBar}
                    onChange={setEvalBar}
                  />
                  {coachActive && (
                    <PopoverSwitchRow
                      label="Engine arrows with coach"
                      checked={arrowsWithCoach}
                      onChange={setArrowsWithCoach}
                    />
                  )}
                </Stack>
                {canChangeStrength && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Icon icon="mdi:speedometer" height={16} />}
                    onClick={() => {
                      setOptionsAnchor(null);
                      setStrengthOpen(true);
                    }}
                  >
                    Bot strength ({strengthLabel})
                  </Button>
                )}
              </>
            )}

            <Divider />
            <Stack spacing={0.75}>
              <PopoverSectionLabel>Board overlays</PopoverSectionLabel>
              <ArrowOverlayControls
                prefs={overlay.engine.prefs}
                capabilities={overlay.capabilities}
                onChange={overlay.engine.update}
                arrows={overlay.engine.arrows}
                nameOf={overlay.nameOf}
                turn={overlay.turn}
                onFocus={overlay.engine.setFocus}
              />
            </Stack>

            {isInProgress && isCasual && (
              <>
                <Divider />
                <Stack direction="row" gap={0.75}>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    startIcon={<Icon icon="mdi:restart" height={16} />}
                    onClick={() => confirmCasualExit("restart")}
                  >
                    Restart
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={<Icon icon="mdi:exit-to-app" height={16} />}
                    onClick={() => confirmCasualExit("discard")}
                  >
                    End practice
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </InspectorPopover>

        <Snackbar
          open={!!notice}
          autoHideDuration={4000}
          onClose={() => setNotice("")}
          message={notice}
        />

        <Dialog
          open={strengthOpen}
          onClose={() => setStrengthOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Bot strength</DialogTitle>
          <DialogContent dividers>
            <StrengthControl
              value={savedStrength}
              onChange={setSavedStrength}
              engineName={botEngineName}
            />
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={() => setStrengthOpen(false)}>
              Done
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={casualExitOpen} onClose={() => setCasualExitOpen(false)}>
          <DialogTitle>
            {casualExit === "restart"
              ? "Restart this game?"
              : "End this practice game?"}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              Your current moves will be discarded. This practice game won’t
              count as a loss.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCasualExitOpen(false)}>
              Keep playing
            </Button>
            <Button variant="contained" onClick={handleCasualExit}>
              {casualExit === "restart" ? "Restart game" : "End practice"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={confirmResign} onClose={() => setConfirmResign(false)}>
          <DialogTitle>Resign this game?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              The game will end and count as a loss.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmResign(false)}>
              Keep playing
            </Button>
            <Button color="error" variant="contained" onClick={handleResign}>
              Resign
            </Button>
          </DialogActions>
        </Dialog>
      </>
    ),
    sheet: (
      <Stack spacing={0}>
        {queuedSource && (
          <Box sx={{ p: 1.25, borderBottom: 1, borderColor: "divider" }}>
            <Alert
              severity="info"
              sx={{ py: 0.15 }}
              action={
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    setQueuedSource(null);
                    setStartingPosition("");
                  }}
                >
                  Clear
                </Button>
              }
            >
              Next game will inherit the board from {queuedSource}.
            </Alert>
          </Box>
        )}

        {challenge && <ChallengeCard endgame={challenge} />}

        {isInProgress && isCasual && hintsOpen && (
          <Box sx={{ p: 1.25, borderBottom: 1, borderColor: "divider" }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 0.75 }}
            >
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
              >
                TOP MOVES
              </Typography>
              <IconButton
                size="small"
                aria-label="Hide hints"
                onClick={toggleHints}
                sx={{ p: 0.25 }}
              >
                <Icon icon="mdi:close" height={16} />
              </IconButton>
            </Stack>
            <TopMovesPanel
              fen={fen}
              positionKey={positionKey}
              engine={hintEngine.engine}
              engineState={hintEngine}
              side={hintSide}
              depth={adviceDepth}
              count={adviceMultiPv}
              onSideChange={(side) => {
                setHintArrows([]);
                setHintSideChoice({ side, fen, positionKey });
              }}
              onArrows={publishHintArrows}
            />
          </Box>
        )}

        <Box sx={{ px: 1.25, py: 0.75 }}>
          <MovesList
            moves={history}
            startsWithBlack={startsWithBlack}
            firstMoveNumber={firstMoveNumber}
            currentPly={shownPly}
            onSelect={inCascade ? undefined : selectPly}
            maxHeight="none"
            emptyText={
              isInProgress
                ? "Play a move on the board to begin."
                : "No moves played."
            }
            annotations={moveAnnotations}
          />
        </Box>
      </Stack>
    ),
  };
}
