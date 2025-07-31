// popup.js
// ***** 注意這裡 console.log 不會顯示在前端 dev Tool *****
const monitorBtn = document.getElementById('monitorBtn');
const cancelMonitorBtn = document.getElementById('cancelMonitorBtn');	 
const outputBtn = document.getElementById('outputBtn');
const monitorSelectedSpan = document.getElementById('monitorSelected');
const outputTargetList = document.getElementById('outputTargetList');
const statusDiv = document.getElementById('status');

const domainPattern = location.origin + '/*';

let outputTargets = []; // 儲存多個輸出目標 selector
let hasMonitor = false;
let tabInit = false;

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

function setStatus(msg) {
  statusDiv.textContent = msg;
}

// 選擇監聽目標
monitorBtn.addEventListener('click', () => {
  injectAndSelect("monitor");
  // 點擊後開始更頻繁地檢查
  setTimeout(() => {
    for (let i = 0; i < 10; i++) {
      setTimeout(checkForPendingData, i * 200);
    }
  }, 1000);
});

// 新增輸出目標（點擊按鈕，觸發內容腳本選擇元素）
outputBtn.addEventListener('click', () => {
  injectAndSelect("output");
  setStatus('請在頁面點擊以新增輸出目標...');
});

// 更新監聽目標顯示，並切換取消監聽按鈕可見狀態
function updateMonitorSelected(selector) {
  console.log('updateMonitorSelected 被調用，selector:', selector);
  if (selector && selector.trim()) {
    monitorSelectedSpan.textContent = selector;
    hasMonitor = true;
    cancelMonitorBtn.style.display = 'inline-block';
    console.log('監聽目標已更新為:', selector);
  } else {
    monitorSelectedSpan.textContent = '(尚未選擇)';
    hasMonitor = false;
    cancelMonitorBtn.style.display = 'none';
    console.log('監聽目標已清除');
  }
}

// 顯示多個輸出目標清單，並生成帶刪除按鈕的列表
function renderOutputTargets() {
  outputTargetList.innerHTML = '';
  if (outputTargets.length === 0) {
    outputTargetList.innerHTML = '<li style="color:#888; padding: 6px;">尚無輸出目標</li>';
    setStatus('請新增輸出目標...');
    return;
  }
  outputTargets.forEach((selector, idx) => {
    addOutputTargetItem(selector, idx);
  });
}

// 新增單個輸出目標項目
function addOutputTargetItem(selector, index) {
  // 如果是第一個項目且列表為空，先清空提示文字
  if (outputTargets.length === 1) {
    outputTargetList.innerHTML = '';
  }
  
  const li = document.createElement('li');
  li.className = 'output-target-item';
  li.dataset.index = index; // 儲存索引以便刪除時使用

  const textSpan = document.createElement('span');
  textSpan.textContent = selector;

  const delBtn = document.createElement('button');
  delBtn.textContent = '刪除';
  delBtn.className = 'btn-delete';
  delBtn.title = '刪除此輸出目標';  
  delBtn.addEventListener('click', () => {
    removeOutputTarget(index, li);
  });

  li.appendChild(textSpan);
  li.appendChild(delBtn);
  outputTargetList.appendChild(li);
}

// 取消監聽按鈕點擊
cancelMonitorBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        window.postMessage({
          type: 'WEBTEXT_SYNC_MESSAGE',
          action: 'cancelMonitor'
        }, '*');
      }
    });
  });
  updateMonitorSelected(null);
  setStatus('監聽已取消');
});
// 移除指定索引的輸出目標
function removeOutputTarget(index, liElement) {
  // 從陣列中移除
  outputTargets.splice(index, 1);
  
  // 儲存更新後的資料
  saveOutputTargets(outputTargets);
  
  // 直接移除 DOM 元素
  if (liElement) {
    liElement.remove();
  }
  
  // 更新其他項目的索引
  updateOutputTargetIndexes();
  
  // 如果沒有項目了，顯示提示文字
  if (outputTargets.length === 0) {
    outputTargetList.innerHTML = '<li style="color:#888; padding: 6px;">尚無輸出目標</li>';
    setStatus('請新增輸出目標...');
  } else {
    setStatus('已刪除輸出目標');
  }
}

// 更新輸出目標項目的索引
function updateOutputTargetIndexes() {
  const items = outputTargetList.querySelectorAll('.output-target-item');
  items.forEach((item, newIndex) => {
    item.dataset.index = newIndex;
    const delBtn = item.querySelector('.btn-delete');
    if (delBtn) {
      // 重新綁定點擊事件
      delBtn.onclick = () => removeOutputTarget(newIndex, item);
    }
  });
}

// 儲存多個輸出目標到 storage.sync
function saveOutputTargets(targets) {
  chrome.storage.sync.get([domainPattern], (data) => {
    const domainData = data[domainPattern] || {};
    domainData.outputSelectors = targets;
    chrome.storage.sync.set({ [domainPattern]: domainData }, () => {
      console.log('[WebTextSync] outputSelectors 已更新', targets);
    });
  });
}

// 從 storage 載入多個輸出目標
function loadOutputTargets() {
  chrome.storage.sync.get([domainPattern], (data) => {
    const domainData = data[domainPattern];
    if (domainData && Array.isArray(domainData.outputSelectors)) {
      outputTargets = domainData.outputSelectors;
    } else {
      outputTargets = [];
    }
    renderOutputTargets();
  });
}

// 監聽來自 background script 的消息
chrome.runtime.onMessage.addListener((msg) => {
  console.log('popup 收到 chrome.runtime 消息:', msg);
  
  if (msg.action === 'saveSelector') {
    console.log('處理 saveSelector 消息');
    handleStorageRequest(msg);
  } else if (msg.action === 'selectedElement') {
    console.log('處理 selectedElement 消息');
    handleMessage(msg);
  }
});

// 檢查當前分頁是否有待處理的選擇器數據
let lastProcessedTimestamp = 0;
let checkCount = 0;

function checkForPendingData() {
  checkCount++;
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    
    const tab = tabs[0];
    
    // 每10次檢查輸出一次調試信息
    if (checkCount % 10 === 0) {
      console.log(`popup 正在檢查待處理數據 (第${checkCount}次)，當前分頁:`, tab.url);
    }
    
    // 檢查頁面中是否有通知元素或待處理數據
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 優先檢查通知元素
        const notificationElement = document.getElementById('webTextSyncNotification');
        if (notificationElement && notificationElement.dataset.selectorData) {
          console.log('發現通知元素，讀取數據');
          const data = JSON.parse(notificationElement.dataset.selectorData);
          notificationElement.remove();
          return data;
        }
        
        // 備用：檢查全域變數
        const hasPendingData = !!window.__webTextSyncPendingData;
        if (hasPendingData) {
          console.log('頁面中發現待處理數據:', window.__webTextSyncPendingData);
          const data = window.__webTextSyncPendingData;
          // 清除已讀取的數據
          delete window.__webTextSyncPendingData;
          return data;
        }
        return null;
      }
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const data = results[0].result;
        console.log('popup 收到待處理數據:', data);
        if (data.timestamp > lastProcessedTimestamp) {
          console.log('處理待處理的選擇器數據:', data);
          handleStorageRequest(data);
          lastProcessedTimestamp = data.timestamp;
        } else {
          console.log('數據已處理過，跳過');
        }
      }
    }).catch(error => {
      // 忽略無法訪問的分頁錯誤
      if (!error.message.includes('Cannot access')) {
        console.log('檢查待處理數據時出錯:', error.message);
      }
    });
  });
}

// 每 200ms 檢查一次，提高響應速度
setInterval(checkForPendingData, 200);

function handleMessage(msg) {
  if (msg.action === 'selectedElement') {
    if (msg.mode === 'monitor') {
      updateMonitorSelected(msg.selector);
      setStatus('監聽目標已更新');
    } else if (msg.mode === 'output') {
      if (!outputTargets.includes(msg.selector)) {
        outputTargets.push(msg.selector);
        saveOutputTargets(outputTargets);
        addOutputTargetItem(msg.selector, outputTargets.length - 1); // 只新增一個項目
        setStatus('新增輸出目標成功');
      } else {
        setStatus('此輸出目標已存在');
      }
    }
  }
}

function handleStorageRequest(data) {
  console.log('處理儲存請求:', data);
  
  if (data.action === 'saveSelector') {
    chrome.storage.sync.get([data.domainPattern], (result) => {
      let domainData = result[data.domainPattern] || {};
      
      if (data.mode === 'monitor') {
        domainData.monitorSelector = data.selector;
        // 同步更新本地變數
        updateMonitorSelected(data.selector);
      } else if (data.mode === 'output') {
        if (!Array.isArray(domainData.outputSelectors)) {
          domainData.outputSelectors = [];
        }
        if (!domainData.outputSelectors.includes(data.selector)) {
          domainData.outputSelectors.push(data.selector);
          // 同步更新本地變數
          outputTargets.push(data.selector);
          addOutputTargetItem(data.selector, outputTargets.length - 1);
        }
      }
      
      // 儲存到 chrome.storage.sync，這會自動同步到所有分頁
      chrome.storage.sync.set({ [data.domainPattern]: domainData }, () => {
        console.log(`[WebTextSync] 選取器已儲存到 chrome.storage.sync (${data.mode}): ${data.selector}`);
        
        // 如果是監聽模式，需要在所有相關分頁啟動監聽
        if (data.mode === 'monitor') {
          setStatus('監聽目標已更新');
          
          // 儲存到 local storage 供 monitor.js 使用
          chrome.storage.local.set({ monitor_selector: data.selector }, () => {
            console.log('monitor_selector 已儲存到 local storage');
            
            // 通知所有匹配的分頁啟動監聽
            notifyAllMatchingTabs(data.domainPattern, 'initMonitor');
          });
        } else if (data.mode === 'output') {
          setStatus('新增輸出目標成功');
          console.log('輸出目標已儲存，其他分頁會通過 storage 事件自動同步');
        }
      });
    });
  }
}

// 通知所有匹配域名模式的分頁
function notifyAllMatchingTabs(domainPattern, action) {
  // 將域名模式轉換為 URL 匹配模式
  const urlPattern = domainPattern.replace('/*', '');
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && tab.url.startsWith(urlPattern)) {
        console.log(`通知分頁 ${tab.id} (${tab.url}) 執行 ${action}`);
        
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (action) => {
            window.postMessage({
              type: 'WEBTEXT_SYNC_MESSAGE',
              action: action
            }, '*');
          },
          args: [action]
        }).catch(error => {
          console.log(`無法通知分頁 ${tab.id}:`, error.message);
        });
      }
    });
  });
}

// 載入頁面時從 storage 載入監聽目標並顯示
function loadMonitorSelected() {
  chrome.storage.sync.get([domainPattern], (data) => {
    const domainData = data[domainPattern] || {};
    if (domainData && domainData.monitorSelector) {
      updateMonitorSelected(domainData.monitorSelector);
    }
  });
}

// 初始化
window.onload = () => {
  loadMonitorSelected();
  loadOutputTargets();
  
  // 開始檢查選擇器數據
  console.log('popup 初始化完成，開始監聽選擇器數據');
  
  // 立即檢查一次
  setTimeout(checkForPendingData, 100);
  
  // 添加手動檢查按鈕（調試用）
  setTimeout(() => {
    if (document.getElementById('status')) {
      const debugBtn = document.createElement('button');
      debugBtn.textContent = '手動檢查';
      debugBtn.style.fontSize = '10px';
      debugBtn.style.marginLeft = '10px';
      debugBtn.onclick = () => {
        console.log('手動觸發檢查...');
        checkForPendingData();
      };
      document.getElementById('status').appendChild(debugBtn);
    }
  }, 500);
};
