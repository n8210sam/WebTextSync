// monitor.js   ***** version 3 *****

// 監聽整個頁面 body + 防抖動 + 鍵盤、滑鼠、MutationObserver + WebTextMonitor 包裝

const WebTextMonitor = (() => {
  let observer = null;
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
    // console.log(`[WebTextSync] 使用者操作：${type} @ ${new Date(lastUserAction.time).toLocaleTimeString()}`);
  }

  // 🔁 記錄使用者操作類型
  function setupUserInputTracking() {
    document.addEventListener("keydown", (e) => markUserAction("keydown", e));
    document.addEventListener("mousedown", (e) => markUserAction("mousedown", e));
    document.addEventListener("paste", (e) => { // 記錄 paste (包括 右鍵 或 Ctrl/Cmd + V 貼上)
      let pasted = (e.clipboardData || window.clipboardData).getData("text");
      console.log("[WebTextSync] 貼上內容：", pasted, e.clipboardData || window.clipboardData);
      markUserAction("paste", e);
    });
  }

  function handleMutations(mutationsList) {
    console.log(`[WebTextSync] 偵測 DOM 變動，最近操作：`, lastUserAction, mutationsList);
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
    if (observer) observer.disconnect(); // 保險起見先停掉

    observer = new MutationObserver(debouncedMutationHandler);
	// 監聽整個頁面 body
    observer.observe(document.body, {
      characterData: true,
      subtree: true,
    });

    // 添加閃爍眼睛到網頁標題
    addBlinkingEyeToTitle();
    console.log("[WebTextSync] MutationObserver 已啟動");
  }

  function startMonitoring() {
    setupUserInputTracking(); // 🔁 記錄使用者操作類型
    startObserver(); // 🚀 啟用監聽
    console.log("[WebTextSync] 收到並啟用 initMonitor");
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
      // 移除閃爍眼睛
      removeBlinkingEyeFromTitle();
      console.log("[WebTextSync] MutationObserver 已停止");
    }
  }

  // 添加閃爍眼睛到標題
  let originalTitle = null;
  let eyeBlinkInterval = null;
  
  function addBlinkingEyeToTitle() {
    if (originalTitle === null) {
      originalTitle = document.title;
    }
    
    // 清除之前的間隔
    if (eyeBlinkInterval) {
      clearInterval(eyeBlinkInterval);
    }
    
    let isEyeOpen = true;
    eyeBlinkInterval = setInterval(() => {
      const eyeIcon = isEyeOpen ? '😉' : '🔥'; // : '👁👁️😉👀🤌🏻🔥';
      document.title = `${eyeIcon} ${originalTitle}`;
      isEyeOpen = !isEyeOpen;
    }, 1000); // 每秒切換一次
    
    console.log("[WebTextSync] 已添加閃爍眼睛到標題");
  }
  
  function removeBlinkingEyeFromTitle() {
    if (eyeBlinkInterval) {
      clearInterval(eyeBlinkInterval);
      eyeBlinkInterval = null;
    }
    
    if (originalTitle !== null) {
      document.title = originalTitle;
      console.log("[WebTextSync] 已移除閃爍眼睛，恢復原標題");
    }
  }

  // 初始化監聽指令
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "initMonitor") startMonitoring();
    return true;
  });

  console.log('[WebTextSync] monitor.js 載入');


  // 自動檢查並啟動監聽功能
  function checkAndAutoStartMonitoring() {
    WebTextSync.getStoredSyncSource()
      .then(syncSource => {
        // 檢查 syncSource 是否存在且有效
        if (!syncSource) {
          console.log('[WebTextSync] 沒有找到 syncSource，不自動啟動監聽 ⚠️ getStoredSyncSource 應該要過濾掉這個錯誤❗');
          return;
        }
        
        if (!syncSource.id) {
          console.log('[WebTextSync] syncSource 沒有 id，不自動啟動監聽 ⚠️ getStoredSyncSource 應該要過濾掉這個錯誤❗');
          return;
        }
        
        // 檢查當前分頁是否為監聽來源分頁
        chrome.runtime.sendMessage({ action: "getTabId" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[WebTextSync] 無法取得當前分頁 ID:', chrome.runtime.lastError);
            return;
          }
          
          if (response && response.tabId === syncSource.id) {
            // console.log('[WebTextSync] 當前分頁是監聽來源，自動啟動監聽');
            startMonitoring();
          } else {
            // console.log(`[WebTextSync] 當前分頁 (${response?.tabId}) 不是監聽來源 (${syncSource.id})，不啟動監聽`);
          }
        });
      })
      .catch(err => {
        console.warn('[WebTextSync] 載入 syncSource 失敗:', err.message);
      });
  }
  
  // 頁面載入完成後檢查並自動啟動監聽
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndAutoStartMonitoring);
  } else {
    // 如果頁面已經載入完成，直接執行檢查
    setTimeout(checkAndAutoStartMonitoring, 100); // 稍微延遲確保所有腳本都載入完成
  }

  // 將公開 API 封裝
  return {
    stopObserver,
  };
})();
