import { mapWithConcurrency, withRetry } from "./concurrency.js";

const USER_AGENT = "Mozilla/5.0 (compatible; twse-earnings-screener/1.0; +https://vercel.com)";
const REQUEST_TIMEOUT_MS = 45_000;
// MOPS throttles aggressively; keep concurrent scrapes low and retry transient failures.
const MOPS_FETCH_CONCURRENCY = 6;
const MOPS_FETCH_RETRIES = 2;

const TWSE_REVENUE_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap05_L";
const TPEX_REVENUE_URL = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O";
const TWSE_VALUATION_URL = "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL";
const TPEX_VALUATION_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis";
const TWSE_PRICE_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TPEX_PRICE_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";
const TWSE_INCOME_ENDPOINTS = ["t187ap06_L_ci", "t187ap06_L_mim", "t187ap06_L_bd"];
const TPEX_INCOME_ENDPOINTS = ["mopsfin_t187ap06_O_ci", "mopsfin_t187ap06_O_mim"];

function safeString(value) {
  return value == null ? "" : String(value);
}

export function num(value) {
  if (value == null) return null;
  const normalized = safeString(value).replace(/,/g, "").trim();
  if (!normalized || normalized === "-" || normalized === "--") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function yi(value) {
  return value == null ? null : Math.round((value / 1e5) * 10) / 10;
}

function isStock(code) {
  return /^\d{4}$/.test(safeString(code));
}

function cleanNote(note) {
  const value = safeString(note).trim();
  return value && value !== "-" ? value : "";
}

function withTimeout(signal) {
  if (signal) return signal;
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

async function fetchBuffer(url, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("user-agent")) headers.set("user-agent", USER_AGENT);
  const response = await fetch(url, {
    ...init,
    headers,
    signal: withTimeout(init.signal),
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function parseJson(text, url) {
  try {
    return JSON.parse(text.replace(/^\ufeff/, ""));
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error.message}`);
  }
}

async function fetchJson(url, init = {}) {
  const buffer = await fetchBuffer(url, init);
  return parseJson(buffer.toString("utf8"), url);
}

async function fetchJsonOptional(url, init = {}) {
  try {
    return await fetchJson(url, init);
  } catch {
    return [];
  }
}

function stripHtml(value) {
  return safeString(value)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#32;/g, " ")
    .trim();
}

function addRevenueRows(rows, data, market) {
  for (const record of data || []) {
    const code = record?.["公司代號"];
    if (!isStock(code)) continue;
    const revenue = num(record["營業收入-當月營收"]);
    const yoy = num(record["營業收入-去年同月增減(%)"]);
    if (revenue == null || revenue <= 0 || yoy == null) continue;
    rows[code] = {
      code,
      name: safeString(record["公司名稱"]),
      ind: safeString(record["產業別"]),
      mkt: market,
      rev: revenue,
      yoy,
      ytdYoy: num(record["累計營業收入-前期比較增減(%)"]),
      mom: num(record["營業收入-上月比較增減(%)"]),
      pe: null,
      pb: null,
      yield: null,
      price: null,
      chg: null,
      eps: null,
      gm: null,
      opm: null,
      npm: null,
      fin: null,
      r12: null,
      r12ly: null,
      epsS: null,
      epsC: null,
      note: cleanNote(record["備註"]),
    };
  }
}

function addValuationRows(rows, data, kind) {
  for (const record of data || []) {
    const code =
      kind === "twse"
        ? record?.Code
        : record?.SecuritiesCompanyCode;
    if (!rows[code]) continue;
    if (kind === "twse") {
      rows[code].pe = num(record.PEratio);
      rows[code].pb = num(record.PBratio);
      rows[code].yield = num(record.DividendYield);
      continue;
    }
    rows[code].pe = num(record.PriceEarningRatio);
    rows[code].pb = num(record.PriceBookRatio);
    rows[code].yield = num(record.YieldRatio);
  }
}

function addPriceRows(rows, data, kind) {
  for (const record of data || []) {
    const code =
      kind === "twse"
        ? record?.Code
        : record?.SecuritiesCompanyCode;
    if (!rows[code]) continue;
    if (kind === "twse") {
      rows[code].price = num(record.ClosingPrice);
      rows[code].chg = num(record.Change);
      continue;
    }
    rows[code].price = num(record.Close);
    rows[code].chg = num(record.Change);
  }
}

function addIncomeStatementRows(rows, data, codeKey, incQuarterState) {
  for (const record of data || []) {
    const code = record?.[codeKey] ?? record?.["公司代號"];
    if (!rows[code]) continue;
    const year = record?.Year ?? record?.["年度"];
    const season = record?.Season ?? record?.["季別"];
    if (year != null && season != null) {
      incQuarterState.value = [String(year), String(season)];
    }
    const epsKey = Object.keys(record || {}).find((key) => key.includes("每股盈餘"));
    const rev = num(record?.["營業收入"]);
    const gp = num(record?.["營業毛利（毛損）淨額"] ?? record?.["營業毛利（毛損）"]);
    const op = num(record?.["營業利益（損失）"]);
    const pt = num(record?.["稅前淨利（淨損）"]);
    const net = num(record?.["本期淨利（淨損）"]);
    const eps = epsKey ? num(record?.[epsKey]) : null;
    rows[code].fin = {
      rev: yi(rev),
      gp: yi(gp),
      op: yi(op),
      pt: yi(pt),
      net: yi(net),
      eps,
    };
    if (eps != null) rows[code].eps = Math.round(eps * 100) / 100;
    if (gp != null && rev) rows[code].gm = Math.round((gp / rev) * 10000) / 100;
    rows[code].opm = op != null && rev ? Math.round((op / rev) * 10000) / 100 : null;
    rows[code].npm = net != null && rev ? Math.round((net / rev) * 10000) / 100 : null;
  }
}

export function buildMonthOrder(revPeriodRoc, length = 24) {
  const rp = safeString(revPeriodRoc);
  let year = Number(rp.slice(0, 3));
  let month = Number(rp.slice(3));
  const result = [];
  for (let i = 0; i < length; i += 1) {
    result.push([year, month]);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return result.reverse();
}

export function parseMonthlyRevenueHtml(html) {
  const rows = {};
  for (const match of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gms)) {
    const cells = [...match[1].matchAll(/<td[^>]*>(.*?)<\/td>/gms)].map((cell) =>
      stripHtml(cell[1]),
    );
    if (cells.length < 3 || !isStock(cells[0])) continue;
    const revenue = num(cells[2]);
    if (revenue != null) rows[cells[0]] = revenue;
  }
  return rows;
}

async function fetchMonthlyRevenuePage(market, year, month) {
  const ym = year * 100 + month;
  const url = `https://mopsov.twse.com.tw/nas/t21/${market}/t21sc03_${year}_${month}_0.html`;
  try {
    const rows = await withRetry(
      async () => {
        const buffer = await fetchBuffer(url);
        return parseMonthlyRevenueHtml(new TextDecoder("big5").decode(buffer));
      },
      { retries: MOPS_FETCH_RETRIES },
    );
    return { ym, rows };
  } catch {
    return { ym, rows: {} };
  }
}

async function fetchMonthlyHistory(months) {
  const tasks = months.flatMap(([year, month]) =>
    ["sii", "otc"].map((market) => ({ market, year, month })),
  );
  const results = await mapWithConcurrency(tasks, MOPS_FETCH_CONCURRENCY, (task) =>
    fetchMonthlyRevenuePage(task.market, task.year, task.month),
  );
  const history = {};
  for (const result of results) {
    for (const [code, revenue] of Object.entries(result.rows)) {
      if (!history[code]) history[code] = {};
      history[code][result.ym] = revenue;
    }
  }
  return history;
}

function defaultIncomeQuarter(revPeriodRoc) {
  const rp = safeString(revPeriodRoc);
  const year = Number(rp.slice(0, 3));
  const month = Number(rp.slice(3));
  return [String(month >= 3 ? year : year - 1), "1"];
}

export function buildQuarterOrder(incQuarter, length = 8) {
  let year = Number(incQuarter[0]);
  let quarter = Number(incQuarter[1]);
  const result = [];
  for (let i = 0; i < length; i += 1) {
    result.push([year, quarter]);
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      year -= 1;
    }
  }
  return result.reverse();
}

export function parseQuarterlyEpsHtml(html) {
  const result = {};
  for (const table of html.match(/<table[^>]*>.*?<\/table>/gms) || []) {
    if (!table.includes("每股盈餘")) continue;
    const headerMatch = table.match(/<tr[^>]*>(.*?)<\/tr>/ms);
    if (!headerMatch) continue;
    const headers = [...headerMatch[1].matchAll(/<t[hd][^>]*>(.*?)<\/t[hd]>/gms)].map((cell) =>
      stripHtml(cell[1]),
    );
    const epsIndexes = headers
      .map((header, index) => (header.includes("每股盈餘") ? index : -1))
      .filter((index) => index >= 0);
    if (epsIndexes.length === 0) continue;
    const epsIndex = epsIndexes.at(-1);
    for (const rowMatch of table.matchAll(/<tr[^>]*>(.*?)<\/tr>/gms)) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>(.*?)<\/td>/gms)].map((cell) =>
        stripHtml(cell[1]),
      );
      if (cells.length <= epsIndex || !isStock(cells[0])) continue;
      const eps = num(cells[epsIndex]);
      if (eps != null) result[cells[0]] = eps;
    }
  }
  return result;
}

async function fetchQuarterlyEpsPage(market, year, season) {
  const quarter = year * 10 + season;
  const body = new URLSearchParams({
    encodeURIComponent: "1",
    step: "1",
    firstin: "1",
    off: "1",
    isQuery: "Y",
    TYPEK: market,
    year: String(year),
    season: String(season).padStart(2, "0"),
  });
  try {
    const rows = await withRetry(
      async () => {
        const buffer = await fetchBuffer("https://mopsov.twse.com.tw/mops/web/ajax_t163sb04", {
          method: "POST",
          body,
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
        });
        return parseQuarterlyEpsHtml(buffer.toString("utf8"));
      },
      { retries: MOPS_FETCH_RETRIES },
    );
    return { quarter, rows };
  } catch {
    return { quarter, rows: {} };
  }
}

async function fetchQuarterlyEpsHistory(quarters) {
  const tasks = quarters.flatMap(([year, season]) =>
    ["sii", "otc"].map((market) => ({ market, year, season })),
  );
  const results = await mapWithConcurrency(tasks, MOPS_FETCH_CONCURRENCY, (task) =>
    fetchQuarterlyEpsPage(task.market, task.year, task.season),
  );
  const history = {};
  for (const result of results) {
    for (const [code, eps] of Object.entries(result.rows)) {
      if (!history[code]) history[code] = {};
      history[code][result.quarter] = eps;
    }
  }
  return history;
}

export function singleQuarterFromCumulative(values, quarterOrder) {
  const result = [];
  for (let index = 0; index < quarterOrder.length; index += 1) {
    const quarter = quarterOrder[index];
    const value = values[index];
    if (value == null) {
      result.push(null);
      continue;
    }
    if (quarter % 10 === 1) {
      result.push(Math.round(value * 100) / 100);
      continue;
    }
    if (
      index > 0 &&
      quarterOrder[index - 1] === quarter - 1 &&
      values[index - 1] != null
    ) {
      result.push(Math.round((value - values[index - 1]) * 100) / 100);
      continue;
    }
    result.push(null);
  }
  return result;
}

// Pure: merge the raw revenue/valuation/price/income datasets into a row map and
// derive the reporting periods. Shared by assembleSnapshot and fetchSnapshotInputs
// (the latter only needs the periods to know which history pages to fetch).
function buildRowMap({
  twseRevenue = [],
  tpexRevenue = [],
  twseValuation = [],
  tpexValuation = [],
  twsePrice = [],
  tpexPrice = [],
  twseIncomeResults = [],
  tpexIncomeResults = [],
} = {}) {
  const rows = {};
  addRevenueRows(rows, twseRevenue, "上市");
  addRevenueRows(rows, tpexRevenue, "上櫃");
  addValuationRows(rows, twseValuation, "twse");
  addValuationRows(rows, tpexValuation, "tpex");
  addPriceRows(rows, twsePrice, "twse");
  addPriceRows(rows, tpexPrice, "tpex");

  const revPeriodRoc =
    safeString(twseRevenue?.[0]?.["資料年月"]) ||
    safeString(tpexRevenue?.[0]?.["資料年月"]);
  const valuationDateRoc =
    safeString(twseValuation?.[0]?.Date) ||
    safeString(twsePrice?.[0]?.Date);

  const incomeQuarterState = { value: null };
  for (const dataset of twseIncomeResults) {
    addIncomeStatementRows(rows, dataset, "公司代號", incomeQuarterState);
  }
  for (const dataset of tpexIncomeResults) {
    addIncomeStatementRows(rows, dataset, "SecuritiesCompanyCode", incomeQuarterState);
  }

  const incQuarter = incomeQuarterState.value || defaultIncomeQuarter(revPeriodRoc);
  return { rows, revPeriodRoc, valuationDateRoc, incQuarter };
}

// Pure: turn already-fetched raw datasets into the final { meta, rows } snapshot.
// Network I/O lives in fetchSnapshotInputs; this stage is fully deterministic.
export function assembleSnapshot(inputs = {}) {
  const { rows, revPeriodRoc, valuationDateRoc, incQuarter } = buildRowMap(inputs);
  const monthOrder = buildMonthOrder(revPeriodRoc, 24);
  const quarterOrder = buildQuarterOrder(incQuarter, 8);
  const monthlyHistory = inputs.monthlyHistory || {};
  const epsHistory = inputs.epsHistory || {};

  for (const row of Object.values(rows)) {
    const monthly = monthlyHistory[row.code];
    if (monthly) {
      const order = monthOrder.map(([year, month]) => year * 100 + month);
      row.r12 = order.slice(12).map((ym) => yi(monthly[ym] ?? null));
      row.r12ly = order.slice(0, 12).map((ym) => yi(monthly[ym] ?? null));
    }
    const epsMap = epsHistory[row.code];
    if (epsMap) {
      const cumulative = quarterOrder.map(([year, season]) => epsMap[year * 10 + season] ?? null);
      row.epsC = cumulative.map((value) => (value == null ? null : Math.round(value * 100) / 100));
      row.epsS = singleQuarterFromCumulative(
        cumulative,
        quarterOrder.map(([year, season]) => year * 10 + season),
      );
    }
  }

  const output = Object.values(rows).sort((left, right) => (right.yoy ?? -Infinity) - (left.yoy ?? -Infinity));
  const meta = {
    revPeriodROC: revPeriodRoc,
    valDateROC: valuationDateRoc,
    incQuarter: incQuarter.map(String),
    count: output.length,
    tw: output.filter((row) => row.mkt === "上市").length,
    otc: output.filter((row) => row.mkt === "上櫃").length,
    source: "TWSE+TPEx+MOPS",
    r12ym: monthOrder.slice(12).map(([year, month]) => year * 100 + month),
    epsQ: quarterOrder.map(([year, season]) => year * 10 + season),
    r12n: output.filter((row) => Array.isArray(row.r12) && row.r12.some((value) => value != null)).length,
    epsN: output.filter((row) => Array.isArray(row.epsS) && row.epsS.some((value) => value != null)).length,
  };

  return { meta, rows: output };
}

// I/O: fetch every upstream dataset, including the history pages whose range is
// derived from the freshly-fetched revenue/income periods.
async function fetchSnapshotInputs() {
  const [
    twseRevenue,
    tpexRevenue,
    twseValuation,
    tpexValuation,
    twsePrice,
    tpexPrice,
  ] = await Promise.all([
    fetchJson(TWSE_REVENUE_URL),
    fetchJson(TPEX_REVENUE_URL),
    fetchJsonOptional(TWSE_VALUATION_URL),
    fetchJsonOptional(TPEX_VALUATION_URL),
    fetchJsonOptional(TWSE_PRICE_URL),
    fetchJsonOptional(TPEX_PRICE_URL),
  ]);

  const [twseIncomeResults, tpexIncomeResults] = await Promise.all([
    Promise.all(
      TWSE_INCOME_ENDPOINTS.map((endpoint) =>
        fetchJsonOptional(`https://openapi.twse.com.tw/v1/opendata/${endpoint}`),
      ),
    ),
    Promise.all(
      TPEX_INCOME_ENDPOINTS.map((endpoint) =>
        fetchJsonOptional(`https://www.tpex.org.tw/openapi/v1/${endpoint}`),
      ),
    ),
  ]);

  const baseInputs = {
    twseRevenue,
    tpexRevenue,
    twseValuation,
    tpexValuation,
    twsePrice,
    tpexPrice,
    twseIncomeResults,
    tpexIncomeResults,
  };

  const { revPeriodRoc, incQuarter } = buildRowMap(baseInputs);
  const monthOrder = buildMonthOrder(revPeriodRoc, 24);
  const quarterOrder = buildQuarterOrder(incQuarter, 8);

  const [monthlyHistory, epsHistory] = await Promise.all([
    fetchMonthlyHistory(monthOrder),
    fetchQuarterlyEpsHistory(quarterOrder),
  ]);

  return { ...baseInputs, monthlyHistory, epsHistory };
}

export async function buildSnapshot() {
  return assembleSnapshot(await fetchSnapshotInputs());
}
