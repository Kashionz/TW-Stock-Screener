import { readFrontendSource, readIndexHtml } from "./check-frontend-source.mjs";

const source = readFrontendSource();
const html = readIndexHtml();

const requiredMarkers = [
  { label: "sortable header", ok: html.includes('data-s="epsYoY"') },
  {
    label: "YoY calculation",
    ok: /nextRow\.epsYoY = \(\(current - previous\) \/ Math\.abs\(previous\)\) \* 100;/.test(source),
  },
  { label: "table cell", ok: source.includes("pct(row.epsYoY)") },
];

const missing = requiredMarkers.filter((marker) => !marker.ok);

if (missing.length > 0) {
  console.error("EPS YoY markers missing:");
  for (const marker of missing) {
    console.error(`- ${marker.label}`);
  }
  process.exit(1);
}

console.log("EPS YoY column verified.");
