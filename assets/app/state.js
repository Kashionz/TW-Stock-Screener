import { quarterLabel } from "./helpers.js";

export const PHRASES = [
  "產品供不應求",
  "行業高景氣度上行",
  "市場超預期拓展",
  "新品上市持續超預期",
  "產品價格中樞持續上漲",
  "供給偏緊",
  "需求旺盛",
];

const LUMPY_INDUSTRIES = ["建材營造", "金融保險業"];
const STORE_KEY = "twse_screener_v1";
const REFRESH_KEY_STORE = "twse_screener_refresh_key_v1";

export const PAGE_SIZE = 50;
export const DRAWER_SECTIONS = ["overview", "charts", "financials", "notes"];
export const DEFAULT_DRAWER_SECTION = DRAWER_SECTIONS[0];

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function loadRefreshKey() {
  try {
    return (localStorage.getItem(REFRESH_KEY_STORE) || "").trim();
  } catch {
    return "";
  }
}

function prepareRows(rows) {
  return (rows || []).map((row) => {
    const nextRow = { ...row, epsYoY: null };
    const eps = nextRow.epsS;
    if (eps && eps.length >= 5) {
      const current = eps.at(-1);
      const previous = eps.at(-5);
      if (current != null && previous != null && previous !== 0) {
        nextRow.epsYoY = ((current - previous) / Math.abs(previous)) * 100;
      }
    }
    return nextRow;
  });
}

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

export function applySnapshot(state, snapshot) {
  state.snapshot = snapshot;
  state.rows = prepareRows(snapshot.rows);
  state.r12ym = snapshot.meta.r12ym || [];
  state.incLabel = quarterLabel(snapshot.meta.incQuarter);
}

export function saveStore(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
}

export function getRecordState(state, code) {
  if (!state.store[code]) {
    state.store[code] = {
      ph: [false, false, false, false, false, false, false],
      note: "",
      link: "",
      star: false,
    };
  }

  return state.store[code];
}

export function setRefreshKey(state, value) {
  state.refreshKey = String(value || "").trim();

  if (state.refreshKey) {
    localStorage.setItem(REFRESH_KEY_STORE, state.refreshKey);
  } else {
    localStorage.removeItem(REFRESH_KEY_STORE);
  }
}

export function getPhraseCount(state, code) {
  return (state.store[code]?.ph || []).filter(Boolean).length;
}

export function includesLumpyIndustry(industry) {
  return LUMPY_INDUSTRIES.includes(industry);
}

export function isSurge(row) {
  return (row.yoy != null && row.yoy >= 30) || (row.ytdYoy != null && row.ytdYoy >= 20);
}

export function getSurgeLevel(row) {
  if (row.yoy != null && row.yoy >= 60 && row.ytdYoy != null && row.ytdYoy >= 30) {
    return 2;
  }
  return isSurge(row) ? 1 : 0;
}

export function isFocus(state, row) {
  return isSurge(row) && getPhraseCount(state, row.code) >= 1;
}

export function scoreValue(state, row) {
  let score = getSurgeLevel(row) * 10 + getPhraseCount(state, row.code);
  if (isFocus(state, row)) score += 100;
  if (getRecordState(state, row.code).star) score += 1000;
  return score;
}

export function toggleStar(state, code) {
  const entry = getRecordState(state, code);
  entry.star = !entry.star;
  saveStore(state);
  return entry.star;
}

export function updatePhrase(state, code, index, checked) {
  const entry = getRecordState(state, code);
  entry.ph[index] = checked;
  saveStore(state);
}

export function updateNote(state, code, note) {
  const entry = getRecordState(state, code);
  entry.note = note;
  saveStore(state);
}

export function setCurrentCode(state, code) {
  state.currentCode = code;
  state.currentRow = state.rows.find((row) => row.code === code) || null;
  return state.currentRow;
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

export function getFilteredRows(state, filters) {
  const { q, mkt, ind, minYoy, minYtd, minGm, epsPos, exLumpy } = filters;

  const filteredRows = state.rows.filter((row) => {
    if (q && !(row.code.includes(q) || (row.name || "").includes(q))) return false;
    if (mkt && row.mkt !== mkt) return false;
    if (ind && row.ind !== ind) return false;
    if (!Number.isNaN(minYoy) && !(row.yoy != null && row.yoy >= minYoy)) return false;
    if (!Number.isNaN(minYtd) && !(row.ytdYoy != null && row.ytdYoy >= minYtd)) return false;
    if (!Number.isNaN(minGm) && !(row.gm != null && row.gm >= minGm)) return false;
    if (epsPos && !(row.eps != null && row.eps > 0)) return false;
    if (exLumpy && includesLumpyIndustry(row.ind)) return false;
    if (state.view === "focus" && !isFocus(state, row)) return false;
    if (state.view === "star" && !getRecordState(state, row.code).star) return false;
    return true;
  });

  filteredRows.sort((left, right) => {
    let leftValue;
    let rightValue;

    if (state.sortKey === "score") {
      leftValue = scoreValue(state, left);
      rightValue = scoreValue(state, right);
    } else if (state.sortKey === "ph") {
      leftValue = getPhraseCount(state, left.code);
      rightValue = getPhraseCount(state, right.code);
    } else if (state.sortKey === "name") {
      leftValue = left.code;
      rightValue = right.code;
    } else if (state.sortKey === "ind") {
      leftValue = left.ind;
      rightValue = right.ind;
    } else {
      leftValue = left[state.sortKey];
      rightValue = right[state.sortKey];
    }

    if (leftValue == null) leftValue = -1e15;
    if (rightValue == null) rightValue = -1e15;
    if (leftValue < rightValue) return -state.sortDir;
    if (leftValue > rightValue) return state.sortDir;
    return 0;
  });

  return filteredRows;
}
