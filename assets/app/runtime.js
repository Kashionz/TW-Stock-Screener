const SNAPSHOT_PATH = "/api/snapshot";
const REFRESH_PATH = "/api/refresh";

function resolveRuntimeUrl(path, locationObject) {
  if (!locationObject || locationObject.protocol === "file:") {
    return null;
  }

  return new URL(path, locationObject.origin).toString();
}

export function createRuntimeConfig(windowObject = window) {
  const locationObject = windowObject.location;
  const isFileMode = locationObject?.protocol === "file:";

  return {
    isFileMode,
    hasLiveApi: !isFileMode,
    snapshotUrl: resolveRuntimeUrl(SNAPSHOT_PATH, locationObject),
    refreshUrl: resolveRuntimeUrl(REFRESH_PATH, locationObject),
  };
}
