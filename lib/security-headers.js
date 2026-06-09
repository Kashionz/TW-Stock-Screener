// Single source of truth for security headers, shared by the local dev server and
// asserted against vercel.json so the deployed runtime cannot silently drift.
//
// CSP scope (see index.html): the only external subresource is Chart.js from
// cdn.jsdelivr.net (SRI-pinned). All app scripts are same-origin; the only inline
// <script> is type="application/json" (non-executable). Inline <style> and inline
// style="" attributes require style-src 'unsafe-inline'.

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

export const SECURITY_HEADERS = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};
