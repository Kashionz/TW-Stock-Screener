import { readFrontendSource, readIndexHtml } from "./check-frontend-source.mjs";

const html = readIndexHtml();
const source = readFrontendSource();

const requiredMarkers = [
  { label: "drawer refresh button", ok: html.includes('id="dRefresh"') },
  { label: "drawer refresh key button", ok: html.includes('id="dRefreshKey"') },
  { label: "drawer refresh status", ok: html.includes('id="dRefreshStatus"') },
  { label: "refresh helper", ok: source.includes("async function refreshCurrentStock()") },
  {
    label: "snapshot reload helper",
    ok: source.includes("async function reloadCurrentSnapshot(okMessage)"),
  },
  {
    label: "snapshot reopen flow",
    ok: /hydrateLatestSnapshot\(\{\s*reopenCode,\s*resetPage: false,\s*}\)/.test(source),
  },
];

const missing = requiredMarkers.filter((marker) => !marker.ok);

if (missing.length > 0) {
  console.error("Sidebar refresh markers missing:");
  for (const marker of missing) {
    console.error(`- ${marker.label}`);
  }
  process.exit(1);
}

console.log("Sidebar refresh markers verified.");
