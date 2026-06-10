# Dual-Mode Local Development Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立雙模式本機開發流程，讓 `npm run dev` 可直接測頁面、`/api/snapshot`、`/api/refresh`，同時保留 `npm run dev:vercel` 作為正式相容驗證入口。

**Architecture:** 先把授權檢查、快照讀取、快照更新抽成共享服務，再讓 Vercel handler 與純 Node dev server 都只做 transport adapter。`dev` 模式中的 refresh 只寫回本機 `data/latest-snapshot.json`，`dev:vercel` 則沿用 Blob 路徑，讓日常開發與正式驗證共享主要邏輯。

**Tech Stack:** Node.js 20 ESM、原生 `node:http`、原生 `node:test`、Vercel serverless handler、`@vercel/blob`

---

## File Structure

### Create

- `lib/runtime-config.js`
  - 統一整理 `PORT`、`REFRESH_SECRET`、`CRON_SECRET`、`SNAPSHOT_BLOB_PATH` 等執行期設定。
- `lib/refresh-auth.js`
  - 提供 Bearer token 授權檢查與統一的 `UnauthorizedError`。
- `lib/snapshot-service.js`
  - 提供 `loadSnapshot({ source })`，封裝 `best` 與 `local` 兩種來源策略。
- `lib/refresh-service.js`
  - 提供 `refreshSnapshot({ target })`，封裝 build、寫入與 payload 組裝。
- `scripts/dev-server.mjs`
  - 提供純 Node 本機 server，供 `npm run dev` 使用。
- `tests/runtime-config.test.mjs`
- `tests/refresh-auth.test.mjs`
- `tests/snapshot-service.test.mjs`
- `tests/refresh-service.test.mjs`
- `tests/dev-server.test.mjs`

### Modify

- `lib/snapshot-store.js`
  - 加入本機快照寫入 helper，保留既有 Blob 讀寫行為。
- `scripts/refresh-local.mjs`
  - 改為透過 `refresh-service` 更新本機快照。
- `api/snapshot.js`
  - 改為呼叫 `snapshot-service`。
- `api/refresh.js`
  - 改為呼叫 `refresh-auth` 與 `refresh-service`。
- `package.json`
  - 加入 `test`、`dev`、`dev:vercel`。
- `README.md`
  - 更新本機開發與測試流程說明。
- `check-vercel-deploy.mjs`
  - 補檢查新的 npm scripts 與新檔案存在。

## Task 1: 建立共用執行期設定與授權基礎

**Files:**
- Create: `lib/runtime-config.js`
- Create: `lib/refresh-auth.js`
- Create: `tests/runtime-config.test.mjs`
- Create: `tests/refresh-auth.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 先寫 `runtime-config` 與 `refresh-auth` 的失敗測試**

```js
// tests/runtime-config.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import { getRuntimeConfig } from "../lib/runtime-config.js";

test("getRuntimeConfig trims secrets and applies defaults", () => {
  const config = getRuntimeConfig({
    PORT: "4310",
    REFRESH_SECRET: "  local-secret  ",
    CRON_SECRET: "  cron-secret  ",
    SNAPSHOT_BLOB_PATH: "custom/path.json",
  });

  assert.deepEqual(config, {
    port: 4310,
    refreshSecret: "local-secret",
    cronSecret: "cron-secret",
    snapshotBlobPath: "custom/path.json",
  });
});

test("getRuntimeConfig falls back to defaults when values are missing", () => {
  const config = getRuntimeConfig({});

  assert.deepEqual(config, {
    port: 3000,
    refreshSecret: "",
    cronSecret: "",
    snapshotBlobPath: "twse-screener/latest.json",
  });
});
```

```js
// tests/refresh-auth.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import { UnauthorizedError, isAuthorizedBearerToken } from "../lib/refresh-auth.js";

const config = {
  refreshSecret: "refresh-one",
  cronSecret: "cron-one",
};

test("isAuthorizedBearerToken accepts refresh secret", () => {
  assert.equal(isAuthorizedBearerToken("Bearer refresh-one", config), true);
});

test("isAuthorizedBearerToken accepts cron secret", () => {
  assert.equal(isAuthorizedBearerToken("Bearer cron-one", config), true);
});

test("isAuthorizedBearerToken rejects invalid or missing tokens", () => {
  assert.equal(isAuthorizedBearerToken("Bearer wrong", config), false);
  assert.equal(isAuthorizedBearerToken("", config), false);
  assert.equal(isAuthorizedBearerToken(null, config), false);
});

test("UnauthorizedError exposes the 401 status code", () => {
  const error = new UnauthorizedError();

  assert.equal(error.message, "Unauthorized");
  assert.equal(error.status, 401);
});
```

- [ ] **Step 2: 先讓測試確實失敗**

Run: `node --test tests/runtime-config.test.mjs tests/refresh-auth.test.mjs`

Expected: FAIL，錯誤會指出 `../lib/runtime-config.js` 或 `../lib/refresh-auth.js` 尚不存在。

- [ ] **Step 3: 以最小實作補上共用設定與授權 helper**

```js
// lib/runtime-config.js
const DEFAULT_PORT = 3000;
const DEFAULT_SNAPSHOT_BLOB_PATH = "twse-screener/latest.json";

function trimEnv(value) {
  return value == null ? "" : String(value).trim();
}

export function getRuntimeConfig(env = process.env) {
  const port = Number.parseInt(trimEnv(env.PORT), 10);

  return {
    port: Number.isFinite(port) ? port : DEFAULT_PORT,
    refreshSecret: trimEnv(env.REFRESH_SECRET),
    cronSecret: trimEnv(env.CRON_SECRET),
    snapshotBlobPath: trimEnv(env.SNAPSHOT_BLOB_PATH) || DEFAULT_SNAPSHOT_BLOB_PATH,
  };
}
```

```js
// lib/refresh-auth.js
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
    this.status = 401;
  }
}

export function isAuthorizedBearerToken(headerValue, config) {
  const secrets = [config.refreshSecret, config.cronSecret].filter(Boolean);
  if (secrets.length === 0) return false;
  return secrets.some((secret) => headerValue === `Bearer ${secret}`);
}

export function assertAuthorizedBearerToken(headerValue, config) {
  if (!isAuthorizedBearerToken(headerValue, config)) {
    throw new UnauthorizedError();
  }
}
```

```json
// package.json
{
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "check:deploy": "node ./check-vercel-deploy.mjs",
    "check:ui": "node ./check-color-display.mjs && node ./check-drawer-eps-fallback.mjs && node ./check-eps-yoy-column.mjs && node ./check-link-field-removed.mjs && node ./check-pagination.mjs && node ./check-project-name.mjs && node ./check-sidebar-refresh.mjs",
    "refresh:local": "node ./scripts/refresh-local.mjs"
  }
}
```

- [ ] **Step 4: 跑測試確認共用基礎通過**

Run: `node --test --test-name-pattern="(getRuntimeConfig|isAuthorizedBearerToken|UnauthorizedError)" tests/runtime-config.test.mjs tests/refresh-auth.test.mjs`

Expected: PASS，4 個測試全過。

- [ ] **Step 5: 建立第一個基礎 commit**

```bash
git add package.json lib/runtime-config.js lib/refresh-auth.js tests/runtime-config.test.mjs tests/refresh-auth.test.mjs
git commit -m "test: add runtime config and refresh auth coverage" -m "Add a minimal node:test harness for shared runtime configuration and Bearer token authorization. This establishes the common foundations needed by both the pure Node dev server and the Vercel adapters."
```

## Task 2: 抽出快照讀取服務與本機寫入能力

**Files:**
- Modify: `lib/snapshot-store.js`
- Create: `lib/snapshot-service.js`
- Create: `tests/snapshot-service.test.mjs`

- [ ] **Step 1: 先寫 `snapshot-service` 的失敗測試**

```js
// tests/snapshot-service.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import { loadSnapshot } from "../lib/snapshot-service.js";

test("loadSnapshot returns local snapshot in local mode", async () => {
  const snapshot = { meta: { revPeriodROC: "11504" }, rows: [{ code: "2330" }] };

  const result = await loadSnapshot({
    source: "local",
    readLocalSnapshotImpl: async () => snapshot,
    readBlobSnapshotImpl: async () => {
      throw new Error("blob should not be read");
    },
  });

  assert.equal(result, snapshot);
});

test("loadSnapshot prefers blob data in best mode", async () => {
  const blobSnapshot = { meta: { revPeriodROC: "11505" }, rows: [{ code: "2317" }] };
  const localSnapshot = { meta: { revPeriodROC: "11504" }, rows: [{ code: "2330" }] };

  const result = await loadSnapshot({
    source: "best",
    readLocalSnapshotImpl: async () => localSnapshot,
    readBlobSnapshotImpl: async () => blobSnapshot,
  });

  assert.equal(result, blobSnapshot);
});

test("loadSnapshot falls back to local data when blob load fails", async () => {
  const localSnapshot = { meta: { revPeriodROC: "11504" }, rows: [{ code: "2330" }] };

  const result = await loadSnapshot({
    source: "best",
    readLocalSnapshotImpl: async () => localSnapshot,
    readBlobSnapshotImpl: async () => {
      throw new Error("boom");
    },
  });

  assert.equal(result, localSnapshot);
});
```

- [ ] **Step 2: 跑測試確認目前尚未實作**

Run: `node --test tests/snapshot-service.test.mjs`

Expected: FAIL，錯誤會指出 `../lib/snapshot-service.js` 尚不存在。

- [ ] **Step 3: 補上快照服務與本機寫入 helper**

```js
// lib/snapshot-service.js
import { readBlobSnapshot, readLocalSnapshot } from "./snapshot-store.js";

export async function loadSnapshot({
  source = "best",
  readLocalSnapshotImpl = readLocalSnapshot,
  readBlobSnapshotImpl = readBlobSnapshot,
} = {}) {
  if (source === "local") {
    return readLocalSnapshotImpl();
  }

  try {
    const blobSnapshot = await readBlobSnapshotImpl();
    if (blobSnapshot) return blobSnapshot;
  } catch {
    // Fall through to local snapshot.
  }

  return readLocalSnapshotImpl();
}
```

```js
// lib/snapshot-store.js
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const LOCAL_SNAPSHOT_PATH = join(ROOT_DIR, "data", "latest-snapshot.json");
export const SNAPSHOT_BLOB_PATH =
  process.env.SNAPSHOT_BLOB_PATH || "twse-screener/latest.json";

export async function readLocalSnapshot() {
  const raw = await readFile(LOCAL_SNAPSHOT_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeLocalSnapshot(snapshot) {
  await writeFile(LOCAL_SNAPSHOT_PATH, JSON.stringify(snapshot));
  return {
    path: LOCAL_SNAPSHOT_PATH,
  };
}

export async function readBlobSnapshot() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { get } = await import("@vercel/blob");
  const blob = await get(SNAPSHOT_BLOB_PATH, {
    access: "private",
    useCache: false,
  });
  if (!blob) return null;
  return new Response(blob.stream).json();
}

export async function loadBestSnapshot() {
  try {
    const blobSnapshot = await readBlobSnapshot();
    if (blobSnapshot) return blobSnapshot;
  } catch {
    // Fall back to the bundled seed snapshot.
  }
  return readLocalSnapshot();
}
```

- [ ] **Step 4: 跑測試確認快照讀取分支正確**

Run: `node --test --test-name-pattern="loadSnapshot" tests/snapshot-service.test.mjs`

Expected: PASS，`local`、`best`、fallback 三條路徑都通過。

- [ ] **Step 5: 建立快照服務 commit**

```bash
git add lib/snapshot-store.js lib/snapshot-service.js tests/snapshot-service.test.mjs
git commit -m "refactor: extract snapshot loading service" -m "Introduce a shared snapshot service and a local snapshot writer so both local development and Vercel handlers can reuse the same snapshot-loading logic."
```

## Task 3: 抽出共享 refresh service，讓 CLI 與 Vercel handler 共用

**Files:**
- Create: `lib/refresh-service.js`
- Create: `tests/refresh-service.test.mjs`
- Modify: `scripts/refresh-local.mjs`
- Modify: `api/refresh.js`

- [ ] **Step 1: 先寫 refresh service 的失敗測試**

```js
// tests/refresh-service.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import { refreshSnapshot } from "../lib/refresh-service.js";

test("refreshSnapshot writes local snapshots in local mode", async () => {
  let writtenSnapshot = null;

  const result = await refreshSnapshot({
    target: "local",
    buildSnapshotImpl: async () => ({
      meta: { revPeriodROC: "11505" },
      rows: [
        { code: "2330", name: "台積電", ind: "半導體業", yoy: 31 },
        { code: "2317", name: "鴻海", ind: "其他電子業", yoy: 21 },
      ],
    }),
    writeLocalSnapshotImpl: async (snapshot) => {
      writtenSnapshot = snapshot;
      return { path: "/tmp/latest-snapshot.json" };
    },
    writeBlobSnapshotImpl: async () => {
      throw new Error("blob writer should not be used");
    },
  });

  assert.equal(writtenSnapshot.meta.revPeriodROC, "11505");
  assert.equal(result.ok, true);
  assert.equal(result.blobUrl, null);
  assert.equal(result.localPath, "/tmp/latest-snapshot.json");
  assert.equal(result.top5.length, 2);
});

test("refreshSnapshot writes blob snapshots in blob mode", async () => {
  const result = await refreshSnapshot({
    target: "blob",
    buildSnapshotImpl: async () => ({
      meta: { revPeriodROC: "11505" },
      rows: [{ code: "2330", name: "台積電", ind: "半導體業", yoy: 31 }],
    }),
    writeLocalSnapshotImpl: async () => {
      throw new Error("local writer should not be used");
    },
    writeBlobSnapshotImpl: async () => ({
      url: "https://blob.example/latest.json",
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.blobUrl, "https://blob.example/latest.json");
  assert.equal(result.localPath, null);
});
```

- [ ] **Step 2: 跑測試確認 service 尚未存在**

Run: `node --test tests/refresh-service.test.mjs`

Expected: FAIL，錯誤會指出 `../lib/refresh-service.js` 尚不存在。

- [ ] **Step 3: 補上 refresh service，並改掉 local CLI 與 Vercel refresh handler**

```js
// lib/refresh-service.js
import { buildSnapshot } from "./build-snapshot.js";
import {
  SNAPSHOT_BLOB_PATH,
  writeBlobSnapshot,
  writeLocalSnapshot,
} from "./snapshot-store.js";

const LUMPY = new Set(["建材營造", "金融保險業"]);

function buildTop5(rows) {
  return rows
    .filter((row) => !LUMPY.has(row.ind))
    .slice(0, 5)
    .map((row) => ({
      code: row.code,
      name: row.name,
      ind: row.ind,
      yoy: row.yoy,
    }));
}

export async function refreshSnapshot({
  target,
  buildSnapshotImpl = buildSnapshot,
  writeLocalSnapshotImpl = writeLocalSnapshot,
  writeBlobSnapshotImpl = writeBlobSnapshot,
} = {}) {
  const snapshot = await buildSnapshotImpl();

  if (target === "local") {
    const local = await writeLocalSnapshotImpl(snapshot);
    return {
      ok: true,
      storedAt: new Date().toISOString(),
      blobPath: null,
      blobUrl: null,
      localPath: local.path,
      meta: snapshot.meta,
      top5: buildTop5(snapshot.rows),
    };
  }

  const blob = await writeBlobSnapshotImpl(snapshot);
  return {
    ok: true,
    storedAt: new Date().toISOString(),
    blobPath: SNAPSHOT_BLOB_PATH,
    blobUrl: blob.url,
    localPath: null,
    meta: snapshot.meta,
    top5: buildTop5(snapshot.rows),
  };
}
```

```js
// scripts/refresh-local.mjs
import { refreshSnapshot } from "../lib/refresh-service.js";

const payload = await refreshSnapshot({
  target: "local",
});

console.log(
  JSON.stringify(
    {
      outputPath: payload.localPath,
      meta: payload.meta,
      top5: payload.top5.map((row) => `${row.code} ${row.name} ${row.yoy}`),
    },
    null,
    2,
  ),
);
```

```js
// api/refresh.js
import { assertAuthorizedBearerToken, UnauthorizedError } from "../lib/refresh-auth.js";
import { refreshSnapshot } from "../lib/refresh-service.js";
import { getRuntimeConfig } from "../lib/runtime-config.js";

export async function GET(request) {
  try {
    const config = getRuntimeConfig();
    assertAuthorizedBearerToken(request.headers.get("authorization"), config);

    return Response.json(
      await refreshSnapshot({
        target: "blob",
      }),
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown refresh error",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: 跑測試與既有 local refresh 腳本確認整合成功**

Run: `node --test --test-name-pattern="refreshSnapshot" tests/refresh-service.test.mjs`

Expected: PASS，local/blob 兩條寫入分支皆通過。

Run: `npm run refresh:local`

Expected: PASS，印出 `outputPath`、`meta`、`top5` 的 JSON 結果，且 `data/latest-snapshot.json` 被更新。

- [ ] **Step 5: 建立 refresh 共享邏輯 commit**

```bash
git add lib/refresh-service.js scripts/refresh-local.mjs api/refresh.js tests/refresh-service.test.mjs
git commit -m "refactor: share refresh workflow across runtimes" -m "Extract the snapshot rebuild workflow into a shared refresh service so the local CLI and Vercel refresh handler use the same build and payload logic."
```

## Task 4: 建立純 Node dev server，接上共享 snapshot/refresh 邏輯

**Files:**
- Create: `scripts/dev-server.mjs`
- Create: `tests/dev-server.test.mjs`
- Modify: `api/snapshot.js`

- [ ] **Step 1: 先寫 dev server 的失敗測試**

```js
// tests/dev-server.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startDevServer } from "../scripts/dev-server.mjs";

test("startDevServer serves local snapshot and authorized refresh", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "twse-dev-"));
  await mkdir(join(rootDir, "data"), { recursive: true });
  await writeFile(join(rootDir, "index.html"), "<!doctype html><title>TW</title><h1>TW</h1>");
  await writeFile(
    join(rootDir, "data", "latest-snapshot.json"),
    JSON.stringify({ meta: { revPeriodROC: "11504" }, rows: [{ code: "2330" }] }),
  );

  const server = await startDevServer({
    rootDir,
    env: {
      PORT: "0",
      REFRESH_SECRET: "local-secret",
    },
    buildSnapshotImpl: async () => ({
      meta: { revPeriodROC: "11505" },
      rows: [{ code: "2330", name: "台積電", ind: "半導體業", yoy: 31 }],
    }),
  });

  t.after(async () => {
    await server.close();
  });

  const homeRes = await fetch(`${server.url}/`);
  assert.equal(homeRes.status, 200);
  assert.match(await homeRes.text(), /TW/);

  const snapshotRes = await fetch(`${server.url}/api/snapshot`);
  assert.equal(snapshotRes.status, 200);
  const snapshotPayload = await snapshotRes.json();
  assert.equal(snapshotPayload.meta.revPeriodROC, "11504");

  const unauthorizedRefresh = await fetch(`${server.url}/api/refresh`);
  assert.equal(unauthorizedRefresh.status, 401);

  const refreshRes = await fetch(`${server.url}/api/refresh`, {
    headers: {
      authorization: "Bearer local-secret",
    },
  });
  assert.equal(refreshRes.status, 200);
  const refreshPayload = await refreshRes.json();
  assert.equal(refreshPayload.meta.revPeriodROC, "11505");

  const writtenSnapshot = JSON.parse(
    await readFile(join(rootDir, "data", "latest-snapshot.json"), "utf8"),
  );
  assert.equal(writtenSnapshot.meta.revPeriodROC, "11505");
});
```

- [ ] **Step 2: 跑測試確認 server 尚未實作**

Run: `node --test tests/dev-server.test.mjs`

Expected: FAIL，錯誤會指出 `../scripts/dev-server.mjs` 尚不存在。

- [ ] **Step 3: 實作純 Node dev server，並改造 snapshot handler**

```js
// scripts/dev-server.mjs
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { assertAuthorizedBearerToken, UnauthorizedError } from "../lib/refresh-auth.js";
import { refreshSnapshot } from "../lib/refresh-service.js";
import { getRuntimeConfig } from "../lib/runtime-config.js";
import { loadSnapshot } from "../lib/snapshot-service.js";

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

function contentTypeFor(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

export async function startDevServer({
  rootDir = ROOT_DIR,
  env = process.env,
  buildSnapshotImpl,
} = {}) {
  const config = getRuntimeConfig(env);
  const dataSnapshotPath = join(rootDir, "data", "latest-snapshot.json");

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host}`);

      if (url.pathname === "/api/snapshot") {
        const snapshot = await loadSnapshot({
          source: "local",
          readLocalSnapshotImpl: async () =>
            JSON.parse(await readFile(dataSnapshotPath, "utf8")),
        });
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify(snapshot));
        return;
      }

      if (url.pathname === "/api/refresh") {
        try {
          assertAuthorizedBearerToken(req.headers.authorization || "", config);
          const payload = await refreshSnapshot({
            target: "local",
            buildSnapshotImpl,
            writeLocalSnapshotImpl: async (snapshot) => {
              await writeFile(dataSnapshotPath, JSON.stringify(snapshot));
              return { path: dataSnapshotPath };
            },
          });
          res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          res.end(JSON.stringify(payload));
          return;
        } catch (error) {
          if (error instanceof UnauthorizedError) {
            res.writeHead(401, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
            res.end(JSON.stringify({ ok: false, error: error.message }));
            return;
          }
          throw error;
        }
      }

      const relativePath = url.pathname === "/" ? "index.html" : normalize(url.pathname).replace(/^\/+/, "");
      const filePath = join(rootDir, relativePath);
      if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      const body = await readFile(filePath);
      res.writeHead(200, { "content-type": contentTypeFor(filePath) });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown dev server error" }));
    }
  });

  await new Promise((resolve) => {
    server.listen(config.port, resolve);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startDevServer();
  console.log(`TW Stock Screener dev server running at ${server.url}`);
}
```

```js
// api/snapshot.js
import { loadSnapshot } from "../lib/snapshot-service.js";

export async function GET() {
  try {
    const snapshot = await loadSnapshot({
      source: "best",
    });

    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown snapshot error",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
```

- [ ] **Step 4: 跑 server 測試與手動 smoke check**

Run: `node --test --test-name-pattern="startDevServer" tests/dev-server.test.mjs`

Expected: PASS，首頁、`/api/snapshot`、授權前後的 `/api/refresh` 都通過。

Run: `node ./scripts/dev-server.mjs`

Expected: PASS，終端輸出 `TW Stock Screener dev server running at http://127.0.0.1:<port>`。

- [ ] **Step 5: 建立本機 server commit**

```bash
git add scripts/dev-server.mjs api/snapshot.js tests/dev-server.test.mjs
git commit -m "feat: add pure node local dev server" -m "Add a standalone local dev server that serves the static UI plus snapshot and refresh endpoints using the shared services. This creates a daily development path that behaves like the deployed app without requiring Blob storage."
```

## Task 5: 補 npm scripts、README 與驗證檢查

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `check-vercel-deploy.mjs`

- [ ] **Step 1: 先寫會失敗的部署檢查**

```js
// check-vercel-deploy.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));

expect(packageJson.scripts?.dev === "node ./scripts/dev-server.mjs", "missing dev script");
expect(packageJson.scripts?.["dev:vercel"] === "vercel dev", "missing dev:vercel script");
expect(packageJson.scripts?.test === "node --test tests/*.test.mjs", "missing test script");
expect(existsSync(join(rootDir, "scripts", "dev-server.mjs")), "missing scripts/dev-server.mjs");
expect(existsSync(join(rootDir, "lib", "refresh-service.js")), "missing lib/refresh-service.js");
expect(existsSync(join(rootDir, "lib", "snapshot-service.js")), "missing lib/snapshot-service.js");
```

- [ ] **Step 2: 跑現有檢查，確認現在會因新需求而失敗**

Run: `npm run check:deploy`

Expected: FAIL，指出缺少新的 scripts 或共享服務檔案。

- [ ] **Step 3: 補上 scripts、README 說明與更新後的檢查**

```json
// package.json
{
  "scripts": {
    "dev": "node ./scripts/dev-server.mjs",
    "dev:vercel": "vercel dev",
    "test": "node --test tests/*.test.mjs",
    "check:deploy": "node ./check-vercel-deploy.mjs",
    "check:ui": "node ./check-color-display.mjs && node ./check-drawer-eps-fallback.mjs && node ./check-eps-yoy-column.mjs && node ./check-link-field-removed.mjs && node ./check-pagination.mjs && node ./check-project-name.mjs && node ./check-sidebar-refresh.mjs",
    "refresh:local": "node ./scripts/refresh-local.mjs"
  }
}
```

````md
// README.md
## Local Development

### Prerequisites

- Node.js 20.x
- `REFRESH_SECRET` set in your shell when testing `/api/refresh`
- Vercel CLI installed for `npm run dev:vercel`

### Daily local development

```bash
npm run dev
```

This starts a pure Node server for:

- `/`
- `/api/snapshot` using `data/latest-snapshot.json`
- `/api/refresh` writing back to `data/latest-snapshot.json`

### Vercel compatibility verification

```bash
npm run dev:vercel
```

Use this mode when you need to verify deployed behavior, including Blob-backed refresh.
````

```js
// check-vercel-deploy.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
expect(packageJson.scripts?.dev === "node ./scripts/dev-server.mjs", "missing dev script");
expect(packageJson.scripts?.["dev:vercel"] === "vercel dev", "missing dev:vercel script");
expect(packageJson.scripts?.test === "node --test tests/*.test.mjs", "missing test script");
expect(
  Array.isArray(vercelJson.crons) &&
    vercelJson.crons.some((cron) => cron.path === "/api/refresh"),
  "missing Vercel cron for /api/refresh",
);
expect(indexHtml.includes("fetch('/api/snapshot'"), "frontend does not hydrate from /api/snapshot");
expect(vercelIgnore.includes("versions/"), "missing versions/ in .vercelignore");
expect(existsSync(join(rootDir, "scripts", "dev-server.mjs")), "missing scripts/dev-server.mjs");
expect(existsSync(join(rootDir, "lib", "refresh-service.js")), "missing lib/refresh-service.js");
expect(existsSync(join(rootDir, "lib", "snapshot-service.js")), "missing lib/snapshot-service.js");
expect(existsSync(join(rootDir, "data", "latest-snapshot.json")), "missing fallback snapshot file");

console.log("Vercel deployment files verified.");
```

- [ ] **Step 4: 跑完整驗證流程**

Run: `npm test`

Expected: PASS，所有 `tests/*.test.mjs` 皆通過。

Run: `npm run check:ui`

Expected: PASS，既有 UI marker 檢查不退化。

Run: `npm run check:deploy`

Expected: PASS，部署與本機雙模式需要的檔案/指令都存在。

Run: `npm run dev`

Expected: PASS，純 Node 本機 server 可啟動並提供本機測試入口。

Run: `npm run dev:vercel`

Expected: PASS，Vercel 本機 server 可啟動；若缺少 CLI，應先依 README 補齊後再重跑。

- [ ] **Step 5: 建立文件與驗證收尾 commit**

```bash
git add package.json README.md check-vercel-deploy.mjs
git commit -m "docs: document dual-mode local development workflow" -m "Document the new daily Node dev server, Vercel verification path, and the required scripts and checks so local testing matches the intended workflow."
```

## Spec Coverage Check

- `npm run dev` 可直接測頁面與 `/api/snapshot`、`/api/refresh`
  - Task 4、Task 5
- `npm run dev:vercel` 保留正式相容驗證
  - Task 5
- `dev` 模式 refresh 寫回本機 `data/latest-snapshot.json`
  - Task 3、Task 4
- 前端 UI 呼叫介面不變
  - Task 4 只改 adapter，不改 [index.html](/Users/kashionz/Desktop/tw-stock-screener/index.html:316)
- 抽出共享 auth / snapshot / refresh 核心
  - Task 1、Task 2、Task 3

## Self-Review Notes

- 沒有 `TBD`、`TODO` 或「之後再補」的 placeholder。
- `loadSnapshot`、`refreshSnapshot`、`assertAuthorizedBearerToken` 的命名在各 task 間一致。
- 任務切法保持每個 commit 都可單獨驗證，不把 Node dev server、共享 service、README 改動混成一包。
