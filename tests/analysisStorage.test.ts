import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDB } from "idb";
import { Chess } from "chess.js";
import {
  newAnalysisSession,
  captureAnalysisBoard,
  clearAnalysisBranches,
  copyAnalysisSession,
} from "@/lib/analysisSession";
import {
  getGameDatabase,
  listAnalysisSessions,
  listAnalysisSessionSummaries,
  saveAnalysisSession,
} from "@/lib/gameDatabase";
import { formatGameToDatabase } from "@/lib/chess";

describe("analysis durable storage", () => {
  it("migrates a real v1 schema additively and preserves existing game IDs, PGN and metadata", async () => {
    const old = await openDB("games", 1, {
      upgrade(db) {
        db.createObjectStore("games", { keyPath: "id", autoIncrement: true });
      },
    });
    const game = new Chess();
    game.move("e4");
    game.setHeader("Event", "Existing game");
    const record = { ...formatGameToDatabase(game), id: 9 };
    await old.put("games", record);
    old.close();
    const db = await getGameDatabase();
    assert.equal(db.version, 4);
    assert.deepEqual(await db.get("gameSummaries", 9), { ...Object.fromEntries(Object.entries(record).filter(([key]) => key !== "pgn")), hasEvaluation: false });
    assert.ok(db.objectStoreNames.contains("analysisSessionSummaries"));
    assert.deepEqual(await db.get("games", 9), record);
    assert.ok(db.objectStoreNames.contains("analysisSessions"));
    assert.equal((await db.getAll("games")).length, 1);
  });

  it("serializes successive snapshots and reopens exact paths/cursors rather than appending duplicates", async () => {
    const original = new Chess();
    original.move("e4");
    original.move("e5");
    const first = newAnalysisSession(original, 9);
    const branch = new Chess();
    branch.move("e4");
    branch.move("c5");
    const second = captureAnalysisBoard(first, branch, true);
    await Promise.all([
      saveAnalysisSession(first),
      saveAnalysisSession(second),
    ]);
    const db = await getGameDatabase();
    assert.deepEqual(await db.get("analysisSessions", first.id), {
      ...second,
      revision: 2,
    });
    assert.equal((await listAnalysisSessions()).length, 1);
    const summaries = await listAnalysisSessionSummaries();
    assert.deepEqual(summaries[0], { id: second.id, title: second.title, updatedAt: second.updatedAt, branchCount: second.branches.length });
    assert.equal("main" in summaries[0], false);
    assert.equal((await db.get("games", 9))?.event, "Existing game");
    await saveAnalysisSession(clearAnalysisBranches(second));
    const cleared = await db.get("analysisSessions", first.id);
    assert.equal(cleared?.branches.length, 0);
    assert.equal(cleared?.main.pgn, original.pgn());
  });

  it("a failed storage transaction does not poison subsequent saves or erase the prior session", async () => {
    const valid = newAnalysisSession();
    await saveAnalysisSession(valid);
    const invalid = {
      ...valid,
      title: (() => "not cloneable") as unknown as string,
    };
    await assert.rejects(saveAnalysisSession(invalid));
    assert.deepEqual(
      await (await getGameDatabase()).get("analysisSessions", valid.id),
      { ...valid, revision: 1 }
    );
    const recovered = { ...valid, title: "Recovered after failure" };
    await saveAnalysisSession(recovered);
    assert.equal(
      (await (await getGameDatabase()).get("analysisSessions", valid.id))
        ?.title,
      recovered.title
    );
  });
  it("refuses a stale cross-tab overwrite and preserves both versions via a new session", async () => {
    const first = newAnalysisSession();
    await saveAnalysisSession(first);
    const db = await getGameDatabase();
    const elsewhere = { ...first, title: "Work from another tab", revision: 2 };
    await db.put("analysisSessions", elsewhere);
    await assert.rejects(
      saveAnalysisSession({ ...first, title: "My pending work" }),
      /another tab/
    );
    assert.equal(
      (await db.get("analysisSessions", first.id))?.title,
      elsewhere.title
    );
    const recovered = {
      ...copyAnalysisSession({ ...first, revision: 17 }),
      title: "My recovered work",
    };
    await saveAnalysisSession(recovered);
    assert.equal(
      (await db.get("analysisSessions", recovered.id))?.title,
      recovered.title
    );
    assert.equal(
      (await db.get("analysisSessions", first.id))?.title,
      elsewhere.title
    );
  });
});
