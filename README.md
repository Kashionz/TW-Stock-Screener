# TW Stock Screener

台股篩選工具，依營收成長、獲利能力、EPS、估值與產業訊號篩選公司。

![TW Stock Screener](./thumbnail.png)

## 總覽

TW Stock Screener 是一款專注於台灣上市櫃公司的單頁式選股應用程式，將每月營收成長、每季財報、估值資料與產業脈絡整合於同一介面，方便快速篩選與後續研究。

前端以靜態 HTML 應用程式建構，最新資料則透過輕量的 serverless 端點提供。當即時資料無法取得時，應用程式會退回到隨附的本地快照（snapshot），確保畫面仍可正常運作。

## 功能特色

- 依營收 YoY、YTD YoY、毛利率、正 EPS、市場別與產業篩選台股。
- 內建 **surge / focus（爆發 / 聚焦）** 模型：當營收 YoY ≥ 30% 或 YTD YoY ≥ 20% 時為 *surge* 候選；若在 surge 的基礎上又勾選了至少一項研究關鍵語句，則升級為 *focus* 候選。
- 預設排除波動較大的產業（建材營造、金融保險業），以降低雜訊。
- 可對篩選後的清單進行排序與搜尋。
- 透過 `localStorage` 在本機追蹤觀察名單，包含星號標記公司、筆記與關鍵語句清單。
- 開啟個股明細抽屜（drawer），檢視圖表、估值資料、EPS 歷史與參考連結。
- 在設定好部署密鑰後，可透過受保護的 API 端點更新最新資料集。

## 資料流程（Data Pipeline）

- `index.html` 包含前端 UI 外殼，並載入 `assets/app/seed-snapshot.js` 以支援離線或檔案模式檢視。
- `api/snapshot.js` 以 `no-store` 快取策略提供當前最佳的快照。
- `api/refresh.js` 從 TWSE、TPEx 與 MOPS 來源重建資料集，並將結果寫入 Vercel Blob 儲存。
- `lib/snapshot-store.js` 優先從 Vercel Blob 載入；當 Blob 儲存無法使用時，退回到 `data/latest-snapshot.json`。
- `data/latest-snapshot.json` 與 `assets/app/seed-snapshot.js` 會保持同步，供本地更新與靜態檔案退回使用。
- `vercel.json` 定義 serverless 函式的限制與排程更新工作。

## 本地開發

### 先決條件

- Node.js 24.x
- 執行 `npm run dev:vercel` 前需先安裝 Vercel CLI。

### 安裝

```bash
npm install
```

### 更新本地快照

```bash
npm run refresh:local
```

### 僅同步檔案模式的隨附快照

```bash
npm run sync:seed
```

當 `data/latest-snapshot.json` 已更新，而你只想重新產生 `assets/app/seed-snapshot.js` 以驗證 `file://` 退回行為時，使用此指令。

### 日常 Node 工作流程

在測試 `/api/refresh` 前請先設定 `REFRESH_SECRET`，因為本地更新端點預期收到與 `REFRESH_SECRET` 或 `CRON_SECRET` 相符的 bearer token。

```bash
REFRESH_SECRET=your-secret npm run dev
```

`npm run dev` 預設會在 `http://127.0.0.1:3000` 啟動純 Node.js 本地伺服器。此工作流程提供：

- `/`：靜態應用程式外殼
- `/api/snapshot`：最新的本地快照內容
- `/api/refresh`：重建資料並將更新後的快照寫回 `data/latest-snapshot.json`

當你想針對應用程式與 API 路由開發，而不經過 Vercel 執行環境時，這是日常的本地開發路徑。
`npm run dev` 會刻意直接讀取本地快照檔案；若你需要 Blob 優先的「最佳快照」行為，請改用 `npm run dev:vercel`。

### Vercel 相容性驗證

```bash
npm run dev:vercel
```

`npm run dev:vercel` 會執行 `vercel dev`，是針對已部署執行環境的正式相容性檢查。用於驗證本地行為是否仍與預期的 Vercel 執行路徑一致，包含 Blob 後端的快照策略。

由於 `npm run dev:vercel` 會呼叫 Vercel CLI，安裝並完成 `vercel` 驗證是使用此模式的先決條件。

### 靜態檔案退回

你仍可直接在瀏覽器中開啟 `index.html`。在檔案模式下，頁面會使用從 `assets/app/seed-snapshot.js` 載入的隨附快照運作，但不會有即時的 `/api/snapshot` 或 `/api/refresh` 行為。

## 環境變數

- `BLOB_READ_WRITE_TOKEN`：在 Vercel Blob 中讀寫最新快照的必要變數。
- `CRON_SECRET`：用於授權排程更新請求的選用密鑰。
- `REFRESH_SECRET`：用於從 UI 手動更新請求的選用密鑰。
- `SNAPSHOT_BLOB_PATH`：選用的 Blob 路徑覆寫值，預設為 `twse-screener/latest.json`。

## 驗證

```bash
npm test
npm run check:ui
npm run check:deploy
```

日常以 `npm run dev` 進行 Node 為基礎的快速煙霧測試（smoke test）；當 Vercel CLI 可用且需要與部署相容的驗證路徑時，再使用 `npm run dev:vercel`。

## 資料來源

- TWSE 開放資料
- TPEx 開放資料
- MOPS 每月營收與損益表資料

## 部署說明

- 本專案已設定為使用 Vercel。
- 在 Vercel 直接連結 GitHub 儲存庫，即可為分支與 pull request 啟用自動的 Preview 部署。
- 在 Vercel 將正式環境分支設為 `main`，使合併至 `main` 時自動建立正式環境部署。
- 將 `BLOB_READ_WRITE_TOKEN`、`CRON_SECRET`、`REFRESH_SECRET` 等執行環境密鑰設定於 Vercel 專案設定中，而非 GitHub Actions secrets。
- GitHub Actions workflow 目前僅執行驗證；實際部署由連結的儲存庫透過 Vercel 處理。
- 排程更新定義於 `vercel.json`。
- `versions/` 下的歷史 HTML 快照會保留在儲存庫中，但透過 `.vercelignore` 排除於 Vercel 部署之外。
