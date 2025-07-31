// output.js 

// 改為依據多個 outputSelectors 執行同步輸出

// 初始化
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "syncOutput") {
    //
	console.log('[WebTextSync] 收到並啟用 syncOutput', message );
	  const SyncTarget = WebTextSync.syncTarget ? WebTextSync.syncTarget() : null;
	  if (!SyncTarget) {
		console.warn('[WebTextSync] 無法找到輸入框');
		return false;
	  }
	  // SyncTarget.innerHTML;
  }
  return true; // Keep message channel open for async response
});
