import MovesList from "@/components/movesList";
import Panel from "@/components/panel";
import TopMovesPanel from "@/components/topMovesPanel";
import { engineLabel } from "@/constants";
import { getEngineModel } from "@/lib/engine/models";
import { effectiveStrength } from "@/lib/engine/botMove";
import { EngineName } from "@/types/enums";
import {
  useEffectiveAdvice,
  useEffectiveBotDrawEvalDepth,
} from "@/hooks/useEffectiveEngineSettings";
import { EngineState, useEngineState } from "@/hooks/useEngine";
import { engineFeatureLabel } from "@/lib/engine/featureEngines";
import { useChessActions } from "@/hooks/useChessActions";
import { getEndgame } from "@/lib/endgames";
import { CHALLENGE_STRENGTH, scoreFromLine } from "@/lib/engine/strength";
import {
  effectiveMoveSide,
  MoveSideChoice,
  resetMoveSideChoice,
} from "@/lib/engine/topMoves";
import { getGameResult, getOutcomeFor } from "@/lib/gameResult";
import { useFeatureEngineName } from "@/hooks/useFeatureEngineName";
import { copyToClipboard } from "@/lib/clipboard";
import { Icon } from "@iconify/react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { ToolbarButton } from "@/components/ToolbarButton";
import StrengthControl from "@/components/strengthControl";
import { useRouter } from "next/router";
import { useCallback, useMemo, useState } from "react";
import { BoardArrow } from "@/lib/arrows/types";
import ChallengeCard from "./challengeCard";
import {
  activeCoachAtom,
  activeGameModeAtom,
  gameIdAtom,
  reviewPlyAtom,
  playEvalBarAtom,
  playCascadeActiveAtom,
  boardFlippedAtom,
  botStrengthAtom,
  botThinkingAtom,
  challengeIdAtom,
  enginePlayNameAtom,
  gameAtom,
  gameEndAtom,
  hintArrowsAtom,
  hintPositionKeyAtom,
  isGameInProgressAtom,
  playerColorAtom,
  savedGameIdAtom,
} from "./states";
import { opposite, useStartGame } from "./useStartGame";
import { useMoveCoach } from "./useMoveCoach";
import { useInteractiveCoach } from "./useInteractiveCoach";

interface Props {
  botEngine: EngineState;
  coach: ReturnType<typeof useMoveCoach>;
  interactive: ReturnType<typeof useInteractiveCoach>;
  coachSlotRef: (el: HTMLDivElement | null) => void;
}

export default function GamePanel({
  botEngine,
  coach,
  interactive,
  coachSlotRef,
}: Props) {
  const store = useStore();
  const gameId = useAtomValue(gameIdAtom);
  const inCascade = useAtomValue(playCascadeActiveAtom);
  const [reviewPly, setReviewPly] = useAtom(reviewPlyAtom);
  const [evalBar, setEvalBar] = useAtom(playEvalBarAtom);
  const { backToSetup, restartGame } = useStartGame();
  const [casualExit, setCasualExit] = useState<"restart" | "discard">(
    "restart"
  );
  const [casualExitOpen, setCasualExitOpen] = useState(false);
  const confirmCasualExit = (action: "restart" | "discard") => {
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

  // Order matters on a tall screen, where this panel sits under the board:
  // what the player taps comes before anything that grows during the game
  // (the move list, coach and hints), so the controls never drift down.
  return (
    <Stack spacing={2}>
      {!isInProgress && info.over && (
        <ResultCard
          reason={info.reason}
          outcome={outcome}
          result={info.result}
          opponent={engineLabel(botEngineName).small}
        />
      )}

      <Panel
        title={
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography fontWeight={600}>
              vs {engineLabel(botEngineName).small}
            </Typography>
            {shownStrength?.mode === "elo" && (
              <Chip size="small" label={`${shownStrength.elo}`} />
            )}
            {shownStrength?.mode === "depth" && (
              <Chip size="small" label={`depth ${shownStrength.depth}`} />
            )}
            {shownStrength?.mode === "max" && (
              <Chip size="small" label="full strength" />
            )}
            {!shownStrength && <Chip size="small" label="joke" />}
            <Chip
              size="small"
              variant="outlined"
              color={isCasual ? "default" : "warning"}
              label={isCasual ? "Casual" : "Formal"}
            />
          </Stack>
        }
      >
        <Stack spacing={1.5}>
          <StatusLine
            over={info.over}
            isPlayerTurn={isPlayerTurn}
            botThinking={botThinking}
            inCheck={game.inCheck()}
            inProgress={isInProgress}
          />

          {isInProgress && (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {isCasual && !coachActive && (
                <ActionButton
                  icon="mdi:lightbulb-on-outline"
                  label={hintsOpen ? "Hide hints" : "Hint"}
                  tooltip="Show the engine's top moves for either side"
                  onClick={toggleHints}
                  active={hintsOpen}
                  minWidth={112}
                />
              )}
              <ActionButton
                icon="mdi:undo-variant"
                label="Take back"
                tooltip={undoDisabledReason || "Take back your last move"}
                disabled={!!undoDisabledReason || reviewing || inCascade}
                onClick={handleUndo}
              />
              <ActionButton
                icon="mdi:swap-vertical"
                label="Flip"
                tooltip="Flip the board"
                onClick={flip}
              />
              <ActionButton
                icon="mdi:handshake-outline"
                label="Offer draw"
                tooltip={
                  isPlayerTurn ? "Ask the bot for a draw" : "Wait for your turn"
                }
                disabled={
                  !isPlayerTurn ||
                  !botEngine.engine ||
                  offeringDraw ||
                  reviewing ||
                  inCascade
                }
                onClick={handleOfferDraw}
              />
              <ActionButton
                icon="mdi:flag-outline"
                label="Resign"
                tooltip="Give up this game"
                onClick={() => setConfirmResign(true)}
              />
            </Stack>
          )}

          {!isCasual && isInProgress && (
            <Alert severity="info" icon={<Icon icon="mdi:lock-outline" />}>
              Formal game: no hints and no takebacks.
            </Alert>
          )}

          {isInProgress && isCasual && (
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              <Button
                size="small"
                variant={coachActive ? "outlined" : "text"}
                aria-pressed={coachActive}
                onClick={() => {
                  if (!coachActive && hintsOpen) toggleHints();
                  setCoachActive(!coachActive);
                }}
              >
                Coach
              </Button>
              <Button
                size="small"
                variant={coachActive && evalBar ? "outlined" : "text"}
                disabled={!coachActive}
                aria-pressed={coachActive && evalBar}
                onClick={() => setEvalBar(!evalBar)}
              >
                Eval bar
              </Button>
              {!challenge && shownStrength && (
                <Button size="small" onClick={() => setStrengthOpen(true)}>
                  Bot strength
                </Button>
              )}
              <Button size="small" onClick={() => confirmCasualExit("restart")}>
                Restart
              </Button>
              <Button size="small" onClick={() => confirmCasualExit("discard")}>
                End practice
              </Button>
            </Stack>
          )}

          <Box ref={coachSlotRef} sx={{ "&:empty": { display: "none" } }} />

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={0.5}
          >
            <Stack direction="row" data-board-shortcuts>
              <ToolbarButton
                tooltip="First position (Home)"
                icon="ri:skip-back-line"
                disabled={!shownPly || inCascade}
                onClick={() => selectPly(0)}
              />
              <ToolbarButton
                tooltip="Previous move (←)"
                icon="ri:arrow-left-s-line"
                disabled={!shownPly || inCascade}
                onClick={() => selectPly(shownPly - 1)}
              />
              <ToolbarButton
                tooltip="Next move (→)"
                icon="ri:arrow-right-s-line"
                disabled={!reviewing || inCascade}
                onClick={() => selectPly(shownPly + 1)}
              />
            </Stack>
            <Button
              size="small"
              disabled={!reviewing || inCascade}
              onClick={() => selectPly(livePly)}
            >
              {isInProgress ? "Live position" : "Final position"}
            </Button>
          </Stack>

          <MovesList
            moves={history}
            startsWithBlack={startsWithBlack}
            firstMoveNumber={firstMoveNumber}
            currentPly={shownPly}
            onSelect={inCascade ? undefined : selectPly}
            maxHeight={230}
            fixedHeight
            annotations={coach.moves.map((entry) => ({
              classification: entry.after?.moveClassification,
              evaluation: entry.after?.lines[0],
              status:
                coach.error && !entry.after?.moveClassification
                  ? "error"
                  : undefined,
            }))}
          />
        </Stack>
      </Panel>

      {challenge && <ChallengeCard endgame={challenge} />}

      {isInProgress && isCasual && hintsOpen && (
        <Panel title="Hints">
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
        </Panel>
      )}

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
          <Button onClick={() => setStrengthOpen(false)}>Done</Button>
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
    </Stack>
  );
}

function StatusLine({
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

  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      sx={{ height: 24, minHeight: 24 }}
    >
      <Box
        sx={{
          width: 20,
          height: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isPlayerTurn ? (
          <Icon icon="mdi:cursor-default-click-outline" height={20} />
        ) : (
          <CircularProgress size={16} thickness={5} />
        )}
      </Box>
      <Typography variant="body2" noWrap>
        {isPlayerTurn
          ? inCheck
            ? "You are in check. Your move."
            : "Your move."
          : botThinking
            ? "Thinking…"
            : "Waiting for the bot…"}
      </Typography>
    </Stack>
  );
}

function ActionButton({
  icon,
  label,
  tooltip,
  onClick,
  disabled,
  active,
  minWidth,
}: {
  icon: string;
  label: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  minWidth?: number;
}) {
  return (
    <Tooltip title={tooltip}>
      <Box component="span">
        <Button
          size="small"
          variant={active ? "contained" : "outlined"}
          color="inherit"
          disabled={disabled}
          onClick={onClick}
          startIcon={<Icon icon={icon} height={18} />}
          sx={minWidth ? { minWidth } : undefined}
        >
          {label}
        </Button>
      </Box>
    </Tooltip>
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
        ? "mdi:emoticon-sad-outline"
        : "mdi:handshake-outline";

  const copy = async (label: string, text: string) => {
    if (!(await copyToClipboard(text))) return;
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  };

  return (
    <Panel>
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Icon icon={icon} height={44} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {headline}
          </Typography>
          <Typography sx={{ opacity: 0.75 }}>
            {reason} · {result}
          </Typography>
        </Box>

        <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="center">
          <Button
            variant="contained"
            startIcon={<Icon icon="mdi:chart-line" height={18} />}
            disabled={savedGameId === null}
            onClick={() =>
              router.push({
                pathname: "/analysis",
                query: { gameId: savedGameId },
              })
            }
          >
            Analyze game
          </Button>
          <Button
            variant="outlined"
            startIcon={<Icon icon="mdi:sync" height={18} />}
            onClick={() =>
              challengeId
                ? startChallenge(challengeId)
                : startGame({ playerColor: opposite(playerColor) })
            }
          >
            {challengeId ? "Try again" : "Rematch"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Icon icon="mdi:plus" height={18} />}
            onClick={backToSetup}
          >
            New game
          </Button>
        </Stack>

        <Stack direction="row" gap={1}>
          <Button
            size="small"
            color="inherit"
            onClick={() => copy("PGN", game.pgn())}
          >
            {copied === "PGN" ? "Copied!" : "Copy PGN"}
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={() => copy("FEN", game.fen())}
          >
            {copied === "FEN" ? "Copied!" : "Copy FEN"}
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}
