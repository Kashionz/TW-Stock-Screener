import {
  createAppState,
  toggleStar,
  updateNote,
  updatePhrase,
} from "./state.js";
import { createRuntimeConfig } from "./runtime.js";
import { collectDom, createAppUi } from "./ui.js";
import { createRefreshFlow } from "./refresh-flow.js";

const FILTER_IDS = ["q", "mkt", "ind", "minYoy", "minYtd", "minGm", "epsPos", "exLumpy"];

const initialSnapshot = window.__TWSE_INITIAL_SNAPSHOT__;

if (!initialSnapshot?.meta || !Array.isArray(initialSnapshot.rows)) {
  throw new Error("Initial snapshot payload is missing.");
}

const state = createAppState(initialSnapshot);
state.snapshotEtag = window.__TWSE_INITIAL_SNAPSHOT_ETAG__ || null;
const runtime = createRuntimeConfig();
const dom = collectDom();
const ui = createAppUi({ state, dom, runtime });
const refreshFlow = createRefreshFlow({ state, ui, runtime });

function rerenderFromFirstPage() {
  state.page = 1;
  ui.render();
}

for (const id of FILTER_IDS) {
  const element = dom[id];
  element.addEventListener("input", rerenderFromFirstPage);
  element.addEventListener("change", rerenderFromFirstPage);
}

for (const button of dom.viewButtons) {
  button.addEventListener("click", () => {
    for (const viewButton of dom.viewButtons) {
      viewButton.classList.remove("on");
    }
    button.classList.add("on");
    state.view = button.dataset.v || "all";
    if (state.view !== "all") {
      dom.minYoy.value = "";
    }
    rerenderFromFirstPage();
  });
}

for (const header of dom.sortHeaders) {
  header.addEventListener("click", () => {
    const key = header.dataset.s;
    if (state.sortKey === key) {
      state.sortDir *= -1;
    } else {
      state.sortKey = key;
      state.sortDir = -1;
    }
    rerenderFromFirstPage();
  });
}

dom.pager.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button || button.disabled) return;

  const pageAction = button.dataset.page;
  if (pageAction === "prev") {
    state.page = Math.max(1, state.page - 1);
  } else if (pageAction === "next") {
    state.page += 1;
  } else {
    state.page = Number(pageAction);
  }

  ui.render();
});

dom.tb.addEventListener("click", (event) => {
  const star = event.target.closest("[data-star]");
  if (star) {
    toggleStar(state, star.dataset.star);
    ui.render();
    event.stopPropagation();
    return;
  }

  const row = event.target.closest(".row");
  if (row) {
    ui.openDrawer(row.dataset.c);
  }
});

dom.ov.addEventListener("click", () => {
  ui.closeDrawer();
});

dom.close.addEventListener("click", () => {
  ui.closeDrawer();
});

dom.emS.addEventListener("click", () => {
  state.epsMode = "S";
  dom.emS.classList.add("on");
  dom.emC.classList.remove("on");
  ui.renderEps();
});

dom.emC.addEventListener("click", () => {
  state.epsMode = "C";
  dom.emC.classList.add("on");
  dom.emS.classList.remove("on");
  ui.renderEps();
});

dom.dRefresh.addEventListener("click", () => {
  refreshFlow.refreshCurrentStock();
});

dom.dRefreshKey.addEventListener("click", () => {
  if (!state.refreshBusy) {
    refreshFlow.promptRefreshKey();
  }
});

dom.dPhrases.addEventListener("change", (event) => {
  const label = event.target.closest(".ph");
  if (!label || !state.currentCode) return;

  const index = Number(label.dataset.i);
  updatePhrase(state, state.currentCode, index, event.target.checked);
  label.classList.toggle("on", event.target.checked);
});

dom.dNote.addEventListener("input", (event) => {
  if (!state.currentCode) return;
  updateNote(state, state.currentCode, event.target.value);
});

ui.syncSnapshotMeta();
ui.renderIndustryOptions();
ui.updateRefreshControls();
ui.render();
refreshFlow.hydrateLatestSnapshot();
