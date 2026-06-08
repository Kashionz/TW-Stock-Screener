import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const html = readFileSync(join(rootDir, "index.html"), "utf8");

const requiredMarkers = [
  { label: "drawer refresh button", needle: 'id="dRefresh"' },
  { label: "drawer refresh key button", needle: 'id="dRefreshKey"' },
  { label: "drawer refresh status", needle: 'id="dRefreshStatus"' },
  { label: "refresh helper", needle: "async function refreshCurrentStock()" },
  { label: "snapshot reload helper", needle: "async function reloadCurrentSnapshot(okMessage)" },
  { label: "snapshot reopen flow", needle: "hydrateLatestSnapshot({reopenCode:code,resetPage:false})" },
];

const missing = requiredMarkers.filter(({ needle }) => !html.includes(needle));

if (missing.length > 0) {
  console.error("Sidebar refresh markers missing:");
  for (const marker of missing) {
    console.error(`- ${marker.label}`);
  }
  process.exit(1);
}

console.log("Sidebar refresh markers verified.");
