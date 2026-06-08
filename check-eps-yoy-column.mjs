import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const versionsDir = join(rootDir, "versions");
const latestVersion = readdirSync(versionsDir)
  .filter((name) => name.endsWith(".html"))
  .sort()
  .at(-1);

if (!latestVersion) {
  console.error("No versioned HTML snapshot found.");
  process.exit(1);
}

const requiredMarkers = [
  { label: "sortable header", needle: 'data-s="epsYoY"' },
  { label: "YoY calculation", needle: "epsYoY=(c-p)/Math.abs(p)*100" },
  { label: "table cell", needle: "pct(o.epsYoY)" },
];

const targets = [
  join(rootDir, "index.html"),
  join(versionsDir, latestVersion),
];

let failed = false;

for (const target of targets) {
  const html = readFileSync(target, "utf8");
  const missing = requiredMarkers.filter(({ needle }) => !html.includes(needle));
  if (missing.length > 0) {
    failed = true;
    console.error(target);
    for (const marker of missing) {
      console.error(`  missing: ${marker.label}`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`EPS YoY column verified in index.html and ${latestVersion}.`);
