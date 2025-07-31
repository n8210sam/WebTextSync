// selector_injector.js  入口模組

// 防止重複執行
if (window.__selectorInjectorLoaded) {
  console.log('selector_injector.js 已經載入過，跳過重複執行');
} else {
  window.__selectorInjectorLoaded = true;
  
  console.log('selector_injector.js 入口模組 - 使用 window.postMessage 方案');
  var currentMode = null;
  // 產生 intelligent selector 的函式，必須放在前面或至少在 onClick 前定義

  // 直接使用 window.postMessage 方案
  console.log('設置 window.postMessage 消息監聽器');
  
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type === 'WEBTEXT_SYNC_MESSAGE' && event.data.action === 'startSelecting') {
      console.log('收到 window.postMessage 消息:', event.data);
      currentMode = event.data.mode;
      activateSelector();
    }
  });
  
  // 通知已準備好接收消息
  window.postMessage({
    type: 'WEBTEXT_SYNC_READY',
    source: 'selector_injector'
  }, '*');

  function activateSelector() {
    document.body.style.cursor = 'crosshair';
    console.log(`start activateSelector currentMode="${currentMode}"`);

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();

      let source = e.target;
      document.removeEventListener('click', onClick, true);
      document.body.style.cursor = 'default';
      
      // 確保 utils.js 的函數可用，等待函數載入
      let selector;
      if (typeof window.generateSmartSelector === 'function') {
        selector = window.generateSmartSelector(source);
      } else if (typeof generateSmartSelector === 'function') {
        selector = generateSmartSelector(source);
      } else {
        // 備用的簡單選擇器生成
        if (source.id) {
          selector = `#${source.id}`;
        } else {
          // 生成更好的備用選擇器
          let tag = source.tagName.toLowerCase();
          let parent = source.parentElement;
          if (parent) {
            let siblings = Array.from(parent.children).filter(el => el.tagName === source.tagName);
            if (siblings.length > 1) {
              let index = siblings.indexOf(source) + 1;
              selector = `${tag}:nth-of-type(${index})`;
            } else {
              selector = tag;
            }
          } else {
            selector = tag;
          }
        }
        console.warn('generateSmartSelector 不可用，使用備用選擇器:', selector);
      }
      let textVal = (source.innerText || source.value || '');

      // 選定的監聽目標 用綠色外框標示
      source.style.outline = '2px solid #4CAF50';

      // 浮出提示文字
      if (typeof window.showFloatingTip === 'function' && typeof window.ellipsisText === 'function') {
        window.showFloatingTip(`✔ 已選擇元素：${window.ellipsisText(textVal, 20)}`);
      } else if (typeof showFloatingTip === 'function' && typeof ellipsisText === 'function') {
        showFloatingTip(`✔ 已選擇元素：${ellipsisText(textVal, 20)}`);
      } else {
        console.log(`✔ 已選擇元素：${textVal.substring(0, 20)}${textVal.length > 20 ? '...' : ''}`);
      }

      // Console log 偵錯
      console.log(`[WebTextSync]${currentMode} 已選擇元素：${selector} ,內文：${textVal}`);
      console.log(source);

      // 儲存選取器到 chrome.storage.sync
      let domainPattern = window.location.origin + '/*';
      console.log(`[WebTextSync] domainPattern(${domainPattern})`);
      
      // 檢查 chrome.storage 是否可用
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get([domainPattern], (data) => {
          let domainData = data[domainPattern] || {};
          if (currentMode === 'monitor') domainData.monitorSelector = selector;
          else if (currentMode === 'output') {
            // 輸出目標改存成陣列，新增方式
            if (!Array.isArray(domainData.outputSelectors)) {
              domainData.outputSelectors = [];
            }
            if (!domainData.outputSelectors.includes(selector)) {
              domainData.outputSelectors.push(selector);
            }
          }

        chrome.storage.sync.set({ [domainPattern]: domainData }, () => {
          console.log(`[WebTextSync] 選取器已儲存 (${currentMode}): ${selector}`);
          
          // 統一使用 window.postMessage 發送消息到 popup
          function sendMessageToPopup(message) {
            window.postMessage({
              type: 'WEBTEXT_SYNC_TO_POPUP',
              ...message
            }, '*');
          }
          
          sendMessageToPopup({
            action: 'selectedElement',
            mode: currentMode,
            selector: selector
          });

          // 如果是監聽，通知 monitor.js 啟動監聽
          if (currentMode === "monitor") { 
            chrome.storage.local.set({ monitor_selector: selector }, () => {
              sendMessageToPopup({ action: "initMonitor" });
            });
          }
        });
        });
      } else {
        // chrome.storage 不可用，使用 postMessage 通知 popup 處理儲存
        console.warn('chrome.storage 不可用，使用 postMessage 通知 popup 處理儲存');
        
        // 統一使用 window.postMessage 發送消息到 popup
        function sendMessageToPopup(message) {
          window.postMessage({
            type: 'WEBTEXT_SYNC_TO_POPUP',
            ...message
          }, '*');
        }
        
        const storageData = {
          action: 'saveSelector',
          domainPattern: domainPattern,
          mode: currentMode,
          selector: selector,
          textVal: textVal
        };
        
        // 由於動態注入的腳本無法直接使用 chrome.storage，
        // 我們需要直接通過 executeScript 調用 popup 的處理函數
        console.warn('chrome.storage 不可用，嘗試直接通知 popup');
        
        // 創建一個立即執行的通知機制
        const selectorData = {
          action: 'saveSelector',
          domainPattern: domainPattern,
          mode: currentMode,
          selector: selector,
          textVal: textVal,
          timestamp: Date.now()
        };
        
        // 將數據存儲到頁面上，並觸發一個明顯的事件
        window.__webTextSyncPendingData = selectorData;
        
        // 創建一個明顯的 DOM 變化來通知 popup
        const notificationElement = document.createElement('div');
        notificationElement.id = 'webTextSyncNotification';
        notificationElement.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:10px;background:linear-gradient(90deg,red,orange,red);z-index:999999;animation:blink 0.5s infinite;';
        notificationElement.dataset.selectorData = JSON.stringify(selectorData);
        
        // 添加閃爍動畫
        const style = document.createElement('style');
        style.textContent = '@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.3; } }';
        document.head.appendChild(style);
        
        document.body.appendChild(notificationElement);
        
        // 同時在 console 中輸出明顯的標記
        console.log('🚨🚨🚨 [WebTextSync] 通知 popup 處理選擇器數據 🚨🚨🚨');
        console.log('📋 數據內容:', selectorData);
        
        // 3秒後移除通知元素
        setTimeout(() => {
          if (notificationElement.parentNode) {
            notificationElement.remove();
          }
        }, 3000);
        
        console.log('[WebTextSync] 數據已準備，創建通知元素:', selectorData);
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


} // 結束防重複執行的 if 區塊
