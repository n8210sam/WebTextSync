2025/07/30
    試圖解決程式重複載入的根本問題:
        修改 manifest.json :
            使用 content_scripts 先載入專用程式, 最後載入公用程式:
                <code>
  , "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*"],
      "js": ["content_chatgpt.js"],
      "run_at": "document_end"
    },
    {
      "matches": ["https://gemini.google.com/*"],
      "js": ["content_gemini.js"],
      "run_at": "document_end"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["utils.js","selector_injector.js","monitor.js","output.js"],
      "run_at": "document_end"
    }
  ]
  // 已經透過 content_scripts 注入網頁中，則不需要也不應該再在 web_accessible_resources 中重複宣告它。
  // 除非要拓展應用到未知網站
  /*
  , "web_accessible_resources": [ // 宣告這些資源可被內容腳本存取
    {
      "resources": [
        "utils.js",
        "selector_injector.js",
        "monitor.js",
        "output.js",
        // "jquery-3.7.1.min.js", 未用到, 暫時移除
        "content_gemini.js",
        "content_chatgpt.js"
      ],
      "matches": ["<all_urls>"] // 允許在所有網址下被存取
    }
  ]
  */
                </code>
            接著修改其他程式, 將其他程式的動態載入全部註解起來:
                popup.js 
                    <code>
function injectAndSelect(mode) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // 先檢查是否已經注入過
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        return window.__webTextSyncInjected || false;
      }
    }, (results) => {
      const isAlreadyInjected = results && results[0] && results[0].result;
      
      if (isAlreadyInjected) {
        // 如果已經注入過，直接發送消息
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (mode) => {
            window.postMessage({
              type: 'WEBTEXT_SYNC_MESSAGE',
              action: 'startSelecting',
              mode: mode
            }, '*');
          },
          args: [mode]
        });
        return;
      }
      
      // 如果還沒注入，才執行注入
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          window.__webTextSyncInjected = true;
          
          // 先載入 utils.js
          const utilsScript = document.createElement('script');
          utilsScript.src = chrome.runtime.getURL('utils.js');
          utilsScript.onload = () => {
            // utils.js 載入完成後再載入 selector_injector.js
            const selectorScript = document.createElement('script');
            selectorScript.src = chrome.runtime.getURL('selector_injector.js');
            document.documentElement.appendChild(selectorScript);
          };
          document.documentElement.appendChild(utilsScript);
        }
      }, () => {
        // 等注入完成再送訊息給 content script
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (mode) => {
              window.postMessage({
                type: 'WEBTEXT_SYNC_MESSAGE',
                action: 'startSelecting',
                mode: mode
              }, '*');
            },
            args: [mode]
          });
        }, 500); // 增加等待時間確保腳本完全載入
      });
    });
  });
}
                    </code>

		優化公用程式: 一律包裝到 WebTextSync() 裡, 停用函數掛到全域 window.<function> 的方式
	

