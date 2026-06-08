import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const html = readFileSync(join(rootDir, "index.html"), "utf8");

const requiredMarkers = [
  { label: "pagination container", needle: 'id="pager"' },
  { label: "page state", needle: "sortDir=-1,page=1" },
  { label: "page size", needle: "const PAGE_SIZE=50" },
  { label: "paged slice", needle: "r.slice(start,start+PAGE_SIZE)" },
  { label: "previous button", needle: 'data-page="prev"' },
  { label: "next button", needle: 'data-page="next"' },
  { label: "filter reset", needle: "page=1;render()" },
];

const missing = requiredMarkers.filter(({ needle }) => !html.includes(needle));

if (missing.length > 0) {
  console.error("Pagination markers missing:");
  for (const marker of missing) {
    console.error(`- ${marker.label}`);
  }
  process.exit(1);
}

console.log("Pagination markers verified.");
