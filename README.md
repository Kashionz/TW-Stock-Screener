# TW Stock Screener

Taiwan stock screening tool for filtering companies by revenue growth, profitability, EPS, valuation, and industry signals.

![TW Stock Screener](./thumbnail.png)

## Overview

TW Stock Screener is a single-page stock screening app focused on Taiwan-listed companies. It combines monthly revenue growth, quarterly earnings, valuation data, and sector context into one interface for fast filtering and follow-up research.

The UI is built as a static HTML app, while the latest dataset is served through lightweight serverless endpoints. When live data is unavailable, the app falls back to a bundled local snapshot so the screen still works.

## Features

- Filter Taiwan stocks by revenue YoY, YTD YoY, gross margin, positive EPS, market, and industry.
- Sort and search across the screened list.
- Track watchlist items with local starred companies, notes, and phrase checklists stored in `localStorage`.
- Inspect a per-stock detail drawer with charts, valuation data, EPS history, and reference links.
- Refresh the latest dataset through a protected API endpoint when deployment secrets are configured.

## Data Pipeline

- `index.html` contains the client UI and a bundled seed snapshot for offline or file-based viewing.
- `api/snapshot.js` serves the best available snapshot with `no-store` caching.
- `api/refresh.js` rebuilds the dataset from TWSE, TPEx, and MOPS sources, then writes the result to Vercel Blob storage.
- `lib/snapshot-store.js` loads from Vercel Blob first and falls back to `data/latest-snapshot.json` if Blob storage is unavailable.
- `vercel.json` defines the serverless function limits and the scheduled refresh job.

## Local Development

### Prerequisites

- Node.js 20.x

### Install

```bash
npm install
```

### Refresh the local snapshot

```bash
npm run refresh:local
```

### View the app locally

You can open `index.html` directly in a browser. In file mode, the page still works with the bundled snapshot embedded in the HTML.

If you want live `/api/snapshot` and `/api/refresh` behavior, run it through a Vercel deployment or a compatible local serverless workflow.

## Environment Variables

- `BLOB_READ_WRITE_TOKEN`: Required for reading and writing the latest snapshot in Vercel Blob.
- `CRON_SECRET`: Optional secret for authorizing scheduled refresh requests.
- `REFRESH_SECRET`: Optional secret for manual refresh requests from the UI.
- `SNAPSHOT_BLOB_PATH`: Optional Blob path override. Defaults to `twse-screener/latest.json`.

## Validation

```bash
npm run check:ui
npm run check:deploy
```

These checks cover key UI markers, deployment assumptions, and the current project naming.

## Data Sources

- TWSE open data
- TPEx open data
- MOPS monthly revenue and income statement data

## Deployment Notes

- The project is configured for Vercel.
- Scheduled refresh is defined in `vercel.json`.
- Historical HTML snapshots under `versions/` are kept in the repository, but excluded from Vercel deployment via `.vercelignore`.
