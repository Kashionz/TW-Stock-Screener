import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertAuthorizedBearerToken,
  UnauthorizedError,
} from "../lib/refresh-auth.js";
import { refreshSnapshot } from "../lib/refresh-service.js";
import { getRuntimeConfig } from "../lib/runtime-config.js";
import { loadSnapshot } from "../lib/snapshot-service.js";

export const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

export function contentTypeFor(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function resolveStaticFile(rootDir, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const normalizedPath = normalize(relativePath);
  const resolvedRoot = resolve(rootDir);
  const resolvedPath = resolve(rootDir, normalizedPath);

  if (
    resolvedPath !== resolvedRoot &&
    !resolvedPath.startsWith(`${resolvedRoot}${sep}`)
  ) {
    return null;
  }

  return resolvedPath;
}

async function handleSnapshotRequest(res, dataSnapshotPath) {
  const snapshot = await loadSnapshot({
    source: "local",
    readLocalSnapshotImpl: async () => JSON.parse(await readFile(dataSnapshotPath, "utf8")),
  });

  sendJson(res, 200, snapshot, {
    "cache-control": "no-store",
  });
}

async function handleRefreshRequest(
  req,
  res,
  config,
  dataSnapshotPath,
  buildSnapshotImpl,
) {
  assertAuthorizedBearerToken(req.headers.authorization || "", config);

  const result = await refreshSnapshot({
    target: "local",
    buildSnapshotImpl,
    writeLocalSnapshotImpl: async (snapshot) => {
      await writeFile(dataSnapshotPath, JSON.stringify(snapshot));
      return { path: dataSnapshotPath };
    },
  });

  sendJson(res, 200, result, {
    "cache-control": "no-store",
  });
}

async function handleStaticRequest(res, rootDir, pathname) {
  const filePath = resolveStaticFile(rootDir, pathname);
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const body = await readFile(filePath);
  res.writeHead(200, {
    "content-type": contentTypeFor(filePath),
  });
  res.end(body);
}

export async function startDevServer({
  rootDir = ROOT_DIR,
  env = process.env,
  buildSnapshotImpl,
} = {}) {
  const config = getRuntimeConfig(env);
  const dataSnapshotPath = join(rootDir, "data", "latest-snapshot.json");

  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

    try {
      if (req.method !== "GET") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      if (requestUrl.pathname === "/api/snapshot") {
        await handleSnapshotRequest(res, dataSnapshotPath);
        return;
      }

      if (requestUrl.pathname === "/api/refresh") {
        await handleRefreshRequest(
          req,
          res,
          config,
          dataSnapshotPath,
          buildSnapshotImpl,
        );
        return;
      }

      await handleStaticRequest(res, rootDir, requestUrl.pathname);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        sendJson(res, 401, {
          ok: false,
          error: error.message,
        });
        return;
      }

      sendJson(
        res,
        500,
        {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown dev server error",
        },
        {
          "cache-control": "no-store",
        },
      );
    }
  });

  await new Promise((resolvePromise, rejectPromise) => {
    const onError = (error) => {
      server.off("listening", onListening);
      rejectPromise(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolvePromise();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(config.port, "127.0.0.1");
  });

  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : config.port;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolvePromise, rejectPromise) => {
        server.close((error) => {
          if (error) {
            rejectPromise(error);
            return;
          }
          resolvePromise();
        });
      }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startDevServer();
  console.log(`TW Stock Screener dev server running at ${server.url}`);
}
