# AGENTS.md

本檔案提供在此專案中工作的代理統一遵循的規範。內容依 `CLAUDE.md` 整理，並補上本專案要求的回覆語言規則。

> 注意：上一層目錄若有其他 `CLAUDE.md` 或代理設定，不適用於此專案。這個 repo 是獨立的靜態前端 + serverless 應用。

## 語言

- 與使用者互動時，一律使用繁體中文（台灣）。
- 程式碼、檔名、環境變數、API 欄位與既有識別字維持原本英文命名，不自行翻譯。

## 常用指令

```bash
npm install

# 本地開發：雙模式
REFRESH_SECRET=secret npm run dev
npm run dev:vercel

# 資料處理
npm run refresh:local
npm run sync:seed

# 驗證
npm test
npm run check:ui
npm run check:deploy

# 單檔 / 單測試
node --test tests/refresh-service.test.mjs
node --test --test-name-pattern="writes blob" tests/refresh-service.test.mjs
```

- Node 版本固定以 `24.x` 為準，CI 也是使用 Node 24。
- 專案為純 ESM（`"type": "module"`）。
- 沒有 bundler 或 build step，前端直接以原生 ES modules 交付。

## 專案架構

這是一個台股篩選器單頁應用：靜態 `index.html` 殼層搭配 serverless API，資料來源是每日更新的 JSON snapshot。核心設計是 **共用的 `lib/` 商業邏輯，搭配兩套可互換的執行器**，讓本地開發與正式環境盡量共用同一套邏輯。

### 雙模式執行

兩個 transport adapter 包裝同一套 `lib/` 邏輯。**adapter 必須保持輕薄，核心邏輯只放在 `lib/`，不要塞進 `api/` handler 或 dev server。**

| 模式 | 執行器 | `/api/snapshot` 來源 | `/api/refresh` 寫入位置 |
|---|---|---|---|
| Production / `npm run dev:vercel` | `api/*.js`（Vercel functions） | Blob 優先，失敗才 fallback 到本地 | Vercel Blob |
| `REFRESH_SECRET=... npm run dev` | `scripts/dev-server.mjs`（Node HTTP server） | 只讀本地檔案 | `data/latest-snapshot.json` 與 seed |

- 兩邊都應呼叫 `loadSnapshot()`、`refreshSnapshot()`、`assertAuthorizedBearerToken()`。
- `dev` 模式的 refresh 雖然不會寫 Blob，但回傳格式仍要與 production 對齊，包含 `blobUrl: null`，避免前端分支邏輯漂移。
- 相關設計可參考 `docs/superpowers/specs/2026-06-09-local-dev-dual-mode-design.md`。

### 三份同步的 snapshot

`refreshSnapshot({ target: "local" })` 會透過 `writeLocalSnapshot()` 一次寫入兩個本地輸出，三份 snapshot 必須保持一致，不可漂移：

- `twse-screener/latest.json`：production 使用的 Vercel Blob，可由 `SNAPSHOT_BLOB_PATH` 覆蓋。
- `data/latest-snapshot.json`：本地資料來源，也是 production fallback，透過 `vercel.json` 的 `includeFiles` 打包給 `api/snapshot.js` 使用。
- `assets/app/seed-snapshot.js`：提供 `file://` 模式與首屏 bootstrap，用 `window.__TWSE_INITIAL_SNAPSHOT__` 注入。

若手動修改 `data/latest-snapshot.json`，必須執行 `npm run sync:seed` 重新同步 `assets/app/seed-snapshot.js`。

### Snapshot 資料形狀

- 結構為 `{ meta, rows }`。
- `meta` 包含民國年格式的期間欄位與統計資訊，例如 `revPeriodROC`、`valDateROC`、`incQuarter`、`r12ym`、`epsQ`。
- `rows` 每列代表一檔股票，包含營收年增、估值、EPS 序列、近 12 個月營收、毛利率等資料。
- `build-snapshot.js` 會整合 TWSE、TPEx 與 MOPS 資料，MOPS 部分包含 Big5 解碼的 HTML 抓取；資料以 4 位數股票代碼為鍵，並以 `yoy` 由大到小排序。

### 前端結構

`index.html` 會先載入 `seed-snapshot.js`，再載入 `main.js`：

- `assets/app/runtime.js`：用 `location.protocol` 判斷 `file:` 或 HTTP，決定是否嘗試呼叫 live API。
- `assets/app/state.js`：整理 snapshot 與實作「2+3」篩選邏輯。
- `assets/app/refresh-flow.js`：處理 drawer 中的設定金鑰與 refresh 流程。
- `assets/app/ui.js`：DOM 與圖表渲染。
- `assets/app/helpers.js`：民國日期與台式數字格式化，例如 `yi()`、`num()`。

`state.js` 的領域邏輯需特別注意：

- `isSurge`：`yoy >= 30` 或 `ytdYoy >= 20`
- `isFocus`：符合 surge 且至少勾選一個研究 phrase
- `scoreValue`：排序加權邏輯
- `PHRASES`、星號、筆記等狀態會存在 `localStorage`
- `LUMPY_INDUSTRIES`（建材營造、金融保險業）預設排除

## 驗證與授權

- `/api/refresh` 必須使用 `Authorization: Bearer <token>`，且 token 要符合 `REFRESH_SECRET` 或 `CRON_SECRET`。
- 若 `REFRESH_SECRET` 與 `CRON_SECRET` 都未設定，refresh 請求應一律被拒絕。這是刻意設計，且 `dev` 與 production 要一致。

## 部署

- 專案部署在 Vercel，使用 **Vercel 原生 Git 整合**。
- `main` 分支推送會進 production，其他分支與 PR 會進 preview。
- `.github/workflows/vercel-deploy.yml` 雖然存在，但用途是 **驗證**，不是部署。
- workflow 內部名稱為 `CI`，其 `verify` job 應只跑：
  - `npm test`
  - `npm run check:ui`
  - `npm run check:deploy`
- workflow 不可改成執行 `vercel deploy`；`check-vercel-deploy.mjs` 會驗證這件事。
- `vercel.json` 也不可關閉 Git deployment；`check-vercel-deploy.mjs` 會檢查 `git.deploymentEnabled` 不得設為 `false`。
- Vercel cron 會在平日排程打 `/api/refresh`。
- `versions/`、`check-*.mjs`、`scripts/`、`thumbnail.png` 會透過 `.vercelignore` 排除在部署之外。

## 慣例與注意事項

- `check-*.mjs` 是刻意設計成脆弱的字串檢查。若你修改 `package.json` scripts、`vercel.json`、GitHub workflow 或 `index.html` 的 bootstrap 標籤，必須同步更新相關檢查。
- `scripts/dev-server.mjs` 有 allowlist、路徑穿越防護與 symlink escape 防護，不要隨意放寬。
- 儲存資料內的日期一律以民國年格式保存；西元轉換應放在顯示層，例如 `helpers.js` 中做 `+1911`。
- `lib/` 內函式大量採用可注入實作的測試接縫，例如 `readLocalSnapshotImpl`、`buildSnapshotImpl`、`writeBlobSnapshotImpl`。修改時必須保留這些注入點，避免測試失去無網路 / 無 Blob 的能力。
- `versions/*.html` 是歷史 UI snapshot，需保留在 git 中，但不屬於實際應用的一部分。

## 代理工作原則

- 修改前先確認變更應落在 `lib/`、`api/`、`scripts/` 或 `assets/app/` 哪一層，避免把核心邏輯寫進 adapter。
- 任何牽涉 snapshot 寫入邏輯的變更，都要檢查本地 snapshot、seed snapshot 與 production Blob 行為是否仍一致。
- 任何牽涉前端資料啟動流程的變更，都要確認 `index.html` 仍先載入 seed，再載入模組入口。
- 宣稱完成前，至少執行與變更範圍相符的驗證：
  - 核心邏輯、API、資料流：`npm test`
  - 前端 UI / bootstrap / 檢查規則：`npm run check:ui`
  - 部署設定、workflow、Vercel 行為：`npm run check:deploy`
