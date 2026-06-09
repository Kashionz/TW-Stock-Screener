import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DRAWER_SECTION,
  clearCurrentRow,
  createAppState,
  setCurrentCode,
  setDrawerSection,
} from "../assets/app/state.js";

function installLocalStorage(t) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
  t.after(() => {
    delete globalThis.localStorage;
  });
}

const snapshot = {
  meta: {
    r12ym: [],
    incQuarter: ["115", "1"],
  },
  rows: [
    {
      code: "2330",
      name: "台積電",
      ind: "半導體業",
    },
  ],
};

test("createAppState starts the drawer in overview mode", (t) => {
  installLocalStorage(t);
  const state = createAppState(snapshot);

  assert.equal(state.drawerSection, DEFAULT_DRAWER_SECTION);
});

test("setDrawerSection normalizes invalid values and clearCurrentRow resets to overview", (t) => {
  installLocalStorage(t);
  const state = createAppState(snapshot);

  setCurrentCode(state, "2330");
  assert.equal(setDrawerSection(state, "notes"), "notes");
  assert.equal(setDrawerSection(state, "not-a-real-section"), DEFAULT_DRAWER_SECTION);

  setDrawerSection(state, "financials");
  clearCurrentRow(state);

  assert.equal(state.currentCode, null);
  assert.equal(state.currentRow, null);
  assert.equal(state.drawerSection, DEFAULT_DRAWER_SECTION);
});
