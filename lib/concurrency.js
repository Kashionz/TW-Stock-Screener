// Small concurrency helpers used to keep upstream scraping (MOPS in particular)
// from firing dozens of requests at once, which triggers throttling/timeouts.

export async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  const workerCount = Math.max(1, Math.min(limit, items.length));
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function withRetry(fn, { retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
