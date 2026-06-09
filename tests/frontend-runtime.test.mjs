import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeConfig } from "../assets/app/runtime.js";

test("createRuntimeConfig disables live api in file mode", () => {
  const runtime = createRuntimeConfig({
    location: {
      protocol: "file:",
      origin: "null",
    },
  });

  assert.equal(runtime.isFileMode, true);
  assert.equal(runtime.hasLiveApi, false);
  assert.equal(runtime.snapshotUrl, null);
  assert.equal(runtime.refreshUrl, null);
});

test("createRuntimeConfig exposes live api urls in http mode", () => {
  const runtime = createRuntimeConfig({
    location: {
      protocol: "http:",
      origin: "http://127.0.0.1:3000",
    },
  });

  assert.equal(runtime.isFileMode, false);
  assert.equal(runtime.hasLiveApi, true);
  assert.equal(runtime.snapshotUrl, "http://127.0.0.1:3000/api/snapshot");
  assert.equal(runtime.refreshUrl, "http://127.0.0.1:3000/api/refresh");
});
