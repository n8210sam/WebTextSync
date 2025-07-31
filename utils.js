// utils.js：全局共用函式

const currentUrl = window.location.href.replace(/\/[^\/]*$/, "/*");

/*
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
    storage.get([key], (result) => {
      const array = result[key] || [];
      callback(array);
    });
  },

  getArrayAsync(key) {
    const storage = this.getStorage();
    return new Promise((resolve, reject) => {
      storage.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key] || []);
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

const WebTextSync = {
  // WebTextSync.syncTarget return 網站專用對話框;

  getStoredSyncSource(key = 'syncSource') { // syncSource
    return new Promise((resolve, reject) => { // 注意!! chrome.storage.local.get 是非同步處理
      chrome.storage.local.get([key], (result) => {
        console.log('123 key:', key, result);
        if (chrome.runtime.lastError) {
          console.error(`讀取 ${key} 錯誤:`, chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
		const data = result[key];
	    if (!data || (!data.id && 'syncSource'==key )) {
		  return reject(new Error(`syncSource 資料不存在或格式錯誤: ${JSON.stringify(data)}`));
		}
        console.log('132 data:', data);
        resolve(data);
      });
    });
  },

  getSyncTarget(searchStr) { // get SyncTarget
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
      left: '10px',
      background: bgcolor,
      color: color,
      padding: '6px 10px',
      borderRadius: '6px',
      zIndex: 9999,
      fontSize: '14px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
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
  }
};

console.log('[WebTextSync] utils.js 載入');
