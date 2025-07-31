2025/07/30
    manifest.json
        Gemini 教我的:
            manifest_version: 3: 宣告使用 Manifest V3 規範。
            action: 定義點擊擴充功能圖示時的行為，這裡會打開 popup.html。
            background: 使用 service_worker 來執行背景腳本 background.js。Service Worker 是 Manifest V3 的推薦背景腳本類型，它在需要時啟動，空閒時終止，以節省資源。
            permissions:
            storage: 允許擴充功能使用 chrome.storage API 儲存用戶設定和同步數據。
            activeTab: 允許擴充功能臨時存取用戶當前活躍的標籤頁，以便在其中注入腳本或獲取資訊。
            scripting: Manifest V3 中用於動態注入內容腳本的核心權限，取代了 Manifest V2 的 tabs 和 executeScript。
            host_permissions: 允許擴充功能與指定的網域互動。<all_urls> 表示允許在所有網頁上執行內容腳本，這是為了實現動態匹配和注入的靈活性。在實際部署時，您可以根據需要縮小範圍。
            web_accessible_resources: 允許網頁訪問擴充功能內部的資源。這裡列出了所有可能被動態注入的內容腳本，確保它們可以被 chrome.scripting.executeScript 載入。
		ChatGPT 教我:
			Chrome 會根據定義順序先後注入 JS
			已經透過 content_scripts 注入網頁中，則不需要也不應該再在 web_accessible_resources 中重複宣告它。



	handleMutations 是什麼？
		在 MutationObserver 的回呼函數中：
			<code>
const debouncedMutationHandler = WebTextSync.Debounce(handleMutations, 300);

function startObserver() //🚀 啟用監聽 
	const observer = new MutationObserver(debouncedMutationHandler);
	//
	const observer = new MutationObserver((mutationsList, observer) => {
	  // mutationsList 是一個 MutationRecord[] 陣列
	});
			</code>
		mutationsList 是 一個包含所有 DOM 變化紀錄的陣列，每一筆變化是一個 MutationRecord，可能是：
			子節點變化（childList）
			屬性變化（attributes）
			文字內容變化（characterData）
		範例一筆 MutationRecord 長這樣：
			{
			  type: "attributes",
			  target: <div>,
			  attributeName: "class",
			  oldValue: "old-class"
			}
		type 為 characterData 的範例:
			{
			  type: "characterData",
			  target: #text "原本的文字",
			  addedNodes: NodeList [],          // 對 characterData 而言通常為空
			  removedNodes: NodeList [],        // 同上
			  previousSibling: null,
			  nextSibling: null,
			  attributeName: null,
			  attributeNamespace: null,
			  oldValue: "原本的文字"             // ⚠️ 舊的文字內容
			}



	function startObserver() 包裝的 5 個好處：
		1️⃣ 延後啟用，控制時機 - 可以等時機成熟再手動呼叫
		2️⃣ 避免變數污染作用域 - 避免 const observer = new MutationObserver(...) 變成全域變數
		3️⃣ 方便重新啟動 / 停止監聽
			停止監聽範例: WebTextSync.stopObserver = function () { observer.disconnect(); }
		4️⃣ 便於測試與除錯
		5️⃣ 未來可擴充設定或條件判斷
			例如你想只在某些頁面才啟用監聽：
				<code>
WebTextSync.startObserver = function () {
  if (!location.href.includes("chatgpt.com")) return;
  const observer = new MutationObserver(...);
  observer.observe(...);
};
				</code>



	累積所有 2 秒內的變化再一起處理:
		<code>
let mutationBuffer = [];

const observer = new MutationObserver((mutationsList) => {
  mutationBuffer.push(...mutationsList); // 其中 ... 是 展開運算子（Spread operator），意思是「把陣列裡的每個元素都展開，當作獨立的參數傳入」。
  debouncedMutationHandler();
});

const debouncedMutationHandler = WebTextSync.Debounce(() => {
  if (mutationBuffer.length) {
    handleMutations(mutationBuffer);
    mutationBuffer = [];
  }
}, 2000);
		</code>



	(type) => () => { 是什麼?
		這段語法是 JavaScript 的 箭頭函式（Arrow Function），(type) => () => { ... } 是一個 高階函式（Higher-Order Function），意思是：
			<code>
const markUserInput = (type) => () => {
  lastUserAction = type + "@" + new Date().toISOString();
  console.log(`[WebTextSync] 使用者觸發：${lastUserAction}`);
};
			</code>
			markUserInput 是一個「會傳回另一個函式」的函式。



	屬性變更： class => ProseMirror 代表什麼?
		觀察到這個變化代表: class="ProseMirror" 元素的 class 屬性被改成 ProseMirror , 意味這個 Dom 成為一個 ProseMirror 編輯器容器, 原本這個元素可能是個空的 <div> 或非編輯元素


	document.addEventListener("input") 是監聽什麼?
		| 行為                          | 是否觸發`input`  |
		| ----------------------     | --------------- |
		| 鍵盤輸入                      | ✅ 是             |
		| Ctrl+V / 貼上                 | ✅ 是             |
		| 刪除文字（Backspace、Delete） | ✅ 是             |
		| 拖曳文字進來                  | ✅ 是             |
		| 用滑鼠改變內容（如語音輸入）  | ✅ 是             |
		| 透過 JS 變更 `.value`         | ❌ 否（需手動觸發事件）|



2025/07/31
	傳送訊息給當前作用中的分頁 (msg, sender, sendResponse)
		<code>
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  chrome.tabs.sendMessage(tabs[0].id, {greeting: "Hello from background!"}, function(response) {
    console.log(response.farewell);
  });
});
		</code>
		溝通使用 chrome.runtime.sendMessage 與 chrome.runtime.onMessage



	sessionStorage.setItem() 只能直接儲存字串。如果想儲存 JavaScript 物件，需要轉換成字串格式
		<code>
// popup.js 或任何在分頁中執行的腳本
const myObjectData = {
  name: "範例使用者",
  age: 30,
  isActive: true,
  preferences: ["dark_mode", "notifications"],
  lastLogin: new Date().toISOString()
};

// 將 JavaScript 物件轉換為 JSON 字串
const objectAsString = JSON.stringify(myObjectData);

// 將 JSON 字串儲存到 sessionStorage
sessionStorage.setItem("myStoredObject", objectAsString);

console.log("物件已儲存為字串:", objectAsString);
		</code>
		取回資料時，再使用 JSON.parse() 將字串轉換回 JavaScript 物件。


	sender.tab 物件常見且重要的屬性：
		id (integer): 分頁的唯一 ID。這是最重要的屬性，你可以用它來識別具體是哪個分頁發送了訊息。如果你想針對該分頁執行某些操作（例如更新分頁、向該分頁發送訊息），都會用到這個 ID。
		index (integer): 分頁在視窗中的索引位置（從 0 開始）。
		windowId (integer): 分頁所屬的視窗的 ID。
		url (string): 分頁當前載入的 URL。
		title (string): 分頁的標題。
		favIconUrl (string, optional): 分頁網站的 favicon URL。
		active (boolean): 表示這個分頁是否是其所在視窗中當前活躍（被聚焦）的分頁。
		highlighted (boolean): 表示這個分頁是否在其所在視窗中被選中或高亮顯示。
		pinned (boolean): 表示這個分頁是否被釘選。
		audible (boolean, optional): 表示這個分頁當前是否正在播放音訊。
		discarded (boolean): 表示這個分頁是否被丟棄（為了釋放記憶體而將其內容從記憶體中清除，但分頁仍保留在標籤列中）。
		autoDiscardable (boolean): 表示這個分頁是否可以被瀏覽器自動丟棄。
		mutedInfo (object, optional): 關於分頁靜音狀態的資訊，包含 muted (boolean) 和 reason (string, optional) 等。
		width (integer, optional): 分頁的寬度（以像素為單位）。
		height (integer, optional): 分頁的高度（以像素為單位）。
		status (string, optional): 分頁的載入狀態。常見的值有 "loading" 或 "complete"。
		incognito (boolean): 表示這個分頁是否處於無痕模式。
		successorTabId (integer, optional): 如果這個分頁是通過「新分頁」按鈕或從另一個分頁連結打開的，則這是新分頁的前一個分頁的 ID。



	學習開發-chrome-extension-v3
		https://medium.com/@alexian853/%E5%BE%9E%E9%A0%AD%E9%96%8B%E5%A7%8B%E5%AD%B8%E7%BF%92%E9%96%8B%E7%99%BC-chrome-extension-v3-%E7%89%88%E6%9C%AC-96d7fdfc00d1
		<code>
// 複製按鈕實作
async function copyMessageToClipboard() {
  const { reviewTemplate } = await chrome.storage.sync.get(['reviewTemplate']);
  const prLinkSymbol = /{PR_LINK}/;
  const jiraLinkSymbol = /{JIRA_CARD}/;
  // 一個 PR 可能會關聯多張 JIRA 卡片，故用 Array 包裝
  const jiraLinks = [...document.querySelectorAll('h1 [data-link-key="dvcs-connector-issue-key-linker"]')];
  const jiraLinkPlainText = jiraLinks.map((link) => link.innerHTML).join('|');
  const jiraLinkHtmlText = jiraLinks.map((link) =>
    `<a href="${link.href}">${link.innerHTML}</a>`).join(' | ');

  // 使用 ClipboardItem 建立可複製的內容，使用 .replace 方法替換要複製的內容
  const clipboardItem = new ClipboardItem({
    "text/plain": new Blob(
      [
        reviewTemplate
          .replace(prLinkSymbol, 'PR')
          .replace(jiraLinkSymbol, jiraLinkPlainText)
      ],
      { type: "text/plain" }
    ),
    "text/html": new Blob(
      [
        reviewTemplate
          .replace(/\n/g, '<br>')
          .replace(prLinkSymbol, `<a href="${location.href}">PR</a>`)
          .replace(jiraLinkSymbol, jiraLinkHtmlText)
      ],
      { type: "text/html" }
    ),
  });

 // 將複製內容寫入剪貼簿
  return navigator.clipboard.write([clipboardItem]);
}
		</code>



	📌 事件傳遞流程分為三階段：
		Capturing Phase（捕獲）：由外層 DOM → 內層元素
		Target Phase：事件抵達實際觸發的目標元素
		Bubbling Phase（冒泡）：由內層元素 → 外層 DOM 傳回
	預設是冒泡，除非你明確指定 true 才會進入捕獲階段。
		document.addEventListener('click', onClick, true);
		當使用者點擊頁面中任何元素，這個 onClick 函式都會搶先在 捕獲階段 被觸發，早於其他用 false 註冊的監聽器。




