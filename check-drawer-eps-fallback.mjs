import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const html = readFileSync(join(rootDir, "index.html"), "utf8");

const hasFallbackHelper = html.includes("function displayQuarterEps(o)");
const usesFallbackInDrawer = html.includes("['EPS(季)',signedFmt(displayQuarterEps(o),2)]");
const stillUsesRawQuarterEps = html.includes("['EPS(季)',fmt(o.eps,2)]") || html.includes("['EPS(季)',fmt(displayQuarterEps(o),2)]");

if (!hasFallbackHelper || !usesFallbackInDrawer || stillUsesRawQuarterEps) {
  console.error("Drawer EPS fallback not wired correctly.");
  console.error(JSON.stringify({ hasFallbackHelper, usesFallbackInDrawer, stillUsesRawQuarterEps }, null, 2));
  process.exit(1);
}

console.log("Drawer EPS fallback verified.");
