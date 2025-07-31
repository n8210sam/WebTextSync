// background.js
let tabs = [];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('background.js 收到消息:', msg, 'from:', sender);
  
  // 處理來自 content script 的 saveSelector 請求
  if (msg.action === "getTabId") {
    // 當收到 "getTabId" 的請求時，sender.tab 物件會包含發送者（也就是內容腳本所在的分頁）的資訊
    if (sender.tab && sender.tab.id) {
      if (!tabs[sender.tab.id]) tabs[sender.tab.id] = sender.tab;
	  sendResponse({ tabId: sender.tab.id }); // 將分頁 ID 回傳給發送者
    } else {
      sendResponse({ tabId: null }); // 如果無法取得，則回傳 null
    }
    return true; // 表示 sendResponse 會非同步調用
  }
  
  if (msg.action === "setSyncTarget") { // 設定網站專用 syncTarget
    if (sender.tab && sender.tab.id) {
      if (!tabs[sender.tab.id]) tabs[sender.tab.id] = sender.tab;
      if (msg.syncTarget) tabs[sender.tab.id].syncTarget = msg.syncTarget;
    }
  }
  if (msg.action === "getSyncTarget") { // 取得網站專用 syncTarget
    if (sender.tab && sender.tab.id) {
      if (tabs[sender.tab.id] && tabs[sender.tab.id].syncTarget ) {
	    sendResponse({ syncTarget: tabs[sender.tab.id].syncTarget });
      } else {
        sendResponse({ tabId: null });
	  };
    } else {
      sendResponse({ tabId: null });
    }
    return true;
  }
  
  if (msg.action === "saveSelector") {
    console.log('轉發 saveSelector 到 popup');
    // 轉發到 popup
    chrome.runtime.sendMessage(msg);
    return;
  }
  
  if (msg.action === "selectedElement") {
    console.log('轉發 selectedElement 到 popup');
    // 轉發到 popup
    chrome.runtime.sendMessage(msg);
    return;
  }
  
  // 請求監聽來源的當前內容
  if (msg.action === "requestCurrentContent") {
    console.log('[WebTextSync] 收到請求當前內容，目標分頁:', msg.sourceTabId);
    
    if (msg.sourceTabId) {
      chrome.tabs.sendMessage(msg.sourceTabId, { 
        action: "getCurrentContent" 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[WebTextSync] 無法從監聽來源獲取內容:', chrome.runtime.lastError.message);
          sendResponse({ content: null });
        } else {
          console.log('[WebTextSync] 成功獲取監聽來源內容');
          sendResponse(response);
        }
      });
    } else {
      sendResponse({ content: null });
    }
    return true; // 保持消息通道開放以進行異步回應
  }
  
  // 選擇(監聽/輸出)目標
  if (msg.action === "selectElement") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        console.log(`background.js @_@ action="${msg.action}"`);
        chrome.tabs.sendMessage(tabs[0].id, { action: "startSelecting", mode: msg.mode });
      }
    });
  }

  // 監聽文字
  if (msg.action === "initMonitor") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "initMonitor" });
      }
    });
  }

  // 取消監聽
  if (msg.action === "cancelMonitor") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "cancelMonitor" });
      }
    });
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
  }
  // 想在某處觸發輸出同步行為時，比如 popup.js 或 background.js，直接執行：
  // chrome.runtime.sendMessage({ action: "syncOutput" });
  // 會由 background.js 傳送訊息給 content script（output.js），執行同步輸出功能。

});
