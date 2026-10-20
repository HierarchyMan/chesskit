import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Arrow } from "react-chessboard/dist/chessboard/types";
import { uniqueArrows } from "@/lib/arrows";

describe("uniqueArrows", () => {
  it("keeps the first of two arrows between the same squares", () => {
    const arrows: Arrow[] = [
      ["e1", "f3", "red"],
      ["f3", "d4", "red"],
      ["e1", "f3", "green"],
    ];

    assert.deepEqual(uniqueArrows(arrows), [
      ["e1", "f3", "red"],
      ["f3", "d4", "red"],
    ]);
  });

  it("treats opposite directions as different arrows", () => {
    const arrows: Arrow[] = [
      ["e2", "e4"],
      ["e4", "e2"],
    ];

    assert.equal(uniqueArrows(arrows).length, 2);
  });

  it("leaves an empty list alone", () => {
    assert.deepEqual(uniqueArrows([]), []);
  });
});
