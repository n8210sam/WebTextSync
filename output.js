// output.js 

// 改為依據多個 outputSelectors 執行同步輸出

// 添加寫字/翻頁圖示到標題
const writeIconInterval = 'writeIconInterval';
function addWritingIconToTitle() {
  const icons = ['✍️', '📝', '📄', '📋', '✏️'];
  WebTextSync.setTitleAnimation(writeIconInterval, i => icons[i % icons.length], 1500);
}
function removeWritingIconFromTitle() {
  WebTextSync.removeTitleAnimation(writeIconInterval); 
}

function stopSyncOutput() {
  WebTextSync.currentSyncTarget = null ;
  removeWritingIconFromTitle();
  console.log('[ output.js ] 當前分頁不是輸出目標，移除圖示');
}

// 頁面載入後 檢查當前頁面是否為輸出目標 -- 只檢查, 更新UI, 不更新資料
function checkIfOutputTarget() {
  
  if (WebTextSync.debug_mode) console.log(23, '[ output.js ] debug_mode On : WebTextSync.currentTabId, , .currentSyncTarget = ',WebTextSync.currentTabId,' , .originalTitle:',WebTextSync.originalTitle,' , .currentSyncTarget:',WebTextSync.currentSyncTarget);

  // Todo: 使用 storage 動態檢查當前頁面是否為輸出目標
  chrome.storage.local.get(['syncTargets','syncSource','lastMonitorContentd'], (res) => {
    console.log('使用 storage 動態檢查當前頁面是否為輸出目標 res=', res);
    let syncTargetsArray = res.syncTargets || [];
    // 更新或新增目標
    try {
      // 檢查當前分頁是否為監聽來源
      const isMonitorSource = res.syncSource && res.syncSource.tabId === WebTextSync.currentTabId;
      console.log(`[ output.js ] isMonitorSource? ${isMonitorSource} , res.syncSource= ${(res.syncSource?res.syncSource.tabId:res.syncSource)} , currentTabId=${WebTextSync.currentTabId}`);

      // 檢查當前分頁是否在輸出目標列表中
      const existingIndex = syncTargetsArray.findIndex(target => target.tabId === tabId);
      console.log(`[ output.js ] existingIndex?  ${existingIndex}  , res.syncSource${res.syncSource}  , res.lastMonitorContentd ${res.lastMonitorContentd} ` );

      if (existingIndex >= 0) {
        // 是輸出目標 但不在執行中
        if (!WebTextSync.currentSyncTarget && !isMonitorSource) {
          WebTextSync.currentSyncTarget = WebTextSync.currentTabId;
          addWritingIconToTitle(); // 變更 UI 狀態
          console.log('[ output.js ] 當前分頁是輸出目標，也不是監聽來源，添加寫字圖示');
        
          // 立即取用監聽內容 同步輸出
          if (res.syncSource && res.lastMonitorContentd) {
            performSyncOutput(res.lastMonitorContentd); // 輸出頁初始化時, 同步輸出監聽內容
          }
        }

      } else if (WebTextSync.currentSyncTarget) {
        // 已非輸出目標, 但還在執行中
        stopSyncOutput() ;
      }
      
    } catch (err) {
      // 實際測試遇到錯誤: 新增的 tabId 不在舊陣列裡, 解法? 直接用一筆新的蓋掉全部 :
      console.log('[ output.js ] 使用 storage 發生錯誤', err);
    }
  });
    
}

// 執行同步輸出到目標元素 : 二種來源 [ 監聽頁要求 syncOutput , 輸出頁重新整理 ]
function performSyncOutput(data, selector) { 
  if (!selector) selector = WebTextSync.syncElement();
  applySyncToElement(selector, data, 0);
}

// 應用同步到指定元素
function applySyncToElement(selector , data, index) {
  try {
    console.log(7444,'selector, data, index, WebTextSync.syncElement ~~~ ',selector, data, index, WebTextSync.syncElement)
    
    if (typeof selector === 'string') { // 字串
      const targetElement = document.querySelector(selector);

    } else if (selector instanceof Element || selector instanceof HTMLDocument) { // DOM 元素
      const targetElement = selector;

    } else {
      throw new Error(`[ output.js ] 不是有效的 selector 或 DOM 元素`);
    }
    
    if (targetElement) {
      // 根據元素類型決定如何設定文字
      if (targetElement.contentEditable === 'true') {
        // 可編輯的 div (如 ChatGPT, Gemini)
        targetElement.innerHTML = data;
        console.log(`[ output.js ] 已同步到可編輯元素 ${index + 1}:`, selector);
      } else if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
        // 輸入框或文字區域
        targetElement.value = data;
        // 觸發 input 事件讓網站知道內容已改變
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`[ output.js ] 已同步到輸入元素 ${index + 1}:`, selector);
      } else {
        // 其他元素，設定 textContent
        targetElement.textContent = data;
        console.log(`[ output.js ] 已同步到文字元素 ${index + 1}:`, selector);
      }
      
      // 添加視覺反饋 - 短暫的綠色邊框
      const originalOutline = targetElement.style.outline;
      targetElement.style.outline = '2px solid #4CAF50';
      setTimeout(() => {
        targetElement.style.outline = originalOutline;
      }, 1000);
      
    } else {
      console.warn(`[ output.js ] 找不到輸出目標元素: ${selector}`);
    }
  } catch (error) {
    console.error(`[ output.js ] 同步到選擇器 "${selector}" 時發生錯誤:`, error);
  }
}

// 初始化 -- 移到 selector_injector.js


// 輸出頁 檢查並執行初始同步
function checkAndPerformInitialSync() {
  
  // 稍微延遲後請求初始內容，確保頁面完全載入
  setTimeout(() => { checkIfOutputTarget() }, 200);
}

console.log('[ output.js ]  載入');

// 等待頁面載入完成 才初始同步 window.addEventListener('load', checkAndPerformInitialSync);

