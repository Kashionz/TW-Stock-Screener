import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getRuntimeConfig } from "./runtime-config.js";
import { SEED_SNAPSHOT_PATH, writeSeedSnapshot } from "./seed-snapshot.js";

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const LOCAL_SNAPSHOT_PATH = join(ROOT_DIR, "data", "latest-snapshot.json");

function resolveSnapshotBlobPath(env = process.env) {
  return getRuntimeConfig(env).snapshotBlobPath;
}

export async function readLocalSnapshot() {
  const raw = await readFile(LOCAL_SNAPSHOT_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeLocalSnapshot(
  snapshot,
  {
    snapshotPath = LOCAL_SNAPSHOT_PATH,
    seedSnapshotPath = SEED_SNAPSHOT_PATH,
  } = {},
) {
  const storedSnapshot = snapshot?.storedAt
    ? snapshot
    : {
        ...snapshot,
        storedAt: new Date().toISOString(),
      };
  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, JSON.stringify(storedSnapshot));
  const seed = await writeSeedSnapshot(storedSnapshot, {
    filePath: seedSnapshotPath,
  });
  return {
    path: snapshotPath,
    seedPath: seed.path,
    storedAt: storedSnapshot.storedAt,
  };
}

export async function readBlobSnapshot({ blobPath = resolveSnapshotBlobPath() } = {}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { get } = await import("@vercel/blob");
  const blob = await get(blobPath, {
    access: "private",
    useCache: false,
  });
  if (!blob) return null;
  return new Response(blob.stream).json();
}

export async function loadBestSnapshot() {
  const { loadSnapshot } = await import("./snapshot-service.js");
  return loadSnapshot({
    source: "best",
    readLocalSnapshotImpl: readLocalSnapshot,
    readBlobSnapshotImpl: readBlobSnapshot,
  });
}

export async function writeBlobSnapshot(
  snapshot,
  { blobPath = resolveSnapshotBlobPath() } = {},
) {
  const storedSnapshot = snapshot?.storedAt
    ? snapshot
    : {
        ...snapshot,
        storedAt: new Date().toISOString(),
      };
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  const { put } = await import("@vercel/blob");
  const blob = await put(blobPath, JSON.stringify(storedSnapshot), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json; charset=utf-8",
  });
  return {
    ...blob,
    storedAt: storedSnapshot.storedAt,
  };
}
