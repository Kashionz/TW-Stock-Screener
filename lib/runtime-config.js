export const DEFAULT_PORT = 3000;
export const DEFAULT_SNAPSHOT_BLOB_PATH = "twse-screener/latest.json";
export const DEFAULT_REFRESH_MIN_RETENTION_RATIO = 0.7;

export function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseRetentionRatio(value) {
  const raw = trimEnv(value);
  if (raw === "") return DEFAULT_REFRESH_MIN_RETENTION_RATIO;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_REFRESH_MIN_RETENTION_RATIO;
  }
  return parsed;
}

export function getRuntimeConfig(env = process.env) {
  const rawPort = trimEnv(env.PORT);
  const parsedPort = /^\d+$/.test(rawPort) ? Number(rawPort) : Number.NaN;
  const port =
    Number.isInteger(parsedPort) && (parsedPort === 0 || parsedPort > 0)
      ? parsedPort
      : DEFAULT_PORT;
  const refreshSecret = trimEnv(env.REFRESH_SECRET);
  const cronSecret = trimEnv(env.CRON_SECRET);
  const snapshotBlobPath =
    trimEnv(env.SNAPSHOT_BLOB_PATH) || DEFAULT_SNAPSHOT_BLOB_PATH;
  const refreshMinRetentionRatio = parseRetentionRatio(
    env.REFRESH_MIN_RETENTION_RATIO,
  );

  return {
    port,
    refreshSecret,
    cronSecret,
    snapshotBlobPath,
    refreshMinRetentionRatio,
  };
}
