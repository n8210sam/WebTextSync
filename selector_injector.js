// selector_injector.js  入口模組

const domainPattern = window.location.origin + '/*';
let currentMode = null;
console.log('selector_injector.js 載入');


  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startSelecting") {
      console.log('selector_injector 收到 chrome.runtime 消息:', message);
      currentMode = message.mode;
	  if (currentMode === 'monitor') { // 改為直接監聽, 不必選
        // const syncSource = WebTextSync.getStoredSyncSource();
		// console.log('syncSource.target', syncSource.target) ;
	  } else  activateSelector();
      return true;
    }
  });
  
  function activateSelector() {
    document.body.style.cursor = 'crosshair';
    console.log(`start activateSelector currentMode="${currentMode}"`);

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();

      let source = e.target;
      document.removeEventListener('click', onClick, true);
      document.body.style.cursor = 'default';
      
      let selector = WebTextSync.GenerateSmartSelector(source);
      let textVal = (source.innerText || source.value || '');

      // 選定的監聽目標 用綠色外框標示
      source.style.outline = '2px solid #4CAF50';

      // 浮出提示文字
      WebTextSync.ShowFloatingTip(`✔ 已選擇元素：${WebTextSync.EllipsisText(textVal, 20)}`);
      console.log(`[WebTextSync]${currentMode} 已選擇元素：${selector} ,內文：${textVal}`, source);

      // 儲存選取器到 chrome.storage.local
      console.log(`[WebTextSync] domainPattern(${domainPattern}) , (${window.location.hostname})`);
      
        chrome.storage.local.get([domainPattern], (data) => {
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

        chrome.storage.local.set({ [domainPattern]: domainData }, () => {
          console.log(`[WebTextSync] 選取器已儲存 (${currentMode}): ${selector}`);
          
          // 統一使用 window.postMessage 發送消息到 popup
          function sendMessageToPopup(message) {
            window.postMessage({
              type: 'WEBTEXT_SYNC_TO_POPUP',
              ...message
            }, '*');
          }
          
          // 發送消息到 background script，再轉發到 popup
          chrome.runtime.sendMessage({
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

      /* 改到 background.js  執行 onMessage.addListener
	  // 動態載入 monitor.js 或 output.js
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(currentMode === 'monitor' ? 'monitor.js' : 'output.js');
      document.documentElement.appendChild(script);
	  */
    }

    document.addEventListener('click', onClick, true);
  }


