import assert from "node:assert/strict";
import test from "node:test";

function createSnapshot() {
  return {
    meta: {
      revPeriodROC: "11505",
    },
    rows: [
      { code: "2330", name: "台積電", ind: "半導體業", yoy: 31, extra: "ignored" },
      { code: "1301", name: "台塑", ind: "塑膠工業", yoy: 12, extra: "ignored" },
      { code: "1101", name: "台泥", ind: "建材營造", yoy: 8, extra: "ignored" },
      { code: "2881", name: "富邦金", ind: "金融保險業", yoy: 15, extra: "ignored" },
      { code: "2317", name: "鴻海", ind: "其他電子業", yoy: 21, extra: "ignored" },
      { code: "2454", name: "聯發科", ind: "半導體業", yoy: 19, extra: "ignored" },
      { code: "2308", name: "台達電", ind: "電子零組件業", yoy: 18, extra: "ignored" },
      { code: "2382", name: "廣達", ind: "電腦及週邊設備業", yoy: 17, extra: "ignored" },
      { code: "2303", name: "聯電", ind: "半導體業", yoy: 16, extra: "ignored" },
    ],
  };
}

function expectedTop5() {
  return [
    { code: "2330", name: "台積電", ind: "半導體業", yoy: 31 },
    { code: "1301", name: "台塑", ind: "塑膠工業", yoy: 12 },
    { code: "2317", name: "鴻海", ind: "其他電子業", yoy: 21 },
    { code: "2454", name: "聯發科", ind: "半導體業", yoy: 19 },
    { code: "2308", name: "台達電", ind: "電子零組件業", yoy: 18 },
  ];
}

test("refreshSnapshot writes local snapshots in local mode", async () => {
  const { refreshSnapshot } = await import("../lib/refresh-service.js");
  const snapshot = createSnapshot();
  let writtenSnapshot = null;

  const result = await refreshSnapshot({
    target: "local",
    buildSnapshotImpl: async () => snapshot,
    writeLocalSnapshotImpl: async (payload) => {
      writtenSnapshot = payload;
      return { path: "/tmp/latest-snapshot.json" };
    },
    writeBlobSnapshotImpl: async () => {
      throw new Error("blob write should not be called");
    },
  });

  assert.equal(writtenSnapshot?.meta.revPeriodROC, "11505");
  assert.equal(result.ok, true);
  assert.equal(result.blobPath, null);
  assert.equal(result.blobUrl, null);
  assert.equal(result.localPath, "/tmp/latest-snapshot.json");
  assert.equal(result.seedPath, null);
  assert.deepEqual(result.top5, expectedTop5());
});

test("refreshSnapshot writes blob snapshots in blob mode", async () => {
  const { refreshSnapshot } = await import("../lib/refresh-service.js");
  const snapshot = createSnapshot();
  let writeOptions = null;

  const result = await refreshSnapshot({
    target: "blob",
    blobPath: "custom/latest.json",
    buildSnapshotImpl: async () => snapshot,
    writeLocalSnapshotImpl: async () => {
      throw new Error("local write should not be called");
    },
    writeBlobSnapshotImpl: async (_payload, options) => {
      writeOptions = options;
      return {
        url: "https://blob.example/latest.json",
      };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(writeOptions, {
    blobPath: "custom/latest.json",
  });
  assert.equal(result.blobPath, "custom/latest.json");
  assert.equal(result.blobUrl, "https://blob.example/latest.json");
  assert.equal(result.localPath, null);
  assert.equal(result.seedPath, null);
  assert.deepEqual(result.top5, expectedTop5());
});

test("refreshSnapshot only accepts local or blob target", async () => {
  const { refreshSnapshot } = await import("../lib/refresh-service.js");

  await assert.rejects(
    () =>
      refreshSnapshot({
        target: "staging",
        buildSnapshotImpl: async () => createSnapshot(),
      }),
    {
      message: 'Invalid refresh target: "staging". Expected "local" or "blob".',
    },
  );
});

test("refreshSnapshot sets storedAt after a successful write", async (t) => {
  const { refreshSnapshot } = await import("../lib/refresh-service.js");
  const RealDate = globalThis.Date;
  let phase = "before-write";

  class FakeDate extends RealDate {
    constructor(...args) {
      super(...args);
    }

    toISOString() {
      return phase;
    }
  }

  globalThis.Date = FakeDate;
  t.after(() => {
    globalThis.Date = RealDate;
  });

  const result = await refreshSnapshot({
    target: "local",
    buildSnapshotImpl: async () => createSnapshot(),
    writeLocalSnapshotImpl: async () => {
      phase = "after-write";
      return { path: "/tmp/latest-snapshot.json" };
    },
    writeBlobSnapshotImpl: async () => {
      throw new Error("blob write should not be called");
    },
  });

  assert.equal(result.storedAt, "after-write");
});

test("api refresh returns 401 JSON when unauthorized", async () => {
  const { GET } = await import("../api/refresh.js");

  const response = await GET(new Request("https://example.test/api/refresh"));
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(payload, { ok: false, error: "Unauthorized" });
});
