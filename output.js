// output.js 

// 改為依據多個 outputSelectors 執行同步輸出

// 監聽來自 chrome.runtime 和 window.postMessage 的消息
chrome.runtime.onMessage.addListener(handleOutputMessage);

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'WEBTEXT_SYNC_MESSAGE') {
    handleOutputMessage(event.data);
  }
});

function handleOutputMessage(msg) {
  if (msg.action === "syncOutput") {
    const domainPattern = window.location.origin + "/*";

    chrome.storage.sync.get([domainPattern], (data) => {
      const domainData = data[domainPattern];
      if (!domainData || !Array.isArray(domainData.outputSelectors) || domainData.outputSelectors.length === 0) {
        console.warn('[WebTextSync] 未設定輸出對象，無法同步輸出');
        return;
      }

      chrome.storage.local.get(["latestInput"], (res) => {
        const text = res.latestInput || "";

        domainData.outputSelectors.forEach((selector) => {
          const target = document.querySelector(selector);
          if (!target) {
            console.warn("[WebTextSync] "+ domainPattern +" 輸出對象不存在:", selector);
            return;
          }

          if (typeof target.value !== "undefined") {
            target.value = text;
          } else {
            target.innerText = text;
          }

          // 這裡要累計輸出的 domainPattern 和 selector
        });
		// 顯示不重複的 domainPattern 和 selector
          showFloatingTip("[WebTextSync] 已同步輸出到: " + ellipsisText(text));
          console.log("[WebTextSync] 已同步輸出", text,"目標",domainPattern,selector);
      });
    });
  }
}