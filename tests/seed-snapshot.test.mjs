import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

test("writeSeedSnapshot writes a browser-ready seed payload", async () => {
  const { writeSeedSnapshot } = await import("../lib/seed-snapshot.js");
  const rootDir = await mkdtemp(join(tmpdir(), "twse-seed-"));
  const filePath = join(rootDir, "assets", "app", "seed-snapshot.js");

  const snapshot = {
    meta: {
      revPeriodROC: "11505",
    },
    rows: [{ code: "2330" }],
  };

  await writeSeedSnapshot(snapshot, { filePath });
  const written = await readFile(filePath, "utf8");

  assert.match(written, /^window\.__TWSE_INITIAL_SNAPSHOT__=/u);
  assert.match(written, /"revPeriodROC":"11505"/u);
  assert.match(written, /"code":"2330"/u);
});
