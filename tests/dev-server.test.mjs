import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

function createSnapshot(revPeriodROC) {
  return {
    meta: {
      revPeriodROC,
    },
    rows: [
      {
        code: "2330",
        name: "台積電",
        ind: "半導體業",
        yoy: 31,
      },
    ],
  };
}

test("startDevServer serves static UI, snapshot, and authorized refresh", async () => {
  const { startDevServer } = await import("../scripts/dev-server.mjs");
  const rootDir = await mkdtemp(join(tmpdir(), "twse-dev-"));
  const dataDir = join(rootDir, "data");
  const assetsDir = join(rootDir, "assets", "app");
  const snapshotPath = join(dataDir, "latest-snapshot.json");
  const seedSnapshotPath = join(assetsDir, "seed-snapshot.js");

  await mkdir(dataDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });
  await writeFile(snapshotPath, JSON.stringify(createSnapshot("11504")));
  await writeFile(seedSnapshotPath, "window.__TWSE_INITIAL_SNAPSHOT__={};\n");
  await writeFile(join(rootDir, "index.html"), "<!doctype html><title>TW</title><h1>TW</h1>");
  await writeFile(join(rootDir, "thumbnail.png"), "png");

  const server = await startDevServer({
    rootDir,
    env: {
      PORT: "0",
      REFRESH_SECRET: "local-secret",
    },
    buildSnapshotImpl: async () => createSnapshot("11505"),
  });

  try {
    const homeResponse = await fetch(server.url);
    assert.equal(homeResponse.status, 200);
    const csp = homeResponse.headers.get("content-security-policy");
    assert.match(csp, /script-src 'self' https:\/\/cdn\.jsdelivr\.net/u);
    assert.match(csp, /frame-ancestors 'none'/u);
    assert.equal(homeResponse.headers.get("x-content-type-options"), "nosniff");
    assert.match(await homeResponse.text(), /TW/u);

    const imageResponse = await fetch(`${server.url}/thumbnail.png`);
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get("content-type"), "image/png");

    const snapshotResponse = await fetch(`${server.url}/api/snapshot`);
    assert.equal(snapshotResponse.status, 200);
    assert.equal(
      snapshotResponse.headers.get("cache-control"),
      "no-store",
    );
    assert.equal((await snapshotResponse.json()).meta.revPeriodROC, "11504");

    const unauthorizedRefreshResponse = await fetch(`${server.url}/api/refresh`);
    assert.equal(unauthorizedRefreshResponse.status, 401);
    assert.deepEqual(await unauthorizedRefreshResponse.json(), {
      ok: false,
      error: "Unauthorized",
    });

    const authorizedRefreshResponse = await fetch(`${server.url}/api/refresh`, {
      headers: {
        authorization: "Bearer local-secret",
      },
    });
    assert.equal(authorizedRefreshResponse.status, 200);
    const authorizedRefreshPayload = await authorizedRefreshResponse.json();
    assert.equal(authorizedRefreshPayload.meta.revPeriodROC, "11505");
    assert.ok(authorizedRefreshPayload.storedAt);

    const writtenSnapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
    assert.equal(writtenSnapshot.meta.revPeriodROC, "11505");
    assert.ok(writtenSnapshot.storedAt);

    const seedSnapshot = await readFile(seedSnapshotPath, "utf8");
    assert.match(seedSnapshot, /window\.__TWSE_INITIAL_SNAPSHOT__=/u);
    assert.match(seedSnapshot, /11505/u);
  } finally {
    await server.close();
  }
});

test("startDevServer answers conditional snapshot requests with 304", async () => {
  const { startDevServer } = await import("../scripts/dev-server.mjs");
  const rootDir = await mkdtemp(join(tmpdir(), "twse-dev-"));
  const dataDir = join(rootDir, "data");

  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "latest-snapshot.json"), JSON.stringify(createSnapshot("11504")));
  await writeFile(join(rootDir, "index.html"), "<!doctype html><title>TW</title><h1>TW</h1>");

  const server = await startDevServer({
    rootDir,
    env: {
      PORT: "0",
      REFRESH_SECRET: "local-secret",
    },
    buildSnapshotImpl: async () => createSnapshot("11505"),
  });

  try {
    const first = await fetch(`${server.url}/api/snapshot`);
    assert.equal(first.status, 200);
    const etag = first.headers.get("etag");
    assert.match(etag, /^"s[0-9a-z]+"$/u);

    const conditional = await fetch(`${server.url}/api/snapshot`, {
      headers: { "if-none-match": etag },
    });
    assert.equal(conditional.status, 304);
    assert.equal(conditional.headers.get("etag"), etag);
    assert.equal(await conditional.text(), "");
  } finally {
    await server.close();
  }
});

test("startDevServer only serves the public app assets", async () => {
  const { startDevServer } = await import("../scripts/dev-server.mjs");
  const rootDir = await mkdtemp(join(tmpdir(), "twse-dev-"));
  const dataDir = join(rootDir, "data");

  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "latest-snapshot.json"), JSON.stringify(createSnapshot("11504")));
  await writeFile(join(rootDir, "index.html"), "<!doctype html><title>TW</title><h1>TW</h1>");
  await writeFile(join(rootDir, ".env.local"), "SECRET=value");

  const server = await startDevServer({
    rootDir,
    env: {
      PORT: "0",
      REFRESH_SECRET: "local-secret",
    },
    buildSnapshotImpl: async () => createSnapshot("11505"),
  });

  try {
    const dotfileResponse = await fetch(`${server.url}/.env.local`);
    assert.equal(dotfileResponse.status, 404);
    assert.equal(await dotfileResponse.text(), "Not found");

    const dataFileResponse = await fetch(`${server.url}/data/latest-snapshot.json`);
    assert.equal(dataFileResponse.status, 404);
    assert.equal(await dataFileResponse.text(), "Not found");
  } finally {
    await server.close();
  }
});
test("startDevServer returns 404 for missing static files", async () => {
  const { startDevServer } = await import("../scripts/dev-server.mjs");
  const rootDir = await mkdtemp(join(tmpdir(), "twse-dev-"));
  const dataDir = join(rootDir, "data");

  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "latest-snapshot.json"), JSON.stringify(createSnapshot("11504")));
  await writeFile(join(rootDir, "index.html"), "<!doctype html><title>TW</title><h1>TW</h1>");

  const server = await startDevServer({
    rootDir,
    env: {
      PORT: "0",
      REFRESH_SECRET: "local-secret",
    },
    buildSnapshotImpl: async () => createSnapshot("11505"),
  });

  try {
    const response = await fetch(`${server.url}/missing-file`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Not found");
  } finally {
    await server.close();
  }
});

test("startDevServer returns 404 for static directory paths", async () => {
  const { startDevServer } = await import("../scripts/dev-server.mjs");
  const rootDir = await mkdtemp(join(tmpdir(), "twse-dev-"));
  const dataDir = join(rootDir, "data");

  await mkdir(dataDir, { recursive: true });
  await mkdir(join(rootDir, "assets"), { recursive: true });
  await writeFile(join(dataDir, "latest-snapshot.json"), JSON.stringify(createSnapshot("11504")));
  await writeFile(join(rootDir, "index.html"), "<!doctype html><title>TW</title><h1>TW</h1>");

  const server = await startDevServer({
    rootDir,
    env: {
      PORT: "0",
      REFRESH_SECRET: "local-secret",
    },
    buildSnapshotImpl: async () => createSnapshot("11505"),
  });

  try {
    const response = await fetch(`${server.url}/assets`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Not found");
  } finally {
    await server.close();
  }
});

test("startDevServer returns 404 for symlinked files outside rootDir", async () => {
  const { startDevServer } = await import("../scripts/dev-server.mjs");
  const rootDir = await mkdtemp(join(tmpdir(), "twse-dev-"));
  const outsideDir = await mkdtemp(join(tmpdir(), "twse-dev-outside-"));
  const dataDir = join(rootDir, "data");
  const outsideFilePath = join(outsideDir, "outside.txt");
  const symlinkPath = join(rootDir, "escape.txt");

  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "latest-snapshot.json"), JSON.stringify(createSnapshot("11504")));
  await writeFile(join(rootDir, "index.html"), "<!doctype html><title>TW</title><h1>TW</h1>");
  await writeFile(outsideFilePath, "outside");
  await symlink(outsideFilePath, symlinkPath);

  const server = await startDevServer({
    rootDir,
    env: {
      PORT: "0",
      REFRESH_SECRET: "local-secret",
    },
    buildSnapshotImpl: async () => createSnapshot("11505"),
  });

  try {
    const response = await fetch(`${server.url}/escape.txt`);
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Not found");
  } finally {
    await server.close();
  }
});
