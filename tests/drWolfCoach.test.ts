import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { Chess } from "chess.js";
import {
  CoachEventResponse,
  parseCoachActions,
  parseLinkifiedText,
  toCoachEngineResult,
} from "../src/lib/coachBridge";
import { buildAnalysisFeedback } from "../src/lib/analysisFeedback";
import { describeMove } from "../src/lib/visualize/explain";
import { MoveClassification } from "../src/types/enums";

const BUNDLE_PATH = path.resolve(
  process.cwd(),
  "public",
  "coach",
  "coach-bundle.js"
);

interface Harness {
  game: Chess;
  errors: string[];
  allSays: string[];
  send: (ev: Record<string, unknown>) => {
    says: string[];
    arrows: { from: string; to: string; color?: string }[];
    choices: { action: string; title: string }[];
    botMoves: { from: string; to: string; promotion?: string }[];
    definitions: { title: string; html: string }[];
  };
  playPlayerMove: (sanOrUci: string) => ReturnType<Harness["send"]>;
  requestHint: () => ReturnType<Harness["send"]>;
  requestUndo: () => ReturnType<Harness["send"]>;
  defineTerm: (url: string) => ReturnType<Harness["send"]>;
}

/**
 * Boots the real deobfuscated Dr. Wolf bundle (`public/coach/coach-bundle.js`)
 * in a clean VM sandbox and pairs it with a real `chess.js` board and a
 * deterministic legal-move evaluator so we can test real multi-move games,
 * progressive hints, blunders, undos, and glossary definitions end-to-end.
 */
function createDrWolfHarness(options?: {
  playerColor?: "w" | "b";
  evalOverrides?: Record<string, { cp: number; pv: string[] }[]>;
  botMoveOverrides?: Record<string, string>;
}): Harness {
  const errors: string[] = [];
  const allSays: string[] = [];
  const ctx = vm.createContext({
    jsEnv: {} as Record<string, unknown>,
    console: {
      log() {},
      warn() {},
      error(...args: unknown[]) {
        errors.push(args.map(String).join(" "));
      },
    },
  });

  const bundleSource = fs.readFileSync(BUNDLE_PATH, "utf8");
  vm.runInContext(bundleSource, ctx, { filename: "coach-bundle.js" });

  const handleEvent = (
    ctx.jsEnv as { handleEvent: (ev: Record<string, unknown>) => CoachEventResponse }
  ).handleEvent;
  assert.equal(typeof handleEvent, "function", "bundle must expose jsEnv.handleEvent");

  const game = new Chess();
  let clock = 1700000000000;
  const nextWhen = () => (clock += 50);

  const fenKey = (fen: string) => fen.split(" ").slice(0, 2).join(" ");

  const defaultEvalForFen = (fen: string) => {
    const key = fenKey(fen);
    if (options?.evalOverrides?.[key]) return options.evalOverrides[key];
    const g = new Chess(fen);
    const legal = g.moves({ verbose: true });
    if (!legal.length) return [{ cp: 0, pv: [] }];
    const pick = legal[0];
    return [{ cp: 25, pv: [`${pick.from}${pick.to}${pick.promotion ?? ""}`] }];
  };

  const defaultBotMoveForFen = (fen: string) => {
    const key = fenKey(fen);
    if (options?.botMoveOverrides?.[key]) return options.botMoveOverrides[key];
    const g = new Chess(fen);
    const legal = g.moves({ verbose: true });
    assert.ok(legal.length > 0, `expected legal bot move for ${fen}`);
    const pick = legal[0];
    return `${pick.from}${pick.to}${pick.promotion ?? ""}`;
  };

  const send = (ev: Record<string, unknown>) => {
    const says: string[] = [];
    const arrows: { from: string; to: string; color?: string }[] = [];
    const choices: { action: string; title: string }[] = [];
    const botMoves: { from: string; to: string; promotion?: string }[] = [];
    const definitions: { title: string; html: string }[] = [];
    const acked = new Set<number>();

    const pump = (event: Record<string, unknown>) => {
      const res = handleEvent({ deviceVolume: 0.5, when: nextWhen(), ...event });
      const parsed = parseCoachActions(res);

      for (const m of parsed.messages) {
        says.push(m.html);
        allSays.push(m.plain);
      }
      for (const a of parsed.arrows) {
        arrows.push({ from: a.from, to: a.to, color: a.color });
      }
      if (parsed.choices) {
        for (const c of parsed.choices) choices.push({ action: c.action, title: c.title });
      }
      if (parsed.botMove) {
        botMoves.push(parsed.botMove);
      }
      if (parsed.definition) {
        definitions.push(parsed.definition);
      }

      // Acknowledge queued say actions and process any follow-up actions they release (e.g. queued bot moves).
      for (const act of res.play ?? []) {
        if (act.action === "say" && act.id != null && !acked.has(act.id)) {
          acked.add(act.id);
          pump({
            what: "finished_processing_phrase_translation",
            gameScreen: "PLAY",
            id: act.id,
            phraseWasTranslated: false,
          });
          pump({
            what: "finished_processing_phrase_speech",
            gameScreen: "PLAY",
            id: act.id,
          });
        }
      }

      // Fulfill every playChessEngine request Dr. Wolf emits.
      for (const req of parsed.engineRequests) {
        if (req.action === "analyze_position" && req.fen) {
          const evals = defaultEvalForFen(req.fen);
          pump(
            toCoachEngineResult(
              req.fen,
              { lines: evals.map((e, i) => ({ pv: e.pv, cp: e.cp, depth: 9, multiPv: i + 1 })) },
              req
            )
          );
        } else if (req.action === "fetch_bot_move" && req.fen) {
          const mv = defaultBotMoveForFen(req.fen);
          pump({
            what: "engine_result",
            gameScreen: "PLAY",
            fen: req.fen,
            komodo_level: null,
            komodo_depth: null,
            komodoElo: req.komodoElo ?? 500,
            botName: null,
            detailedResults: JSON.stringify({ move: mv }),
          });
        }
      }
    };

    pump(ev);
    return { says, arrows, choices, botMoves, definitions };
  };

  // Boot through initial onboarding into a live PLAY game.
  send({
    what: "character_init",
    currentDeviceId: "unit-test",
    legacyStateString: null,
    stateData: {},
    platform: "android",
    osMajorVersion: 30,
    buildConfig: "Release",
    remoteConfig: {},
    authenticationStatus: { authProviderIds: [], isEmailVerified: false },
    subscriptionStatus: {
      isSubscribed: true,
      isFreeTrialAvailable: false,
      periodType: "yearly",
      subscriptionDuration: "yearly",
      subscriptionStore: "google",
    },
    haveToShowLoginDialog: false,
    viewName: "GAME",
    isPhone: false,
    devicePreferredLocale: "en",
  });
  send({
    what: "choice_response",
    action: "firstLetsPlay",
    parameters: JSON.stringify({ analyticsId: "Play a game" }),
  });
  send({
    what: "choice_response",
    action: "beginner",
    parameters: JSON.stringify({ analyticsId: "Beginner" }),
  });
  if (options?.playerColor === "b") {
    send({
      what: "choice_response",
      action: "choice_black",
      parameters: JSON.stringify({ analyticsId: "Black" }),
    });
  }
  const initialRes = send({
    what: "user_interface_event",
    gameScreen: "PLAY",
    id: "first_game_started",
  });
  for (const bm of initialRes.botMoves) {
    const botFenBefore = game.fen();
    const playedBot = game.move(bm);
    assert.ok(playedBot, `Dr. Wolf emitted illegal opening bot move ${JSON.stringify(bm)}`);
    send({
      what: "move_made",
      gameScreen: "PLAY",
      from: playedBot.from,
      to: playedBot.to,
      promotion: playedBot.promotion ?? null,
      fenBeforeMove: botFenBefore,
    });
  }

  const playPlayerMove = (san: string) => {
    const fenBefore = game.fen();
    const move = game.move(san);
    assert.ok(move, `expected legal move ${san} from ${fenBefore}`);
    const res = send({
      what: "move_made",
      gameScreen: "PLAY",
      from: move.from,
      to: move.to,
      promotion: move.promotion ?? null,
      fenBeforeMove: fenBefore,
    });
    // If Dr. Wolf emitted a bot reply move, play it on the real board and notify Dr. Wolf.
    for (const bm of res.botMoves) {
      const botFenBefore = game.fen();
      const playedBot = game.move(bm);
      assert.ok(playedBot, `Dr. Wolf emitted illegal bot move ${JSON.stringify(bm)}`);
      const botRes = send({
        what: "move_made",
        gameScreen: "PLAY",
        from: playedBot.from,
        to: playedBot.to,
        promotion: playedBot.promotion ?? null,
        fenBeforeMove: botFenBefore,
      });
      res.says.push(...botRes.says);
      res.arrows.push(...botRes.arrows);
      res.choices.push(...botRes.choices);
    }
    return res;
  };

  return {
    game,
    errors,
    allSays,
    send,
    playPlayerMove,
    requestHint: () =>
      send({
        what: "user_interface_event",
        gameScreen: "PLAY",
        id: "tap_game_hint_button",
      }),
    requestUndo: () => {
      game.undo();
      if (game.turn() === "b") game.undo();
      return send({
        what: "user_interface_event",
        gameScreen: "PLAY",
        id: "tap_game_undo_button",
      });
    },
    defineTerm: (url: string) =>
      send({
        what: "link",
        gameScreen: "PLAY",
        url,
      }),
  };
}

test("deobfuscated Dr. Wolf bundle handles a real multi-move game with zero errors and unique dialogue per turn", () => {
  const h = createDrWolfHarness({
    evalOverrides: {
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w": [
        { cp: 30, pv: ["e2e4", "e7e5", "g1f3"] },
        { cp: 20, pv: ["d2d4", "d7d5"] },
      ],
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": [
        { cp: 30, pv: ["e7e5", "g1f3", "b8c6"] },
      ],
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": [
        { cp: 35, pv: ["g1f3", "b8c6", "f1c4"] },
      ],
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": [
        { cp: 30, pv: ["b8c6", "f1c4", "g8f6"] },
      ],
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w": [
        { cp: 35, pv: ["f1c4", "f8c5", "e1g1"] },
      ],
      "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b": [
        { cp: 30, pv: ["f8c5", "e1g1", "g8f6"] },
      ],
      "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w": [
        { cp: 35, pv: ["e1g1", "g8f6", "d2d3"] },
      ],
      "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b": [
        { cp: 30, pv: ["g8f6", "d2d3", "d7d6"] },
      ],
    },
    botMoveOverrides: {
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": "e7e5",
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": "b8c6",
      "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b": "f8c5",
      "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b": "g8f6",
    },
  });

  // Progressive 2-tap hint before Move 1
  const hint1 = h.requestHint();
  assert.ok(hint1.says.length >= 1, "first hint tap should speak");
  const hint2 = h.requestHint();
  assert.ok(hint2.says.length >= 1, "second hint tap should speak");
  assert.ok(hint2.arrows.length >= 1, "second hint tap should draw an arrow on the board");

  // Play 4 full moves (8 plies) on a real board
  const m1 = h.playPlayerMove("e4");
  assert.ok(m1.says.length >= 2, `move 1 should comment on White & Black moves, got: ${JSON.stringify(m1.says)}`);
  assert.equal(h.game.history().length, 2);

  const m2 = h.playPlayerMove("Nf3");
  assert.ok(m2.says.length >= 2, `move 2 should comment on White & Black moves, got: ${JSON.stringify(m2.says)}`);
  assert.notEqual(m2.says[0], m1.says[0], "coach dialogue must change across moves");
  assert.equal(h.game.history().length, 4);

  const m3 = h.playPlayerMove("Bc4");
  assert.ok(m3.says.length >= 1, "move 3 should speak");
  assert.equal(h.game.history().length, 6);

  const m4 = h.playPlayerMove("O-O");
  assert.ok(m4.says.length >= 1, "castling move 4 should speak");
  assert.equal(h.game.history().length, 8);

  assert.equal(h.errors.length, 0, `expected 0 errors from Dr. Wolf bundle, got: ${h.errors.join("; ")}`);
});

test("deobfuscated Dr. Wolf bundle detects blunders, responds to undo, and resolves glossary links", () => {
  const h = createDrWolfHarness({
    evalOverrides: {
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w": [{ cp: 30, pv: ["e2e4", "e7e5"] }],
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": [{ cp: 30, pv: ["e7e5", "g1f3"] }],
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": [{ cp: 35, pv: ["g1f3", "b8c6"] }],
      // After hanging bishop with 2. Ba6??
      "rnbqkbnr/pppp1ppp/B7/4p3/4P3/8/PPPP1PPP/RNBQK1NR b": [{ cp: -450, pv: ["b8a6", "g1f3"] }],
    },
    botMoveOverrides: {
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": "e7e5",
      "rnbqkbnr/pppp1ppp/B7/4p3/4P3/8/PPPP1PPP/RNBQK1NR b": "b8a6",
    },
  });

  h.playPlayerMove("e4");
  const blunder = h.playPlayerMove("Ba6");
  assert.ok(blunder.says.length >= 1, "Dr. Wolf should speak after a hanging-piece blunder");

  // Glossary term link resolution via Dr. Wolf's chessDefinitionsEnglish.js
  const def = h.defineTerm("coach://define?term=CENTER");
  assert.ok(def.definitions.length >= 1, "Dr. Wolf should resolve coach://define?term=CENTER");
  assert.ok(def.definitions[0].html.length > 10, "definition body should be non-empty");

  // Undo works cleanly and keeps the game playable afterward
  const undo = h.requestUndo();
  assert.ok(undo.says.length >= 1, "Dr. Wolf should acknowledge undo");
  const retry = h.playPlayerMove("Nf3");
  assert.ok(retry.says.length >= 1, "Dr. Wolf should continue speaking after undo + retry");
  assert.equal(h.errors.length, 0, `expected 0 errors, got: ${h.errors.join("; ")}`);
});

test("coachBridge parses define links, highlight square links, and strong tags", () => {
  const segs = parseLinkifiedText(
    'Watch <a href="coach://define?term=CENTER">center</a> and <a href="coach://highlight?square=f3">f3</a> after <strong>Nf3</strong>.'
  );
  assert.deepEqual(segs, [
    { kind: "text", text: "Watch " },
    { kind: "term", label: "center", url: "coach://define?term=CENTER" },
    { kind: "text", text: " and " },
    { kind: "square", label: "f3", square: "f3" },
    { kind: "text", text: " after " },
    { kind: "strong", text: "Nf3" },
    { kind: "text", text: "." },
  ]);
});

test("explain.ts and analysisFeedback.ts detect tactical motifs and generate editorial human prose", () => {
  // Pin: White Bg5 pinning Black knight on f6 to Black queen on d8
  const pinFen = "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  const gPin = new Chess(pinFen);
  gPin.move("d3");
  gPin.move("Be7");
  const pinDesc = describeMove(gPin.fen(), "c1g5");
  assert.ok(pinDesc.tags.includes("pin") || pinDesc.tags.includes("develop"), `expected motif tag, got ${pinDesc.tags}`);

  // Book move editorial commentary
  const start = new Chess();
  const m = start.move("e4");
  const bookNote = buildAnalysisFeedback(
    {
      lastMove: m,
      eval: {
        moveClassification: MoveClassification.Opening,
        opening: "Sicilian Defense",
        lines: [{ pv: ["c7c5"], cp: 30, depth: 12, multiPv: 1 }],
      },
    },
    1
  );
  assert.ok(bookNote?.sentence.includes("central push") || bookNote?.sentence.includes("Sicilian"));
  assert.equal(bookNote?.motifLabel, "Book Theory");
});

test("deobfuscated Dr. Wolf bundle plays White move 1 and coaches Black cleanly when bot has White", () => {
  const h = createDrWolfHarness({
    playerColor: "b",
    evalOverrides: {
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w": [
        { cp: 30, pv: ["e2e4", "e7e5", "g1f3"] },
      ],
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": [
        { cp: 30, pv: ["e7e5", "g1f3", "b8c6"] },
      ],
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": [
        { cp: 35, pv: ["g1f3", "b8c6", "f1c4"] },
      ],
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": [
        { cp: 30, pv: ["b8c6", "f1c4", "g8f6"] },
      ],
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w": [
        { cp: 35, pv: ["f1c4", "f8c5", "e1g1"] },
      ],
    },
    botMoveOverrides: {
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w": "e2e4",
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": "g1f3",
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w": "f1c4",
    },
  });

  // Bot (White) should have already played an opening move on game start!
  assert.equal(h.game.history().length, 1, "White bot should play opening move 1");
  assert.equal(h.game.turn(), "b");

  // Player (Black) replies with a legal move -> White bot replies on ply 3
  const blackReply1 = h.game.moves().includes("e5") ? "e5" : h.game.moves()[0];
  const m1 = h.playPlayerMove(blackReply1);
  assert.equal(h.game.history().length, 3, "White bot should reply on ply 3");
  assert.equal(h.game.turn(), "b");
  assert.ok(m1.says.length >= 1, "Dr. Wolf should speak when coaching Black");

  // Player (Black) replies again -> White bot replies on ply 5
  const blackReply2 = h.game.moves().includes("Nc6") ? "Nc6" : h.game.moves()[0];
  const m2 = h.playPlayerMove(blackReply2);
  assert.equal(h.game.history().length, 5, "White bot should reply on ply 5");
  assert.equal(h.game.turn(), "b");
  assert.ok(m2.says.length >= 1);
  assert.equal(h.errors.length, 0, `expected 0 errors, got: ${h.errors.join("; ")}`);
});
