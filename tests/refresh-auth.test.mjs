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

test("isAuthorizedBearerToken 接受大小寫不敏感的 Bearer 與多個空白", async () => {
  const { isAuthorizedBearerToken } = await import("../lib/refresh-auth.js");

  assert.equal(isAuthorizedBearerToken("bearer refresh-one", config), true);
  assert.equal(isAuthorizedBearerToken("BEARER   cron-one", config), true);
});

test("isAuthorizedBearerToken 對無效或缺漏 token 回傳 false", async () => {
  const { isAuthorizedBearerToken } = await import("../lib/refresh-auth.js");

  assert.equal(isAuthorizedBearerToken(null, config), false);
  assert.equal(isAuthorizedBearerToken("", config), false);
  assert.equal(isAuthorizedBearerToken("Bearer", config), false);
  assert.equal(isAuthorizedBearerToken("Bearer wrong-one", config), false);
  assert.equal(isAuthorizedBearerToken("Basic refresh-one", config), false);
});

test("assertAuthorizedBearerToken 對合法 header 不會 throw", async () => {
  const { assertAuthorizedBearerToken } = await import("../lib/refresh-auth.js");

  assert.doesNotThrow(() => {
    assertAuthorizedBearerToken("Bearer refresh-one", config);
  });
});

test("assertAuthorizedBearerToken 對不合法 header 會 throw UnauthorizedError", async () => {
  const { assertAuthorizedBearerToken, UnauthorizedError } = await import(
    "../lib/refresh-auth.js"
  );

  assert.throws(() => {
    assertAuthorizedBearerToken("Bearer wrong-one", config);
  }, UnauthorizedError);
});

test("UnauthorizedError 預設為 401 Unauthorized", async () => {
  const { UnauthorizedError } = await import("../lib/refresh-auth.js");
  const error = new UnauthorizedError();

  assert.equal(error.message, "Unauthorized");
  assert.equal(error.status, 401);
});
