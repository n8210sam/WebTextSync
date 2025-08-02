// background.js
let syncSourceId = null;

// 監聽 port 以使用長連線 connect() : 這是設計的 fallback，會由 content script 再改用 chrome.runtime.connect → background 的 onConnect 查詢 URL。
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "getTabIdPort") {
    port.onMessage.addListener((msg) => {
      if (msg.action === "getTabId" && msg.url) {
        chrome.tabs.query({ url: msg.url }, (tabs) => {
          if (tabs.length > 0) {
            port.postMessage({ tabId: tabs[0].id });
          } else {
            port.postMessage({ tabId: null });
          }
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('background.js 收到消息:', msg, 'from:', sender);
  
  // 處理來自 content script 的 saveSelector 請求
  if (msg.action === "getTabId") {
    // sendResponse 後會由 content script 改用新增的 fallback 方案 onConnect.addListener 。
	  if (sender.tab && sender.tab.id) {
      sendResponse({ tabId: sender.tab.id });
    } else {
      sendResponse({ tabId: null });
    }
  }
  
  if (msg.action === "selectedElement") {
    console.log('轉發 selectedElement 到 popup');
    // 轉發到 popup
    chrome.runtime.sendMessage(msg);
  }
  if (msg.action === "saveSelector") {
    console.log('轉發 saveSelector 到 popup');
    // 轉發到 popup
    chrome.runtime.sendMessage(msg);
  }
  
  
  // 選擇(監聽/輸出)目標
  if (msg.action === "selectElement") {
    if (msg.syncSourceId) syncSourceId = msg.syncSourceId; // 註冊為 background 靜態 syncSourceId
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        console.log(`background.js @_@ action="${msg.action}"`);
        chrome.tabs.sendMessage(tabs[0].id, { action: "startSelecting", mode: msg.mode });
      }
    });
    return true; // 保持消息通道開放
  }

  // 監聽文字
  if (msg.action === "initMonitor") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "initMonitor" });
      }
    });
    return true; // 保持消息通道開放
  }

  // 取消監聽
  if (msg.action === "cancelMonitor") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "cancelMonitor" });
      }
    });
    return true; // 保持消息通道開放
  }

  // 同步輸出文字
  if (msg.action === "syncOutput") {
    console.log('[WebTextSync] 收到同步輸出請求，數據:', msg.data);
    
    // 獲取所有輸出目標分頁並發送同步消息
    chrome.storage.local.get(['syncTargets'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[WebTextSync] 無法讀取輸出目標:', chrome.runtime.lastError);
        return;
      }
      
      const syncTargetsArray = result.syncTargets || [];
      console.log('[WebTextSync] 找到輸出目標:', syncTargetsArray);
      
      if (syncTargetsArray.length === 0) {
        console.log('[WebTextSync] 沒有設定輸出目標');
        return;
      }
      
      // 獲取監聽來源分頁 ID 以避免循環
      chrome.storage.local.get(['syncSource'], (sourceResult) => {
        const syncSource = sourceResult.syncSource;
        const sourceTabId = syncSource ? syncSource.id : null;
        
        console.log(`[WebTextSync] 監聽來源分頁 ID: ${sourceTabId}`);
        
        // 向每個輸出目標分頁發送同步消息（排除監聽來源）
        syncTargetsArray.forEach((target, index) => {
          if (target && target.id) {
            // 防循環：如果輸出目標就是監聽來源，跳過
            if (sourceTabId && target.id === sourceTabId) {
              console.log(`[WebTextSync] 跳過輸出到監聽來源分頁: ${target.title} (ID: ${target.id})`);
              return;
            }
            
            chrome.tabs.get(target.id, (tab) => {
              if (chrome.runtime.lastError || !tab) {
                console.warn(`[WebTextSync] 輸出目標分頁 ${target.id} 不存在:`, target.title);
              } else {
                chrome.tabs.sendMessage(target.id, { 
                  action: "syncOutput", 
                  data: msg.data,
                  sourceTabId: sourceTabId // 傳遞來源分頁 ID
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    console.warn(`[WebTextSync] 無法發送到分頁 ${target.id}:`, chrome.runtime.lastError.message);
                  } else {
                    console.log(`[WebTextSync] 已發送同步消息到: ${target.title}`);
                  }
                });
              }
            });
          }
        });
      });
    });
    return true; // 保持消息通道開放
  }
  // 想在某處觸發輸出同步行為時，比如 popup.js 或 background.js，直接執行：
  // chrome.runtime.sendMessage({ action: "syncOutput" });
  // 會由 background.js 傳送訊息給 content script（output.js），執行同步輸出功能。

});
