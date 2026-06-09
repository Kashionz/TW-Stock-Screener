import assert from "node:assert/strict";
import test from "node:test";

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test("mapWithConcurrency preserves input order in the results", async () => {
  const { mapWithConcurrency } = await import("../lib/concurrency.js");

  const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => value * 10);

  assert.deepEqual(result, [10, 20, 30, 40, 50]);
});

test("mapWithConcurrency never runs more than the limit at once", async () => {
  const { mapWithConcurrency } = await import("../lib/concurrency.js");

  let active = 0;
  let maxActive = 0;
  const gates = Array.from({ length: 8 }, () => deferred());

  const pending = mapWithConcurrency(gates, 3, async (gate, index) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await gate.promise;
    active -= 1;
    return index;
  });

  // Release gates one at a time so concurrency can be observed mid-flight.
  for (const gate of gates) {
    await Promise.resolve();
    gate.resolve();
  }

  const result = await pending;
  assert.deepEqual(result, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(maxActive <= 3, `maxActive should be <= 3, got ${maxActive}`);
});

test("mapWithConcurrency handles an empty list", async () => {
  const { mapWithConcurrency } = await import("../lib/concurrency.js");

  const result = await mapWithConcurrency([], 4, async () => {
    throw new Error("mapper should not be called");
  });

  assert.deepEqual(result, []);
});

test("withRetry returns immediately on first success without retrying", async () => {
  const { withRetry } = await import("../lib/concurrency.js");

  let attempts = 0;
  const result = await withRetry(async () => {
    attempts += 1;
    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 1);
});

test("withRetry retries until the call succeeds", async () => {
  const { withRetry } = await import("../lib/concurrency.js");

  let attempts = 0;
  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("transient");
      return "recovered";
    },
    { retries: 3 },
  );

  assert.equal(result, "recovered");
  assert.equal(attempts, 3);
});

test("withRetry throws the last error after exhausting retries", async () => {
  const { withRetry } = await import("../lib/concurrency.js");

  let attempts = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          attempts += 1;
          throw new Error(`fail-${attempts}`);
        },
        { retries: 2 },
      ),
    { message: "fail-3" },
  );

  assert.equal(attempts, 3);
});
