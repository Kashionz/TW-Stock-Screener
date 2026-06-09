import { readLocalSnapshot } from "../lib/snapshot-store.js";
import { writeSeedSnapshot } from "../lib/seed-snapshot.js";

const snapshot = await readLocalSnapshot();
const result = await writeSeedSnapshot(snapshot);

console.log(
  JSON.stringify(
    {
      seedPath: result.path,
      meta: snapshot.meta,
    },
    null,
    2,
  ),
);
