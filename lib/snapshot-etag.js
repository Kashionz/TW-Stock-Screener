// Deterministic ETag derived from a snapshot's identity fields. Used so the
// browser can send `If-None-Match` and skip re-downloading the full payload when
// the deployed seed already matches the live snapshot. Must stay pure so the same
// algorithm runs identically in Node (api/dev-server) and the browser.

const SIGNATURE_KEYS = [
  "revPeriodROC",
  "valDateROC",
  "incQuarter",
  "count",
  "tw",
  "otc",
  "r12n",
  "epsN",
];

export function snapshotEtag(snapshot) {
  const meta = snapshot?.meta ?? {};
  const signature = JSON.stringify(SIGNATURE_KEYS.map((key) => meta[key] ?? null));

  let hash = 5381;
  for (let index = 0; index < signature.length; index += 1) {
    hash = (hash * 33) ^ signature.charCodeAt(index);
  }

  return `"s${(hash >>> 0).toString(36)}"`;
}
