// popup.js
// ***** 注意這裡 console.log 不會顯示在前端 dev Tool *****
const monitorBtn = document.getElementById('monitorBtn');
const cancelMonitorBtn = document.getElementById('cancelMonitorBtn');	 
const outputBtn = document.getElementById('outputBtn');
const testSyncBtn = document.getElementById('testSyncBtn');
const monitorSelectedSpan = document.getElementById('monitorSelected');
const outputTargetList = document.getElementById('outputTargetList');
const outputTargetListEmpty = '<li id="emptyOutputTargetList">尚無輸出目標</li>';
const statusDiv = document.getElementById('status');
// const domainPattern = location.origin + '/*';

let outputTargets = []; // 儲存多個輸出目標 selector
let hasMonitor = false;
let tabInit = false;

function setStatus(msg) {
  statusDiv.textContent = msg;
}

// 更新監聽目標顯示，並切換取消監聽按鈕可見狀態
function updateMonitorSelected(title) {
  console.log('updateMonitorSelected 被調用，title:', title);
  title = String(title || '').trim();
  if (!title) {
    monitorSelectedSpan.textContent = '(尚未選擇)';
    hasMonitor = false;
    cancelMonitorBtn.style.display = 'none';
    console.log('監聽目標已清除');
  } else {
    monitorSelectedSpan.textContent = title?.trim();
    hasMonitor = true;
    cancelMonitorBtn.style.display = 'inline-block';
    console.log('監聽目標已更新為:', title);
  }
}

// 選擇監聽目標
monitorBtn.addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0){} else { return false; }
    const syncSourceId = tabs[0].id;

    // ToDo: title 要從 content script 回傳正確值
    const title = syncSourceId;

    const log = `開始 儲存監聽目標分頁: ${syncSourceId} title:"${title}" , url: "${tabs[0].url}" , hostname: "${ new URL(tabs[0].url).hostname }" ` ;
    statusDiv.textContent = log;
    console.log (log) ;
    const syncSource = { id: syncSourceId, tabId: syncSourceId, title: syncSourceId }; // 監聽源的臨時資料設定
    chrome.storage.local.set({syncSource: syncSource}, function() {
      if (chrome.runtime.lastError) {
        console.error("儲存失敗:", chrome.runtime.lastError.message);
        statusDiv.textContent += "<br> 錯誤: 無法儲存分頁 ID。";
        return;
      }
      
      console.log("來源分頁 ID 已儲存:", syncSourceId);
      statusDiv.textContent = `已記錄分頁 ID: ${syncSourceId} , title:"${title}" `;
      // updateMonitorSelected(title);
      
      chrome.runtime.sendMessage({action: "selectElement", mode: "monitor", syncSourceId: syncSourceId},function(){
        console.log('已發送選擇元素消息，等待用戶選擇監聽目標');
        // setStatus('請在頁面點擊以選擇監聽目標...');
      });
      // setTimeout(() => { window.close(); }, 5000); // 延遲關閉
    });
  });
});


// 取消監聽按鈕點擊
cancelMonitorBtn.addEventListener('click', () => {
  chrome.storage.local.set({syncSource:null});
  // 目前不必傳 cancelMonitor , 監聽檢查不到 chrome.storage.local syncSource 也會自動停止監聽
  // chrome.runtime.sendMessage({action: "cancelMonitor"}); // 目前只會有唯一的監聽目標, 所以不必傳 tab id
  updateMonitorSelected(null);
  setStatus('監聽已取消');
});

// 移除指定索引的輸出目標
function removeOutputTarget(event, tabId, title) {

  // chromeArray.remove((key, matchValue, matchField = 'id', callback); 
  // chromeArray.remove('syncTargets', tabId, 'tabId', callback); 
  chrome.storage.local.get(['syncTargets'], function(res) {
    let syncTargetsArray = res.syncTargets || [];
    const initialLength = syncTargetsArray.length; // 記錄原始長度

    // 過濾掉符合 tabId 的項目
    syncTargetsArray = syncTargetsArray.filter(item => item.tabId !== tabId);

    if (syncTargetsArray.length < initialLength) { // 檢查有項目被移除
      chrome.storage.local.set({ syncTargets: syncTargetsArray }, function() {
        if (chrome.runtime.lastError) {
          console.error("移除 syncTargets 時發生錯誤:", chrome.runtime.lastError);
        } else {
          console.log("成功移除 syncTarget , 剩餘:", syncTargetsArray.length, syncTargetsArray);
        }
      });
    }
  });

  // 直接移除 DOM 元素
  document.getElementById(tabId).remove();

  // 如果沒有項目了，顯示提示文字
  if (syncTargetsArray.length === 0) {
    outputTargetList.innerHTML = outputTargetListEmpty;
    setStatus('請新增輸出目標...');
  } else {
    setStatus('已刪除輸出目標: '+ title);
  }
  
  chrome.runtime.sendMessage({
    action: 'cancelOutputTarget',
    mode: 'output',
    tabId: tabId
  });
}

// 輸出項目清單 新增單個
function addOutputTargetItem(id,title) {
  // 如果是第一個項目且列表為空，先清空提示文字
  if (document.getElementById("emptyOutputTargetList")) {
    outputTargetList.innerHTML = '';
  }
  
  const li = document.createElement('li');
  li.className = 'output-target-item';
  li.id = id;

  const textSpan = document.createElement('span');
  textSpan.textContent = title;

  const delBtn = document.createElement('button');
  delBtn.textContent = '刪除';
  delBtn.className = 'remove-btn';
  delBtn.title = '刪除此輸出目標';  
  delBtn.addEventListener('click', (event) => {
    removeOutputTarget(event,id,title);
  });

  li.appendChild(textSpan);
  li.appendChild(delBtn);
  outputTargetList.appendChild(li);
}

// 新增輸出目標（點擊按鈕，觸發內容腳本選擇元素）
outputBtn.addEventListener('click', () => {

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0) {} else { return false; };  
    const currentTabId = tabs[0].id;
    const title = tabs[0].title.trim() || new URL(tabs[0].url).hostname;
  
    // 直接觸發選擇元素模式
    chrome.runtime.sendMessage({action: "selectElement", mode: "output"});
    setStatus('請在頁面點擊以新增輸出目標...');
    
    // 不立即關閉 popup，等待用戶選擇
  
  }); // chrome.tabs.query
});

// 測試同步功能按鈕
testSyncBtn.addEventListener('click', () => {
  const testData = `測試同步文字 - ${new Date().toLocaleTimeString()}`;
  chrome.runtime.sendMessage({ action: "syncOutput",  data: testData });
  setStatus(`✅ 已發送測試同步: ${testData}`);
  
  // 3秒後恢復狀態
  setTimeout(() => {
    setStatus('選擇監聽目標 或 新增輸出目標');
  }, 3000);
});

// 監聽來自 background script 的消息
chrome.runtime.onMessage.addListener((msg) => {
  console.log('popup 收到 chrome.runtime 消息:', msg);
  
  if (msg.action === 'saveSelectedElement') {
    console.log('處理 saveSelectedElement 消息');
    
    if (msg.mode === 'output') {
      addOutputTargetItem(msg.data.tabId, msg.data.title);

    } else if (msg.mode === 'monitor') {
      // 監聽來源更新 
      updateMonitorSelected(msg.data.title);
    }
  }
});


// 載入頁面時從 storage 載入監聽目標並顯示
function loadMonitorSelected() {
  // 檢查 local storage 是否有 syncSource，若有則檢查分頁是否存在再更新監聽目標顯示 
  WebTextSync.getStoredSyncSource().then(data => {
    chrome.tabs.get(data.id, (tab) => {
    console.log('[ popup.js ] 205 ===== tab :', tab);
    if (chrome.runtime.lastError || !tab) {
      console.log(`syncSource.id 對應分頁不存在，ID=${data.id}`)
      setStatus(`⚠️ 監聽來源分頁已關閉，請重新選擇。`);
      updateMonitorSelected(null);
      return;
    }
    const title = data.title || ''+ new URL(tab.url).hostname;
    updateMonitorSelected( title );
    console.log('已從 local storage 載入 syncSource 並更新監聽目標:', title);
    });
  })
  .catch(err => {
    console.warn('載入 syncSource 失敗:', err.message);
  });
}

// 載入並顯示所有輸出目標
function loadOutputTargets() {
  chrome.storage.local.get(['syncTargets'], function(res) {
    if (chrome.runtime.lastError) { // 這是在初始化, 所以要靜默處理
      // console.error('載入 syncTargets 失敗:', chrome.runtime.lastError);
      // setStatus('載入輸出目標失敗');
      return;
    }
    
    const syncTargetsArray = res.syncTargets || [];
    console.log('載入的 syncTargets:', syncTargetsArray);
    
    // 清空現有列表
    // outputTargetList.innerHTML = '';
    
    if (syncTargetsArray.length === 0) {
      // 沒有輸出目標時顯示提示
      outputTargetList.innerHTML = outputTargetListEmpty;
      console.log('沒有找到輸出目標');
    } else {
      // 遍歷所有 syncTargets 並添加到列表
      syncTargetsArray.forEach(target => {
        if (target && target.id && target.title) {
          // 檢查分頁是否仍然存在
          chrome.tabs.get(target.id, (tab) => {
            if (chrome.runtime.lastError || !tab) {
              removeInvalidTarget(target.id);
              console.warn(`分頁 ${target.id} 不存在，跳過載入: ${target.title} 從 storage 中移除無效的目標`);
            } else {
              // 分頁存在，添加到列表
              addOutputTargetItem(target.id, target.title);
              console.log(`已載入輸出目標: ${target.title} (ID: ${target.id})`);
            }
          });
        } else {
          console.warn('無效的 syncTarget 項目:', target);
        }
      });
      
      // console.log(`已載入 ${syncTargetsArray.length} 個輸出目標`);
    }
  });
}

// 移除無效的輸出目標（分頁已關閉的）
function removeInvalidTarget(targetId) {
  chrome.storage.local.get(['syncTargets'], function(res) {
    let syncTargetsArray = res.syncTargets || [];
    const originalLength = syncTargetsArray.length;
    
    // 過濾掉無效的目標
    syncTargetsArray = syncTargetsArray.filter(item => item.id !== targetId);
    
    if (syncTargetsArray.length < originalLength) {
      chrome.storage.local.set({ syncTargets: syncTargetsArray }, function() {
        if (chrome.runtime.lastError) {
          console.error('移除無效目標時發生錯誤:', chrome.runtime.lastError);
        } else {
          console.log(`已自動移除無效的輸出目標 ID: ${targetId}`);
        }
      });
    }
  });
}

// 頁面載入時自動載入監聽目標和輸出目標
loadMonitorSelected();
loadOutputTargets();

