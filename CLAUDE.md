# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Note: a different `CLAUDE.md` exists in the parent directory for an unrelated project (FinDB). It does not apply here — this repo is a standalone static + serverless app.

## Commands

```bash
npm install                 # install deps (only @vercel/blob)

# Local development — two modes (see Dual-Mode Runtime below)
REFRESH_SECRET=secret npm run dev    # pure Node server at http://127.0.0.1:3000 (daily driver)
npm run dev:vercel                   # `vercel dev` — Blob-backed parity check (needs Vercel CLI auth)

# Data
npm run refresh:local       # rebuild data/latest-snapshot.json + seed from TWSE/TPEx/MOPS (no server)
npm run sync:seed           # regenerate assets/app/seed-snapshot.js from existing data/latest-snapshot.json

# Validation (these three gate CI)
npm test                    # node:test runner over tests/*.test.mjs
npm run check:ui            # runs all check-*.mjs UI-invariant assertions
npm run check:deploy        # asserts deploy config invariants (check-vercel-deploy.mjs)

# Run one test file / one test
node --test tests/refresh-service.test.mjs
node --test --test-name-pattern="writes blob" tests/refresh-service.test.mjs
```

Node 24.x required (`engines` in `package.json`; CI runs Node 24). Pure ESM (`"type": "module"`). No bundler/build step — the frontend ships as raw ES modules.

## Architecture

A single-page Taiwan stock screener: a static `index.html` shell + serverless endpoints, backed by a daily-refreshed JSON snapshot. The defining design is a **shared core (`lib/`) driven by two interchangeable executors** so local dev behaves like production without duplicating logic.

### Dual-Mode Runtime (the central concept)

Two transport adapters wrap the same `lib/` business logic. **Keep adapters thin — all logic lives in `lib/`, never in `api/` handlers or the dev server.** (See `docs/superpowers/specs/2026-06-09-local-dev-dual-mode-design.md`.)

| | Executor | `/api/snapshot` source | `/api/refresh` writes to |
|---|---|---|---|
| Production / `dev:vercel` | `api/*.js` (Vercel functions) | best: Blob → local fallback | Vercel Blob |
| `dev` | `scripts/dev-server.mjs` (Node http) | local file only | `data/latest-snapshot.json` + seed |

Both call `loadSnapshot()` / `refreshSnapshot()` / `assertAuthorizedBearerToken()`. The `dev` refresh returns `blobUrl: null` but keeps the response shape identical so the frontend can't tell which backend it hit.

### Three synchronized snapshot copies

`refreshSnapshot({ target: "local" })` → `writeLocalSnapshot()` writes **both** files atomically; they must never drift:

- **Vercel Blob** (`twse-screener/latest.json`, override via `SNAPSHOT_BLOB_PATH`) — production live data
- **`data/latest-snapshot.json`** — local source + production fallback (bundled into `api/snapshot.js` via `includeFiles` in `vercel.json`)
- **`assets/app/seed-snapshot.js`** — sets `window.__TWSE_INITIAL_SNAPSHOT__` for `file://` / first-paint use

If you ever hand-edit `data/latest-snapshot.json`, run `npm run sync:seed` to regenerate the seed.

### Snapshot shape

`{ meta, rows }`. `meta` carries ROC-calendar period markers (`revPeriodROC`, `valDateROC`, `incQuarter`, `r12ym`, `epsQ`) and counts. Each `row` is one stock with revenue YoY, valuation, EPS series (`epsS` single-quarter, `epsC` cumulative), 12-month revenue (`r12`/`r12ly`), margins, etc. `build-snapshot.js` fetches/merges TWSE + TPEx open data + scraped MOPS pages (Big5-decoded HTML), keyed by 4-digit stock code, sorted by `yoy` desc.

### Frontend (`assets/app/`, no framework)

`index.html` loads `seed-snapshot.js` (classic script → window global) then `main.js` (module entry):

- `runtime.js` — detects `file:` vs HTTP via `location.protocol`; gates whether live API calls are attempted
- `state.js` — snapshot prep + the **"2+3" screening domain logic**: `isSurge` (yoy≥30 OR ytdYoy≥20), `isFocus` (surge + ≥1 checked phrase), `scoreValue` weighting, and `localStorage` persistence of stars/notes/phrase checklists (`PHRASES`). `LUMPY_INDUSTRIES` (建材營造, 金融保險業) are default-excluded.
- `refresh-flow.js` — drives the drawer "set key / refresh stock" flow against `/api/refresh`
- `ui.js` — DOM rendering, Chart.js charts, drawer; `helpers.js` — ROC-date / number formatting (`yi()` = 億, `num()` parses TW-formatted numbers)

### Auth

`/api/refresh` requires `Authorization: Bearer <token>` matching `REFRESH_SECRET` or `CRON_SECRET` (`lib/refresh-auth.js`). With neither env var set, all refresh requests are rejected — this is intentional and identical across modes.

## Deployment

Vercel, driven by **Vercel's native Git integration** (Git deployments are enabled — `check-vercel-deploy.mjs` asserts `vercel.json` does *not* set `git.deploymentEnabled: false`). Push to `main` → production; other branches / PRs → preview. The GitHub Actions workflow (`.github/workflows/vercel-deploy.yml`, internally named `CI`) is **verify-only**: its `verify` job runs `npm test`, `check:ui`, `check:deploy` on pull requests and pushes to `main`, and must *not* run `vercel deploy` (also asserted by the deploy check). A Vercel cron hits `/api/refresh` on a weekday schedule (`crons` in `vercel.json`). `versions/`, `check-*.mjs`, `scripts/`, `thumbnail.png` are excluded from deploy via `.vercelignore`.

## Conventions & gotchas

- **`check-*.mjs` are brittle by design** — they string-match against `package.json` scripts, `vercel.json`, the workflow, and `index.html`'s bootstrap tags. Editing those files can break `check:deploy`/`check:ui`; update the assertions in lockstep.
- **Dev server is hardened** — `scripts/dev-server.mjs` serves only an allowlist (`PUBLIC_STATIC_FILES` + `assets/`, `public/`) with path-traversal and symlink-escape guards. Don't loosen these casually.
- **All dates are ROC (民國) calendar** in stored data; convert at the display layer (`helpers.js`) — `+1911` for years.
- **Test seam pattern**: `lib/` functions take injectable impls (e.g. `readLocalSnapshotImpl`, `buildSnapshotImpl`, `writeBlobSnapshotImpl`) so tests run without network or Blob. Preserve these parameters when modifying.
- `versions/*.html` are historical UI snapshots kept in git but never deployed — not part of the app.
