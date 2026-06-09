import { loadSnapshot } from "../lib/snapshot-service.js";

export async function GET() {
  try {
    const snapshot = await loadSnapshot({ source: "best" });
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
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
