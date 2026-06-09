import { buildSnapshot } from "./build-snapshot.js";
import { getRuntimeConfig } from "./runtime-config.js";
import {
  readBlobSnapshot,
  readLocalSnapshot,
  writeBlobSnapshot,
  writeLocalSnapshot,
} from "./snapshot-store.js";

const LUMPY = new Set(["建材營造", "金融保險業"]);

// Coverage metrics that should not silently collapse between refreshes. A sharp
// drop usually means an upstream source (MOPS history, income statements) failed
// to fetch, so we must not overwrite good data with a degraded snapshot.
const GUARDED_METRICS = ["count", "r12n", "epsN"];

export class RefreshRegressionError extends Error {
  constructor(metric, before, after, minRatio) {
    super(
      `Refresh aborted: "${metric}" dropped from ${before} to ${after}, ` +
        `below the ${Math.round(minRatio * 100)}% retention threshold. ` +
        `Keeping the existing snapshot.`,
    );
    this.name = "RefreshRegressionError";
    this.metric = metric;
    this.before = before;
    this.after = after;
    this.minRatio = minRatio;
  }
}

function assertRefreshTarget(target) {
  if (target === "local" || target === "blob") return;

  const formattedTarget =
    typeof target === "string" ? `"${target}"` : String(target);
  throw new Error(
    `Invalid refresh target: ${formattedTarget}. Expected "local" or "blob".`,
  );
}

function defaultReadCurrentSnapshot(target) {
  return target === "local" ? readLocalSnapshot : readBlobSnapshot;
}

async function readPreviousSnapshot(readCurrentSnapshotImpl) {
  try {
    return await readCurrentSnapshotImpl();
  } catch {
    // No comparable baseline (first run, missing blob, unreadable file) — skip
    // the guard rather than block a legitimate refresh.
    return null;
  }
}

function assertNoRegression(previous, next, minRatio) {
  if (!previous?.meta || !next?.meta) return;

  for (const metric of GUARDED_METRICS) {
    const before = Number(previous.meta[metric]);
    const after = Number(next.meta[metric]);
    if (!Number.isFinite(before) || before <= 0 || !Number.isFinite(after)) {
      continue;
    }
    if (after < before * minRatio) {
      throw new RefreshRegressionError(metric, before, after, minRatio);
    }
  }
}

function buildTop5(rows = []) {
  return rows
    .filter((row) => !LUMPY.has(row.ind))
    .slice(0, 5)
    .map((row) => ({
      code: row.code,
      name: row.name,
      ind: row.ind,
      yoy: row.yoy,
    }));
}

export async function refreshSnapshot({
  target,
  blobPath = getRuntimeConfig().snapshotBlobPath,
  minRetentionRatio = getRuntimeConfig().refreshMinRetentionRatio,
  buildSnapshotImpl = buildSnapshot,
  readCurrentSnapshotImpl = defaultReadCurrentSnapshot(target),
  writeLocalSnapshotImpl = writeLocalSnapshot,
  writeBlobSnapshotImpl = writeBlobSnapshot,
} = {}) {
  assertRefreshTarget(target);
  const snapshot = await buildSnapshotImpl();

  const previous = await readPreviousSnapshot(readCurrentSnapshotImpl);
  assertNoRegression(previous, snapshot, minRetentionRatio);

  const top5 = buildTop5(snapshot.rows);

  if (target === "local") {
    const local = await writeLocalSnapshotImpl(snapshot);
    return {
      ok: true,
      storedAt: new Date().toISOString(),
      blobPath: null,
      blobUrl: null,
      localPath: local.path,
      seedPath: local.seedPath || null,
      meta: snapshot.meta,
      top5,
    };
  }

  const blob = await writeBlobSnapshotImpl(snapshot, { blobPath });
  return {
    ok: true,
    storedAt: new Date().toISOString(),
    blobPath,
    blobUrl: blob.url,
    localPath: null,
    seedPath: null,
    meta: snapshot.meta,
    top5,
  };
}
