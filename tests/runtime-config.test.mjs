import assert from "node:assert/strict";
import test from "node:test";

test("trimEnv 會 trim 字串並將非字串視為空字串", async () => {
  const { trimEnv } = await import("../lib/runtime-config.js");

  assert.equal(trimEnv("  value  "), "value");
  assert.equal(trimEnv(""), "");
  assert.equal(trimEnv(undefined), "");
  assert.equal(trimEnv(null), "");
  assert.equal(trimEnv(3000), "");
});

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
  const { getRuntimeConfig, DEFAULT_PORT } = await import("../lib/runtime-config.js");
  const config = getRuntimeConfig({});

  assert.deepEqual(config, {
    port: DEFAULT_PORT,
    refreshSecret: "",
    cronSecret: "",
    snapshotBlobPath: "twse-screener/latest.json",
  });
});

test("getRuntimeConfig 對非純整數 PORT 會 fallback 到預設值", async () => {
  const { getRuntimeConfig, DEFAULT_PORT } = await import("../lib/runtime-config.js");

  for (const portValue of ["3000abc", "3.14", "1e3"]) {
    assert.equal(
      getRuntimeConfig({ PORT: portValue }).port,
      DEFAULT_PORT,
      `PORT=${portValue} 應回退為預設值`,
    );
  }
});

test("getRuntimeConfig 接受 PORT=0 作為合法值", async () => {
  const { getRuntimeConfig } = await import("../lib/runtime-config.js");

  assert.equal(getRuntimeConfig({ PORT: "0" }).port, 0);
});
