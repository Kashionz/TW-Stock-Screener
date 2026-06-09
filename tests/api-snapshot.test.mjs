import assert from "node:assert/strict";
import test from "node:test";

test("api snapshot serves the payload with an ETag header", async () => {
  const { GET } = await import("../api/snapshot.js");

  const response = await GET(new Request("https://example.test/api/snapshot"));

  assert.equal(response.status, 200);
  assert.match(response.headers.get("etag"), /^"s[0-9a-z]+"$/u);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok((await response.json()).meta);
});

test("api snapshot returns 304 with an empty body when If-None-Match matches", async () => {
  const { GET } = await import("../api/snapshot.js");

  const first = await GET(new Request("https://example.test/api/snapshot"));
  const etag = first.headers.get("etag");

  const second = await GET(
    new Request("https://example.test/api/snapshot", {
      headers: { "if-none-match": etag },
    }),
  );

  assert.equal(second.status, 304);
  assert.equal(second.headers.get("etag"), etag);
  assert.equal(await second.text(), "");
});

test("api snapshot returns 200 when If-None-Match does not match", async () => {
  const { GET } = await import("../api/snapshot.js");

  const response = await GET(
    new Request("https://example.test/api/snapshot", {
      headers: { "if-none-match": '"s-stale"' },
    }),
  );

  assert.equal(response.status, 200);
});
