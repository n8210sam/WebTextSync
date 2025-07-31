// popup.js
// ***** 注意這裡 console.log 不會顯示在前端 dev Tool *****
const monitorBtn = document.getElementById('monitorBtn');
const cancelMonitorBtn = document.getElementById('cancelMonitorBtn');	 
const outputBtn = document.getElementById('outputBtn');
const monitorSelectedSpan = document.getElementById('monitorSelected');
const outputTargetList = document.getElementById('outputTargetList');
const outputTargetListEmpty = '<li id="emptyOutputTargetList">尚無輸出目標</li>';
const statusDiv = document.getElementById('status');

const domainPattern = location.origin + '/*';

let outputTargets = []; // 儲存多個輸出目標 selector
let hasMonitor = false;
let tabInit = false;

function setStatus(msg) {
  statusDiv.textContent = msg;
}

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

// 選擇監聽目標
monitorBtn.addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs.length > 0){} else { return false; }
    const currentTabId = tabs[0].id;
  
    chrome.runtime.sendMessage({action: "selectElement", mode: "monitor", tabsid: currentTabId});
  
    const title = (tabs[0].title.trim() || new URL(tabs[0].url).hostname ) ;
    chrome.storage.local.set({syncSource: {id:currentTabId,title:title}}, function() {
		if (chrome.runtime.lastError) {
		  console.error("儲存失敗:", chrome.runtime.lastError.message);
		  statusDiv.textContent = "錯誤: 無法儲存分頁 ID。";
		  return;
		}
		
		console.log("來源分頁 ID 已儲存:", currentTabId);
		statusDiv.textContent = `已記錄分頁 ID: ${currentTabId}  ${title}`;
		updateMonitorSelected(title);
		setTimeout(() => { window.close(); }, 5000); // 延遲關閉
    });
  });
});


// 取消監聽按鈕點擊
cancelMonitorBtn.addEventListener('click', () => {
  chrome.storage.local.set({syncSource:null});
  updateMonitorSelected(null);
  setStatus('監聽已取消');
});

// 移除指定索引的輸出目標
function removeOutputTarget(event, id) {

  chrome.storage.local.get(['syncTargets'], function(result) {
    let syncTargetsArray = result.syncTargets || [];
    const initialLength = syncTargetsArray.length; // 記錄原始長度

    // 過濾掉符合 id 的項目
    syncTargetsArray = syncTargetsArray.filter(item => item.id !== id);

    if (syncTargetsArray.length < initialLength) { // 檢查有項目被移除
      chrome.storage.local.set({ syncTargets: syncTargetsArray }, function() {
        if (chrome.runtime.lastError) {
          console.error("移除 syncTargets 時發生錯誤:", chrome.runtime.lastError);
        } else {
          console.log("成功移除 syncTarget 項目並更新:", syncTargetsArray);
        }
      });
    }
  });

  // 直接移除 DOM 元素
  document.getElementById(id).remove();

  // 如果沒有項目了，顯示提示文字
  if (syncTargetsArray.length === 0) {
    outputTargetList.innerHTML = outputTargetListEmpty;
    setStatus('請新增輸出目標...');
  } else {
    setStatus('已刪除輸出目標');
  }
}

// 新增單個輸出目標項目
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
    removeOutputTarget(event,id);
  });

  li.appendChild(textSpan);
  li.appendChild(delBtn);
  outputTargetList.appendChild(li);
}


// 新增單個輸出目標項目
function addSyncTarget(currentTabId, title, syncTarget) {
  const newSyncTargetItem = {
    id: currentTabId
    , title: title
    , syncTarget: syncTarget
  };
  
  chrome.storage.local.get(['syncTargets'], function(result) { // 注意這裡用 'syncTargets' 避免與內部屬性混淆
    let syncTargetsArray = result.syncTargets || []; // 如果 syncTargets 不存在，則初始化為空陣列
    let found = false;
    // 檢查是否已存在相同的 id
    for (let i = 0; i < syncTargetsArray.length; i++) {
      if (syncTargetsArray[i].id === currentTabId) {
        // 如果找到相同的 id，則更新該項目
        syncTargetsArray[i] = newSyncTargetItem;
        found = true;
        break;
      }
    }
	
    // 如果沒有找到，則新增項目
    if (!found) {
      syncTargetsArray.push(newSyncTargetItem);
    }
	
    chrome.storage.local.set({ syncTargets: syncTargetsArray }, function() {
      if (chrome.runtime.lastError) {
        console.error("設定 同步輸出分頁(syncTargets)時發生錯誤:", chrome.runtime.lastError);
      } else {
        console.log("成功新增或更新 syncTargets 項目:", syncTargetsArray, newSyncTargetItem);
        addOutputTargetItem(currentTabId, title);
      }
    });
	
  }) // local.get
}


// 新增輸出目標（點擊按鈕，觸發內容腳本選擇元素）
outputBtn.addEventListener('click', () => {

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {

    if (tabs && tabs.length > 0) {} else { return false; };
  
    const currentTabId = tabs[0].id;
    chrome.tabs.sendMessage(currentTabId, {action: "syncOutput"} );
    const title = tabs[0].title.trim() || new URL(tabs[0].url).hostname;
  
    if (!window.syncTarget) {
	  chrome.runtime.sendMessage({action: "selectElement", mode: "output"});
      setStatus('請在頁面點擊以新增輸出目標...');

	} else {
	  addSyncTarget(currentTabId,title, window.syncTarget );
    }
	
  }); // chrome.tabs.query
});

// 監聽來自 background script 的消息
chrome.runtime.onMessage.addListener((msg) => {
  console.log('popup 收到 chrome.runtime 消息:', msg);
  
  if (msg.action === 'saveSelector') {
    console.log('處理 saveSelector 消息');
	
	  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		if (tabs && tabs.length > 0) {} else { return false; };
		const currentTabId = tabs[0].id;
		const title = tabs[0].title.trim() || new URL(tabs[0].url).hostname;
		if (msg.selector) {
	      window.syncTarget = msg.selector
		  addSyncTarget(currentTabId,title, window.syncTarget );
		}
	  }); // chrome.tabs.query
	  
  } else if (msg.action === 'selectedElement') {
    console.log('處理 selectedElement 消息');
    handleMessage(msg);
  }
});


// 載入頁面時從 storage 載入監聽目標並顯示
function loadMonitorSelected() {
  // 檢查 local storage 是否有 syncSource，若有則檢查分頁是否存在再更新監聽目標顯示
  const syncSource = WebTextSync.getStoredSyncSource()
    try {
      chrome.tabs.get(syncSource.id, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          console.log('syncSource.id 對應分頁不存在，跳過更新監聽目標');
          return;
        }
		const title = syncSource.title || new URL(tab.url).hostname;
        updateMonitorSelected( title );
        console.log('已從 local storage 載入 syncSource 並更新監聽目標:', title);
      });
    } catch (e) { }
}

// 初始化
window.onload = () => {
  loadMonitorSelected();
  // loadOutputTargets();
};
