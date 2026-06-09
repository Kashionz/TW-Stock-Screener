export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
    this.status = 401;
  }
}

export function isAuthorizedBearerToken(headerValue, config) {
  if (typeof headerValue !== "string") return false;

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const secrets = [config?.refreshSecret, config?.cronSecret].filter(Boolean);
  return secrets.includes(match[1]);
}

export function assertAuthorizedBearerToken(headerValue, config) {
  if (!isAuthorizedBearerToken(headerValue, config)) {
    throw new UnauthorizedError();
  }
}
