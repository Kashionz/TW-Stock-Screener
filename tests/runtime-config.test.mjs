import assert from "node:assert/strict";
import test from "node:test";

test("getRuntimeConfig 會 trim secrets 並套用 defaults", async () => {
  const { getRuntimeConfig } = await import("../lib/runtime-config.js");
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

test("getRuntimeConfig({}) 會回傳預設值", async () => {
  const { getRuntimeConfig } = await import("../lib/runtime-config.js");
  const config = getRuntimeConfig({});

  assert.deepEqual(config, {
    port: 3000,
    refreshSecret: "",
    cronSecret: "",
    snapshotBlobPath: "twse-screener/latest.json",
  });
});
