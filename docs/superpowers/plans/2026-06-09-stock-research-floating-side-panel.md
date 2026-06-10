# Stock Research Floating Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把桌機個股研究抽屜改成右側全高浮動側邊面板，讓研究清單維持滿寬背景，同時以 `總覽 / 圖表 / 財報 / 筆記` 分段提升閱讀效率。

**Architecture:** 保留 `ui.openDrawer(code)` 作為單一開啟入口，在 `state.js` 新增 `drawerSection` 追蹤目前段落，`ui.js` 負責摘要資料與段落顯示切換。桌機版以 `position: fixed` 面板搭配淡化遮罩覆蓋在研究清單上，平板/手機繼續沿用既有右側抽屜，不更動資料來源、排序、篩選或快照格式。

**Tech Stack:** `index.html` 內嵌 CSS、Vanilla JS ESM (`assets/app/*.js`)、Chart.js、`node:test`、既有 `check-*.mjs` 靜態前端檢查。

---

## File Structure

### Create

- `tests/state.test.mjs`
  - 驗證 `drawerSection` 預設值、合法/非法切換、清空選取後是否回到 `overview`。
- `tests/drawer-ui.test.mjs`
  - 驗證快速判讀卡只保留 4 個主指標，並驗證段籤/段落切換的 class 與 `hidden` 狀態。
- `check-floating-panel-layout.mjs`
  - 驗證浮動面板 HTML/CSS 標記存在，避免回歸成頁面底部靜態區塊。

### Modify

- `assets/app/state.js`
  - 新增 `DEFAULT_DRAWER_SECTION`、`setDrawerSection()`，並讓 `clearCurrentRow()` 回到 `overview`。
- `assets/app/ui.js`
  - 新增 `getQuickStats()`、`applyDrawerSectionUi()`、`renderDrawerSection()`，把面板內容改成分段顯示；桌機打開時啟用淡化 overlay。
- `assets/app/main.js`
  - 綁定段籤 click 事件，維持桌機自動選取第一筆，但切換股票時一律回到 `總覽`。
- `tests/refresh-flow.test.mjs`
  - 驗證快照更新後會重開原本選取的股票，不會丟失頁碼。
- `index.html`
  - 把個股面板改成固定浮動版型，加入段籤、分段內容容器與桌機/行動裝置 CSS。
- `package.json`
  - 把 `check-floating-panel-layout.mjs` 納入 `check:ui`。

## Task 1: 建立面板段落狀態基礎

**Files:**
- Create: `tests/state.test.mjs`
- Modify: `assets/app/state.js`

- [ ] **Step 1: 先寫 `drawerSection` 的失敗測試**

```js
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
```

- [ ] **Step 2: 跑測試確認目前會失敗**

Run: `node --test tests/state.test.mjs`

Expected: FAIL，因為 `assets/app/state.js` 尚未匯出 `DEFAULT_DRAWER_SECTION` 與 `setDrawerSection`，`state.drawerSection` 也尚不存在。

- [ ] **Step 3: 以最小修改補上面板段落 state**

```js
// assets/app/state.js
export const DRAWER_SECTIONS = ["overview", "charts", "financials", "notes"];
export const DEFAULT_DRAWER_SECTION = DRAWER_SECTIONS[0];

export function createAppState(initialSnapshot) {
  const state = {
    snapshot: initialSnapshot,
    rows: [],
    r12ym: [],
    incLabel: "",
    store: loadStore(),
    refreshKey: loadRefreshKey(),
    snapshotEtag: null,
    refreshBusy: false,
    view: "all",
    sortKey: "score",
    sortDir: -1,
    page: 1,
    currentCode: null,
    currentRow: null,
    epsMode: "S",
    drawerSection: DEFAULT_DRAWER_SECTION,
  };

  applySnapshot(state, initialSnapshot);
  return state;
}

export function setDrawerSection(state, section) {
  state.drawerSection = DRAWER_SECTIONS.includes(section) ? section : DEFAULT_DRAWER_SECTION;
  return state.drawerSection;
}

export function clearCurrentRow(state) {
  state.currentCode = null;
  state.currentRow = null;
  state.drawerSection = DEFAULT_DRAWER_SECTION;
}
```

- [ ] **Step 4: 重新跑測試確認通過**

Run: `node --test tests/state.test.mjs`

Expected: PASS，2 個測試全過。

- [ ] **Step 5: 建立第一個基礎 commit**

```bash
git add tests/state.test.mjs assets/app/state.js
git commit -m "refactor: track drawer section state" -m "Add explicit drawer section state so the stock panel can reset to overview when selection changes without coupling that behavior to DOM code."
```

## Task 2: 建立桌機浮動面板版型與靜態檢查

**Files:**
- Create: `check-floating-panel-layout.mjs`
- Modify: `index.html`
- Modify: `package.json`

- [ ] **Step 1: 先寫桌機浮動面板的失敗檢查**

```js
import { readIndexHtml } from "./check-frontend-source.mjs";

const html = readIndexHtml();

const requiredMarkers = [
  {
    label: "desktop floating width",
    ok: /width:clamp\(340px,\s*36vw,\s*420px\)/.test(html),
  },
  {
    label: "drawer tabs",
    ok: html.includes('class="drawer-tabs"') && html.includes('id="dTabs"'),
  },
  {
    label: "overview tab and panel",
    ok: html.includes('data-section="overview"') && html.includes('data-panel="overview"'),
  },
  {
    label: "charts tab and panel",
    ok: html.includes('data-section="charts"') && html.includes('data-panel="charts"'),
  },
  {
    label: "financials tab and panel",
    ok: html.includes('data-section="financials"') && html.includes('data-panel="financials"'),
  },
  {
    label: "notes tab and panel",
    ok: html.includes('data-section="notes"') && html.includes('data-panel="notes"'),
  },
  {
    label: "overview content slot",
    ok: html.includes('id="dOverview"'),
  },
  {
    label: "drawer scroll region",
    ok: html.includes('class="drawer-scroll"'),
  },
  {
    label: "desktop light overlay",
    ok: /background:linear-gradient\(90deg,\s*rgba\(245,247,250,0\)/.test(html),
  },
];

const missing = requiredMarkers.filter((marker) => !marker.ok);

if (missing.length > 0) {
  console.error("Floating panel layout markers missing:");
  for (const marker of missing) {
    console.error(`- ${marker.label}`);
  }
  process.exit(1);
}

console.log("Floating panel layout markers verified.");
```

- [ ] **Step 2: 執行檢查，確認版型標記目前尚未存在**

Run: `node check-floating-panel-layout.mjs`

Expected: FAIL，至少會缺少 `drawer tabs`、`overview content slot`、`desktop floating width` 幾個標記。

- [ ] **Step 3: 把抽屜 HTML/CSS 改成桌機全高浮動面板**

先刪掉目前桌機直接停用 overlay 的規則，也就是 `@media (min-width:1281px){ .ov,.ov.on{ display:none; } }` 這段，避免桌機開啟面板時沒有背景淡化層。

```html
<!-- index.html -->
<style>
.ov{
  position:fixed;
  inset:0;
  background:linear-gradient(90deg, rgba(245,247,250,0) 0%, rgba(245,247,250,.22) 42%, rgba(236,240,246,.74) 100%);
  backdrop-filter:blur(2px);
  opacity:0;
  pointer-events:none;
  transition:opacity .22s ease;
  z-index:20;
}

.ov.on{
  opacity:1;
  pointer-events:auto;
}

.dr{
  position:fixed;
  top:24px;
  right:24px;
  bottom:24px;
  width:clamp(340px,36vw,420px);
  max-width:calc(100vw - 48px);
  display:grid;
  grid-template-rows:minmax(0,1fr);
  padding:0;
  overflow:hidden;
  border:1px solid rgba(222,225,230,.95);
  border-radius:32px;
  background:rgba(255,255,255,.98);
  box-shadow:var(--shadow-lg);
  transform:translateX(calc(100% + 32px));
  opacity:0;
  pointer-events:none;
  transition:transform .22s ease, opacity .22s ease;
  z-index:24;
}

.dr.on{
  transform:translateX(0);
  opacity:1;
  pointer-events:auto;
}

.drawer-content{
  display:none;
  grid-template-rows:auto auto auto minmax(0,1fr);
  min-height:0;
  height:100%;
}

.dr.has-selection .drawer-content{
  display:grid;
}

.drawer-tabs{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:8px;
  padding:0 24px 18px;
  border-bottom:1px solid var(--line-soft);
}

.drtab{
  min-height:40px;
  border:1px solid var(--line);
  border-radius:999px;
  background:var(--canvas);
  color:var(--muted);
  font-size:13px;
  font-weight:600;
}

.drtab.on{
  border-color:rgba(0,82,255,.24);
  background:rgba(0,82,255,.08);
  color:var(--primary);
}

.drawer-scroll{
  min-height:0;
  overflow-y:auto;
  padding:0 24px 24px;
}

.drawer-meta{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.drstats-quick{
  grid-template-columns:repeat(2,minmax(0,1fr));
}

.overview-grid{
  display:grid;
  gap:10px;
}

.overview-item{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:14px 16px;
  border:1px solid var(--line-soft);
  border-radius:18px;
  background:var(--surface-soft);
}

@media (max-width:1180px){
  .dr{
    display:none;
    top:0;
    right:0;
    bottom:0;
    width:min(440px,100vw);
    max-width:none;
    height:100vh;
    min-height:100vh;
    border-radius:32px 0 0 32px;
    transform:translateX(104%);
  }

  .dr.on{
    display:grid;
  }
}
</style>

<aside class="dr" id="dr">
  <div class="drawer-empty">
    <span class="drawer-empty-mark" aria-hidden="true"></span>
    <h2>選一檔展開研究面板</h2>
    <p>從研究清單挑選公司後，這裡會顯示摘要、圖表、財報與你的研究筆記。桌機會用浮動側邊面板深讀，行動裝置則維持右側抽屜。</p>
  </div>

  <div class="drawer-content">
    <div class="drawer-head">
      <div>
        <p class="drawer-sub">個股研究面板</p>
        <h2 class="drawer-title" id="dName"></h2>
        <div class="muted drawer-meta" id="dMeta"></div>
      </div>
      <button type="button" class="close" id="close">關閉</button>
    </div>

    <div class="drawer-actions">
      <button type="button" class="drbtn ghost" id="dRefresh">更新個股資訊</button>
    </div>
    <div class="muted refreshstatus" id="dRefreshStatus"></div>

    <nav class="drawer-tabs" id="dTabs" aria-label="個股研究段落" role="tablist">
      <button type="button" class="drtab on" data-section="overview" aria-selected="true" role="tab">總覽</button>
      <button type="button" class="drtab" data-section="charts" aria-selected="false" role="tab">圖表</button>
      <button type="button" class="drtab" data-section="financials" aria-selected="false" role="tab">財報</button>
      <button type="button" class="drtab" data-section="notes" aria-selected="false" role="tab">筆記</button>
    </nav>

    <div class="drawer-scroll">
      <section class="drawer-panel" data-panel="overview" role="tabpanel">
        <div class="drstats drstats-quick" id="dStats"></div>
        <section class="drawer-section">
          <div class="sec">快速摘要</div>
          <div class="overview-grid" id="dOverview"></div>
        </section>
      </section>

      <section class="drawer-panel" data-panel="charts" role="tabpanel">
        <section class="drawer-section">
          <div class="sec">近 12 個月營收（億元）</div>
          <div class="chartbox"><canvas id="dChart"></canvas></div>
        </section>

        <section class="drawer-section">
          <div class="sec">EPS（元）與去年同期對比 <span class="epstog"><button type="button" id="emS" class="on">單季</button><button type="button" id="emC">累計</button></span><br><span id="dEpsYoY" class="muted"></span></div>
          <div class="chartbox compact"><canvas id="dEps"></canvas></div>
        </section>
      </section>

      <section class="drawer-panel" data-panel="financials" role="tabpanel">
        <section class="drawer-section">
          <div class="sec" id="dFinTitle">季度損益表</div>
          <div class="fintab-wrap">
            <table class="fintab"><tbody id="dFin"></tbody></table>
          </div>
        </section>

        <section class="drawer-section">
          <div class="sec">關鍵措辭檢核</div>
          <div class="phrase-list" id="dPhrases"></div>
        </section>
      </section>

      <section class="drawer-panel" data-panel="notes" role="tabpanel">
        <section class="drawer-section">
          <div class="sec">備註 / 重點摘錄</div>
          <textarea id="dNote" placeholder="例如：法說提到 HBM 供不應求，Q3 報價續漲。"></textarea>
        </section>

        <section class="drawer-section">
          <div class="sec">參考連結</div>
          <div class="links" id="dLinks"></div>
        </section>
      </section>
    </div>
  </div>
</aside>
```

```json
// package.json
{
  "scripts": {
    "check:ui": "node ./check-color-display.mjs && node ./check-drawer-eps-fallback.mjs && node ./check-eps-yoy-column.mjs && node ./check-link-field-removed.mjs && node ./check-pagination.mjs && node ./check-project-name.mjs && node ./check-sidebar-refresh.mjs && node ./check-floating-panel-layout.mjs"
  }
}
```

- [ ] **Step 4: 跑新的版型檢查與既有 UI 檢查**

Run: `node check-floating-panel-layout.mjs`

Expected: PASS，輸出 `Floating panel layout markers verified.`

Run: `npm run check:ui`

Expected: PASS，既有 UI 檢查與新增浮動面板檢查都通過。

- [ ] **Step 5: 建立版型 commit**

```bash
git add index.html package.json check-floating-panel-layout.mjs
git commit -m "feat: add floating stock panel layout shell" -m "Replace the bottom-of-page stock drawer layout with a desktop floating side panel shell while keeping the existing mobile drawer behavior and UI regression checks."
```

## Task 3: 接上段籤互動、內容渲染與刷新後重開流程

**Files:**
- Create: `tests/drawer-ui.test.mjs`
- Modify: `index.html`
- Modify: `assets/app/ui.js`
- Modify: `assets/app/main.js`
- Modify: `tests/refresh-flow.test.mjs`

- [ ] **Step 1: 先寫 UI 段籤與快照重開的失敗測試**

```js
// tests/drawer-ui.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

import { applyDrawerSectionUi, getQuickStats } from "../assets/app/ui.js";

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
  assert.equal(overviewPanel.hidden, true);
  assert.equal(notesPanel.hidden, false);
});
```

```js
// tests/refresh-flow.test.mjs
test("hydrateLatestSnapshot reopens the requested stock after replacing rows", async (t) => {
  const state = { snapshotEtag: '"old"', rows: [], page: 2 };
  const ui = fakeUi();
  const flow = createRefreshFlow({ state, ui, runtime: liveRuntime() });

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(fullSnapshot({ revPeriodROC: "11506" })), {
      status: 200,
      headers: { "content-type": "application/json", etag: '"new"' },
    });
  t.after(() => {
    globalThis.fetch = realFetch;
  });

  const result = await flow.hydrateLatestSnapshot({
    reopenCode: "2330",
    resetPage: false,
  });

  assert.equal(result, true);
  assert.equal(ui.calls.resetDrawer, 1);
  assert.deepEqual(ui.calls.openDrawer, ["2330"]);
  assert.equal(state.page, 2);
});
```

- [ ] **Step 2: 執行測試，確認 `ui.js` 目前還沒有對應 helper**

Run: `node --test tests/drawer-ui.test.mjs tests/refresh-flow.test.mjs`

Expected: FAIL，因為 `assets/app/ui.js` 尚未匯出 `getQuickStats` 與 `applyDrawerSectionUi`。

- [ ] **Step 3: 接上段籤切換、總覽卡片與桌機 overlay 行為**

`Chart.js` 在 `display:none` 的 canvas 上初始化很容易得到錯誤尺寸，所以這一步不要再像現在一樣每次 `openDrawer()` 都直接 render 圖表。改成「只有目前段落是 `charts` 時才建立圖表；離開 `charts` 時就 destroy」，這樣桌機預設停在 `總覽` 也不會把 chart 畫壞。

其中 `getQuickStats()` 與 `applyDrawerSectionUi()` 放在 `ui.js` 的匯出層，`renderDrawerSection()`、`setActiveDrawerSection()`、`openDrawer()`、`resetDrawer()` 則都放回既有的 `createAppUi({ state, dom, runtime })` 內部，避免把需要 `state/dom` 的邏輯誤放成檔案頂層函式。

```html
<!-- index.html -->
.drawer-panel{
  display:none;
}

.drawer-panel.on{
  display:block;
}
```

```js
// assets/app/ui.js
import {
  DEFAULT_DRAWER_SECTION,
  PAGE_SIZE,
  PHRASES,
  clearCurrentRow,
  getFilteredRows,
  getPhraseCount,
  getRecordState,
  getSurgeLevel,
  isFocus,
  setCurrentCode,
  setDrawerSection,
} from "./state.js";

export function getQuickStats(row) {
  return [
    ["月營收YoY", pct(row.yoy)],
    ["累計YoY", pct(row.ytdYoy)],
    ["毛利率", signedFmt(row.gm, 1, "%")],
    ["EPS(季)", signedFmt(displayQuarterEps(row), 2)],
  ];
}

function getOverviewItems(row) {
  return [
    ["月增MoM", pct(row.mom)],
    ["股價", fmt(row.price, 2)],
    ["本益比", fmt(row.pe, 1)],
    ["淨值比", fmt(row.pb, 2)],
    ["殖利率", `${fmt(row.yield, 2)}%`],
  ];
}

export function applyDrawerSectionUi(dom, section) {
  for (const button of dom.dTabButtons) {
    const active = button.dataset.section === section;
    button.classList.toggle("on", active);
    button.setAttribute("aria-selected", String(active));
    button.setAttribute("tabindex", active ? "0" : "-1");
  }

  for (const panel of dom.dPanels) {
    const active = panel.dataset.panel === section;
    panel.classList.toggle("on", active);
    panel.hidden = !active;
  }
}

export function collectDom(documentRoot = document) {
  return {
    q: documentRoot.getElementById("q"),
    mkt: documentRoot.getElementById("mkt"),
    ind: documentRoot.getElementById("ind"),
    minYoy: documentRoot.getElementById("minYoy"),
    minYtd: documentRoot.getElementById("minYtd"),
    minGm: documentRoot.getElementById("minGm"),
    epsPos: documentRoot.getElementById("epsPos"),
    exLumpy: documentRoot.getElementById("exLumpy"),
    count: documentRoot.getElementById("count"),
    pager: documentRoot.getElementById("pager"),
    tb: documentRoot.getElementById("tb"),
    runtimeChip: documentRoot.getElementById("runtimeChip"),
    heroCoverage: documentRoot.getElementById("heroCoverage"),
    statUniverse: documentRoot.getElementById("statUniverse"),
    statListed: documentRoot.getElementById("statListed"),
    statOtc: documentRoot.getElementById("statOtc"),
    statRevenuePeriod: documentRoot.getElementById("statRevenuePeriod"),
    statIncomePeriod: documentRoot.getElementById("statIncomePeriod"),
    statValuationDate: documentRoot.getElementById("statValuationDate"),
    summaryMatches: documentRoot.getElementById("summaryMatches"),
    summaryFocus: documentRoot.getElementById("summaryFocus"),
    summaryWatch: documentRoot.getElementById("summaryWatch"),
    summaryView: documentRoot.getElementById("summaryView"),
    snapshotMeta: documentRoot.getElementById("snapshotMeta"),
    noteIncLabel: documentRoot.getElementById("noteIncLabel"),
    ov: documentRoot.getElementById("ov"),
    dr: documentRoot.getElementById("dr"),
    close: documentRoot.getElementById("close"),
    dName: documentRoot.getElementById("dName"),
    dMeta: documentRoot.getElementById("dMeta"),
    dRefresh: documentRoot.getElementById("dRefresh"),
    dRefreshStatus: documentRoot.getElementById("dRefreshStatus"),
    dTabs: documentRoot.getElementById("dTabs"),
    dOverview: documentRoot.getElementById("dOverview"),
    dStats: documentRoot.getElementById("dStats"),
    dChart: documentRoot.getElementById("dChart"),
    emS: documentRoot.getElementById("emS"),
    emC: documentRoot.getElementById("emC"),
    dEps: documentRoot.getElementById("dEps"),
    dEpsYoY: documentRoot.getElementById("dEpsYoY"),
    dFinTitle: documentRoot.getElementById("dFinTitle"),
    dFin: documentRoot.getElementById("dFin"),
    dPhrases: documentRoot.getElementById("dPhrases"),
    dNote: documentRoot.getElementById("dNote"),
    dLinks: documentRoot.getElementById("dLinks"),
    dTabButtons: [...documentRoot.querySelectorAll(".drtab[data-section]")],
    dPanels: [...documentRoot.querySelectorAll(".drawer-panel[data-panel]")],
    viewButtons: [...documentRoot.querySelectorAll(".viewbtn")],
    sortHeaders: [...documentRoot.querySelectorAll('th[data-s]')],
  };
}

function renderDrawerSection() {
  applyDrawerSectionUi(dom, state.drawerSection);

  if (!state.currentRow) return;

  if (state.drawerSection === "charts") {
    renderRevenueChart(state.currentRow);
    renderEps();
    return;
  }

  destroyCharts();
}

function setActiveDrawerSection(section) {
  setDrawerSection(state, section);
  renderDrawerSection();
}

function openDrawer(code, { resetSection = true } = {}) {
  const row = setCurrentCode(state, code);
  if (!row) return;

  if (resetSection) {
    setDrawerSection(state, DEFAULT_DRAWER_SECTION);
  }

  const entry = getRecordState(state, code);
  const rocYear = Number(state.snapshot.meta.incQuarter?.[0] || "115") || 115;

  dom.dName.innerHTML =
    `${escapeHtml(row.name)} <span class="code">${code}</span> <span class="mk ${row.mkt === "上櫃" ? 'mkO">櫃' : 'mkS">市'}</span> ` +
    (entry.star ? '<span class="star on">★</span>' : "");
  dom.dMeta.textContent = row.ind + (row.note ? ` ｜ ${row.note}` : "");
  dom.dStats.innerHTML = getQuickStats(row)
    .map(
      ([label, value]) =>
        `<div class="drstat"><div class="k">${label}</div><div class="v">${value}</div></div>`,
    )
    .join("");
  dom.dOverview.innerHTML = getOverviewItems(row)
    .map(
      ([label, value]) =>
        `<div class="overview-item"><span class="muted">${label}</span><div>${value}</div></div>`,
    )
    .join("");
  dom.dFinTitle.textContent = `季度損益表（${state.incLabel}）`;
  dom.dFin.innerHTML = buildFinancialTable(row);
  dom.dPhrases.innerHTML = PHRASES.map(
    (phrase, index) =>
      `<label class="ph${entry.ph[index] ? " on" : ""}" data-i="${index}"><input type="checkbox" ${entry.ph[index] ? "checked" : ""}>${phrase}</label>`,
  ).join("");
  dom.dNote.value = entry.note || "";
  dom.dLinks.innerHTML = buildReferenceLinks(code, rocYear);

  setRefreshStatus(
    runtime && !runtime.hasLiveApi
      ? "目前是靜態檔模式；若要測試更新個股資訊，請改用 npm run dev 或 npm run dev:vercel。"
      : state.refreshKey
        ? "可手動抓取最新快照，並重新載入這檔資料。"
        : "點「更新個股資訊」可重新載入最新快照。",
  );
  updateRefreshControls();

  dom.ov.classList.add("on");
  dom.dr.classList.add("on", "has-selection");
  renderDrawerSection();
  render();
}

function resetDrawer({ renderList = false } = {}) {
  destroyCharts();
  dom.ov.classList.remove("on");
  dom.dr.classList.remove("on", "has-selection");
  clearCurrentRow(state);
  applyDrawerSectionUi(dom, DEFAULT_DRAWER_SECTION);
  if (renderList) {
    render();
  }
}

return {
  closeDrawer,
  openDrawer,
  readFilters,
  render,
  renderEps,
  renderIndustryOptions,
  resetDrawer,
  setDrawerSection: setActiveDrawerSection,
  setRefreshStatus,
  syncSnapshotMeta,
  updateRefreshControls,
};
```

```js
// assets/app/main.js
dom.dTabs.addEventListener("click", (event) => {
  const button = event.target.closest(".drtab[data-section]");
  if (!button || !state.currentCode) return;
  ui.setDrawerSection(button.dataset.section);
});
```

- [ ] **Step 4: 跑單元測試，確認段籤與刷新流程都通過**

Run: `node --test tests/state.test.mjs tests/drawer-ui.test.mjs tests/refresh-flow.test.mjs`

Expected: PASS，`drawerSection` state、UI helper 與 refresh reopen 測試都通過。

- [ ] **Step 5: 跑完整測試與 UI 靜態檢查**

Run: `npm test`

Expected: PASS，所有 `tests/*.test.mjs` 都通過。

Run: `npm run check:ui`

Expected: PASS，舊有檢查與新的浮動面板檢查都通過。

- [ ] **Step 6: 用本機頁面做手動驗證**

Run: `npm run dev`

Expected: 啟動本機開發伺服器，預設可在 `http://localhost:3000` 開頁。

手動驗證項目：

1. 桌機寬度大於 `1181px` 時，頁面載入後自動選取第一筆，右側顯示固定浮動面板。
2. 面板預設停在 `總覽`，只先顯示 4 張快速判讀卡與摘要區，不再直接看到整串長內容。
3. 點 `圖表 / 財報 / 筆記` 時，同一時間只會顯示一個段落，且 `圖表` 切回來時尺寸正常。
4. 在 `財報` 或 `筆記` 段籤下點另一檔股票，面板保持開啟，但段籤會回到 `總覽`。
5. 點右上角關閉或背景淡化層時，面板會收起並移除列高亮。
6. 把視窗縮到 `1180px` 以下時，面板回到既有右側滑出抽屜，不破壞手機/平板閱讀。

- [ ] **Step 7: 建立互動層 commit**

```bash
git add index.html assets/app/main.js assets/app/ui.js tests/drawer-ui.test.mjs tests/refresh-flow.test.mjs
git commit -m "feat: wire floating stock panel interactions" -m "Add drawer sections, overview-first rendering, chart-safe section switching, and snapshot reopen coverage for the floating stock research panel."
```
