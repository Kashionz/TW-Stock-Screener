import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const SEED_SNAPSHOT_PATH = join(ROOT_DIR, "assets", "app", "seed-snapshot.js");

export function serializeSeedSnapshot(snapshot) {
  return `window.__TWSE_INITIAL_SNAPSHOT__=${JSON.stringify(snapshot)};\n`;
}

export async function writeSeedSnapshot(
  snapshot,
  { filePath = SEED_SNAPSHOT_PATH } = {},
) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeSeedSnapshot(snapshot));
  return { path: filePath };
}
