import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitBoardWorkspace } from "@/lib/boardWorkspace";

describe("board workspace fit", () => {
  it("fits the square, real chrome, gutter and inspector into a laptop workspace", () => {
    const bounds = {
      width: 1000,
      height: 640,
      inspectorMinWidth: 380,
      chromeHeight: 144,
      gutterWidth: 48,
    };
    const fit = fitBoardWorkspace(bounds);
    assert.equal(fit.sideBySide, true);
    assert.equal(fit.boardWidth + 20 + fit.inspectorWidth, bounds.width);
    assert.ok(
      fit.boardWidth - bounds.gutterWidth + bounds.chromeHeight <= bounds.height
    );
    assert.ok(fit.boardWidth - bounds.gutterWidth >= 300);
  });

  it("chooses readable stacked flow when a side-by-side stage cannot fit", () => {
    for (const bounds of [
      { width: 390, height: 760 },
      { width: 720, height: 260 },
      { width: 270, height: 600 },
    ]) {
      const fit = fitBoardWorkspace({
        ...bounds,
        inspectorMinWidth: 380,
        chromeHeight: 144,
        gutterWidth: 48,
      });
      assert.equal(fit.sideBySide, false);
      assert.ok(fit.boardWidth <= bounds.width);
      assert.ok(fit.boardWidth > 0);
    }
  });
  it("keeps the height-fitted board size and gives all extra width to the inspector", () => {
    const shared = {
      height: 640,
      inspectorMinWidth: 380,
      chromeHeight: 144,
      gutterWidth: 48,
    };
    const compact = fitBoardWorkspace({ ...shared, width: 1000 });
    const wide = fitBoardWorkspace({ ...shared, width: 1700 });
    assert.equal(compact.boardWidth, wide.boardWidth);
    assert.equal(wide.inspectorWidth - compact.inspectorWidth, 700);
    assert.equal(wide.boardWidth + 20 + wide.inspectorWidth, 1700);
  });
  it("keeps a wide short window bounded instead of stacking its inspector below the board", () => {
    const fit = fitBoardWorkspace({
      width: 1013,
      height: 399,
      inspectorMinWidth: 380,
      chromeHeight: 156,
      gutterWidth: 48,
    });
    assert.equal(fit.sideBySide, true);
    assert.equal(fit.boardWidth, 291);
    assert.equal(fit.inspectorWidth, 702);
  });
  it("stacks portrait windows even when there is enough width for two columns", () => {
    for (const viewport of [
      { width: 948, height: 1026 },
      { width: 1024, height: 1366 },
    ]) {
      const fit = fitBoardWorkspace({
        width: viewport.width - 72,
        height: viewport.height - 64,
        portrait: viewport.height > viewport.width,
        inspectorMinWidth: 380,
        chromeHeight: 156,
        gutterWidth: 48,
      });
      assert.equal(fit.sideBySide, false);
      assert.equal(fit.boardWidth, viewport.width - 72);
      assert.equal(fit.inspectorWidth, fit.boardWidth);
    }
  });
  it("uses viewport orientation rather than the shape left by navigation and chrome", () => {
    const bounds = {
      width: 830,
      height: 840,
      inspectorMinWidth: 380,
      chromeHeight: 156,
      gutterWidth: 48,
    };
    assert.equal(fitBoardWorkspace({ ...bounds, portrait: false }).sideBySide, true);
    assert.equal(fitBoardWorkspace({ ...bounds, portrait: true }).sideBySide, false);
  });
  it("lets stacked boards use their width and scroll past the viewport height", () => {
    const fit = fitBoardWorkspace({
      width: 900,
      height: 800,
      portrait: true,
      inspectorMinWidth: 380,
      chromeHeight: 156,
      gutterWidth: 48,
    });
    assert.equal(fit.boardWidth, 900);
    assert.ok(fit.boardWidth - 48 + 156 > 800);
  });
});
