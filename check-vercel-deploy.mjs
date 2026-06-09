import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const vercelJson = JSON.parse(readFileSync(join(rootDir, "vercel.json"), "utf8"));
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const vercelIgnore = readFileSync(join(rootDir, ".vercelignore"), "utf8");

expect(packageJson.dependencies?.["@vercel/blob"] === "2.4.0", "missing @vercel/blob dependency");
expect(packageJson.engines?.node === "20.x", "unexpected Node engine range");
expect(packageJson.scripts?.dev === "node ./scripts/dev-server.mjs", "missing npm dev script");
expect(packageJson.scripts?.["dev:vercel"] === "vercel dev", "missing npm dev:vercel script");
expect(packageJson.scripts?.test === "node --test tests/*.test.mjs", "unexpected npm test script");
expect(
  Array.isArray(vercelJson.crons) &&
    vercelJson.crons.some((cron) => cron.path === "/api/refresh"),
  "missing Vercel cron for /api/refresh",
);
expect(indexHtml.includes("fetch('/api/snapshot'"), "frontend does not hydrate from /api/snapshot");
expect(vercelIgnore.includes("versions/"), "missing versions/ in .vercelignore");
expect(existsSync(join(rootDir, "package-lock.json")), "missing package-lock.json");
expect(existsSync(join(rootDir, "api", "snapshot.js")), "missing api/snapshot.js");
expect(existsSync(join(rootDir, "api", "refresh.js")), "missing api/refresh.js");
expect(existsSync(join(rootDir, "scripts", "dev-server.mjs")), "missing scripts/dev-server.mjs");
expect(existsSync(join(rootDir, "lib", "refresh-service.js")), "missing lib/refresh-service.js");
expect(existsSync(join(rootDir, "lib", "snapshot-service.js")), "missing lib/snapshot-service.js");
expect(existsSync(join(rootDir, "data", "latest-snapshot.json")), "missing fallback snapshot file");

console.log("Vercel deployment files verified.");
