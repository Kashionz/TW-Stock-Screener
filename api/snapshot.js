import { loadBestSnapshot } from "../lib/snapshot-store.js";

export async function GET() {
  try {
    const snapshot = await loadBestSnapshot();
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
