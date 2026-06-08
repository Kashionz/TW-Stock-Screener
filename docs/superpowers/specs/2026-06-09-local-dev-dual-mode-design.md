# 雙模式本機開發/測試流程設計

日期：2026-06-09

## 背景

目前專案可直接用 `file://` 開啟 [index.html](/Users/kashionz/Desktop/tw-stock-screener/index.html:1)，但這種方式無法完整驗證 `/api/snapshot` 與 `/api/refresh`。畫面上的「設定更新金鑰」與「更新個股資訊」在 UI 上可操作，但只要碰到實際 API 行為，就會和正式環境脫節。

專案目前的本機流程有三個問題：

1. 日常 UI 開發與正式 API 行為是兩個世界。
2. `/api/refresh` 的核心邏輯分散在 Vercel handler 與本機腳本之間，缺少共享服務層。
3. 使用者無法透過單一穩定的本機網址，測到接近正式環境的互動流程。

本設計的目標是保留現有靜態頁面加 serverless 的部署模型，新增一條可日常使用的純 Node 本機流程，並保留 Vercel 本機驗證流程，形成雙模式開發方式。

## 目標

1. 提供 `npm run dev`，讓本機可透過 HTTP 直接測頁面、`/api/snapshot`、`/api/refresh`。
2. 提供 `npm run dev:vercel`，保留與正式環境接近的驗證方式。
3. 讓 `dev` 模式中的 `/api/refresh` 更新本機 [data/latest-snapshot.json](/Users/kashionz/Desktop/tw-stock-screener/data/latest-snapshot.json:1)，不依賴 Blob。
4. 保持前端 UI 呼叫介面不變，讓 [index.html](/Users/kashionz/Desktop/tw-stock-screener/index.html:316) 無需知道自己跑在哪個後端模式。
5. 將快照讀取、更新、授權檢查抽成共用核心，減少本機與正式流程分岔。

## 非目標

1. 這一輪不把前端改寫成 React、Next.js 或其他框架。
2. 這一輪不大幅重寫 [lib/build-snapshot.js](/Users/kashionz/Desktop/tw-stock-screener/lib/build-snapshot.js:1) 的資料抓取與解析策略。
3. 這一輪不新增帳號系統、遠端同步或多使用者能力。
4. 這一輪不處理完整 E2E 測試基礎建設，只先建立可穩定驗證的本機執行環境。

## 選項比較

### 方案 A：共享核心 + 兩個執行器

做法：

- 將快照讀取、快照更新、授權檢查抽成共享服務層。
- 保留 `api/` 作為 Vercel adapter。
- 新增純 Node 本機伺服器作為 `dev` 流程。

優點：

- 日常開發快。
- 正式相容驗證仍保留。
- 本機與正式模式共用大部分商業邏輯。
- 改動範圍可控，符合漸進式重整。

缺點：

- 需要先整理目前分散的 handler/script 邏輯。

### 方案 B：額外包一層本機伺服器，但不抽共享核心

做法：

- 新增本機伺服器直接複製或重寫 `/api/snapshot`、`/api/refresh` 的流程。

優點：

- 前期看起來改動最少。

缺點：

- 本機與正式邏輯會很快分岔。
- 後續修 bug 要改兩處。
- 架構債會變大。

### 方案 C：直接全面改成新框架

做法：

- 重建前後端開發骨架，例如 Vite 或 Next.js。

優點：

- 長期體驗最好。

缺點：

- 這一輪成本過高。
- 與目前需求不匹配。
- 不符合「先解本機可測」的最短路徑。

## 決策

採用方案 A：共享核心 + 兩個執行器。

理由：

- 它最直接解決「本機可像正式環境一樣測」這個核心需求。
- 它讓本機模式與正式模式共享主要邏輯，降低未來維護風險。
- 它不要求這一輪就更換整個技術骨架。

## 架構設計

### 目錄與模組邊界

保留現有大方向：

- [index.html](/Users/kashionz/Desktop/tw-stock-screener/index.html:1)：前端 UI
- [api/snapshot.js](/Users/kashionz/Desktop/tw-stock-screener/api/snapshot.js:1)：Vercel snapshot adapter
- [api/refresh.js](/Users/kashionz/Desktop/tw-stock-screener/api/refresh.js:1)：Vercel refresh adapter
- [lib/build-snapshot.js](/Users/kashionz/Desktop/tw-stock-screener/lib/build-snapshot.js:1)：資料快照 builder

新增或調整的模組責任：

- `lib/snapshot-service.js`
  - 負責讀取最佳快照。
  - 封裝「優先讀 Blob，失敗則回退本機快照」與「純本機只讀本機快照」的策略。

- `lib/refresh-service.js`
  - 負責重建快照。
  - 接受寫入目標設定，決定寫回本機檔案或 Blob。
  - 回傳前端與 API 需要的統一結果結構。

- `lib/refresh-auth.js`
  - 負責檢查 request header 中的 Bearer token 是否符合允許的 secret。
  - 統一 `REFRESH_SECRET` / `CRON_SECRET` 的授權邏輯。

- `lib/runtime-config.js`
  - 統一定義目前執行模式與相關環境變數。
  - 將 `dev` 模式與 Vercel 模式的差異集中管理。

- `scripts/dev-server.mjs`
  - 提供純 Node 本機伺服器。
  - 提供靜態頁面、`/api/snapshot`、`/api/refresh`。

### 執行模式

#### `dev` 模式

- 啟動純 Node server。
- 靜態提供 [index.html](/Users/kashionz/Desktop/tw-stock-screener/index.html:1) 與必要資源。
- `GET /api/snapshot`
  - 從本機 [data/latest-snapshot.json](/Users/kashionz/Desktop/tw-stock-screener/data/latest-snapshot.json:1) 讀取。
- `GET /api/refresh`
  - 驗證 `Authorization: Bearer <REFRESH_SECRET>`。
  - 呼叫共用 refresh service 重建最新快照。
  - 將結果寫回本機 [data/latest-snapshot.json](/Users/kashionz/Desktop/tw-stock-screener/data/latest-snapshot.json:1)。
  - 回傳與正式模式相近的 JSON 結構。

#### `dev:vercel` 模式

- 走 Vercel 本機模式。
- `api/` 下的 handler 繼續作為正式 adapter。
- `GET /api/snapshot`
  - 仍使用最佳快照策略。
- `GET /api/refresh`
  - 驗證 `Authorization: Bearer <REFRESH_SECRET>` 或 `CRON_SECRET`。
  - 呼叫共用 refresh service。
  - 依設定寫入 Blob。

### 前端互動行為

前端不需要知道後端模式，只維持現有呼叫方式：

- `fetch('/api/snapshot')`
- `fetch('/api/refresh', { headers: { authorization: 'Bearer ...' } })`

因此 [index.html](/Users/kashionz/Desktop/tw-stock-screener/index.html:316) 到 [index.html](/Users/kashionz/Desktop/tw-stock-screener/index.html:360) 的 UI 契約可以維持不變。這樣可以把這一輪重整限定在本機流程與後端結構，不把前端一起拉進高風險改動。

## 指令設計

新增或保留以下指令：

- `npm run dev`
  - 啟動純 Node 本機伺服器。

- `npm run dev:vercel`
  - 啟動 Vercel 本機驗證流程。

- `npm run refresh:local`
  - 保留現有行為，單純重建本機快照，不啟動伺服器。

如果 Vercel CLI 尚未安裝，`dev:vercel` 可以先定義為需要額外安裝依賴的驗證模式；這不影響 `dev` 成為日常主要入口。

## 環境變數設計

### 共通

- `REFRESH_SECRET`
  - `dev` 與 `dev:vercel` 都使用。
  - 前端「設定更新金鑰」輸入的值，必須對應這個 secret 才能成功更新。

### 僅 `dev:vercel` / 正式模式需要

- `BLOB_READ_WRITE_TOKEN`
  - 用於讀寫 Blob。

- `CRON_SECRET`
  - 保留給排程或其他正式流程使用。

- `SNAPSHOT_BLOB_PATH`
  - Blob 路徑覆寫。

### `dev` 模式原則

- 不要求 `BLOB_READ_WRITE_TOKEN`。
- `CRON_SECRET` 可省略。
- 若未設定 `REFRESH_SECRET`，則 `/api/refresh` 應拒絕授權請求，行為與正式模式一致。

## API 契約

### `GET /api/snapshot`

成功時：

- 回傳 `{ meta, rows }`
- `Cache-Control: no-store`

失敗時：

- 回傳 `{ ok: false, error }`
- 使用 500 狀態碼

### `GET /api/refresh`

授權失敗時：

- 回傳 `{ ok: false, error: "Unauthorized" }`
- 使用 401 狀態碼

成功時：

- 回傳 `{ ok: true, storedAt, meta, top5, ... }`
- `dev` 與 `dev:vercel` 的回傳形狀應盡量一致

差異點：

- `dev` 可不回傳真實 Blob URL，但回傳欄位應維持相容；若無 Blob，可回傳 `null` 或模式化標記值，避免前端或工具誤判。

## 測試策略

### `dev` 模式驗證

1. 打開本機網址。
2. 確認首頁載入成功，且畫面可顯示快照資料。
3. 開啟個股抽屜。
4. 測「設定更新金鑰」：
   - 有值時可儲存到 `localStorage`
   - 清空後可移除
5. 測「更新個股資訊」：
   - 未設定金鑰時，應只重載目前快照或顯示相應訊息
   - 設錯金鑰時，應回 401
   - 設對金鑰時，應更新本機快照並重新載入畫面

### `dev:vercel` 模式驗證

1. 確認 `/api/snapshot` 能正常回應。
2. 在缺少 `BLOB_READ_WRITE_TOKEN` 時，`/api/refresh` 應回覆可解釋的錯誤。
3. 補齊 Blob 設定後，`/api/refresh` 應可完成正式路徑更新。

### 自動檢查

保留現有：

- `npm run check:ui`
- `npm run check:deploy`

後續可再補：

- `dev server` 的最小 smoke test
- 共用 service 的單元測試

## 錯誤處理

1. 授權失敗要統一回 401，不要讓不同執行器各自回不同訊息。
2. 快照重建失敗要將 builder 的錯誤透出為清楚訊息，方便本機除錯。
3. `dev` 模式寫檔失敗時，要明確指出是本機快照寫入失敗，而不是籠統的更新失敗。
4. `dev:vercel` 模式缺少 Blob token 時，要保留目前清楚的錯誤訊息。

## 風險與取捨

1. `dev` 模式不寫 Blob，因此不等於正式資料儲存路徑；這是刻意接受的差異，換取更低的本機開發成本。
2. 若共用 service 設計過薄，仍可能殘留 adapter 邏輯重複；實作時要確保 Vercel handler 與 Node server 只做 transport 包裝。
3. 若後續前端需求增加，單一 [index.html](/Users/kashionz/Desktop/tw-stock-screener/index.html:1) 仍會是另一個維護壓力，但這不屬於本設計的第一階段。

## 分階段實作建議

第一階段：

1. 抽出共用 auth / snapshot / refresh service
2. 新增 `scripts/dev-server.mjs`
3. 補 `package.json` 的 `dev` 與 `dev:vercel`
4. 更新 README 本機使用方式

第二階段：

1. 驗證前端在 `dev` 與 `dev:vercel` 的互動一致性
2. 為共用 service 補最小測試

第三階段：

1. 視需要再拆前端模組
2. 視需要再拆 [lib/build-snapshot.js](/Users/kashionz/Desktop/tw-stock-screener/lib/build-snapshot.js:1)

## 成功標準

1. 開發者不再需要用 `file://` 模式測主要功能。
2. `npm run dev` 可完整驗證更新金鑰與更新個股資訊流程。
3. `npm run dev:vercel` 可作為正式相容驗證入口。
4. 本機與正式模式的快照/更新邏輯由共享服務層維護，而不是各自複製。
