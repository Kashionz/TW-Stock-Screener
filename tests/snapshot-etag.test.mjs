import assert from "node:assert/strict";
import test from "node:test";

function snapshot(meta) {
  return { meta, rows: [] };
}

test("snapshotEtag returns a quoted, weak-free ETag string", async () => {
  const { snapshotEtag } = await import("../lib/snapshot-etag.js");

  const etag = snapshotEtag(snapshot({ revPeriodROC: "11505", count: 1954 }));

  assert.match(etag, /^"s[0-9a-z]+"$/u);
});

test("snapshotEtag is stable for identical meta", async () => {
  const { snapshotEtag } = await import("../lib/snapshot-etag.js");

  const meta = { revPeriodROC: "11505", valDateROC: "1150605", incQuarter: ["115", "1"], count: 1954, r12n: 1830, epsN: 1951 };

  assert.equal(snapshotEtag(snapshot({ ...meta })), snapshotEtag(snapshot({ ...meta })));
});

test("snapshotEtag changes when a guarded meta field changes", async () => {
  const { snapshotEtag } = await import("../lib/snapshot-etag.js");

  const base = { revPeriodROC: "11505", valDateROC: "1150605", count: 1954, r12n: 1830 };
  const moved = { ...base, valDateROC: "1150606" };

  assert.notEqual(snapshotEtag(snapshot(base)), snapshotEtag(snapshot(moved)));
});

test("snapshotEtag does not throw on missing meta", async () => {
  const { snapshotEtag } = await import("../lib/snapshot-etag.js");

  assert.match(snapshotEtag(undefined), /^"s[0-9a-z]+"$/u);
  assert.match(snapshotEtag({}), /^"s[0-9a-z]+"$/u);
});
