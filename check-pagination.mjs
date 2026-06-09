import { readFrontendSource, readIndexHtml } from "./check-frontend-source.mjs";

const html = readIndexHtml();
const source = readFrontendSource();

const requiredMarkers = [
  { label: "pagination container", ok: html.includes('id="pager"') },
  { label: "page state", ok: source.includes("page: 1") },
  { label: "page size", ok: source.includes("export const PAGE_SIZE = 50") },
  { label: "paged slice", ok: source.includes(".slice(start, start + PAGE_SIZE)") },
  { label: "previous button", ok: source.includes('data-page="prev"') },
  { label: "next button", ok: source.includes('data-page="next"') },
  {
    label: "filter reset",
    ok: /function rerenderFromFirstPage\(\)\s*{\s*state\.page = 1;\s*ui\.render\(\);\s*}/.test(source),
  },
];

const missing = requiredMarkers.filter((marker) => !marker.ok);

if (missing.length > 0) {
  console.error("Pagination markers missing:");
  for (const marker of missing) {
    console.error(`- ${marker.label}`);
  }
  process.exit(1);
}

console.log("Pagination markers verified.");
