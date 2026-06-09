import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
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
  const snapshotPath = join(dataDir, "latest-snapshot.json");

  await mkdir(dataDir, { recursive: true });
  await writeFile(snapshotPath, JSON.stringify(createSnapshot("11504")));
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
    const homeResponse = await fetch(server.url);
    assert.equal(homeResponse.status, 200);
    assert.match(await homeResponse.text(), /TW/u);

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

    const writtenSnapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
    assert.equal(writtenSnapshot.meta.revPeriodROC, "11505");
  } finally {
    await server.close();
  }
});
