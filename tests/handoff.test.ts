import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { HANDOFF_EVENT, setHandoff, takeHandoff } from "@/lib/handoff";

const original = Object.getOwnPropertyDescriptor(globalThis, "window");
const values = new Map<string, string>();
const events = new EventTarget();
const mock = Object.assign(events, {
  location: { pathname: "/analysis" },
  sessionStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  },
});
Object.defineProperty(globalThis, "window", {
  value: mock,
  configurable: true,
});
after(() => {
  if (original) Object.defineProperty(globalThis, "window", original);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("destination-owned handoffs", () => {
  it("a synchronous source listener cannot consume a board intended for the editor", () => {
    mock.location.pathname = "/analysis";
    let consumed = false;
    const listener = () => {
      consumed = !!takeHandoff("fen");
    };
    mock.addEventListener(HANDOFF_EVENT, listener);
    const fen = "4k3/8/8/8/8/8/1R6/4K3 b - - 0 42";
    setHandoff({ kind: "fen", fen }, "/editor");
    assert.equal(consumed, false);
    mock.removeEventListener(HANDOFF_EVENT, listener);
    mock.location.pathname = "/editor";
    assert.equal(takeHandoff("fen")?.fen, fen);
    assert.equal(takeHandoff("fen"), undefined);
  });

  it("editor-to-arena and analysis-to-play paths preserve the requested position", () => {
    for (const destination of ["/arena", "/play"]) {
      mock.location.pathname = "/editor";
      setHandoff({ kind: "fen", fen: "requested position" }, destination);
      assert.equal(takeHandoff("fen"), undefined);
      mock.location.pathname = destination;
      assert.equal(takeHandoff("fen")?.fen, "requested position");
    }
  });

  it("mismatched kinds do not discard a correctly targeted PGN", () => {
    mock.location.pathname = "/analysis";
    setHandoff({ kind: "pgn", pgn: "1. e4 c5 *" }, "/analysis");
    assert.equal(takeHandoff("fen"), undefined);
    assert.equal(takeHandoff("pgn")?.pgn, "1. e4 c5 *");
  });
});
