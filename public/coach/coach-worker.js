/* Classic Web Worker hosting the standalone ChessCoach (Dr. Wolf) JS bundle. */
/* eslint-disable no-undef */
self.jsEnv = {};

let loaded = false;
let ready = false;
let clock = Date.now();

function nextWhen() {
  clock = Math.max(Date.now(), clock + 15);
  return clock;
}

function mergeResponses(target, next) {
  if (!next) return target;
  if (Array.isArray(next.play)) target.play.push(...next.play);
  if (Array.isArray(next.playChessEngine)) {
    target.playChessEngine.push(...next.playChessEngine);
  }
  if (Array.isArray(next.global)) target.global.push(...next.global);
  return target;
}

function sendRaw(event) {
  const combined = { play: [], playChessEngine: [], global: [] };
  if (!loaded || typeof self.jsEnv.handleEvent !== "function") {
    return combined;
  }

  const first = self.jsEnv.handleEvent({
    deviceVolume: 0.5,
    when: nextWhen(),
    ...event,
  });
  mergeResponses(combined, first);

  // Acknowledge every queued say action and capture any follow-up actions (like queued bot moves!)
  // emitted when speech completes.
  const acked = new Set();
  let scanIdx = 0;
  while (scanIdx < combined.play.length) {
    const act = combined.play[scanIdx++];
    if (act && act.action === "say" && act.id != null && !acked.has(act.id)) {
      acked.add(act.id);
      const tRes = self.jsEnv.handleEvent({
        deviceVolume: 0.5,
        when: nextWhen(),
        what: "finished_processing_phrase_translation",
        gameScreen: "PLAY",
        id: act.id,
        phraseWasTranslated: false,
      });
      mergeResponses(combined, tRes);

      const sRes = self.jsEnv.handleEvent({
        deviceVolume: 0.5,
        when: nextWhen(),
        what: "finished_processing_phrase_speech",
        gameScreen: "PLAY",
        id: act.id,
      });
      mergeResponses(combined, sRes);
    }
  }
  return combined;
}

function initEngine(playerColor) {
  if (!loaded) {
    importScripts("/coach/coach-bundle.js");
    loaded = true;
  }
  sendRaw({
    what: "character_init",
    currentDeviceId: "chesskit-web-coach",
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
  sendRaw({
    what: "choice_response",
    action: "firstLetsPlay",
    parameters: JSON.stringify({ analyticsId: "Play a game" }),
  });
  sendRaw({
    what: "choice_response",
    action: "beginner",
    parameters: JSON.stringify({ analyticsId: "Beginner" }),
  });

  // Start the game (if player chose Black, switch color via new-game event if available).
  const startRes = sendRaw({
    what: "user_interface_event",
    gameScreen: "PLAY",
    id: "first_game_started",
  });

  // Arm blunder warn-and-wait immediately so Dr. Wolf intervenes on early blunders too.
  try {
    const app = self.jsEnv.getAppController && self.jsEnv.getAppController();
    if (app && app.playScreenController) {
      // Allow immediate blunder intervention.
      const ds = app.dataStore || null;
      if (ds && ds.localData) {
        ds.localData.movesSinceMistakeWarning = 25;
        ds.localData.movesSinceLastFlipRequest = 25;
      }
    }
  } catch {
    // ignore optional internals
  }

  ready = true;
  return startRes;
}

self.onmessage = function (e) {
  const msg = e.data || {};
  const id = msg.id;
  try {
    if (msg.type === "init") {
      const res = initEngine(msg.playerColor || "w");
      self.postMessage({ id, ok: true, res });
      return;
    }
    if (!ready) {
      initEngine("w");
    }
    if (msg.type === "event") {
      const res = sendRaw(msg.event);
      self.postMessage({ id, ok: true, res });
      return;
    }
    self.postMessage({ id, ok: false, error: "Unknown command: " + msg.type });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  }
};
