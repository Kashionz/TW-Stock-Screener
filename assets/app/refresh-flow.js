import { applySnapshot, setRefreshKey } from "./state.js";
import { revLabel } from "./helpers.js";

function isSnapshotPayload(snapshot) {
  return Boolean(snapshot?.meta && Array.isArray(snapshot.rows) && snapshot.rows.length > 0);
}

function unavailableMessage(runtime) {
  if (runtime?.hasLiveApi) return "";
  return "目前是靜態檔模式；若要測試設定更新金鑰與更新個股資訊，請改用 npm run dev 或 npm run dev:vercel。";
}

export function createRefreshFlow({ state, ui, runtime }) {
  const snapshotUrl = runtime?.snapshotUrl;
  const refreshUrl = runtime?.refreshUrl;

  async function hydrateLatestSnapshot({ reopenCode = null, resetPage = true } = {}) {
    if (!snapshotUrl) return false;

    try {
      const response = await fetch(snapshotUrl, {
        cache: "no-store",
      });
      if (!response.ok) return false;

      const nextSnapshot = await response.json();
      if (!isSnapshotPayload(nextSnapshot)) return false;

      ui.resetDrawer();
      applySnapshot(state, nextSnapshot);
      ui.syncSnapshotMeta();
      ui.renderIndustryOptions();
      if (resetPage) state.page = 1;
      ui.render();
      if (reopenCode && state.rows.some((row) => row.code === reopenCode)) {
        ui.openDrawer(reopenCode);
      }
      return true;
    } catch {
      return false;
    }
  }

  async function reloadCurrentSnapshot(okMessage) {
    if (!snapshotUrl) {
      ui.setRefreshStatus(unavailableMessage(runtime), "err");
      return false;
    }

    const reopenCode = state.currentCode;
    const loaded = await hydrateLatestSnapshot({
      reopenCode,
      resetPage: false,
    });
    if (!loaded) {
      ui.setRefreshStatus("重新載入快照失敗，請稍後再試。", "err");
      return false;
    }

    ui.setRefreshStatus(okMessage, "ok");
    return true;
  }

  async function promptRefreshKey() {
    if (!runtime?.hasLiveApi) {
      ui.setRefreshStatus(unavailableMessage(runtime), "err");
      return false;
    }

    const entered = window.prompt(
      "輸入手動更新金鑰；留空後按確定可清除此瀏覽器內已儲存的金鑰。",
      state.refreshKey,
    );
    if (entered === null) return false;

    const nextKey = entered.trim();
    setRefreshKey(state, nextKey);
    ui.updateRefreshControls();
    ui.setRefreshStatus(
      nextKey
        ? "已儲存更新金鑰，之後可直接抓取最新資料。"
        : "已清除更新金鑰，目前只會重新載入既有快照。",
      nextKey ? "ok" : "",
    );
    return true;
  }

  async function refreshCurrentStock() {
    if (state.refreshBusy || !state.currentCode) return;
    if (!refreshUrl) {
      ui.setRefreshStatus(unavailableMessage(runtime), "err");
      return;
    }

    if (!state.refreshKey) {
      await reloadCurrentSnapshot(
        "已重新載入目前快照；若要重抓交易所最新資料，請先設定更新金鑰。",
      );
      return;
    }

    state.refreshBusy = true;
    ui.updateRefreshControls();
    ui.setRefreshStatus("正在抓取最新資料，完成後會回到這檔個股。");

    const reopenCode = state.currentCode;

    try {
      const response = await fetch(refreshUrl, {
        cache: "no-store",
        headers: {
          authorization: `Bearer ${state.refreshKey}`,
        },
      });
      const payload = await response.json().catch(() => null);

      if (response.status === 401) {
        ui.setRefreshStatus("更新金鑰無效，或目前環境未啟用手動更新。", "err");
        return;
      }

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "更新失敗，請稍後再試。");
      }

      const loaded = await hydrateLatestSnapshot({
        reopenCode,
        resetPage: false,
      });
      if (!loaded) {
        ui.setRefreshStatus("資料已更新，但重新載入最新快照失敗。", "err");
        return;
      }

      const period = payload.meta ? revLabel(payload.meta.revPeriodROC) : "最新快照";
      ui.setRefreshStatus(`已更新為 ${period} 的資料。`, "ok");
    } catch (error) {
      ui.setRefreshStatus(
        error instanceof Error ? error.message : "更新失敗，請稍後再試。",
        "err",
      );
    } finally {
      state.refreshBusy = false;
      ui.updateRefreshControls();
    }
  }

  return {
    hydrateLatestSnapshot,
    promptRefreshKey,
    refreshCurrentStock,
    reloadCurrentSnapshot,
  };
}
