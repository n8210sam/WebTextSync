// utils.js：全局共用函式

const WebTextSync = {
  debug_mode: (window.WebTextSync_config && window.WebTextSync_config.debug_mode) || false,
  currentTabId: null, // 儲存 [目前分頁] tab id 
  originalTitle: null, // 儲存 [目前分頁] 原標題
  currentSyncTarget: null, // 目前分頁 是[執行中]的 輸出目標元素 
  
  async init() {
    this.currentTabId = await this.getCurrentTabIdSafe();
    
    // 避免空標題 title > hostname > filename > Untitled 
    this.originalTitle = (
      document.title?.trim() ||
      window.location.hostname?.trim() ||
      window.location.pathname.split('/').pop()?.trim() ||
      'Untitled'
    ); // 問號 ?. 是 可選鏈（Optional Chaining） 運算子。

    if (WebTextSync.debug_mode) {
       this.originalTitle = ''+ this.currentTabId +'🚨'+ this.originalTitle
       console.log('utils.js debug_mode On 🚨 ', this.currentTabId, this.originalTitle )
    } 
  },
  //在 JavaScript 中，物件的所有方法在物件建立完成後就會同步存在，並不需要考慮函式宣告的順序。

  // 使用 Port fallback 查詢 tabId (使用 connect 長連線)
  getTabIdViaPort() {
    return new Promise((resolve) => {
      const port = chrome.runtime.connect({ name: "getTabIdPort" });
      port.onMessage.addListener((msg) => resolve(msg.tabId));
      port.postMessage({ action: "getTabId", url: location.href });
    });
  },

  // 安全取得 tabId（有 sender.tab.id 就用，否則 fallback）
  async getCurrentTabIdSafe() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getTabId" }, async (res) => {
        if (res?.tabId) {
          resolve(res.tabId);
        } else {
          console.log("sender.tab 無法取得，改用 URL fallback 查詢 tabId");
          const tabId = await WebTextSync.getTabIdViaPort();
          resolve(tabId);
        }
      });
    });
  },

  getStoredSyncSource(key = 'syncSource') { // syncSource
    return new Promise((resolve, reject) => { // 注意!! chrome.storage.local.get 是非同步處理
      chrome.storage.local.get([key], (res) => {
        console.log('[ utils.js ] getStoredSyncSource key:', key, ' ,  res:', res);
        if (chrome.runtime.lastError) {
          console.error(`讀取 ${key} 錯誤:`, chrome.runtime.lastError, chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
          return;
        }
        const data = res[key];
        if (!data || (!data.tabId && 'syncSource' === key)) {
          return reject(new Error(`syncSource 資料不存在或格式錯誤: ${JSON.stringify(data)}`));
        }
        // console.log('[ utils.js ] 131 data:', data);
        resolve(data);
      });
    });
  },



  /**
   * 通用動畫標題設定
   * @param {string} intervalVarName 全域變數名稱，用來儲存 interval ID
   * @param {function(number): string} getIconFn 根據狀態傳回圖示
   * @param {number} delay 間隔時間 (毫秒)
   */
  setTitleAnimation(intervalVarName, getIconFn, delay) {
    console.log (`開始 setTitleAnimation:  originalTitle:"${this.originalTitle}" , intervalVarName:"${intervalVarName}" , getIconFn: "${getIconFn}" , delay: "${delay}" ` ) ;
    
    // 清除舊動畫
    if (window[intervalVarName]) {
      clearInterval(window[intervalVarName]);
    }

    let index = 0;
    window[intervalVarName] = setInterval(() => {
      const icon = getIconFn(index);
      document.title = `${icon} ${this.originalTitle}`;
      index++;
    }, delay);
  },
  removeTitleAnimation(intervalVarName) {
    if (window[intervalVarName]) {
      clearInterval(window[intervalVarName]);
    }
    
    if (this.originalTitle !== null) {
      document.title = this.originalTitle;
    }
  },

  // 回傳 網站專用對話框; (尚未實際應用)
  getSyncOutputTarget(searchStr) { // get SyncTarget.target
	const site_dict = [
	  { name: 'gemini' , url: 'gemini.google.com/app', target: 'div.ql-editor.textarea.new-input-ui' },
	  { name: 'chatgpt' , url: 'chatgpt.com', target: 'div.ProseMirror#prompt-textarea[contenteditable="true"]' },
	  { name: 'perplexity' , url: 'www.perplexity.ai', target: '#ask-input' },
	  { name: 'gemini' , url: 'gemini.google.com', target: 'div.ql-editor.textarea.new-input-ui' }
	];
	///根據搜尋字串 (searchStr)，從 site_dict 中找出最相似的 URL 對應的資料 (忽略大小寫)。
	// 相似度判斷邏輯：
	// 1. 精確相等：如果 searchStr 與某個 entry.url 完全相等，立即返回該資料。
	// 2. 包含匹配：找出 entry.url 包含 searchStr 的所有條目。
	// 3. 最多匹配字數：在所有包含匹配中，選擇 entry.url 中包含 searchStr 且 searchStr 本身長度最長的那個（即匹配字數最多）。
	// @param {string} searchStr - 用於比對的搜尋字串。
	// @returns {Object|null} - 找到的最相似的資料物件 (包含 url 和 target)，如果沒有找到則返回 null。

	  let bestMatch = null;
	  let maxMatchedLength = 0; // 記錄 searchStr 的長度，表示匹配到的字數
      searchStr = searchStr.toLowerCase();

	  for (const entry of site_dict) {
		const dictName = entry.name.toLowerCase();
		const dictUrl = entry.url.toLowerCase();

		// 1. 精確相等：如果 searchStr 與 dictUrl 完全相等，直接返回該條目
		if (searchStr === dictName || searchStr === dictUrl) {
		  // console.log(`精確匹配找到: "${searchStr}" 與 "${dictName}" 或 "${dictUrl}"`);
		  return entry;
		}

		// 2. 包含匹配：檢查 dictUrl 是否包含 searchStr
		if (dictUrl.includes(searchStr)) {
		  // 判斷是否為目前最好的匹配：
		  // 條件是 searchStr 的長度大於目前記錄的最大匹配長度
		  // 這意味著我們找到了一個更長、更具體的 searchStr 匹配
		  if (searchStr.length > maxMatchedLength) {
			maxMatchedLength = searchStr.length;
			bestMatch = entry;
		  }
		}
	  }

	  // 返回在所有包含匹配中，searchStr 自身長度最長的那個條目
	  console.log(`非精確匹配的最佳結果 (匹配字數): "${searchStr}"，長度: ${maxMatchedLength}`);
	  return bestMatch;
	},

  GenerateSmartSelector(el) { // 完整路徑的選擇器生成器
    if (!el) return null;
    if (el.id) return `#${el.id}`; // 使用 id 為最快捷精確方式

    const path = [];
    while (el && el.nodeType === 1) { // 一路從當前元素往上回溯到 <body>，生成一個「絕對層級選擇器路徑」
      let tag = el.tagName.toLowerCase();
      const siblings = Array.from(el.parentNode?.children || []).filter(
        sib => sib.tagName === el.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(el) + 1;
        tag += `:nth-of-type(${index})`;
      }
      path.unshift(tag);
      el = el.parentElement;
    }

    return path.join(' > ');
  },

  ShowFloatingTip(message, duration = 5000, bgcolor = "#4CAF50", color = "white") {
    const tip = document.createElement('div');
    tip.innerText = message;
    Object.assign(tip.style, {
      position: 'fixed',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      minWidth: '30vw',
      background: bgcolor,
      color: color,
      padding: '6px 10px',
      borderRadius: '6px',
      zIndex: 9999,
      fontSize: '14px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      textAlign: 'center',
    });
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), duration);
  },

  EllipsisText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  },

  Debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  },

  // 安全的消息發送函數
  async safeSendMessage(message) {
    if (!(chrome.runtime && chrome.runtime.id)) {
      throw new Error("[ utils.js ] Extension context invalidated：分頁已逾時或無效");
    }

    if (!this.currentTabId) this.currentTabId = await this.getTabIdViaPort();
    if (!this.currentTabId) {
      throw new Error("[ utils.js ] 缺少 currentTabId，無法發送訊息");
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`[ utils.js ] sendMessage 錯誤 lastError : ${chrome.runtime.lastError.message}`));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(new Error(`[ utils.js ] sendMessage 發送例外錯誤: ${error.message}`));
      }
    });
  },

  // 安全的消息發送函數 (舊版)
  XXsafeSendMessage(message, callback) {
    if (chrome.runtime && chrome.runtime.id) {} else {
      console.log("[ utils.js ] Extension context invalidated 分頁逾時");
    }
    if (!this.currentTabId) {
      console.log("[ utils.js ] 缺少 currentTabId");
      return false;
    }
    
    try {
      chrome.runtime.sendMessage(message, callback);
      return true;
    } catch (error) {
      console.warn("[ utils.js ] Extension context error:", error.message);
      return false;
    }
  }
};


/*
chromeArray 是一個目前還沒用到的物件, 主要是用來學習 javascript 語法 函式提取到物件 的應用

// 指定儲存區為 sync
chromeArray.setStorageType('sync');

// 新增項目
chromeArray.add('syncTargets', { id: 1, title: 'Page A' });

// 刪除項目
chromeArray.remove('syncTargets', 1);

// 更新項目
chromeArray.update('syncTargets', { id: 123, name: 'Updated' }, 'id',
  (data) => { console.log('✅ 更新成功:', data); }
);

*/
const chromeArray = {
  storageType: 'local',  // 預設為 local

  setStorageType(type) {
    if (type === 'local' || type === 'sync') {
      this.storageType = type;
    } else {
      throw new Error(`無效的 storageType: ${type}`);
    }
  },

  getStorageType() {
    return this.storageType;
  },

  getStorage() {
    const storage = chrome.storage[this.storageType];
    if (!storage) throw new Error(`無效的 storageType: ${this.storageType}`);
    return storage;
  },

  getArray(key, callback) {
    const storage = this.getStorage();
    storage.get([key], (res) => {
      const array = res[key] || [];
      callback(array);
    });
  },

  getArrayAsync(key) {
    const storage = this.getStorage();
    return new Promise((resolve, reject) => {
      storage.get([key], (res) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(res[key] || []);
        }
      });
    });
  },

  saveMap(key, map, callback) {
    const array = Array.from(map.values());
    this.getStorage().set({ [key]: array }, () => {
      if (chrome.runtime.lastError) {
        console.error(`儲存 ${this.storageType}.${key} 發生錯誤:`, chrome.runtime.lastError);
      } else if (typeof callback === 'function') {
        callback(array);
      }
    });
  },

  // 全新才上
  add(key, newItem, matchField = 'id', callback) {
    this.getArray(key, (array) => {
      const map = this.arrayToMap(array, matchField);
      if (!map.has(newItem[matchField])) {
        map.set(newItem[matchField], newItem);
        this.saveMap(key, map, callback);
      } else {
        console.log(`項目已存在，未新增: ${matchField}=${newItem[matchField]}`);
      }
    });
  },
  
  // Upsert 資料存在就更新，不存在就新增
  put(key, newItem, matchField = 'id', callback) {
    this.getArray(key, (array) => {
      const map = this.arrayToMap(array, matchField);
      map.set(newItem[matchField], newItem);
      this.saveMap(key, map, callback);
    });
  },

  // 原有才上
  update(key, newItem, matchField = 'id', callback) {
    this.getArray(key, (array) => {
      const map = this.arrayToMap(array, matchField);
      if (map.has(newItem[matchField])) {
        map.set(newItem[matchField], newItem);
        this.saveMap(key, map, callback);
      } else {
        console.log(`找不到項目，無法更新: ${matchField}=${newItem[matchField]}`);
      }
    });
  },

  remove(key, matchValue, matchField = 'id', callback) {
    this.getArray(key, (array) => {
      const map = this.arrayToMap(array, matchField);
      map.delete(matchValue);
      this.saveMap(key, map, callback);
    });
  },

  arrayToMap(array, keyField = 'id') {
    const map = new Map();
    array.forEach(item => {
      if (item[keyField] !== undefined) {
        map.set(item[keyField], item);
      }
    });
    return map;
  }
};

window.WebTextSync = WebTextSync; // 將 WebTextSync 物件掛載到全域 window 物件上 *** 優先掛載以使用功能, 變數值後補;
console.log('[ utils.js ] 載入, debug_mode:', WebTextSync.debug_mode, ' , window.WebTextSync_config=', window.WebTextSync_config);

// 還沒初始化 通常是 null 
if (WebTextSync.debug_mode) console.log('[ utils.js ] 375 debug_mode On : WebTextSync.currentTabId = ',WebTextSync.currentTabId,' , .originalTitle:',WebTextSync.originalTitle,' , .currentSyncTarget:',WebTextSync.currentSyncTarget);

// 不要在 utils.js 做 WebTextSync.init(), 因為 popup.html 有引用~ 改到 selector_injector.js 做 (在結構 manifest.json 中, 目前的設定會應用到 monitor.js 和 output.js )
