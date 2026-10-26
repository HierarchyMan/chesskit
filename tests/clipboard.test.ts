import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { copyToClipboard } from "../src/lib/clipboard";

const globals = globalThis as Record<string, unknown>;
const original = { navigator: globals.navigator, document: globals.document };
globals.HTMLElement ??= class {};

const stubDocument = (copyResult: boolean | Error) => {
  const calls: string[] = [];
  const field = {
    value: "",
    style: {},
    setAttribute: () => undefined,
    select: () => calls.push(`select:${field.value}`),
    remove: () => calls.push("remove"),
  };
  globals.document = {
    activeElement: null,
    body: { appendChild: () => undefined },
    createElement: () => field,
    execCommand: () => {
      if (copyResult instanceof Error) throw copyResult;
      return copyResult;
    },
  };
  return calls;
};

const stubClipboard = (writeText?: (text: string) => Promise<void>) => {
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: writeText ? { writeText } : undefined },
    configurable: true,
  });
};

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: original.navigator,
    configurable: true,
  });
  globals.document = original.document;
});

test("uses the async clipboard API when it works", async () => {
  const written: string[] = [];
  stubClipboard(async (text) => void written.push(text));
  stubDocument(false);
  assert.equal(await copyToClipboard("1. e4"), true);
  assert.deepEqual(written, ["1. e4"]);
});

test("falls back to selection copy when the async API is denied", async () => {
  stubClipboard(async () => {
    throw new Error("Write permission denied");
  });
  const calls = stubDocument(true);
  assert.equal(await copyToClipboard("1. e4"), true);
  assert.deepEqual(calls, ["select:1. e4", "remove"]);
});

test("falls back when the async API is missing", async () => {
  stubClipboard();
  stubDocument(true);
  assert.equal(await copyToClipboard("1. e4"), true);
});

test("reports failure when every route is refused", async () => {
  stubClipboard(async () => {
    throw new Error("denied");
  });
  stubDocument(new Error("blocked"));
  assert.equal(await copyToClipboard("1. e4"), false);
});
