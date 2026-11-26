import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Chess, DEFAULT_POSITION, Square } from "chess.js";
import { createChess } from "@/lib/chessInstance";
import { buildAnalysisFeedback } from "@/lib/analysisFeedback";
import { chessPathKey } from "@/lib/chessHistory";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { DEFAULT_ENGINE } from "@/constants";
import {
  getEffectiveCoachDialogueFromStore,
  useEffectiveCoachDialogue,
} from "@/hooks/useEffectiveEngineSettings";
import { useEngineState } from "@/hooks/useEngine";
import { useFeatureEngineName } from "@/hooks/useFeatureEngineName";
import { useChessActions } from "@/hooks/useChessActions";
import {
  BUILTIN_CHESS_GLOSSARY,
  CoachChoice,
  CoachDefinition,
  CoachEngineRequest,
  CoachEventResponse,
  CoachMessage,
  CoachWorkerClient,
  parseCoachActions,
  toCoachEngineResult,
} from "@/lib/coachBridge";
import { COACH_ARROW_COLORS } from "@/lib/coachCascade";
import { BoardArrow } from "@/lib/arrows/types";
import { BoardEffect, SquareHighlight } from "@/components/board/cues";
import { getBotMove } from "@/lib/engine/botMove";
import { arenaTerminalEval } from "@/lib/engine/arenaAnalysis";
import {
  botReplyDelayMs,
  botReplySpeedAtom,
  fullStrengthMsAtom,
} from "@/lib/engine/engineSettings";
import { engineFeatureLabel } from "@/lib/engine/featureEngines";
import { CHALLENGE_STRENGTH } from "@/lib/engine/strength";
import { UciEngine } from "@/lib/engine/uciEngine";
import { sleep } from "@/lib/helpers";
import { describeMove } from "@/lib/visualize/explain";
import { Color, MoveClassification } from "@/types/enums";
import { PositionEval } from "@/types/eval";
import { useMoveCoach } from "./useMoveCoach";
import {
  botErrorAtom,
  botStrengthAtom,
  botThinkingAtom,
  challengeIdAtom,
  clocksAtom,
  coachVoiceEnabledAtom,
  gameAtom,
  gameIdAtom,
  isGameInProgressAtom,
  reviewPlyAtom,
  playCascadeActiveAtom,
  playerColorAtom,
} from "./states";

export interface CoachFeedMessage extends CoachMessage {
  /** True when this message begins a new coach reply group in the live feed. */
  startsGroup?: boolean;
  /** Compact move label (e.g. "3. Nf3" or "Hint") captured when the reply began. */
  moveTag?: string;
}

const currentMoveTag = (game: Chess): string | undefined => {
  const history = game.history({ verbose: true });
  if (!history.length) return undefined;
  const firstMove = history[0];
  const firstMoveNumber = Number(firstMove.before.split(" ")[5]) || 1;
  const offset = firstMove.color === "b" ? 1 : 0;
  const lastIndex = history.length - 1;
  const moveNumber = firstMoveNumber + Math.floor((lastIndex + offset) / 2);
  const lastMove = history[lastIndex];
  return lastMove.color === "w"
    ? `${moveNumber}. ${lastMove.san}`
    : `${moveNumber}... ${lastMove.san}`;
};

const MISTAKE_CLASSES: readonly MoveClassification[] = [
  MoveClassification.Inaccuracy,
  MoveClassification.Mistake,
  MoveClassification.Blunder,
];

const speakLine = (plain: string) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const clean = plain.replace(/\s+/g, " ").trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.03;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on unsupported browsers.
  }
};

const attackerArrowsTo = (
  fen: string,
  target: Square,
  attackerColor: "w" | "b"
): BoardArrow[] => {
  try {
    const g = createChess(fen);
    return g
      .attackers(target, attackerColor)
      .slice(0, 3)
      .map((from) => ({
        from,
        to: target,
        kind: "content" as const,
        color: COACH_ARROW_COLORS.danger,
      }));
  } catch {
    return [];
  }
};

const findKingSquare = (fen: string, color: "w" | "b"): Square | undefined => {
  try {
    const g = createChess(fen);
    for (const row of g.board()) {
      for (const cell of row) {
        if (cell && cell.type === "k" && cell.color === color) {
          return cell.square;
        }
      }
    }
  } catch {
    // ignore
  }
  return undefined;
};

const terminalEvalForFen = (fen: string) => {
  try {
    return arenaTerminalEval(createChess(fen));
  } catch {
    return undefined;
  }
};

/**
 * Real Dr. Wolf (ChessCoach JS) Play Coach runtime.
 *
 * Drives Dr. Wolf's `playChessEngine` loop (`analyze_position` + `fetch_bot_move`)
 * on a dedicated evaluation engine (automatically falling back to bundled Stockfish
 * if the user's configured Settings coach engine is unavailable) with a watchdog
 * so neither the coach nor the bot can ever deadlock.
 */
export function useInteractiveCoach(
  enabled: boolean,
  moveCoach: ReturnType<typeof useMoveCoach>,
  botEngine: UciEngine | null
) {
  const store = useStore();
  const game = useAtomValue(gameAtom);
  const gameId = useAtomValue(gameIdAtom);
  const playerColor = useAtomValue(playerColorAtom);
  const isInProgress = useAtomValue(isGameInProgressAtom);
  const voiceEnabled = useAtomValue(coachVoiceEnabledAtom);
  const reviewPly = useAtomValue(reviewPlyAtom);
  const root = game.history({ verbose: true })[0]?.before ?? game.fen();
  const standard = root === DEFAULT_POSITION;
  const challengeId = useAtomValue(challengeIdAtom);
  const cascadeActive = useAtomValue(playCascadeActiveAtom);
  const setBotThinking = useSetAtom(botThinkingAtom);
  const setBotError = useSetAtom(botErrorAtom);
  const { playMove, goToMove } = useChessActions(gameAtom);

  // Use the user's configured coach dialogue engine if available, otherwise fall back to bundled Stockfish 19 Lite
  // so an unavailable external/undownloaded engine in Settings never breaks Dr. Wolf.
  const configuredDialogueEngine = useFeatureEngineName("coachDialogue");
  const {
    depth: dialogueDepth,
    multiPv: dialogueMultiPv,
    movetimeMs: dialogueMovetimeMs,
  } = useEffectiveCoachDialogue();
  const [positionCoachGame, setPositionCoachGame] = useState<number | null>(
    null
  );
  const [workerFailed, setWorkerFailed] = useState(false);
  const positionCoaching =
    !standard || positionCoachGame === gameId || workerFailed;
  const [failedEngine, setFailedEngine] = useState<string | null>(null);
  const useBundledFallback = failedEngine === configuredDialogueEngine;
  const drWolfEngineState = useEngineState(
    enabled && standard && positionCoachGame !== gameId && !workerFailed
      ? useBundledFallback
        ? DEFAULT_ENGINE
        : configuredDialogueEngine
      : undefined,
    engineFeatureLabel("coachDialogue")
  );

  useEffect(() => {
    if (
      enabled &&
      !useBundledFallback &&
      drWolfEngineState.status === "error" &&
      configuredDialogueEngine !== DEFAULT_ENGINE
    ) {
      setFailedEngine(configuredDialogueEngine);
    }
  }, [
    enabled,
    useBundledFallback,
    drWolfEngineState.status,
    configuredDialogueEngine,
  ]);

  const drWolfEngine = drWolfEngineState.engine;

  const clientRef = useRef<CoachWorkerClient | null>(null);
  const evalCacheRef = useRef<Map<string, PositionEval>>(new Map());
  const pendingRequestsRef = useRef<CoachEngineRequest[]>([]);
  const processingQueueRef = useRef<boolean>(false);
  const fetchingBotMoveRef = useRef<boolean>(false);
  const suppressUndoCallbackRef = useRef<boolean>(false);
  const drWolfEngineRef = useRef<UciEngine | null>(null);
  const drWolfEngineErroredRef = useRef<boolean>(false);
  const botEngineRef = useRef<UciEngine | null>(null);
  const moveCoachMovesRef = useRef(moveCoach.moves);
  const gradingEngineRef = useRef(moveCoach.engineState.engine?.name);
  gradingEngineRef.current = moveCoach.engineState.engine?.name;
  const syncedPliesRef = useRef<number>(0);
  const spokenIdsRef = useRef(new Set<number>());
  const positionMessageId = useRef(0);
  const lastPositionFeedback = useRef<string | undefined>(undefined);
  const sessionPlyAtBoot = useRef(0);
  const sessionTokenRef = useRef<number>(0);

  drWolfEngineRef.current = drWolfEngine;
  drWolfEngineErroredRef.current =
    drWolfEngineState.status === "error" &&
    (useBundledFallback || configuredDialogueEngine === DEFAULT_ENGINE);
  botEngineRef.current = botEngine;
  moveCoachMovesRef.current = moveCoach.moves;

  // Clear cached dialogue evals whenever the user tweaks dialogue engine or search settings.
  useEffect(() => {
    evalCacheRef.current.clear();
  }, [
    configuredDialogueEngine,
    dialogueDepth,
    dialogueMultiPv,
    dialogueMovetimeMs,
  ]);

  const [workerReady, setWorkerReady] = useState(false);
  const [transcript, setTranscript] = useState<{
    messages: CoachFeedMessage[];
    replyStart: number;
    nextStartsReply: boolean;
  }>({ messages: [], replyStart: 0, nextStartsReply: true });
  const { messages, replyStart } = transcript;
  const replyMessages = useMemo(
    () => messages.slice(replyStart),
    [messages, replyStart]
  );

  const updateTranscript = useCallback(
    (
      incoming: CoachMessage[],
      startReply = false,
      wiggle = false,
      explicitTag?: string
    ) => {
      const moveTag = explicitTag ?? currentMoveTag(store.get(gameAtom));
      setTranscript((previous) => {
        const startsReply = startReply || previous.nextStartsReply;
        const known = new Set(previous.messages.map((message) => message.id));
        const added: CoachFeedMessage[] = incoming
          .filter((message) => {
            if (known.has(message.id)) return false;
            known.add(message.id);
            return true;
          })
          .map((message, idx) =>
            idx === 0 && startsReply
              ? { ...message, startsGroup: true, moveTag }
              : { ...message }
          );
        if (added.length) {
          return {
            messages: [...previous.messages, ...added],
            replyStart: startsReply
              ? previous.messages.length
              : previous.replyStart,
            nextStartsReply: false,
          };
        }
        if (wiggle && previous.messages.length) {
          const last = previous.messages[previous.messages.length - 1];
          return {
            ...previous,
            messages: [
              ...previous.messages.slice(0, -1),
              { ...last, wiggleTick: (last.wiggleTick ?? 0) + 1 },
            ],
            nextStartsReply: startsReply,
          };
        }
        return startsReply === previous.nextStartsReply
          ? previous
          : { ...previous, nextStartsReply: startsReply };
      });
    },
    [store]
  );
  const [workerArrows, setWorkerArrows] = useState<BoardArrow[]>([]);
  const [workerHighlights, setWorkerHighlights] = useState<SquareHighlight[]>(
    []
  );
  const [mentionedSquare, setMentionedSquare] = useState<Square | null>(null);
  const [workerChoices, setWorkerChoices] = useState<CoachChoice[]>([]);
  const [workerEffect, setWorkerEffect] = useState<BoardEffect | undefined>();
  const [coachBusy, setCoachBusy] = useState(false);

  // Only let Dr. Wolf orchestrate bot moves on standard White games once the Worker is initialized
  // AND we have a live engine available to fulfill its queue.
  const canDrWolfOrchestrate =
    enabled && workerReady && !positionCoaching && !challengeId && !!botEngine;

  const enqueueAndDrainRef = useRef<
    (reqs: CoachEngineRequest[], token: number) => void
  >(() => undefined);

  const applyResponse = useCallback(
    (res: CoachEventResponse, token: number, expectedGame?: Chess) => {
      if (
        token !== sessionTokenRef.current ||
        (expectedGame && expectedGame !== store.get(gameAtom))
      )
        return;
      const parsed = parseCoachActions(res);

      if (parsed.clearChat || parsed.messages.length || parsed.wiggle) {
        updateTranscript(parsed.messages, parsed.clearChat, parsed.wiggle);
      }

      if (parsed.clearShapes) {
        setWorkerArrows(parsed.arrows);
        setWorkerHighlights(parsed.highlights);
      } else {
        if (parsed.arrows.length > 0) setWorkerArrows(parsed.arrows);
        if (parsed.highlights.length > 0)
          setWorkerHighlights(parsed.highlights);
      }

      if (parsed.effect) setWorkerEffect(parsed.effect);
      if (parsed.clearChoices) {
        setWorkerChoices(parsed.choices ?? []);
      } else if (parsed.choices !== undefined) {
        setWorkerChoices(parsed.choices);
      }

      if (parsed.undoRequested && !suppressUndoCallbackRef.current) {
        const g = store.get(gameAtom);
        const hist = g.history({ verbose: true });
        let targetPly = hist.length - 1;
        while (targetPly >= 0 && hist[targetPly].color !== playerColor) {
          targetPly--;
        }
        if (targetPly >= 0) {
          goToMove(targetPly, g);
        }
      }

      if (parsed.botMove) {
        const g = store.get(gameAtom);
        if (
          store.get(isGameInProgressAtom) &&
          !g.isGameOver() &&
          g.turn() !== playerColor
        ) {
          playMove(parsed.botMove, g);
        }
      }

      if (parsed.engineRequests.length > 0) {
        enqueueAndDrainRef.current(parsed.engineRequests, token);
      }
    },
    [goToMove, playMove, playerColor, store, updateTranscript]
  );

  const switchToPositionCoach = useCallback((token: number) => {
    if (token !== sessionTokenRef.current) return;
    pendingRequestsRef.current = [];
    clientRef.current?.dispose();
    clientRef.current = null;
    setWorkerFailed(true);
    setWorkerReady(false);
    setWorkerChoices([]);
    setWorkerArrows([]);
    setWorkerHighlights([]);
  }, []);

  // Sequential fulfillment loop for Dr. Wolf's `playChessEngine` requests.
  const drainEngineQueue = useCallback(
    async (token: number) => {
      if (processingQueueRef.current) return;
      processingQueueRef.current = true;
      setCoachBusy(true);

      try {
        while (
          pendingRequestsRef.current.length > 0 &&
          token === sessionTokenRef.current
        ) {
          const req = pendingRequestsRef.current[0];
          const client = clientRef.current;
          if (!client) break;

          if (req.action === "analyze_position" && req.fen) {
            const evalEng = drWolfEngineRef.current;
            if (!evalEng && !drWolfEngineErroredRef.current) {
              // Wait for engine to finish booting; effect below will resume draining.
              break;
            }
            pendingRequestsRef.current.shift();

            const effective = getEffectiveCoachDialogueFromStore(store);
            const cacheKey = JSON.stringify([
              evalEng?.name,
              effective,
              req.fen,
            ]);
            let posEval = evalCacheRef.current.get(cacheKey);
            if (!posEval && evalEng?.name === gradingEngineRef.current) {
              // A completed grading search is usable only when it meets the dialogue settings.
              const fromArena = moveCoachMovesRef.current.find(
                (m) =>
                  (m.move.before === req.fen && m.before?.lines.length) ||
                  (m.move.after === req.fen && m.after?.lines.length)
              );
              if (fromArena) {
                posEval =
                  fromArena.move.before === req.fen
                    ? fromArena.before
                    : fromArena.after;
                if (
                  !posEval ||
                  posEval.lines.length < effective.multiPv ||
                  posEval.lines.some(
                    (line) => line.bound || line.depth < effective.depth
                  )
                ) {
                  posEval = undefined;
                }
              }
            }
            if (!posEval && evalEng) {
              try {
                posEval = await evalEng.evaluatePositionWithUpdate({
                  fen: req.fen,
                  depth: effective.depth,
                  multiPv: effective.multiPv,
                  movetimeMs:
                    effective.movetimeMs > 0 ? effective.movetimeMs : undefined,
                  useCloudEval: false,
                });
                if (posEval.lines.length > 0) {
                  evalCacheRef.current.set(cacheKey, posEval);
                  if (evalCacheRef.current.size > 384) {
                    const first = evalCacheRef.current.keys().next().value;
                    if (first !== undefined) evalCacheRef.current.delete(first);
                  }
                }
              } catch {
                posEval = undefined;
              }
            }
            if (token !== sessionTokenRef.current) break;

            const result = posEval?.lines.length
              ? posEval
              : terminalEvalForFen(req.fen);
            if (!result?.lines.length) {
              switchToPositionCoach(token);
              break;
            }
            try {
              const response = await client.sendEvent(
                toCoachEngineResult(req.fen, result, req)
              );
              applyResponse(response, token);
            } catch {
              switchToPositionCoach(token);
            }
          } else if (req.action === "fetch_bot_move" && req.fen) {
            const bEng = botEngineRef.current;
            if (!bEng) break;
            if (store.get(playCascadeActiveAtom)) break;

            pendingRequestsRef.current.shift();
            const expected = store.get(gameAtom);
            if (
              !store.get(isGameInProgressAtom) ||
              expected.fen() !== req.fen ||
              expected.turn() === playerColor
            )
              continue;
            fetchingBotMoveRef.current = true;
            setBotError(null);
            setBotThinking(true);
            try {
              const minThink = sleep(
                botReplyDelayMs(store.get(botReplySpeedAtom))
              );
              const botClock =
                store.get(clocksAtom)?.[
                  playerColor === Color.White ? "b" : "w"
                ];
              const uci = await getBotMove(
                bEng,
                req.fen,
                store.get(challengeIdAtom)
                  ? CHALLENGE_STRENGTH
                  : store.get(botStrengthAtom),
                {
                  clockMs: botClock,
                  fullStrengthMs: store.get(fullStrengthMsAtom),
                }
              );
              await minThink;
              if (token !== sessionTokenRef.current) break;
              if (
                uci &&
                store.get(isGameInProgressAtom) &&
                chessPathKey(store.get(gameAtom)) === chessPathKey(expected)
              ) {
                const res = await client
                  .sendEvent({
                    what: "engine_result",
                    gameScreen: "PLAY",
                    fen: req.fen,
                    komodo_level: null,
                    komodo_depth: null,
                    komodoElo: req.komodoElo ?? 500,
                    botName: null,
                    detailedResults: JSON.stringify({ move: uci }),
                  })
                  .catch(() => ({}));
                applyResponse(res, token, expected);
              }
            } catch (err) {
              console.error(err);
              if (token === sessionTokenRef.current) {
                setBotError(
                  err instanceof Error
                    ? err.message
                    : "The bot could not make a move."
                );
              }
            } finally {
              fetchingBotMoveRef.current = false;
              setBotThinking(false);
            }
          } else {
            pendingRequestsRef.current.shift();
          }
        }
      } finally {
        processingQueueRef.current = false;
        if (token === sessionTokenRef.current) {
          setCoachBusy(false);
        }
      }
    },
    [
      applyResponse,
      playerColor,
      setBotError,
      setBotThinking,
      store,
      switchToPositionCoach,
    ]
  );

  enqueueAndDrainRef.current = (reqs: CoachEngineRequest[], token: number) => {
    if (token !== sessionTokenRef.current) return;
    pendingRequestsRef.current.push(...reqs);
    void drainEngineQueue(token);
  };

  // Re-trigger engine queue draining whenever either engine finishes loading or cascade closes.
  useEffect(() => {
    if (
      enabled &&
      workerReady &&
      pendingRequestsRef.current.length > 0 &&
      !cascadeActive
    ) {
      void drainEngineQueue(sessionTokenRef.current);
    }
  }, [
    enabled,
    workerReady,
    drWolfEngine,
    drWolfEngineState.status,
    botEngine,
    cascadeActive,
    drainEngineQueue,
  ]);

  // Safety watchdog: if Dr. Wolf is orchestrating, it's the bot's turn, no cascade or choice prompt
  // is holding the game, and the bot still hasn't moved after 4.5s, play the bot move directly so
  // the game can NEVER get stuck in perpetual "Waiting for the bot...".
  const currentFen = game.fen();
  const isBotTurn = game.turn() !== playerColor;
  useEffect(() => {
    if (
      !canDrWolfOrchestrate ||
      !isInProgress ||
      game.isGameOver() ||
      !isBotTurn ||
      cascadeActive ||
      workerChoices.length > 0 ||
      !botEngine
    ) {
      return;
    }

    const token = sessionTokenRef.current;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (
        cancelled ||
        token !== sessionTokenRef.current ||
        fetchingBotMoveRef.current
      ) {
        return;
      }
      const g = store.get(gameAtom);
      if (
        g.isGameOver() ||
        g.turn() === playerColor ||
        g.fen() !== currentFen
      ) {
        return;
      }
      setBotThinking(true);
      try {
        const botClock =
          store.get(clocksAtom)?.[playerColor === Color.White ? "b" : "w"];
        const uci = await getBotMove(
          botEngine,
          currentFen,
          store.get(challengeIdAtom)
            ? CHALLENGE_STRENGTH
            : store.get(botStrengthAtom),
          {
            clockMs: botClock,
            fullStrengthMs: store.get(fullStrengthMsAtom),
          }
        );
        if (!cancelled && token === sessionTokenRef.current && uci) {
          const latest = store.get(gameAtom);
          if (
            store.get(isGameInProgressAtom) &&
            latest === g &&
            !latest.isGameOver()
          ) {
            playMove(
              {
                from: uci.slice(0, 2) as Square,
                to: uci.slice(2, 4) as Square,
                promotion: uci.slice(4, 5) || undefined,
              },
              latest
            );
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setBotThinking(false);
      }
    }, 8000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    canDrWolfOrchestrate,
    isInProgress,
    game,
    currentFen,
    isBotTurn,
    cascadeActive,
    workerChoices.length,
    botEngine,
    playerColor,
    playMove,
    setBotThinking,
    store,
  ]);

  // Reset coaching transcript only when a brand-new game starts (never when toggling Coach off/on mid-game).
  const transcriptGameIdRef = useRef<number>(gameId);
  useEffect(() => {
    if (transcriptGameIdRef.current === gameId) return;
    transcriptGameIdRef.current = gameId;
    evalCacheRef.current.clear();
    spokenIdsRef.current.clear();
    lastPositionFeedback.current = undefined;
    syncedPliesRef.current = 0;
    setPositionCoachGame(null);
    setWorkerFailed(false);
    setTranscript({ messages: [], replyStart: 0, nextStartsReply: true });
  }, [gameId]);

  // Boot / pause the Dr. Wolf JS Worker when Coach is toggled or a new game starts,
  // preserving existing transcript messages across same-game Coach off/on toggles.
  useEffect(() => {
    const token = ++sessionTokenRef.current;
    pendingRequestsRef.current = [];
    setWorkerReady(false);
    setCoachBusy(false);
    sessionPlyAtBoot.current = store.get(gameAtom).history().length;

    if (!enabled) {
      clientRef.current?.dispose();
      clientRef.current = null;
      setWorkerArrows([]);
      setWorkerHighlights([]);
      setWorkerChoices([]);
      setWorkerEffect(undefined);
      setMentionedSquare(null);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    setWorkerArrows([]);
    setWorkerHighlights([]);
    setWorkerChoices([]);
    setWorkerEffect(undefined);
    setMentionedSquare(null);

    if (!standard || sessionPlyAtBoot.current > 0) {
      setPositionCoachGame(gameId);
      return;
    }

    syncedPliesRef.current = 0;
    setPositionCoachGame(null);
    let client: CoachWorkerClient;
    try {
      client = new CoachWorkerClient();
      clientRef.current = client;
    } catch {
      setWorkerFailed(true);
      return;
    }
    void client
      .init(playerColor)
      .then((res) => {
        if (token !== sessionTokenRef.current) return;
        setWorkerReady(true);
        applyResponse(res, token);
      })
      .catch(() => {
        if (token === sessionTokenRef.current) setWorkerFailed(true);
      });

    return () => {
      sessionTokenRef.current = token + 1;
      pendingRequestsRef.current = [];
      client.dispose();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [enabled, gameId, playerColor, standard, applyResponse, store]);

  // Clear temporary square highlight when the board changes.
  useEffect(() => {
    setMentionedSquare(null);
    setWorkerArrows([]);
    setWorkerHighlights([]);
    setWorkerEffect(undefined);
  }, [currentFen]);

  // Sync moves into Dr. Wolf (strictly after `workerReady` so fast Move 1 never races `init()`).
  useEffect(() => {
    if (!enabled || !workerReady || !clientRef.current) return;
    const token = sessionTokenRef.current;
    const history = game.history({ verbose: true });

    if (history.length < syncedPliesRef.current) {
      const diff = syncedPliesRef.current - history.length;
      syncedPliesRef.current = history.length;
      setWorkerArrows([]);
      setWorkerHighlights([]);
      setWorkerChoices([]);
      pendingRequestsRef.current = [];
      if (diff > 0 && clientRef.current) {
        updateTranscript([], true);
        suppressUndoCallbackRef.current = true;
        void clientRef.current
          .sendEvent({
            what: "user_interface_event",
            gameScreen: "PLAY",
            id: "tap_game_undo_button",
          })
          .then((res) => applyResponse(res, token))
          .catch(() => undefined)
          .finally(() => {
            suppressUndoCallbackRef.current = false;
          });
      }
      return;
    }

    const newMoves = history.slice(syncedPliesRef.current);
    if (!newMoves.length) return;
    if (newMoves.some((move) => move.color === playerColor))
      updateTranscript([], true);
    syncedPliesRef.current = history.length;
    setWorkerArrows([]);
    setWorkerHighlights([]);

    (async () => {
      for (const m of newMoves) {
        if (token !== sessionTokenRef.current || !clientRef.current) break;
        const res = await clientRef.current
          .sendEvent({
            what: "move_made",
            gameScreen: "PLAY",
            from: m.from,
            to: m.to,
            promotion: m.promotion ?? null,
            fenBeforeMove: m.before,
          })
          .catch(() => ({}));
        applyResponse(res, token);
      }
    })();
  }, [
    enabled,
    workerReady,
    game,
    applyResponse,
    playerColor,
    updateTranscript,
  ]);

  // Tactical visual accents (converging red attacker arrows / king shake) when Stockfish grades a blunder.
  const tacticalVisuals = useMemo(() => {
    const fb = moveCoach.feedback;
    if (!fb || fb.status !== "done" || !fb.classification) return null;
    const cls = fb.classification;
    const isMistake = MISTAKE_CLASSES.includes(cls);
    const arrows: BoardArrow[] = [];
    const highlights: SquareHighlight[] = [];
    let effect: BoardEffect | undefined;

    let desc;
    try {
      desc = describeMove(fb.move.before, fb.move.lan);
    } catch {
      desc = undefined;
    }

    if (isMistake) {
      if (desc?.dangerSquare) {
        highlights.push({
          square: desc.dangerSquare,
          tone: "danger",
          pulse: cls === MoveClassification.Blunder,
        });
        const opp = playerColor === "w" ? "b" : "w";
        arrows.push(...attackerArrowsTo(fb.move.after, desc.dangerSquare, opp));
      } else {
        highlights.push({
          square: fb.move.to as Square,
          tone: "danger",
          pulse: cls === MoveClassification.Blunder,
        });
      }
      if (cls === MoveClassification.Blunder) {
        const kingSq = findKingSquare(fb.move.after, playerColor);
        if (kingSq) {
          effect = { square: kingSq, kind: "shake_king", key: fb.plyIndex };
        }
      }
    } else if (
      cls === MoveClassification.Splendid ||
      cls === MoveClassification.Perfect
    ) {
      highlights.push({ square: fb.move.to as Square, tone: "success" });
      effect = {
        square: fb.move.to as Square,
        kind: "point_earned",
        key: fb.plyIndex,
      };
    } else if (desc?.tags.includes("mate")) {
      const opp = playerColor === "w" ? "b" : "w";
      const oppKing = findKingSquare(fb.move.after, opp);
      if (oppKing) {
        effect = { square: oppKing, kind: "spin_king", key: fb.plyIndex };
      }
    }

    return { isMistake, arrows, highlights, effect };
  }, [moveCoach.feedback, playerColor]);

  useEffect(() => {
    if (!enabled || !positionCoaching || moveCoach.feedback?.status !== "done")
      return;
    const feedback = moveCoach.feedback;
    if (lastPositionFeedback.current === feedback.key) return;
    const entry = moveCoach.moves[feedback.plyIndex];
    const commentary = buildAnalysisFeedback(
      { lastMove: feedback.move, eval: entry?.after, lastEval: entry?.before },
      feedback.plyIndex + 1
    );
    if (!commentary) return;
    lastPositionFeedback.current = feedback.key;
    updateTranscript(
      [
        {
          id: --positionMessageId.current,
          html: commentary.sentence,
          plain: commentary.sentence,
        },
      ],
      true
    );
  }, [
    enabled,
    moveCoach.feedback,
    moveCoach.moves,
    positionCoaching,
    updateTranscript,
  ]);

  useEffect(() => {
    if (!enabled || !voiceEnabled) return;
    return () => window.speechSynthesis?.cancel();
  }, [enabled, gameId, voiceEnabled]);

  useEffect(() => {
    // Muted messages are consumed too, so enabling speech never reads an
    // entire past game out loud.
    if (!enabled) return;
    for (const message of messages) {
      if (spokenIdsRef.current.has(message.id)) continue;
      spokenIdsRef.current.add(message.id);
      if (voiceEnabled) speakLine(message.plain);
    }
  }, [enabled, gameId, messages, voiceEnabled]);

  // Progressive Dr. Wolf hint button (Tap 1 = conceptual hint, Tap 2 = direct hint + arrow!).
  const requestHint = useCallback(async () => {
    if (
      !enabled ||
      !isInProgress ||
      game.turn() !== playerColor ||
      reviewPly !== null ||
      cascadeActive
    )
      return;
    if (positionCoaching) {
      const source =
        moveCoach.position.fen === game.fen()
          ? moveCoach.position.eval
          : undefined;
      const uci = source?.bestMove ?? source?.lines[0]?.pv[0];
      if (!uci) return;
      const move = game
        .moves({ verbose: true })
        .find((candidate) => candidate.lan === uci);
      if (!move) return;
      const text = `Consider ${move.san}. Look at what it changes before you commit.`;
      updateTranscript(
        [{ id: --positionMessageId.current, html: text, plain: text }],
        true,
        false,
        "Hint"
      );
      setWorkerArrows([
        {
          from: move.from,
          to: move.to,
          kind: "content",
          color: COACH_ARROW_COLORS.reminder,
        },
      ]);
      return;
    }
    if (!workerReady || !clientRef.current) return;
    const token = sessionTokenRef.current;
    const res = await clientRef.current
      .sendEvent({
        what: "user_interface_event",
        gameScreen: "PLAY",
        id: "tap_game_hint_button",
      })
      .catch(() => ({}));
    applyResponse(res, token);
  }, [
    enabled,
    workerReady,
    applyResponse,
    isInProgress,
    game,
    playerColor,
    reviewPly,
    cascadeActive,
    positionCoaching,
    moveCoach.position,
    updateTranscript,
  ]);

  const highlightSquare = useCallback((sq: Square) => {
    setMentionedSquare((prev) => (prev === sq ? null : sq));
  }, []);

  const defineTerm = useCallback(
    async (url: string): Promise<CoachDefinition | null> => {
      const match = url.match(/term=([^&]+)/i);
      const termKey = match
        ? decodeURIComponent(match[1]).toUpperCase().replace(/\s+/g, "_")
        : "";

      if (clientRef.current) {
        const res = await clientRef.current
          .sendEvent({
            what: "link",
            gameScreen: "PLAY",
            url,
          })
          .catch(() => ({}));
        const parsed = parseCoachActions(res);
        if (parsed.definition && parsed.definition.html.trim().length > 0) {
          return parsed.definition;
        }
      }

      if (termKey && BUILTIN_CHESS_GLOSSARY[termKey]) {
        return BUILTIN_CHESS_GLOSSARY[termKey];
      }

      if (match) {
        const term = decodeURIComponent(match[1]).replace(/_/g, " ");
        return {
          title: term.charAt(0).toUpperCase() + term.slice(1).toLowerCase(),
          html: "A key chess concept referenced by your coach.",
        };
      }
      return null;
    },
    []
  );

  const sendChoice = useCallback(
    async (choice: CoachChoice) => {
      if (!clientRef.current) return;
      const token = sessionTokenRef.current;
      setWorkerChoices([]);
      const res = await clientRef.current
        .sendEvent({
          what: "choice_response",
          action: choice.action,
          parameters:
            choice.parameters ?? JSON.stringify({ analyticsId: choice.title }),
        })
        .catch(() => ({}));
      applyResponse(res, token);
    },
    [applyResponse]
  );

  const arrows = useMemo<BoardArrow[]>(() => {
    if (workerArrows.length) return workerArrows;
    return tacticalVisuals?.arrows ?? [];
  }, [workerArrows, tacticalVisuals]);

  const highlights = useMemo<SquareHighlight[]>(() => {
    const base = workerHighlights.length
      ? workerHighlights
      : (tacticalVisuals?.highlights ?? []);
    if (mentionedSquare) {
      return [
        ...base.filter((h) => h.square !== mentionedSquare),
        { square: mentionedSquare, tone: "mentioned", pulse: true },
      ];
    }
    return base;
  }, [workerHighlights, tacticalVisuals, mentionedSquare]);

  const effect = workerEffect ?? tacticalVisuals?.effect;

  return {
    messages,
    replyStart,
    replyMessages,
    arrows,
    highlights,
    effect,
    choices: workerChoices,
    isMistake: !!tacticalVisuals?.isMistake,
    positionCoaching,
    ready: workerReady || positionCoaching,
    canRequestHint:
      enabled &&
      isInProgress &&
      game.turn() === playerColor &&
      reviewPly === null &&
      !cascadeActive &&
      (positionCoaching
        ? !!moveCoach.position.eval?.lines[0]?.pv[0]
        : workerReady),
    coachBusy: coachBusy && isInProgress,
    drWolfDrivesBot: canDrWolfOrchestrate,
    requestHint,
    highlightSquare,
    defineTerm,
    sendChoice,
  };
}
