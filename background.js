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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "syncOutput" });
      }
    });
  }
  // 想在某處觸發輸出同步行為時，比如 popup.js 或 background.js，直接執行：
  // chrome.runtime.sendMessage({ action: "syncOutput" });
  // 會由 background.js 傳送訊息給 content script（output.js），執行同步輸出功能。

});
