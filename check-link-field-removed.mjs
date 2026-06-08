import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const html = readFileSync(join(rootDir, "index.html"), "utf8");

const forbiddenMarkers = [
  { label: "manual link input", needle: 'id="dLink"' },
  { label: "manual link placeholder", needle: "貼上法說會簡報或新聞連結（選填）" },
  { label: "manual link value binding", needle: "document.getElementById('dLink')" },
];

const remaining = forbiddenMarkers.filter(({ needle }) => html.includes(needle));

if (remaining.length > 0) {
  console.error("Removed link field markers still present:");
  for (const marker of remaining) {
    console.error(`- ${marker.label}`);
  }
  process.exit(1);
}

if (!html.includes('id="dLinks"')) {
  console.error("Expected auto-generated reference links to remain.");
  process.exit(1);
}

console.log("Manual link field removed and reference links preserved.");
