import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFrontendSource } from "./check-frontend-source.mjs";
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS } from "./lib/security-headers.js";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const vercelJson = JSON.parse(readFileSync(join(rootDir, "vercel.json"), "utf8"));
const indexHtml = readFileSync(join(rootDir, "index.html"), "utf8");
const vercelIgnore = readFileSync(join(rootDir, ".vercelignore"), "utf8");
const vercelWorkflow = readFileSync(join(rootDir, ".github", "workflows", "vercel-deploy.yml"), "utf8");
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
  vercelJson.git?.deploymentEnabled === false,
  "vercel.json should disable built-in Git deployments",
);

const globalHeaderRule = (vercelJson.headers || []).find(
  (rule) => rule.source === "/(.*)",
);
expect(Boolean(globalHeaderRule), "vercel.json is missing the global security headers rule");
for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
  const header = (globalHeaderRule.headers || []).find((entry) => entry.key === key);
  expect(Boolean(header), `vercel.json is missing the ${key} header`);
  expect(
    header.value === value,
    `vercel.json ${key} must match lib/security-headers.js`,
  );
}
expect(
  CONTENT_SECURITY_POLICY.includes("https://cdn.jsdelivr.net"),
  "CSP must allow the Chart.js CDN origin",
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
expect(
  existsSync(join(rootDir, ".github", "workflows", "vercel-deploy.yml")),
  "missing .github/workflows/vercel-deploy.yml",
);
expect(existsSync(join(rootDir, "assets", "app", "seed-snapshot.js")), "missing assets/app/seed-snapshot.js");
expect(existsSync(join(rootDir, "api", "snapshot.js")), "missing api/snapshot.js");
expect(existsSync(join(rootDir, "api", "refresh.js")), "missing api/refresh.js");
expect(existsSync(join(rootDir, "scripts", "dev-server.mjs")), "missing scripts/dev-server.mjs");
expect(existsSync(join(rootDir, "scripts", "sync-seed-snapshot.mjs")), "missing scripts/sync-seed-snapshot.mjs");
expect(existsSync(join(rootDir, "lib", "refresh-service.js")), "missing lib/refresh-service.js");
expect(existsSync(join(rootDir, "lib", "snapshot-service.js")), "missing lib/snapshot-service.js");
expect(existsSync(join(rootDir, "data", "latest-snapshot.json")), "missing fallback snapshot file");
expect(vercelWorkflow.includes("npm test"), "workflow does not run npm test");
expect(vercelWorkflow.includes("npm run check:ui"), "workflow does not run UI checks");
expect(vercelWorkflow.includes("npm run check:deploy"), "workflow does not run deploy checks");
expect(
  vercelWorkflow.includes("VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}"),
  "workflow does not load VERCEL_ORG_ID secret",
);
expect(
  vercelWorkflow.includes("VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}"),
  "workflow does not load VERCEL_PROJECT_ID secret",
);
expect(
  vercelWorkflow.includes("vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}"),
  "workflow does not pull the Vercel preview environment",
);
expect(
  vercelWorkflow.includes("vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}"),
  "workflow does not deploy Vercel preview builds",
);
expect(
  vercelWorkflow.includes("vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}"),
  "workflow does not pull the Vercel production environment",
);
expect(
  vercelWorkflow.includes("vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}"),
  "workflow does not build Vercel production artifacts",
);
expect(
  vercelWorkflow.includes("vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}"),
  "workflow does not deploy Vercel production builds",
);

console.log("Vercel deployment files verified.");
