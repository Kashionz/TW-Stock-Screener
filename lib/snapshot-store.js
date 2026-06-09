import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const LOCAL_SNAPSHOT_PATH = join(ROOT_DIR, "data", "latest-snapshot.json");

export const SNAPSHOT_BLOB_PATH =
  process.env.SNAPSHOT_BLOB_PATH || "twse-screener/latest.json";

export async function readLocalSnapshot() {
  const raw = await readFile(LOCAL_SNAPSHOT_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeLocalSnapshot(snapshot) {
  await writeFile(LOCAL_SNAPSHOT_PATH, JSON.stringify(snapshot));
  return { path: LOCAL_SNAPSHOT_PATH };
}

export async function readBlobSnapshot() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { get } = await import("@vercel/blob");
  const blob = await get(SNAPSHOT_BLOB_PATH, {
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

export async function writeBlobSnapshot(snapshot) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  const { put } = await import("@vercel/blob");
  return put(SNAPSHOT_BLOB_PATH, JSON.stringify(snapshot), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json; charset=utf-8",
  });
}
