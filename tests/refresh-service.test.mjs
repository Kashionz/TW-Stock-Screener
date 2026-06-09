import assert from "node:assert/strict";
import test from "node:test";

function createSnapshot() {
  return {
    meta: {
      revPeriodROC: "11505",
    },
    rows: [
      { code: "2330", name: "台積電", ind: "半導體業", yoy: 31 },
      { code: "2317", name: "鴻海", ind: "其他電子業", yoy: 21 },
    ],
  };
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
  assert.equal(result.blobUrl, null);
  assert.equal(result.localPath, "/tmp/latest-snapshot.json");
  assert.equal(result.top5.length, 2);
});

test("refreshSnapshot writes blob snapshots in blob mode", async () => {
  const { refreshSnapshot } = await import("../lib/refresh-service.js");
  const snapshot = createSnapshot();

  const result = await refreshSnapshot({
    target: "blob",
    buildSnapshotImpl: async () => snapshot,
    writeLocalSnapshotImpl: async () => {
      throw new Error("local write should not be called");
    },
    writeBlobSnapshotImpl: async () => ({
      url: "https://blob.example/latest.json",
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.blobUrl, "https://blob.example/latest.json");
  assert.equal(result.localPath, null);
});
