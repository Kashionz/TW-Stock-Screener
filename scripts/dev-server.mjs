import { readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertAuthorizedBearerToken,
  UnauthorizedError,
} from "../lib/refresh-auth.js";
import { refreshSnapshot } from "../lib/refresh-service.js";
import { getRuntimeConfig } from "../lib/runtime-config.js";
import { SECURITY_HEADERS } from "../lib/security-headers.js";
import { snapshotEtag } from "../lib/snapshot-etag.js";
import { loadSnapshot } from "../lib/snapshot-service.js";
import { writeLocalSnapshot } from "../lib/snapshot-store.js";

export const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC_STATIC_FILES = new Set([
  "favicon.ico",
  "index.html",
  "robots.txt",
  "thumbnail.png",
]);
const PUBLIC_STATIC_PREFIXES = ["assets/", "public/"];

export function contentTypeFor(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".css":
      return "text/css; charset=utf-8";
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

  if (!isPublicStaticPath(normalizedPath)) {
    return null;
  }

  const resolvedPath = resolve(rootDir, normalizedPath);

  if (!isPathInside(resolvedRoot, resolvedPath)) {
    return null;
  }

  return resolvedPath;
}

function isPublicStaticPath(relativePath) {
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  if (segments.some((segment) => segment.startsWith("."))) return false;
  if (PUBLIC_STATIC_FILES.has(relativePath)) return true;
  return PUBLIC_STATIC_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function isPathInside(parentPath, childPath) {
  return (
    childPath === parentPath ||
    childPath.startsWith(`${parentPath}${sep}`)
  );
}

async function resolveServableStaticFile(rootDir, realRootDir, pathname) {
  const filePath = resolveStaticFile(rootDir, pathname);
  if (!filePath) {
    return null;
  }

  let realFilePath;
  try {
    realFilePath = await realpath(filePath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      ["ENOENT", "ENOTDIR"].includes(error.code)
    ) {
      return null;
    }

    throw error;
  }

  if (!isPathInside(realRootDir, realFilePath)) {
    return null;
  }

  const fileStats = await stat(realFilePath);
  if (!fileStats.isFile()) {
    return null;
  }

  return realFilePath;
}

async function handleSnapshotRequest(req, res, dataSnapshotPath) {
  const snapshot = await loadSnapshot({
    source: "local",
    readLocalSnapshotImpl: async () => JSON.parse(await readFile(dataSnapshotPath, "utf8")),
  });
  const etag = snapshotEtag(snapshot);

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, {
      "cache-control": "no-store",
      etag,
    });
    res.end();
    return;
  }

  sendJson(res, 200, snapshot, {
    "cache-control": "no-store",
    etag,
  });
}

async function handleRefreshRequest(
  req,
  res,
  config,
  dataSnapshotPath,
  seedSnapshotPath,
  buildSnapshotImpl,
) {
  assertAuthorizedBearerToken(req.headers.authorization || "", config);

  const result = await refreshSnapshot({
    target: "local",
    buildSnapshotImpl,
    writeLocalSnapshotImpl: async (snapshot) =>
      writeLocalSnapshot(snapshot, {
        snapshotPath: dataSnapshotPath,
        seedSnapshotPath,
      }),
  });

  sendJson(res, 200, result, {
    "cache-control": "no-store",
  });
}

async function handleStaticRequest(res, rootDir, realRootDir, pathname) {
  const filePath = await resolveServableStaticFile(rootDir, realRootDir, pathname);
  if (!filePath) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const body = await readFile(filePath);
  res.writeHead(200, {
    "content-type": contentTypeFor(filePath),
    ...SECURITY_HEADERS,
  });
  res.end(body);
}

export async function startDevServer({
  rootDir = ROOT_DIR,
  env = process.env,
  buildSnapshotImpl,
} = {}) {
  const config = getRuntimeConfig(env);
  const realRootDir = await realpath(rootDir);
  const dataSnapshotPath = join(rootDir, "data", "latest-snapshot.json");
  const seedSnapshotPath = join(rootDir, "assets", "app", "seed-snapshot.js");

  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

    try {
      if (req.method !== "GET") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      if (requestUrl.pathname === "/api/snapshot") {
        await handleSnapshotRequest(req, res, dataSnapshotPath);
        return;
      }

      if (requestUrl.pathname === "/api/refresh") {
        await handleRefreshRequest(
          req,
          res,
          config,
          dataSnapshotPath,
          seedSnapshotPath,
          buildSnapshotImpl,
        );
        return;
      }

      await handleStaticRequest(res, rootDir, realRootDir, requestUrl.pathname);
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
