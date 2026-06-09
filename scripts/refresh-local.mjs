import { refreshSnapshot } from "../lib/refresh-service.js";

const payload = await refreshSnapshot({ target: "local" });

console.log(
  JSON.stringify(
    {
      outputPath: payload.localPath,
      seedPath: payload.seedPath,
      meta: payload.meta,
      top5: payload.top5.map((row) => `${row.code} ${row.name} ${row.yoy}`),
    },
    null,
    2,
  ),
);
