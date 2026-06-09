import { buildSnapshot } from "./build-snapshot.js";
import {
  SNAPSHOT_BLOB_PATH,
  writeBlobSnapshot,
  writeLocalSnapshot,
} from "./snapshot-store.js";

const LUMPY = new Set(["建材營造", "金融保險業"]);

function assertRefreshTarget(target) {
  if (target === "local" || target === "blob") return;

  const formattedTarget =
    typeof target === "string" ? `"${target}"` : String(target);
  throw new Error(
    `Invalid refresh target: ${formattedTarget}. Expected "local" or "blob".`,
  );
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
  buildSnapshotImpl = buildSnapshot,
  writeLocalSnapshotImpl = writeLocalSnapshot,
  writeBlobSnapshotImpl = writeBlobSnapshot,
} = {}) {
  assertRefreshTarget(target);
  const snapshot = await buildSnapshotImpl();
  const top5 = buildTop5(snapshot.rows);

  if (target === "local") {
    const local = await writeLocalSnapshotImpl(snapshot);
    return {
      ok: true,
      storedAt: new Date().toISOString(),
      blobPath: null,
      blobUrl: null,
      localPath: local.path,
      meta: snapshot.meta,
      top5,
    };
  }

  const blob = await writeBlobSnapshotImpl(snapshot);
  return {
    ok: true,
    storedAt: new Date().toISOString(),
    blobPath: SNAPSHOT_BLOB_PATH,
    blobUrl: blob.url,
    localPath: null,
    meta: snapshot.meta,
    top5,
  };
}
