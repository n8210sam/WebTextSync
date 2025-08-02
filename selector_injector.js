// selector_injector.js  入口模組

const currentSyncTargetSet = new WeakMap(); // 用 WeakMap 自動記憶元素與其樣式
const styleProps = ['outline', 'backgroundColor', 'opacity'];

let currentMode = null;

console.log('selector_injector.js 載入');

  function backupStyles(e, prop) {
    if (!e || !prop) return;
    const currentStyles = {};
    prop.forEach(prop => {
      currentStyles[prop] = e.style[prop] || '';
    });
    currentSyncTargetSet.set(e, currentStyles);
  }
  function restoreStyles(e) {
    const saved = currentSyncTargetSet.get(e);
    if (!saved) return;
    for (const prop in saved) {
      e.style[prop] = saved[prop];
    }
    currentSyncTargetSet.delete(e); // 可選：恢復後清除備份
  }
  
  // 目標外觀強調
  function selectorMarkup(target, oldTarget) {

    if (oldTarget) { // 還原 舊物件 外觀樣式
      restoreStyles(oldTarget);
      if (oldTarget.parentElement) restoreStyles(oldTarget.parentElement);
      let children = oldTarget.children;
      if (children && children.length > 0) {
        for (let i = 0; i < children.length; i++) {
          restoreStyles(children[i]);
        }
      }
    }

    // 選定的(監聽/輸出)目標 用綠色外框標示
    backupStyles(target, styleProps); // 備份 新物件 外觀樣式
    target.style.outline = '2px solid #4CAF50';
    
    // 目標的父層  底色用淺黃色 xx 用橘線
    if (target.parentElement) {
      backupStyles(target.parentElement, styleProps); // 備份
      target.parentElement.style.outline = '1px solid orange';
      // target.parentElement.style.backgroundColor = '#ffff99';
      // target.parentElement.style.opacity = '0.2';
    }
    
    // 目標的子層(如果有)要用淺綠外框
    children = target.children;
    if (children && children.length > 0) {
      for (let i = 0; i < children.length; i++) {
        backupStyles(children[i], styleProps);
        children[i].style.outline = '1px solid #81C784';
        // children[i].style.backgroundColor = '#81C784';
      }
    }

    // 浮出提示文字
    const selector = WebTextSync.GenerateSmartSelector(target);
    const textVal = (target.innerText || target.value || '');
    WebTextSync.ShowFloatingTip(`✔ 已選擇元素：${WebTextSync.EllipsisText(textVal, 20)}`);
    console.log(`[WebTextSync]${currentMode} 已選擇元素：${selector} ,內文：${textVal}`, target);

  }
  
  function startSelecting() {
    document.body.style.cursor = 'crosshair';
    console.log(`start selecting currentMode="${currentMode}"`);

    function onClick(e) { // 點擊選定
      e.preventDefault();
      e.stopPropagation();

      let target = e.target;
      document.removeEventListener('click', onClick, true);
      document.body.style.cursor = 'default';
      
      selectorMarkup(target, WebTextSync.currentSyncTarget); // 目標外觀強調
      WebTextSync.currentSyncTarget = target; // 靜態儲存(輸出目標的選擇器)
      
      const selector = WebTextSync.GenerateSmartSelector(target);
      // ***** 分頁的完整資料設定 *****
      const targetData = {
        id: WebTextSync.currentTabId
        , tabId: WebTextSync.currentTabId
        , selector: selector
        , title: WebTextSync.originalTitle
        , target: target
      }
      
      if (currentMode === 'monitor') {
        // 監聽來源：syncSource 儲存到 chrome.storage.local , 每次執行都依鍵名 syncSource 覆蓋對應的值
        chrome.storage.local.set({ syncSource: targetData }, () => {
          console.log(`[ selector_injector.js ] 監聽來源已儲存`, targetData);
          sendSelectedElementMessage(targetData);
        });
      } else if (currentMode === 'output') {
        // 輸出目標：儲存到 syncTargets，同時儲存選擇器
        
        try {
          // chromeArray.put(key, newItem, matchField = 'id', callback)
          // chromeArray.put('syncTargets', targetData, 'tabId', callback);
        } catch (err) {
          throw err;
        }
        
        chrome.storage.local.get(['syncTargets'], (res) => {
          console.log('output onClick 儲存到 syncTargets', res);
          let syncTargetsArray = res.syncTargets || [];
          // 更新或新增目標
          try {
            const existingIndex = syncTargetsArray.findIndex(target => target.tabId === tabId);
            if (existingIndex >= 0) {
              syncTargetsArray[existingIndex] = targetData;
            } else {
              syncTargetsArray.push(targetData);
            }
            chrome.storage.local.set({ syncTargets: syncTargetsArray }, () => {
              console.log(`[ selector_injector.js ] 輸出目標已儲存 ${selector}`, targetData);
              sendSelectedElementMessage(targetData);
            });
          } catch (err) {
            // 實際測試遇到錯誤: 新增的 tabId 不在舊陣列裡, 解法? 直接用一筆新的蓋掉全部 :
            chrome.storage.local.set({ syncTargets:[targetData] })
            throw err;
          }
        });
      }
      
      function sendSelectedElementMessage(targetData) {
        // 發送消息到 background script，再轉發到 popup
        chrome.runtime.sendMessage({
          action: 'saveSelectedElement',
          mode: currentMode,
          data: targetData
        });
      }

      /* 改到 background.js  執行 onMessage.addListener
	  // 動態載入 monitor.js 或 output.js
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(currentMode === 'monitor' ? 'monitor.js' : 'output.js');
      document.documentElement.appendChild(script);
	  */
    }

    document.addEventListener('click', onClick, true);
  }


(async () => {
  console.log("[ selector_injector.js ] (async () => {初始化} ");
  await WebTextSync.init();
  console.log("[ selector_injector.js ]: WebTextSync 初始化完成，tabId:", WebTextSync.currentTabId); // 移到這裡 currentTabId 避免在 popup.js 抓取 currentTabId (會是 null)
  
  // 頁面載入完成後檢查並自動啟動監聽
  WebTextMonitor.checkAndAutoStartMonitoring()
  
  // 初始化 onMessage 監聽消息
  try {
    if (chrome.runtime && chrome.runtime.onMessage) {
      // Listen for messages from background script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[ selector_injector.js ] selector_injector.js 收到消息:', message);
        
        // ****** 選擇目標 ******
        if (message.action === "startSelecting") {
          console.log('selector_injector 收到 chrome.runtime 消息:', message);
          currentMode = message.mode;
          if (currentMode === 'monitor') { // 改為直接監聽, 不必選
            // const syncSource = WebTextSync.getStoredSyncSource();
            // console.log('syncSource.target', syncSource.target) ;
            chrome.runtime.sendMessage("initMonitor") // 這裡是 content script , 要(透過 background.js )送回 popup 
          } else { 
            startSelecting();
            return true;
          }
          // return true;
        }
    
        // ****** 監聽 ******
        if (message.action === "initMonitor") {
          WebTextMonitor.startMonitoring();
          return;

        } else if (message.action === "getCurrentContent") {
          console.log('[ selector_injector.js ] 收到 getCurrentContent 請求');
          // 回應當前內容請求
          const content = WebTextMonitor.getCurrentMonitorContent();
          console.log('[ selector_injector.js ] 準備回應內容:', content);
          chrome.storage.local.set({ lastMonitorContentd : content }, function() {
            if (chrome.runtime.lastError) {
              console.error("lastMonitorContentd 儲存失敗:", chrome.runtime.lastError.message);
            }
            sendResponse({ content: content });
          }); 
          return true;

        // ****** 同步輸出 ******
        } else if (message.action === "syncOutput") {
          // 雙重防循環檢查：確保不會輸出到監聽來源
          if (WebTextSync.currentTabId === message.sourceTabId) {
            console.log('[ selector_injector.js ] 防循環：當前分頁是監聽來源，跳過輸出');
            return;
          }
          if (message.data) {
            performSyncOutput(message.data); // 監聽頁要求 syncOutput
          } else {
            // console.warn('[ selector_injector.js ] 同步輸出請求沒有包含數據');
          }
          return;
          
        } else if (message.action === "cancelOutputTarget") {
          WebTextSync.removeTitleAnimation(writeIconInterval);
          return;
        }
        //return true;
      });
    }
    console.log('selector_injector: WebTextMonitor 初始化完成');
  } catch (error) {
    console.warn('[ selector_injector.js ] Cannot set up message listener:', error.message);
  }

  // 監聽 storage 變化，當監聽來源或輸出目標改變時重新檢查 
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.syncSource || changes.syncTargets) {
        console.log(`[ selector_injector.js ] 監聽 或 輸出目標 已變更 `, changes.syncSource , changes.syncTargets);
      }
      if (changes.syncTargets) {
        console.log(231 ,'[ selector_injector.js ] changes.syncTargets ' ,changes.syncTargets)
        if (changes.syncTargets.newValue.length == 0 && changes.syncTargets.oldValue.length == 1 ) {
          // 輸出目標 被刪除
          if (WebTextSync.currentSyncTarget && WebTextSync.currentSyncTarget  == changes.syncTargets.oldValue[0].tabId) {
            stopSyncOutput() ;
          }
        }
        
      }
    }
  });
  
  checkAndPerformInitialSync(); // 輸出頁 檢查 + 執行初始同步

})();
