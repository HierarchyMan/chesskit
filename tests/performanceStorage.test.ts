import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { it } from "node:test";
import { openDB } from "idb";
import { Chess } from "chess.js";
import { newAnalysisSession } from "@/lib/analysisSession";
import {
  addGameRecord,
  gameSummary,
  getGameDatabase,
  listAnalysisSessionSummaries,
  saveAnalysisSession,
} from "@/lib/gameDatabase";
import { formatGameToDatabase } from "@/lib/chess";

it("projects an existing v2 library without rewriting full game/session data and updates summaries atomically", async () => {
  const old = await openDB("games", 2, {
    upgrade(db) {
      db.createObjectStore("games", { keyPath: "id", autoIncrement: true });
      db.createObjectStore("analysisSessions", { keyPath: "id" });
    },
  });
  const chess = new Chess();
  chess.move("e4");
  chess.setComment("Keep this comment");
  const record = { ...formatGameToDatabase(chess), id: 40 };
  const session = newAnalysisSession(chess, 40);
  await old.put("games", record);
  await old.put("analysisSessions", session);
  old.close();
  const db = await getGameDatabase();
  assert.equal(db.version, 7);
  assert.deepEqual(await db.get("games", 40), record);
  assert.deepEqual(await db.get("analysisSessions", session.id), session);
  assert.deepEqual(await db.get("gameSummaries", 40), gameSummary(record));
  let summaryReads = 0;
  const original = IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll = function (
    ...args: Parameters<IDBObjectStore["getAll"]>
  ) {
    if (this.name === "analysisSessionSummaries") summaryReads++;
    return original.apply(this, args);
  };
  try {
    await listAnalysisSessionSummaries();
    for (const title of ["A", "AB", "ABC"]) {
      await saveAnalysisSession({ ...session, title });
      const rows = await listAnalysisSessionSummaries();
      assert.equal(rows[0].title, title);
    }
    assert.equal(
      summaryReads,
      1,
      "rename keystrokes update cached metadata without rereading the library"
    );
  } finally {
    IDBObjectStore.prototype.getAll = original;
  }
  const before = (await db.getAll("games")).length;
  assert.deepEqual(
    await db.get("analysisSessionArchives", session.id),
    session,
    "the first compact save archives the exact legacy record"
  );
  await assert.rejects(
    addGameRecord(db, {
      ...record,
      pgn: (() => "uncloneable") as unknown as string,
    })
  );
  assert.equal((await db.getAll("games")).length, before);
  assert.equal((await db.getAll("gameSummaries")).length, before);
  const id = await addGameRecord(db, formatGameToDatabase(chess));
  assert.equal(id, 41);
  assert.deepEqual(
    await db.get("gameSummaries", id),
    gameSummary({ ...formatGameToDatabase(chess), id })
  );
});
