import { loadSnapshot } from "../lib/snapshot-service.js";
import { snapshotEtag } from "../lib/snapshot-etag.js";

export async function GET(request) {
  try {
    const snapshot = await loadSnapshot({ source: "best" });
    const etag = snapshotEtag(snapshot);

    if (request?.headers?.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          "Cache-Control": "no-store",
          ETag: etag,
        },
      });
    }

    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
        ETag: etag,
      },
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown snapshot error",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
