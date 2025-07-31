// monitor.js 

// 全局變數保存目前狀態與 handler/observer 引用，方便取消監聽
let monitorState = {
  target: null,
  handler: null,
  observer: null,
};

// 對目標同步輸出
function handlerFactory(source) {
  return () => {
    const text = source.value || source.innerText || "";
    chrome.storage.local.set({ latestInput: text }, () => {
      console.log("[WebTextSync] (防抖動監聽)同步輸出 : latestInput:", text);
      chrome.runtime.sendMessage({ action: "syncOutput" });
    });
  };
}

// 監聽來自 chrome.runtime 和 window.postMessage 的消息
chrome.runtime.onMessage.addListener(handleMonitorMessage);

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'WEBTEXT_SYNC_MESSAGE') {
    handleMonitorMessage(event.data);
  }
});

function handleMonitorMessage(msg) {
  // 延遲執行，等收到 initMonitor 才啟動監聽
  if (msg.action === "initMonitor") {
    const domainPattern = window.location.origin + "/*";

    chrome.storage.sync.get([domainPattern], (data) => {
      const selector = data?.[domainPattern]?.monitorSelector;
      if (!selector) return console.warn("[WebTextSync] monitorSelector undefined for", domainPattern);

      const source = document.querySelector(selector);
      if (!source) return console.warn("[WebTextSync] 監聽對象不存在:", selector);

      // 若之前已有監聽，先取消（避免重複綁定）
      if (monitorState.target) {
        // 移除事件
        if (monitorState.handler && (monitorState.target.tagName === "INPUT" || monitorState.target.tagName === "TEXTAREA")) {
          monitorState.target.removeEventListener("input", monitorState.handler);
        }
        // 斷開 MutationObserver
        if (monitorState.observer) {
          monitorState.observer.disconnect();
          monitorState.observer = null;
        }
        monitorState.target = null;
        monitorState.handler = null;
      }

      monitorState.target = source;

      // 標記綠框並提示
      source.style.outline = "2px solid #4CAF50";
      const preview = (source.value || source.innerText || "");
      showFloatingTip(`[監聽中] ${ ellipsisText(preview) }`);

      // 防抖動包裝，設定停2秒後才執行
      let syncOutput = debounce(handlerFactory(source), 2000);
      monitorState.handler = syncOutput;

      // 根據元素類型判斷使用事件或 MutationObserver
      if (["INPUT", "TEXTAREA"].includes(source.tagName)) {
        source.addEventListener("input", syncOutput);
      } else {
        let observer = new MutationObserver(syncOutput);
        observer.observe(source, { childList: true, characterData: true, subtree: true });
        monitorState.observer = observer;
      }

      console.log("[WebTextSync] 開始監聽目標：", selector);
      console.log("[WebTextSync] 初始內文：", preview);
    });
  }

  // 新增一個 cancelMonitor 的訊息，收到時會解除監聽
  if (msg.action === "cancelMonitor") {
    if (!monitorState.target) {
      console.log("[WebTextSync] 尚未啟用監聽，無法取消");
      return;
    }

    // 先解除事件監聽
    if (monitorState.handler && (monitorState.target.tagName === "INPUT" || monitorState.target.tagName === "TEXTAREA")) {
      monitorState.target.removeEventListener("input", monitorState.handler);
    }

    // 停止 observer
    if (monitorState.observer) {
      monitorState.observer.disconnect();
      monitorState.observer = null;
    }

    // 清空狀態與 UI 標記
    if (monitorState.target) {
      monitorState.target.style.outline = "";  // 移除綠框標記
    }
    monitorState.target = null;
    monitorState.handler = null;

    showFloatingTip("[WebTextSync] 監聽已取消");

    console.log("[WebTextSync] 已取消監聽目標");
  }
}
