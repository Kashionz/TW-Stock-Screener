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
import {
  displayQuarterEps,
  epsBarColor,
  escapeHtml,
  fmt,
  formatChange,
  pct,
  revLabel,
  rocDateLabel,
  signedFmt,
  snapshotHeader,
  ymLabel,
} from "./helpers.js";

function buildFinancialTable(row) {
  const financials = row.fin;
  if (!financials) {
    return '<tr><td class="muted" colspan="2">此檔（多為金融/特殊業）損益表欄位不適用</td></tr>';
  }

  const rows = [
    ["營業收入", financials.rev, null],
    ["營業毛利", financials.gp, row.gm],
    ["營業利益", financials.op, row.opm],
    ["稅前淨利", financials.pt, null],
    ["稅後淨利", financials.net, row.npm],
    ["每股盈餘 EPS", financials.eps, null],
  ];

  return rows
    .map(([label, value, ratio]) => {
      const displayValue =
        value == null
          ? "—"
          : label.includes("EPS")
            ? `${value.toFixed(2)} 元`
            : `${value.toLocaleString()} 億`;
      const displayRatio =
        ratio == null ? "" : ` <span class="muted">(${ratio.toFixed(1)}%)</span>`;
      return `<tr><td>${label}</td><td>${displayValue}${displayRatio}</td></tr>`;
    })
    .join("");
}

function buildReferenceLinks(code, rocYear) {
  return (
    `<a href="https://doc.twse.com.tw/server-java/t57sb01?step=1&colorchg=1&seamon=&mtype=A&co_id=${code}&year=${rocYear}" target="_blank">季報電子書 ${rocYear}</a>` +
    `<a href="https://doc.twse.com.tw/server-java/t57sb01?step=1&colorchg=1&seamon=&mtype=A&co_id=${code}&year=${rocYear - 1}" target="_blank">季報 ${rocYear - 1}</a>` +
    `<a href="https://goodinfo.tw/tw/StockBzPerformance.asp?STOCK_ID=${code}" target="_blank">Goodinfo 財報</a>` +
    `<a href="https://tw.stock.yahoo.com/quote/${code}/financials" target="_blank">Yahoo 財務</a>`
  );
}

const SORT_LABELS = {
  score: "評級",
  ph: "措辭數",
  name: "公司代號",
  ind: "產業",
  yoy: "月營收 YoY",
  ytdYoy: "累計 YoY",
  gm: "毛利率",
  eps: "EPS",
  epsYoY: "單季 EPS YoY",
  pe: "本益比",
  pb: "淨值比",
  price: "股價",
  chg: "漲跌",
};

const VIEW_LABELS = {
  all: "全部",
  focus: "重點關注",
  star: "觀察清單",
};

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
    ["殖利率", row.yield == null ? '<span class="muted">—</span>' : `${fmt(row.yield, 2)}%`],
  ];
}

export function summarizeDrawerNote(note, maxLength = 30) {
  const compact = String(note || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return "";
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

export function buildDrawerMeta(row, note) {
  const parts = [];

  if (row?.ind) parts.push(row.ind);

  const noteSummary = summarizeDrawerNote(note);
  if (noteSummary) parts.push(noteSummary);

  return parts.join(" ｜ ");
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

export function resetDrawerScrollPosition(dom) {
  if (!dom?.drawerScroll) return;
  dom.drawerScroll.scrollTop = 0;
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
    drawerScroll: documentRoot.querySelector(".drawer-scroll"),
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

export function createAppUi({ state, dom, runtime }) {
  let revenueChart = null;
  let epsChart = null;

  function destroyRevenueChart() {
    if (revenueChart) {
      revenueChart.destroy();
      revenueChart = null;
    }
  }

  function destroyEpsChart() {
    if (epsChart) {
      epsChart.destroy();
      epsChart = null;
    }
  }

  function destroyCharts() {
    destroyRevenueChart();
    destroyEpsChart();
  }

  function clearCanvas(canvas, message) {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#9aa3b0";
    context.font = "13px sans-serif";
    context.fillText(message, 20, 40);
  }

  function syncSnapshotMeta() {
    const { meta } = state.snapshot;

    dom.snapshotMeta.textContent = snapshotHeader(meta);
    dom.noteIncLabel.textContent = state.incLabel;
    dom.runtimeChip.textContent = runtime && runtime.hasLiveApi ? "本機更新模式" : "靜態快照模式";
    dom.heroCoverage.textContent = `${meta.count.toLocaleString()} 檔研究宇宙`;
    dom.statUniverse.textContent = meta.count.toLocaleString();
    dom.statListed.textContent = meta.tw.toLocaleString();
    dom.statOtc.textContent = meta.otc.toLocaleString();
    dom.statRevenuePeriod.textContent = revLabel(meta.revPeriodROC);
    dom.statIncomePeriod.textContent = state.incLabel;
    dom.statValuationDate.textContent = rocDateLabel(meta.valDateROC);
  }

  function setRefreshStatus(message, tone = "") {
    dom.dRefreshStatus.className = `muted refreshstatus${tone ? ` ${tone}` : ""}`;
    dom.dRefreshStatus.textContent = message || "";
  }

  function updateRefreshControls() {
    const apiUnavailable = runtime && !runtime.hasLiveApi;

    dom.dRefresh.disabled = apiUnavailable || state.refreshBusy;
    dom.dRefresh.textContent = state.refreshBusy ? "更新中…" : "更新個股資訊";
  }

  function renderIndustryOptions() {
    const previousValue = dom.ind.value;
    const industries = [...new Set(state.rows.map((row) => row.ind).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right, "zh-Hant"),
    );

    dom.ind.innerHTML =
      '<option value="">全部產業</option>' +
      industries.map((industry) => `<option>${escapeHtml(industry)}</option>`).join("");

    if (previousValue && industries.includes(previousValue)) {
      dom.ind.value = previousValue;
    }
  }

  function readFilters() {
    return {
      q: dom.q.value.trim(),
      mkt: dom.mkt.value,
      ind: dom.ind.value,
      minYoy: Number.parseFloat(dom.minYoy.value),
      minYtd: Number.parseFloat(dom.minYtd.value),
      minGm: Number.parseFloat(dom.minGm.value),
      epsPos: dom.epsPos.checked,
      exLumpy: dom.exLumpy.checked,
    };
  }

  function renderPager(total) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(state.page, pages);

    if (total <= PAGE_SIZE) {
      dom.pager.innerHTML = "";
      return;
    }

    const startPage = Math.max(1, state.page - 2);
    const endPage = Math.min(pages, state.page + 2);
    const parts = [];

    for (let page = startPage; page <= endPage; page += 1) {
      parts.push(
        `<button class="${page === state.page ? "on" : ""}" data-page="${page}">${page}</button>`,
      );
    }

    dom.pager.innerHTML =
      `<span class="pagerstat">第 ${state.page} / ${pages} 頁</span>` +
      `<div class="pagernav">` +
      `<button data-page="prev" ${state.page === 1 ? "disabled" : ""}>上一頁</button>` +
      parts.join("") +
      `<button data-page="next" ${state.page === pages ? "disabled" : ""}>下一頁</button>` +
      "</div>";
  }

  function render() {
    const filteredRows = getFilteredRows(state, readFilters());
    const pages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const totalWatch = state.rows.filter((row) => getRecordState(state, row.code).star).length;
    const filteredFocus = filteredRows.filter((row) => isFocus(state, row)).length;

    const start = (state.page - 1) * PAGE_SIZE;
    const end = Math.min(filteredRows.length, start + PAGE_SIZE);

    dom.count.textContent =
      `符合 ${filteredRows.length} 檔` +
      (state.view === "focus"
        ? "（業績大增＋已勾選措辭）"
        : state.view === "star"
          ? "（觀察清單）"
          : "") +
      (filteredRows.length ? `｜顯示第 ${start + 1}-${end} 檔` : "") +
      `｜依 ${SORT_LABELS[state.sortKey] || state.sortKey} 排序`;

    dom.summaryMatches.textContent = filteredRows.length.toLocaleString();
    dom.summaryFocus.textContent =
      state.view === "focus" ? filteredRows.length.toLocaleString() : filteredFocus.toLocaleString();
    dom.summaryWatch.textContent = totalWatch.toLocaleString();
    dom.summaryView.textContent = VIEW_LABELS[state.view] || VIEW_LABELS.all;

    renderPager(filteredRows.length);

    dom.tb.innerHTML = filteredRows
      .slice(start, start + PAGE_SIZE)
      .map((row) => {
        const code = row.code;
        const phraseCount = getPhraseCount(state, code);
        const focus = isFocus(state, row);
        const surgeLevel = getSurgeLevel(row);
        const surgeBadge =
          surgeLevel === 2
            ? '<span class="surge surgeH">大增</span>'
            : surgeLevel === 1
              ? '<span class="surge surgeM">成長</span>'
              : "";
        const phraseBadgeClass =
          phraseCount === 0 ? "b0" : phraseCount >= 4 ? "b3" : phraseCount >= 2 ? "b2" : "b1";
        const rating = focus ? '<span class="flag">重點</span>' : surgeBadge;
        const marketBadge =
          row.mkt === "上櫃"
            ? '<span class="mk mkO">櫃</span>'
            : '<span class="mk mkS">市</span>';

        return (
          `<tr class="row${focus ? " focus" : ""}${state.currentCode === code ? " current" : ""}" data-c="${code}">` +
          `<td><span class="star${getRecordState(state, code).star ? " on" : ""}" data-star="${code}">★</span></td>` +
          `<td class="l"><span class="name">${escapeHtml(row.name)}</span> <span class="code">${code}</span>${marketBadge}</td>` +
          `<td class="l hideT hideM"><span class="muted">${escapeHtml(row.ind)}</span></td>` +
          `<td>${pct(row.yoy)}</td><td class="hideM">${pct(row.ytdYoy)}</td><td class="hideM">${signedFmt(row.gm, 1)}</td>` +
          `<td class="hideS">${signedFmt(row.eps, 2)}</td><td class="hideS">${pct(row.epsYoY)}</td><td class="hideS">${fmt(row.pe, 1)}</td><td class="hideT hideM">${fmt(row.pb, 2)}</td>` +
          `<td class="hideS">${fmt(row.price, 2)}</td><td class="hideT hideM">${formatChange(row)}</td>` +
          `<td class="hideS"><span class="badge ${phraseBadgeClass}">${phraseCount}/7</span></td><td>${rating}</td>` +
          "</tr>"
        );
      })
      .join("");
  }

  function renderRevenueChart(row) {
    destroyRevenueChart();

    if (row.r12 && row.r12.some((value) => value != null)) {
      const labels = state.r12ym.map(ymLabel);
      revenueChart = new Chart(dom.dChart, {
        data: {
          labels,
          datasets: [
            {
              type: "bar",
              label: "今年",
              data: row.r12,
              backgroundColor: "#1f6feb",
              borderRadius: 3,
              order: 2,
            },
            {
              type: "line",
              label: "去年同月",
              data: row.r12ly,
              borderColor: "#e0a400",
              backgroundColor: "#e0a400",
              borderWidth: 2,
              pointRadius: 2,
              tension: 0.3,
              order: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              labels: {
                boxWidth: 10,
                font: { size: 10 },
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y;
                  if (value == null) return " —";
                  if (context.datasetIndex === 0) {
                    const lastYear = row.r12ly ? row.r12ly[context.dataIndex] : null;
                    let text = ` 今年 ${value.toLocaleString()} 億`;
                    if (lastYear) {
                      const yoy = (((value - lastYear) / lastYear) * 100).toFixed(1);
                      text += `  (YoY ${((value - lastYear) / lastYear) * 100 >= 0 ? "+" : ""}${yoy}%)`;
                    }
                    return text;
                  }
                  return ` 去年 ${value.toLocaleString()} 億`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 } },
            },
            y: {
              ticks: { font: { size: 10 } },
              grid: { color: "#eef0f3" },
            },
          },
        },
      });
      return;
    }

    clearCanvas(dom.dChart, "此檔無月營收歷史資料");
  }

  function renderEps() {
    destroyEpsChart();

    if (!state.currentRow) return;

    const eps = state.currentRow;
    const quarters = state.snapshot.meta.epsQ || [];
    const values = state.epsMode === "C" ? eps.epsC : eps.epsS;
    const label = state.epsMode === "C" ? "累計EPS" : "單季EPS";
    const periodLabel = state.epsMode === "C" ? "累計" : "單季";

    if (values && values.some((value) => value != null)) {
      const labels = quarters.map((quarter) => {
        const year = Math.floor(quarter / 10) + 1911 - 2000;
        const season = quarter % 10;
        return `${year}Q${season}`;
      });
      const colors = values.map((value, index) => epsBarColor(value, index >= values.length - 4));

      epsChart = new Chart(dom.dEps, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label,
              data: values,
              backgroundColor: colors,
              borderRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y;
                  const index = context.dataIndex;
                  if (value == null) return " 無資料";
                  let text = ` ${value.toFixed(2)} 元`;
                  const previous = index >= 4 ? values[index - 4] : null;
                  if (previous != null && previous !== 0) {
                    const yoy = (((value - previous) / Math.abs(previous)) * 100).toFixed(0);
                    text += `  (YoY ${((value - previous) / Math.abs(previous)) * 100 >= 0 ? "+" : ""}${yoy}%)`;
                  }
                  return text;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 } },
            },
            y: {
              ticks: { font: { size: 10 } },
              grid: { color: "#eef0f3" },
            },
          },
        },
      });

      const latest = values.at(-1);
      const lastYear = values.at(-5);
      dom.dEpsYoY.textContent =
        latest != null && lastYear != null && lastYear !== 0
          ? `最新${periodLabel} ${latest.toFixed(2)} vs 去年同期 ${lastYear.toFixed(2)}（YoY ${((latest - lastYear) / Math.abs(lastYear)) * 100 >= 0 ? "+" : ""}${(((latest - lastYear) / Math.abs(lastYear)) * 100).toFixed(0)}%）`
          : "";
      return;
    }

    dom.dEpsYoY.textContent = "";
    clearCanvas(dom.dEps, "此檔無EPS資料");
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

  function renderDrawerMeta(note) {
    dom.dMeta.textContent = state.currentRow ? buildDrawerMeta(state.currentRow, note) : "";
  }

  function setActiveDrawerSection(section) {
    setDrawerSection(state, section);
    resetDrawerScrollPosition(dom);
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
    renderDrawerMeta(entry.note);
    setRefreshStatus(
      runtime && !runtime.hasLiveApi
        ? "目前是靜態檔模式；若要測試更新個股資訊，請改用 npm run dev 或 npm run dev:vercel。"
        : state.refreshKey
          ? "可手動抓取最新快照，並重新載入這檔資料。"
          : "點「更新個股資訊」可重新載入最新快照。",
    );
    updateRefreshControls();

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

    dom.ov.classList.add("on");
    dom.dr.classList.add("on", "has-selection");
    resetDrawerScrollPosition(dom);
    renderDrawerSection();
    render();
  }

  function resetDrawer({ renderList = false } = {}) {
    destroyCharts();
    dom.ov.classList.remove("on");
    dom.dr.classList.remove("on", "has-selection");
    clearCurrentRow(state);
    applyDrawerSectionUi(dom, DEFAULT_DRAWER_SECTION);
    resetDrawerScrollPosition(dom);
    if (renderList) {
      render();
    }
  }

  function closeDrawer() {
    resetDrawer({ renderList: true });
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
    updateDrawerMeta: renderDrawerMeta,
    syncSnapshotMeta,
    updateRefreshControls,
  };
}
