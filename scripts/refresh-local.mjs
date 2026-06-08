import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSnapshot } from "../lib/build-snapshot.js";

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_PATH = join(ROOT_DIR, "data", "latest-snapshot.json");

const snapshot = await buildSnapshot();
await writeFile(OUTPUT_PATH, JSON.stringify(snapshot));

const top5 = snapshot.rows
  .filter((row) => !["建材營造", "金融保險業"].includes(row.ind))
  .slice(0, 5)
  .map((row) => `${row.code} ${row.name} ${row.yoy}`);

console.log(
  JSON.stringify(
    {
      outputPath: OUTPUT_PATH,
      meta: snapshot.meta,
      top5,
    },
    null,
    2,
  ),
);
