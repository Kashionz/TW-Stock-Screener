export const DEFAULT_PORT = 3000;
export const DEFAULT_SNAPSHOT_BLOB_PATH = "twse-screener/latest.json";

export function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getRuntimeConfig(env = process.env) {
  const rawPort = trimEnv(env.PORT);
  const parsedPort = /^\d+$/.test(rawPort) ? Number(rawPort) : Number.NaN;
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
  const refreshSecret = trimEnv(env.REFRESH_SECRET);
  const cronSecret = trimEnv(env.CRON_SECRET);
  const snapshotBlobPath =
    trimEnv(env.SNAPSHOT_BLOB_PATH) || DEFAULT_SNAPSHOT_BLOB_PATH;

  return {
    port,
    refreshSecret,
    cronSecret,
    snapshotBlobPath,
  };
}
