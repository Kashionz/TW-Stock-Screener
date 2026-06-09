import {
  assertAuthorizedBearerToken,
  UnauthorizedError,
} from "../lib/refresh-auth.js";
import { refreshSnapshot } from "../lib/refresh-service.js";
import { getRuntimeConfig } from "../lib/runtime-config.js";

export async function GET(request) {
  try {
    const config = getRuntimeConfig();
    assertAuthorizedBearerToken(request.headers.get("authorization"), config);
    return Response.json(await refreshSnapshot({ target: "blob" }));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown refresh error",
      },
      { status: 500 },
    );
  }
}
