// background.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('background.js 收到消息:', msg, 'from:', sender);
  
  // 處理來自 content script 的 saveSelector 請求
  if (msg.action === "saveSelector") {
    console.log('轉發 saveSelector 到 popup');
    // 轉發到 popup
    chrome.runtime.sendMessage(msg);
    return;
  }
  
  // 選擇(監聽/輸出)目標
  if (msg.action === "selectElement") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log(`background.js @_@ action="${msg.action}"`);
      chrome.tabs.sendMessage(tabs[0].id, { action: "startSelecting", mode: msg.mode });
    });
  }

  // 監聽文字
  if (msg.action === "initMonitor") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "initMonitor" });
    });
  }

  // 取消監聽
  if (msg.action === "cancelMonitor") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "cancelMonitor" });
    });
  }

  // 同步輸出文字
  if (msg.action === "syncOutput") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "syncOutput" });
    });
  }
  // 想在某處觸發輸出同步行為時，比如 popup.js 或 background.js，直接執行：
  // chrome.runtime.sendMessage({ action: "syncOutput" });
  // 會由 background.js 傳送訊息給 content script（output.js），執行同步輸出功能。

});
