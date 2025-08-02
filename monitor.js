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
    // console.log(`[ monitor.js ] 使用者操作：${type} @ ${new Date(lastUserAction.time).toLocaleTimeString()}`);
  }

  // 🔁 記錄使用者操作類型
  function setupUserInputTracking() {
    document.addEventListener("keydown", (e) => markUserAction("keydown", e));
    document.addEventListener("mousedown", (e) => markUserAction("mousedown", e));
    document.addEventListener("paste", (e) => { // 記錄 paste (包括 右鍵 或 Ctrl/Cmd + V 貼上)
      let pasted = (e.clipboardData || window.clipboardData).getData("text");
      console.log("[ monitor.js ] 貼上內容：", pasted, e.clipboardData || window.clipboardData);
      markUserAction("paste", e);
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
      // 移除閃爍眼睛
      removeBlinkingEyeFromTitle();
      console.log("[ monitor.js ] MutationObserver 已停止");
    }
  }
  
  function handleMutations(mutationsList) {
    console.log(`[ monitor.js ] 偵測 DOM 變動，最近操作：`, lastUserAction, mutationsList);
    for (const mutation of mutationsList) {
      // mutation.type 類型分為 attributes childList characterData
      if (mutation.type === "characterData") {
        console.log("文字變更：", mutation.target.data);
        const txt = mutation.target.data.trim();
        
        // 使用安全的消息發送函數
        WebTextSync.safeSendMessage({
          action: "syncOutput",
          sourceTabId: WebTextSync.currentTabId,
          data: txt
        }).then(response => {
          console.log("safeSendMessage 成功回應：", response);
        }).catch(error => {
          console.log("safeSendMessage 發生錯誤：", error.message);
          stopObserver();
        });

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
    console.log("[ monitor.js ] MutationObserver 已啟動");
  }

  function startMonitoring() {
    setupUserInputTracking(); // 🔁 記錄使用者操作類型
    startObserver(); // 🚀 啟用監聽
    console.log("[ monitor.js ] 收到並啟用 initMonitor");
  }

  // 添加閃爍眼睛到標題
  let eyeBlinkInterval = 'eyeBlinkInterval';
  
  function addBlinkingEyeToTitle() {
    WebTextSync.setTitleAnimation(eyeBlinkInterval, i => (i % 2 === 0 ? '😉' : '🔥'), 1000);
    // console.log("[ monitor.js ] 已添加閃爍眼睛到標題 ... 👁👁️😉👀🤌🏻🔥 ");
  }
  
  function removeBlinkingEyeFromTitle() {
    WebTextSync.removeTitleAnimation(eyeBlinkInterval); 
  }


  // 獲取當前監聽內容
  function getCurrentMonitorContent() {
    console.log('[ monitor.js ] 開始獲取監聽內容...');
    
    // 嘗試從網站專用的 syncTarget 獲取內容
    console.log('[ monitor.js ] WebTextSync.syncElement ', WebTextSync.syncElement);
    if (WebTextSync.syncElement) {
      try {
        const targetElement = WebTextSync.syncElement();
        console.log('[ monitor.js ] 目標元素:', targetElement);
        
        if (targetElement) {
          let content = '';
          if (targetElement.contentEditable === 'true') {
            content = targetElement.innerHTML || targetElement.textContent || '';
            console.log('[ monitor.js ] 從 contentEditable 元素獲取內容');
          } else if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
            content = targetElement.value || '';
            console.log('[ monitor.js ] 從 INPUT/TEXTAREA 元素獲取內容');
          } else {
            content = targetElement.textContent || '';
            console.log('[ monitor.js ] 從其他元素獲取內容');
          }
          console.log('[ monitor.js ] 獲取到監聽內容:', content);
          return content;
        } else {
          console.warn('[ monitor.js ] syncTarget() 返回 null');
        }
      } catch (error) {
        console.warn('[ monitor.js ] 獲取監聽內容時發生錯誤:', error);
      }
    } else {
      console.warn('[ monitor.js ] WebTextSync.syncElement 不存在');
    }
    
    console.log('[ monitor.js ] 無法獲取監聽內容');
    return '';
  }

  console.log('[ monitor.js ] monitor.js 載入');


  // 自動檢查並啟動監聽功能
  function checkAndAutoStartMonitoring() {
    WebTextSync.getStoredSyncSource()
      .then(syncSource => {
        // *** 不必檢查 syncSource 和 .id 是否存在且有效, getStoredSyncSource 已檢查過
        //if (!syncSource) {
        if (!WebTextSync.currentTabId) {
          console.log('[ monitor.js ] 缺少 currentTabId, 重新抓取 ? ');
          (async () => {
            WebTextSync.currentTabId = await WebTextSync.getCurrentTabIdSafe();
            console.log('[ monitor.js ]  currentTabId=',WebTextSync.currentTabId);
          })();
          
          if (!WebTextSync.currentTabId) {
            console.warn('[ monitor.js ] 缺少 currentTabId, 跳過監聽');
            return;
          }
        }
          
        if (WebTextSync.currentTabId === syncSource.tabId) {
          console.log('[ monitor.js ] 當前分頁是監聽來源，自動啟動監聽', WebTextSync.currentTabId , syncSource.tabId );
          startMonitoring();
        } else {
          console.log(`[ monitor.js ] 當前分頁 (${response?.tabId}) 不是監聽來源 (${syncSource.tabId})`);
        }
      })
      .catch(err => {
        console.warn('[ monitor.js ] 載入 syncSource 失敗:', err.message);
      });
  }
  
  if (WebTextSync.debug_mode) console.log('[ monitor.js ] 載入完成後  debug_mode On : WebTextSync.currentTabId = ',WebTextSync.currentTabId,' , .originalTitle:',WebTextSync.originalTitle,' , .currentSyncTarget:',WebTextSync.currentSyncTarget);
  /*
  // 頁面載入完成後檢查並自動啟動監聽
  if (document.readyState === 'loading') {
    console.log('[ monitor.js ]  document.readyState === loading  addEventListener' );
    document.addEventListener('DOMContentLoaded', checkAndAutoStartMonitoring);
  } else {
    // 如果頁面已經載入完成，直接執行檢查
    console.log('[ monitor.js ]  setTimeout(checkAndAutoStartMonitoring, 200) ' );
    setTimeout(checkAndAutoStartMonitoring, 200); // 稍微延遲確保所有腳本都載入完成
  }
  */

  // 將公開 API 封裝
  return {
    startMonitoring,stopObserver,getCurrentMonitorContent, checkAndAutoStartMonitoring
  };
})();
