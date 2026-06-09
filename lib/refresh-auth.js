import { createHash, timingSafeEqual } from "node:crypto";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
    this.status = 401;
  }
}

// Constant-time comparison: hash both sides to a fixed length first so neither the
// secret's length nor its content leaks through timing.
function safeEqual(a, b) {
  const digestA = createHash("sha256").update(String(a)).digest();
  const digestB = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(digestA, digestB);
}

export function isAuthorizedBearerToken(headerValue, config) {
  if (typeof headerValue !== "string") return false;

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const token = match[1];
  const secrets = [config?.refreshSecret, config?.cronSecret].filter(Boolean);
  return secrets.some((secret) => safeEqual(token, secret));
}

export function assertAuthorizedBearerToken(headerValue, config) {
  if (!isAuthorizedBearerToken(headerValue, config)) {
    throw new UnauthorizedError();
  }
}
