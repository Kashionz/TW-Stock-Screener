import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDrawerSectionUi,
  buildPagerWindow,
  buildFinancialTable,
  buildDrawerMeta,
  getQuickStats,
  resetDrawerScrollPosition,
  summarizeDrawerNote,
} from "../assets/app/ui.js";

function fakeToggleElement(datasetKey, value) {
  const classes = new Set();
  return {
    dataset: { [datasetKey]: value },
    hidden: false,
    attributes: {},
    classList: {
      add: (...names) => {
        for (const name of names) classes.add(name);
      },
      remove: (...names) => {
        for (const name of names) classes.delete(name);
      },
      toggle: (name, force) => {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
    },
    setAttribute(name, nextValue) {
      this.attributes[name] = String(nextValue);
    },
  };
}

test("getQuickStats keeps the overview cards to the four primary metrics", () => {
  const stats = getQuickStats({
    yoy: 41.2,
    ytdYoy: 18.6,
    gm: 54.3,
    eps: 7.25,
  });

  assert.deepEqual(
    stats.map(([label]) => label),
    ["月營收YoY", "累計YoY", "毛利率", "EPS(季)"],
  );
});

test("buildPagerWindow keeps the visible page buttons capped at three", () => {
  assert.deepEqual(buildPagerWindow(1, 9), [1, 2, 3]);
  assert.deepEqual(buildPagerWindow(2, 9), [1, 2, 3]);
  assert.deepEqual(buildPagerWindow(3, 9), [2, 3, 4]);
  assert.deepEqual(buildPagerWindow(8, 9), [7, 8, 9]);
  assert.deepEqual(buildPagerWindow(9, 9), [7, 8, 9]);
});

test("buildFinancialTable marks the unsupported-state row for centered layout", () => {
  const html = buildFinancialTable({ fin: null });

  assert.equal(html.includes("financial-empty"), true);
  assert.equal(html.includes("損益表欄位不適用"), true);
});

test("summarizeDrawerNote collapses whitespace and truncates long notes", () => {
  assert.equal(summarizeDrawerNote("  HBM   報價   上修  "), "HBM 報價 上修");
  const summary = summarizeDrawerNote(
    "法說提到 HBM 供不應求，先進封裝產能持續吃緊，第三季仍看上修。",
    18,
  );

  assert.equal(summary.endsWith("…"), true);
  assert.equal(summary.includes("HBM"), true);
  assert.equal(summary.length <= 18, true);
});

test("buildDrawerMeta combines industry with the saved note summary", () => {
  const meta = buildDrawerMeta(
    { ind: "半導體業" },
    "法說提到 HBM 供不應求，先進封裝產能持續吃緊，第三季仍看上修。",
  );

  assert.equal(meta.startsWith("半導體業 ｜ "), true);
  assert.equal(meta.includes("HBM"), true);
  assert.equal(meta.endsWith("…"), true);
  assert.equal(buildDrawerMeta({ ind: "航運業" }, ""), "航運業");
});

test("applyDrawerSectionUi activates only the requested tab and panel", () => {
  const overviewTab = fakeToggleElement("section", "overview");
  const notesTab = fakeToggleElement("section", "notes");
  const overviewPanel = fakeToggleElement("panel", "overview");
  const notesPanel = fakeToggleElement("panel", "notes");

  applyDrawerSectionUi(
    {
      dTabButtons: [overviewTab, notesTab],
      dPanels: [overviewPanel, notesPanel],
    },
    "notes",
  );

  assert.equal(overviewTab.classList.contains("on"), false);
  assert.equal(notesTab.classList.contains("on"), true);
  assert.equal(overviewTab.attributes["aria-selected"], "false");
  assert.equal(notesTab.attributes["aria-selected"], "true");
  assert.equal(overviewTab.attributes.tabindex, "-1");
  assert.equal(notesTab.attributes.tabindex, "0");
  assert.equal(overviewPanel.hidden, true);
  assert.equal(notesPanel.hidden, false);
});

test("resetDrawerScrollPosition rewinds the drawer content before rendering another section", () => {
  const dom = {
    drawerScroll: {
      scrollTop: 248,
    },
  };

  resetDrawerScrollPosition(dom);

  assert.equal(dom.drawerScroll.scrollTop, 0);
  assert.doesNotThrow(() => resetDrawerScrollPosition({}));
});
