import { readBlobSnapshot, readLocalSnapshot } from "./snapshot-store.js";

async function loadBestSnapshot({
  readLocalSnapshotImpl,
  readBlobSnapshotImpl,
}) {
  try {
    const blobSnapshot = await readBlobSnapshotImpl();
    if (blobSnapshot) return blobSnapshot;
  } catch {
    // Fall back to the local snapshot when blob loading fails.
  }

  return readLocalSnapshotImpl();
}

export async function loadSnapshot({
  source = "best",
  readLocalSnapshotImpl = readLocalSnapshot,
  readBlobSnapshotImpl = readBlobSnapshot,
} = {}) {
  if (source === "local") {
    return readLocalSnapshotImpl();
  }

  return loadBestSnapshot({
    readLocalSnapshotImpl,
    readBlobSnapshotImpl,
  });
}
