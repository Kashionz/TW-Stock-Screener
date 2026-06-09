export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function quarterLabel(iq) {
  return iq && iq.length >= 2 ? `${Number(iq[0]) + 1911} Q${iq[1]}` : "";
}

export function rocDateLabel(value) {
  const date = String(value || "");
  if (date.length !== 7) return "";
  return `${Number(date.slice(0, 3)) + 1911}/${date.slice(3, 5)}/${date.slice(5, 7)}`;
}

export function revLabel(value) {
  const period = String(value || "");
  if (period.length !== 5) return "";
  return `${Number(period.slice(0, 3)) + 1911}年${Number(period.slice(3))}月`;
}

export function snapshotHeader(meta) {
  return `資料快照：月營收 ${revLabel(meta.revPeriodROC)} ｜ 損益表 ${quarterLabel(meta.incQuarter)} ｜ 估值/股價 ${rocDateLabel(meta.valDateROC)} ｜ 來源：證交所 + 櫃買中心開放資料、月營收史 MOPS（上市 ${meta.tw} ＋ 上櫃 ${meta.otc} ＝ ${meta.count} 檔）`;
}

export function fmt(value, digits = 2) {
  return value == null ? '<span class="muted">—</span>' : Number(value).toFixed(digits);
}

export function signedFmt(value, digits = 2, suffix = "") {
  if (value == null) return '<span class="muted">—</span>';
  const number = Number(value);
  const className = number > 0 ? "pos" : number < 0 ? "neg" : "";
  const text = `${number.toFixed(digits)}${suffix}`;
  return className ? `<span class="${className}">${text}</span>` : text;
}

export function pct(value) {
  if (value == null) return '<span class="muted">—</span>';
  const className = value >= 0 ? "pos" : "neg";
  const text = Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(1);
  return `<span class="${className}">${value >= 0 ? "+" : ""}${text}</span>`;
}

export function formatChange(row) {
  if (row?.chgText) return `<span class="muted">${escapeHtml(row.chgText)}</span>`;
  return pct(row?.chg);
}

export function ymLabel(value) {
  const label = String(value);
  return `${Number.parseInt(label.slice(0, 3), 10) + 1911 - 2000}/${label.slice(3)}`;
}

export function displayQuarterEps(row) {
  if (row.eps != null) return row.eps;
  const quarters = row.epsS || [];
  for (let index = quarters.length - 1; index >= 0; index -= 1) {
    if (quarters[index] != null) return quarters[index];
  }
  return null;
}

export function epsBarColor(value, isRecent) {
  if (value == null) return "#cfd6df";
  if (value >= 0) return isRecent ? "#137a4b" : "#8cc8a2";
  return isRecent ? "#c0362c" : "#e7a39d";
}
