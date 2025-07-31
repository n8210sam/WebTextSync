// monitor.js 

// 監聽整個頁面 body  ***** version 2 ***** 防抖動 + 鍵盤、滑鼠、MutationObserver

let lastUserAction = null; // 保留最後一次操作

function markUserAction(type, event) {
  lastUserAction = {
    type,                   // 操作類型（如 'keydown', 'paste'）
    time: Date.now(),       // 時間戳（毫秒）
    detail: {
      key: event?.key,      // 若有提供鍵盤事件
      ctrlKey: event?.ctrlKey,
      target: event?.target // 觸發的 DOM 元素
    }
  };
  //console.log(`[WebTextSync] 使用者操作：${type} @ ${new Date(lastUserAction.time).toLocaleTimeString()}`);
}

// 🔁 記錄使用者操作類型
function setupUserInputTracking() {
  const markUserInput = (type) => () => {
    lastUserAction = type + "@" + new Date().toISOString();
    console.log(`[WebTextSync] 使用者觸發：${lastUserAction}`);
  };

  document.addEventListener("keydown", (e) => markUserAction("keydown", e));
  document.addEventListener("mousedown", (e) => markUserAction("mousedown", e));
  // 記錄 paste (包括 右鍵 或 Ctrl/Cmd + V 貼上)
  document.addEventListener("paste", (e) => {
    let pasted = (e.clipboardData || window.clipboardData).getData('text');
    console.log("[WebTextSync] 貼上內容：", pasted, e.clipboardData || window.clipboardData );
    markUserAction("paste", e);
  });

}


// 🔍 DOM 變動偵測
function handleMutations(mutationsList) {
  console.log(`[WebTextSync] 偵測 DOM 變動，最近操作：${lastUserAction}`, 42, mutationsList ,lastUserAction);

    for (const mutation of mutationsList) {
      // mutation.type 類型分為 attributes childList characterData
      if (mutation.type === "characterData") {
        console.log("文字變更：", mutation.target.data);
		chrome.runtime.sendMessage({ action: "syncOutput", data: mutation.target.data });
      }
    }
}

// 防抖包裝
const debouncedMutationHandler = WebTextSync.Debounce(handleMutations, 2000);

// 🚀 啟用監聽
function startObserver() {
  // 啟用觀察器
  const observer = new MutationObserver(debouncedMutationHandler);

  // 監聽整個頁面 body
  observer.observe(document.body, {
	characterData: true, // 監聽文字內容改變
	subtree: true        // 遞迴整個 DOM 子樹
  });
  console.log("[WebTextSync] MutationObserver 已啟動");
}

function startMonitoring(){
    setupUserInputTracking(); // 🔁 記錄使用者操作類型
    startObserver(); // 🚀 啟用監聽
	console.log('[WebTextSync] 收到並啟用 initMonitor');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "initMonitor") startMonitoring();
  return true; // Keep message channel open for async response
});

console.log('[WebTextSync] monitor.js 載入');

// onLoadMonitor 
try {
  let syncSource = WebTextSync.getStoredSyncSource()
  chrome.tabs.get(syncSource.id, (tab) => {
	if (chrome.runtime.lastError || !tab) {
	  // syncSource.id 對應分頁不存在，跳過更新監聽目標
	} else {
	  startMonitoring();
	};
  });
} catch (e) { }