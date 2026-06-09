import { readFrontendSource } from "./check-frontend-source.mjs";

const source = readFrontendSource();

const hasFallbackHelper = source.includes("export function displayQuarterEps(row)");
const usesFallbackInDrawer = source.includes('["EPS(季)", signedFmt(displayQuarterEps(row), 2)]');
const stillUsesRawQuarterEps =
  source.includes('["EPS(季)", fmt(row.eps, 2)]') ||
  source.includes('["EPS(季)", fmt(displayQuarterEps(row), 2)]');

if (!hasFallbackHelper || !usesFallbackInDrawer || stillUsesRawQuarterEps) {
  console.error("Drawer EPS fallback not wired correctly.");
  console.error(JSON.stringify({ hasFallbackHelper, usesFallbackInDrawer, stillUsesRawQuarterEps }, null, 2));
  process.exit(1);
}

console.log("Drawer EPS fallback verified.");
