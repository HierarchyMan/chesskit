import MovesList from "@/components/movesList";
import Panel from "@/components/panel";
import TopMovesPanel from "@/components/topMovesPanel";
import { ENGINE_LABELS } from "@/constants";
import { EngineState, useEngineState } from "@/hooks/useEngine";
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
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/router";
import { useCallback, useMemo, useState } from "react";
import { BoardArrow } from "@/lib/arrows/types";
import ChallengeCard from "./challengeCard";
import CoachCard from "./coachCard";
import {
  activeCoachAtom,
  activeGameModeAtom,
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

interface Props {
  botEngine: EngineState;
}

export default function GamePanel({ botEngine }: Props) {
  const game = useAtomValue(gameAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const [isInProgress, setIsInProgress] = useAtom(isGameInProgressAtom);
  const activeMode = useAtomValue(activeGameModeAtom);
  const coachActive = useAtomValue(activeCoachAtom);
  const [end, setEnd] = useAtom(gameEndAtom);
  const botThinking = useAtomValue(botThinkingAtom);
  const botEngineName = useAtomValue(enginePlayNameAtom);
  const savedStrength = useAtomValue(botStrengthAtom);
  const challengeId = useAtomValue(challengeIdAtom);
  const challenge = challengeId ? getEndgame(challengeId) : undefined;
  const strength = challenge ? CHALLENGE_STRENGTH : savedStrength;
  const setFlipped = useSetAtom(boardFlippedAtom);
  const setHintArrows = useSetAtom(hintArrowsAtom);
  const positionKey = useAtomValue(hintPositionKeyAtom);
  const publishHintArrows = useCallback(
    (arrows: BoardArrow[]) => setHintArrows({ positionKey, arrows }),
    [setHintArrows, positionKey]
  );
  const analysisEngineName = useFeatureEngineName("advice");
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
    hintsOpen && activeMode === "casual" ? analysisEngineName : undefined
  );

  const isCasual = activeMode === "casual";
  const history = game.history();
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
    if (undoDisabledReason) return;
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
    if (!engine || !isPlayerTurn) return;

    try {
      const result = await engine.evaluatePositionWithUpdate({
        fen: game.fen(),
        depth: 12,
        multiPv: 2,
        useCloudEval: false,
      });
      const playerScore = scoreFromLine(result.lines[0], game.turn());
      const botScore = -playerScore;

      if (botScore <= 30 && history.length >= 16) {
        setEnd({ type: "draw-agreed" });
        setIsInProgress(false);
        setNotice(
          `${ENGINE_LABELS[botEngineName].small} accepted your draw offer.`
        );
      } else {
        setNotice(
          history.length < 16
            ? `${ENGINE_LABELS[botEngineName].small} declined: it is too early for a draw.`
            : `${ENGINE_LABELS[botEngineName].small} declined the draw offer.`
        );
      }
    } catch (error) {
      console.error(error);
      setNotice("The draw offer could not be evaluated.");
    }
  };

  const toggleHints = () => {
    if (hintsOpen) setHintArrows([]);
    setHintsOpen(!hintsOpen);
  };

  const outcome = info.over ? getOutcomeFor(info, playerColor) : "drawn";

  return (
    <Stack spacing={2}>
      {challenge && <ChallengeCard endgame={challenge} />}

      <Panel
        title={
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography fontWeight={600}>
              vs {ENGINE_LABELS[botEngineName].small}
            </Typography>
            {strength.mode === "elo" && (
              <Chip size="small" label={`${strength.elo}`} />
            )}
            {strength.mode === "depth" && (
              <Chip size="small" label={`depth ${strength.depth}`} />
            )}
            {strength.mode === "max" && <Chip size="small" label="max" />}
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

          <MovesList
            moves={history}
            startsWithBlack={startsWithBlack}
            firstMoveNumber={firstMoveNumber}
            currentPly={history.length}
            maxHeight={230}
          />

          {isInProgress && (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {isCasual && (
                <ActionButton
                  icon="mdi:lightbulb-on-outline"
                  label={hintsOpen ? "Hide hints" : "Hint"}
                  tooltip="Show the engine's top moves for either side"
                  onClick={toggleHints}
                  active={hintsOpen}
                />
              )}
              <ActionButton
                icon="mdi:undo-variant"
                label="Take back"
                tooltip={undoDisabledReason || "Take back your last move"}
                disabled={!!undoDisabledReason}
                onClick={handleUndo}
              />
              <ActionButton
                icon="mdi:swap-vertical"
                label="Flip"
                tooltip="Flip the board"
                onClick={() => setFlipped((value) => !value)}
              />
              <ActionButton
                icon="mdi:handshake-outline"
                label="Offer draw"
                tooltip={
                  isPlayerTurn ? "Ask the bot for a draw" : "Wait for your turn"
                }
                disabled={!isPlayerTurn || !botEngine.engine}
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
        </Stack>
      </Panel>

      {coachActive && <CoachCard />}

      {isInProgress && isCasual && hintsOpen && (
        <Panel title="Hints">
          <TopMovesPanel
            fen={fen}
            positionKey={positionKey}
            engine={hintEngine.engine}
            engineStatus={hintEngine.status}
            engineError={hintEngine.error}
            onRetryEngine={hintEngine.retry}
            side={hintSide}
            onSideChange={(side) => {
              setHintArrows([]);
              setHintSideChoice({ side, fen, positionKey });
            }}
            onArrows={publishHintArrows}
          />
        </Panel>
      )}

      {!isInProgress && info.over && (
        <ResultCard
          reason={info.reason}
          outcome={outcome}
          result={info.result}
          opponent={ENGINE_LABELS[botEngineName].small}
        />
      )}

      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice("")}
        message={notice}
      />

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
    <Stack direction="row" alignItems="center" gap={1}>
      {isPlayerTurn ? (
        <Icon icon="mdi:cursor-default-click-outline" height={20} />
      ) : (
        <CircularProgress size={16} thickness={5} />
      )}
      <Typography variant="body2">
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
}: {
  icon: string;
  label: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
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

  const copy = (label: string, text: string) => {
    navigator.clipboard?.writeText?.(text);
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
