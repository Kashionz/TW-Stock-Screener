import assert from "node:assert/strict";
import test from "node:test";

import { createRefreshFlow } from "../assets/app/refresh-flow.js";

function fakeUi() {
  const calls = { render: 0, resetDrawer: 0, openDrawer: [] };
  return {
    calls,
    resetDrawer: () => {
      calls.resetDrawer += 1;
    },
    syncSnapshotMeta: () => {},
    renderIndustryOptions: () => {},
    render: () => {
      calls.render += 1;
    },
    openDrawer: (code) => {
      calls.openDrawer.push(code);
    },
    setRefreshStatus: () => {},
    updateRefreshControls: () => {},
  };
}

function liveRuntime() {
  return {
    hasLiveApi: true,
    snapshotUrl: "https://x.test/api/snapshot",
    refreshUrl: "https://x.test/api/refresh",
  };
}

function fullSnapshot(meta) {
  return {
    meta: { r12ym: [], incQuarter: ["115", "1"], ...meta },
    rows: [{ code: "2330", name: "台積電", ind: "半導體業", yoy: 31 }],
  };
}

test("hydrateLatestSnapshot sends If-None-Match and treats 304 as already-current", async (t) => {
  const state = { snapshotEtag: '"seed-etag"', rows: [], page: 1 };
  const ui = fakeUi();
  const flow = createRefreshFlow({ state, ui, runtime: liveRuntime() });

  let capturedInit = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    capturedInit = init;
    return new Response(null, { status: 304, headers: { etag: '"seed-etag"' } });
  };
  t.after(() => {
    globalThis.fetch = realFetch;
  });

  const result = await flow.hydrateLatestSnapshot();

  assert.equal(result, true);
  assert.equal(capturedInit.headers["if-none-match"], '"seed-etag"');
  assert.equal(ui.calls.render, 0);
  assert.equal(state.snapshotEtag, '"seed-etag"');
});

test("hydrateLatestSnapshot applies the body and updates the etag on 200", async (t) => {
  const state = { snapshotEtag: '"old"', rows: [], page: 3 };
  const ui = fakeUi();
  const flow = createRefreshFlow({ state, ui, runtime: liveRuntime() });

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(fullSnapshot({ revPeriodROC: "11505" })), {
      status: 200,
      headers: { "content-type": "application/json", etag: '"fresh"' },
    });
  t.after(() => {
    globalThis.fetch = realFetch;
  });

  const result = await flow.hydrateLatestSnapshot();

  assert.equal(result, true);
  assert.equal(state.snapshotEtag, '"fresh"');
  assert.equal(state.rows.length, 1);
  assert.equal(ui.calls.render, 1);
  assert.equal(state.page, 1);
});
