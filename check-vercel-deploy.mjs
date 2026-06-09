import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFrontendSource } from "./check-frontend-source.mjs";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const vercelJson = JSON.parse(readFileSync(join(rootDir, "vercel.json"), "utf8"));
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const vercelIgnore = readFileSync(join(rootDir, ".vercelignore"), "utf8");
const frontendSource = readFrontendSource();

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
expect(
  frontendSource.includes("/api/snapshot"),
  "frontend does not reference /api/snapshot",
);
expect(
  frontendSource.includes("/api/refresh"),
  "frontend does not reference /api/refresh",
);
expect(
  indexHtml.includes('script type="module" src="./assets/app/main.js"'),
  "index.html does not bootstrap the frontend module",
);
expect(
  indexHtml.includes('<script src="./assets/app/seed-snapshot.js"></script>'),
  "index.html does not load the bundled seed snapshot script",
);
expect(vercelIgnore.includes("versions/"), "missing versions/ in .vercelignore");
expect(existsSync(join(rootDir, "package-lock.json")), "missing package-lock.json");
expect(existsSync(join(rootDir, "assets", "app", "seed-snapshot.js")), "missing assets/app/seed-snapshot.js");
expect(existsSync(join(rootDir, "api", "snapshot.js")), "missing api/snapshot.js");
expect(existsSync(join(rootDir, "api", "refresh.js")), "missing api/refresh.js");
expect(existsSync(join(rootDir, "scripts", "dev-server.mjs")), "missing scripts/dev-server.mjs");
expect(existsSync(join(rootDir, "scripts", "sync-seed-snapshot.mjs")), "missing scripts/sync-seed-snapshot.mjs");
expect(existsSync(join(rootDir, "lib", "refresh-service.js")), "missing lib/refresh-service.js");
expect(existsSync(join(rootDir, "lib", "snapshot-service.js")), "missing lib/snapshot-service.js");
expect(existsSync(join(rootDir, "data", "latest-snapshot.json")), "missing fallback snapshot file");

console.log("Vercel deployment files verified.");
