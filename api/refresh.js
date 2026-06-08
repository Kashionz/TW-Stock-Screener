import { buildSnapshot } from "../lib/build-snapshot.js";
import { SNAPSHOT_BLOB_PATH, writeBlobSnapshot } from "../lib/snapshot-store.js";

const LUMPY = new Set(["建材營造", "金融保險業"]);

function isAuthorized(request) {
  const authHeader = request.headers.get("authorization");
  const secrets = [process.env.CRON_SECRET, process.env.REFRESH_SECRET].filter(Boolean);
  if (secrets.length === 0) return false;
  return secrets.some((secret) => authHeader === `Bearer ${secret}`);
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const snapshot = await buildSnapshot();
    const blob = await writeBlobSnapshot(snapshot);
    const top5 = snapshot.rows
      .filter((row) => !LUMPY.has(row.ind))
      .slice(0, 5)
      .map((row) => ({
        code: row.code,
        name: row.name,
        ind: row.ind,
        yoy: row.yoy,
      }));

    return Response.json({
      ok: true,
      storedAt: new Date().toISOString(),
      blobPath: SNAPSHOT_BLOB_PATH,
      blobUrl: blob.url,
      meta: snapshot.meta,
      top5,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown refresh error",
      },
      { status: 500 },
    );
  }
}
