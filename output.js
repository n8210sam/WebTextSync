// output.js 

// 改為依據多個 outputSelectors 執行同步輸出

// 添加寫字/翻頁圖示到標題
let originalTitle = null;
let writeIconInterval = null;

function addWritingIconToTitle() {
  if (originalTitle === null) {
    originalTitle = document.title;
  }
  
  // 清除之前的間隔
  if (writeIconInterval) {
    clearInterval(writeIconInterval);
  }
  
  const writeIcons = ['✍️', '📝', '📄', '📋', '✏️']; // 寫字和翻頁相關圖示
  let iconIndex = 0;
  
  writeIconInterval = setInterval(() => {
    const currentIcon = writeIcons[iconIndex];
    document.title = `${currentIcon} ${originalTitle}`;
    iconIndex = (iconIndex + 1) % writeIcons.length;
  }, 1500); // 每1.5秒切換一次圖示
  
  // console.log("[WebTextSync] 已添加寫字圖示到標題");
}

function removeWritingIconFromTitle() {
  if (writeIconInterval) {
    clearInterval(writeIconInterval);
    writeIconInterval = null;
  }
  
  if (originalTitle !== null) {
    document.title = originalTitle;
    console.log("[WebTextSync] 已移除寫字圖示，恢復原標題");
  }
}

// 檢查 extension context 是否有效
function isExtensionContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (error) {
    return false;
  }
}

// 安全的消息發送函數
function safeSendMessage(message, callback) {
  if (!isExtensionContextValid()) {
    console.warn("[WebTextSync] Extension context invalidated in output.js");
    return false;
  }
  
  try {
    chrome.runtime.sendMessage(message, callback);
    return true;
  } catch (error) {
    console.warn("[WebTextSync] Extension context error in output.js:", error.message);
    return false;
  }
}

// 檢查當前頁面是否為輸出目標
function checkIfOutputTarget() {
  if (!isExtensionContextValid()) {
    console.warn('[WebTextSync] Extension context not valid, skipping output target check');
    return;
  }
  
  chrome.storage.local.get(['syncTargets', 'syncSource'], function(result) {
    if (chrome.runtime.lastError) {
      console.warn('[WebTextSync] 無法檢查輸出目標:', chrome.runtime.lastError);
      return;
    }
    
    const syncTargetsArray = result.syncTargets || [];
    const syncSource = result.syncSource;
    
    // 獲取當前分頁 ID
    safeSendMessage({ action: "getTabId" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[WebTextSync] 無法取得當前分頁 ID:', chrome.runtime.lastError);
        return;
      }
      
      if (response && response.tabId) {
        const currentTabId = response.tabId;
        
        // 檢查當前分頁是否為監聽來源
        const isMonitorSource = syncSource && syncSource.id === currentTabId;
        
        // 檢查當前分頁是否在輸出目標列表中
        const isOutputTarget = syncTargetsArray.some(target => target.id === currentTabId);
        
        if (isMonitorSource) {
          console.log('[WebTextSync] 當前分頁是監聽來源，移除寫字圖示');
          removeWritingIconFromTitle();
        } else if (isOutputTarget) {
          console.log('[WebTextSync] 當前分頁是輸出目標，添加寫字圖示');
          addWritingIconToTitle();
        } else {
          console.log('[WebTextSync] 當前分頁既不是監聽來源也不是輸出目標');
          removeWritingIconFromTitle();
        }
      }
    });
  });
}

// 執行同步輸出到目標元素
function performSyncOutput(data) {
  // 獲取當前分頁的輸出選擇器
  const domainPattern = window.location.origin + '/*';
  
  chrome.storage.local.get([domainPattern], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('[WebTextSync] 無法讀取輸出選擇器:', chrome.runtime.lastError);
      return;
    }
    
    const domainData = result[domainPattern] || {};
    const outputSelectors = domainData.outputSelectors || [];
    
    if (outputSelectors.length === 0) {
      console.log('[WebTextSync] 當前域名沒有設定輸出選擇器');
      return;
    }
    
    console.log('[WebTextSync] 找到輸出選擇器:', outputSelectors);
    
    // 遍歷所有輸出選擇器並同步文字
    outputSelectors.forEach((selector, index) => {
      try {
        const targetElement = document.querySelector(selector);
        let success = false
        if (targetElement) {
          // 根據元素類型決定如何設定文字
          if (targetElement.contentEditable === 'true') {
            // 可編輯的 div (如 ChatGPT, Gemini)
            targetElement.innerHTML = data;
            success = true ;
          } else if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
            // 輸入框或文字區域
            targetElement.value = data;
            // 觸發 input 事件讓網站知道內容已改變
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
            success = true ;
          } else {
            // 其他元素，設定 textContent
            targetElement.textContent = data;
            success = true ;
          }
          if (success) {
            console.log(`[WebTextSync] 已同步到文字元素 ${index + 1}:`, selector);
          }
          
          // 添加視覺反饋 - 短暫的綠色邊框
          const originalOutline = targetElement.style.outline;
          targetElement.style.outline = '2px solid #4CAF50';
          setTimeout(() => {
            targetElement.style.outline = originalOutline;
          }, 1000);
          
        } else {
          console.warn(`[WebTextSync] 找不到輸出目標元素: ${selector}`);
        }
      } catch (error) {
        console.error(`[WebTextSync] 同步到選擇器 "${selector}" 時發生錯誤:`, error);
      }
    });
  });
}

// 初始化
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "syncOutput") {
    console.log('[WebTextSync] 收到同步輸出請求', message);
    
    // 雙重防循環檢查：確保不會輸出到監聽來源
    safeSendMessage({ action: "getTabId" }, (response) => {
      if (response && response.tabId && message.sourceTabId) {
        if (response.tabId === message.sourceTabId) {
          console.log('[WebTextSync] 防循環：當前分頁是監聽來源，跳過輸出');
          return;
        }
      }
      
      if (message.data) {
        performSyncOutput(message.data);
      } else {
        console.warn('[WebTextSync] 同步輸出請求沒有包含數據');
      }
    });
  }
  return true; // Keep message channel open for async response
});

// 監聽 storage 變化，當監聽來源或輸出目標改變時重新檢查
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.syncSource || changes.syncTargets)) {
    console.log('[WebTextSync] 監聽設定已變更，重新檢查圖示狀態');
    setTimeout(checkIfOutputTarget, 100);
  }
});

// 請求監聽來源的當前內容
function requestCurrentContentFromMonitor() {
  if (!isExtensionContextValid()) {
    console.warn('[WebTextSync] Extension context not valid, skipping content request');
    return;
  }
  
  chrome.storage.local.get(['syncSource'], function(result) {
    if (chrome.runtime.lastError) {
      console.warn('[WebTextSync] 無法讀取監聽來源:', chrome.runtime.lastError);
      return;
    }
    
    const syncSource = result.syncSource;
    if (!syncSource || !syncSource.id) {
      console.log('[WebTextSync] 沒有設定監聽來源');
      return;
    }
    
    console.log('[WebTextSync] 請求監聽來源的當前內容:', syncSource.title);
    
    // 通過 background script 向監聽來源分頁請求當前內容
    safeSendMessage({ 
      action: "requestCurrentContent",
      sourceTabId: syncSource.id 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[WebTextSync] 無法從監聽來源獲取內容:', chrome.runtime.lastError.message);
      } else if (response && response.content) {
        console.log('[WebTextSync] 收到監聽來源內容，執行同步:', response.content);
        performSyncOutput(response.content);
      } else {
        console.log('[WebTextSync] 監聽來源沒有內容或未回應');
      }
    });
  });
}

// 檢查並執行初始同步
function checkAndPerformInitialSync() {
  checkIfOutputTarget();
  
  // 稍微延遲後請求初始內容，確保頁面完全載入
  setTimeout(() => {
    chrome.storage.local.get(['syncTargets'], function(result) {
      if (chrome.runtime.lastError) return;
      
      const syncTargetsArray = result.syncTargets || [];
      
      safeSendMessage({ action: "getTabId" }, (response) => {
        if (response && response.tabId) {
          const isOutputTarget = syncTargetsArray.some(target => target.id === response.tabId);
          
          if (isOutputTarget) {
            console.log('[WebTextSync] 當前分頁是輸出目標，請求初始同步');
            requestCurrentContentFromMonitor();
          }
        }
      });
    });
  }, 500);
}

// 頁面載入完成後檢查是否為輸出目標並執行初始同步
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndPerformInitialSync);
} else {
  // 如果頁面已經載入完成，稍微延遲後執行檢查
  setTimeout(checkAndPerformInitialSync, 200);
}

console.log('[WebTextSync] output.js 載入');
