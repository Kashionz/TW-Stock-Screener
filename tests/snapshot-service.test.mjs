import assert from "node:assert/strict";
import test from "node:test";

test("loadSnapshot returns local snapshot in local mode", async () => {
  const { loadSnapshot } = await import("../lib/snapshot-service.js");
  const localSnapshot = { source: "local", items: [1, 2, 3] };

  const result = await loadSnapshot({
    source: "local",
    readLocalSnapshotImpl: async () => localSnapshot,
    readBlobSnapshotImpl: async () => {
      throw new Error("blob should not be read");
    },
  });

  assert.equal(result, localSnapshot);
});

test("loadSnapshot prefers blob data in best mode", async () => {
  const { loadSnapshot } = await import("../lib/snapshot-service.js");
  const blobSnapshot = { source: "blob", items: ["blob"] };
  const localSnapshot = { source: "local", items: ["local"] };

  const result = await loadSnapshot({
    source: "best",
    readLocalSnapshotImpl: async () => localSnapshot,
    readBlobSnapshotImpl: async () => blobSnapshot,
  });

  assert.equal(result, blobSnapshot);
});

test("loadSnapshot falls back to local data when blob load fails", async () => {
  const { loadSnapshot } = await import("../lib/snapshot-service.js");
  const localSnapshot = { source: "local", items: ["local"] };

  const result = await loadSnapshot({
    source: "best",
    readLocalSnapshotImpl: async () => localSnapshot,
    readBlobSnapshotImpl: async () => {
      throw new Error("boom");
    },
  });

  assert.equal(result, localSnapshot);
});

test("loadSnapshot falls back to local data when blob load returns null", async () => {
  const { loadSnapshot } = await import("../lib/snapshot-service.js");
  const localSnapshot = { source: "local", items: ["local"] };

  const result = await loadSnapshot({
    source: "best",
    readLocalSnapshotImpl: async () => localSnapshot,
    readBlobSnapshotImpl: async () => null,
  });

  assert.equal(result, localSnapshot);
});
