import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = fileURLToPath(new URL(".", import.meta.url));

function collectJavaScriptFiles(directory) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, {
    withFileTypes: true,
  })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const nextPath = join(directory, entry.name);
      if (entry.isDirectory()) return collectJavaScriptFiles(nextPath);
      if (entry.name === "seed-snapshot.js") return [];
      return entry.name.endsWith(".js") || entry.name.endsWith(".mjs") ? [nextPath] : [];
    });
}

export function readIndexHtml() {
  return readFileSync(join(rootDir, "index.html"), "utf8");
}

export function readLatestVersionHtml() {
  const versionsDir = join(rootDir, "versions");
  if (!existsSync(versionsDir)) return "";

  const latestVersion = readdirSync(versionsDir)
    .filter((name) => name.endsWith(".html"))
    .sort()
    .at(-1);

  if (!latestVersion) return "";
  return readFileSync(join(versionsDir, latestVersion), "utf8");
}

export function readFrontendSource() {
  const files = [
    join(rootDir, "index.html"),
    ...collectJavaScriptFiles(join(rootDir, "assets", "app")),
  ];

  return files.map((filePath) => readFileSync(filePath, "utf8")).join("\n");
}
