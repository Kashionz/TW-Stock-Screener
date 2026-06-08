import assert from "node:assert/strict";
import test from "node:test";

const config = {
  refreshSecret: "refresh-one",
  cronSecret: "cron-one",
};

test("isAuthorizedBearerToken 接受 refresh secret", async () => {
  const { isAuthorizedBearerToken } = await import("../lib/refresh-auth.js");

  assert.equal(isAuthorizedBearerToken("Bearer refresh-one", config), true);
});

test("isAuthorizedBearerToken 接受 cron secret", async () => {
  const { isAuthorizedBearerToken } = await import("../lib/refresh-auth.js");

  assert.equal(isAuthorizedBearerToken("Bearer cron-one", config), true);
});

test("isAuthorizedBearerToken 對無效或缺漏 token 回傳 false", async () => {
  const { isAuthorizedBearerToken } = await import("../lib/refresh-auth.js");

  assert.equal(isAuthorizedBearerToken(null, config), false);
  assert.equal(isAuthorizedBearerToken("", config), false);
  assert.equal(isAuthorizedBearerToken("Bearer", config), false);
  assert.equal(isAuthorizedBearerToken("Bearer wrong-one", config), false);
  assert.equal(isAuthorizedBearerToken("Basic refresh-one", config), false);
});

test("UnauthorizedError 預設為 401 Unauthorized", async () => {
  const { UnauthorizedError } = await import("../lib/refresh-auth.js");
  const error = new UnauthorizedError();

  assert.equal(error.message, "Unauthorized");
  assert.equal(error.status, 401);
});
