import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "/Users/kashionz/Claude/Artifacts/twse-earnings-screener";
const html = readFileSync(join(rootDir, "index.html"), "utf8");

const expectedTitle = "<title>台股篩選工具</title>";
const expectedHeading = "<h1>台股篩選工具</h1>";
const expectedArtifactName = '"name": "台股篩選工具"';
const removedSubtitle = "基本面動能 × 產業景氣訊號（量化篩選＋質化研判）";

if (!html.includes(expectedTitle)) {
  throw new Error(`Expected page title ${expectedTitle}`);
}

if (!html.includes(expectedHeading)) {
  throw new Error(`Expected heading ${expectedHeading}`);
}

if (!html.includes(expectedArtifactName)) {
  throw new Error(`Expected artifact metadata name ${expectedArtifactName}`);
}

if (html.includes(removedSubtitle)) {
  throw new Error(`Expected subtitle to be removed: ${removedSubtitle}`);
}

console.log("project naming verified");
