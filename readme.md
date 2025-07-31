需求:
	做一個 chrome 外掛程式, 可以讓我在網頁A 對話框輸入的文字, 同步輸出在網頁B 對話框;
	點一下外掛, 可以選擇要監聽或要同步輸出的網頁元素, 並動態載入監聽程式或同步輸出程式;
	在點選前述物件要自動抓取網址, 提取的網址中, 最後一個 "/" 後面的字段換成 "*" 來匹配該網站所有網頁, 並依網址不同, 動態載入智能兼容的網頁元素過濾器;
	前述智能選擇器, 擁有多層級智能選擇策略, 不論用戶選到哪一層都能找到對話框的關鍵元素, 正確提取和同步輸出文字;
	選定監聽目標後, 接入監聽程式, 在畫面上友善提示所選目標及目標內文字前20字(顯示5秒), 並令目標變綠框, 同時在該頁主控台 log 目標及文字用於偵錯;
	選定同步輸出目標後, 接入同步輸出程式 , 動作如前述;
	實作產生正確可用的程式碼;

WebTextSync/
├── manifest.json  基本設定
├── background.js  背景廣播任務
├── popup.html  設定功能 Web UI: 可設定 一個監聽目標 + 多個同步輸出目標
├── popup.js  Web UI的執行程式
├── selector_injector.js  入口模組, 設定用戶所選目標
├── monitor.js  監聽程式, 防抖動 + 呼叫同步輸出
├── output.js  同步輸出程式
├── content_<site_name>.js 網站 <site_name> 專用網頁元素(對話框)過濾器
├── content_gemini.js  Gemini 專用過濾器
├── content_chatgpt.js  ChatGPT 專用過濾器
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png

專用網頁元素過濾器:
	Gemini 網頁對話框的真正輸入區，是 <div class="ql-editor textarea new-input-ui ql-blank"> 這個 contenteditable="true" 的元素
		目標	解釋
		ql-editor textarea	為 Gemini 的輸入框 <div contenteditable="true">，是文字輸入主要目標
		.innerText	用於讀寫內容，避免錯誤保留 <p> 或 <br>
		replace(/\/[^\/]*$/, "/*")	將網址最後段變為 *，達到相同站點但不同頁的通用匹配

	ChatGPT 真正的輸入框：<div class="ProseMirror" id="prompt-textarea" contenteditable="true">

⛔ 為什麼不能用 import？
	content_scripts 不支援 type="module" 或 ES6 的 import 語法，除非你在某些 Hacky 情況下用動態 import()（但這不是建議做法，也會導致 CSP 問題）。
	即使多個 js 檔案在 manifest.json 裡順序載入，也各自是獨立封裝的 script context，不能互相存取函數或變數。

	CSP 是一種安全機制，用來限制網頁能執行哪些腳本、載入哪些資源，防止 XSS 攻擊等。Chrome 擴充功能預設就啟用了嚴格的 CSP。

	在 manifest_version: 3 中，CSP 預設規定：

		不能使用 eval()
		不能使用 Function() 動態執行代碼
		不能 inline script（例如 <script>...</script> 在 HTML 裡不被允許）
		不能用 import 或 type="module" 的 <script>


🎯 popup.js ：處理 popup.html 的 UI 邏輯。
	主要職責：
		初始化：
			載入時，從 chrome.storage.local 讀取並顯示已設定的監聽和同步輸出目標。
			chrome.storage.local.get(['syncSource'],()=>{})
			改用  WebTextSync.getStoredSyncSource().then(data => {}

		設定監聽/輸出按鈕事件：
			當用戶點擊「設定監聽目標」(monitorBtn) 或「新增同步輸出目標」(outputBtn) 按鈕時：
				向 background.js 發送訊息，請求進入元素選擇模式，並告知是設定監聽還是輸出目標。
					chrome.runtime.sendMessage({action: "selectElement", mode: "monitor", tabsid: currentTabId});
				更新 UI 狀態，提示用戶去網頁上點選元素。
				
		
		接收選定元素回饋：
			監聽來自 background.js 的訊息，當元素選擇完成後，更新 popup.html 上的顯示。
			顯示選定目標的網址和簡要描述。
			
		管理目標列表：提供刪除已設定目標的功能。

🧠 background.js ：背景廣播任務 (Service Worker)
	這是擴充功能的核心控制器，負責協調各個模組之間的通訊和數據流。
	主要職責：
		監聽擴充功能圖示點擊 (來自 popup.js)：
			當 popup.js 要求進入元素選擇模式時，background.js 會接收到訊息。
			使用 chrome.scripting.executeScript 將 selector_injector.js 注入到當前活躍的標籤頁。
			設定一個一次性的監聽器，等待 selector_injector.js 返回選定的元素資訊。
		處理選定元素資訊 (來自 selector_injector.js)：
			接收到選定元素的 CSS 選擇器、當前網址、初始文字等資訊。
				if (msg.action === "selectElement") 
					chrome.tabs.sendMessage(tabs[0].id, { action: "startSelecting", mode: msg.mode })
			網址處理： 將提取的網址中，最後一個 "/" 後面的字段換成 "*" 來匹配該網站所有網頁。例如：https://www.example.com/some/path/page.html 會變成 https://www.example.com/some/path/*。這將作為儲存的目標網址模式。
			智能選擇器判斷： 根據處理後的網址，判斷是否需要載入特定的智能兼容網頁元素過濾器（如 content_gemini.js 或 content_chatgpt.js）。這可以通過一個內部映射表來實現。
			將選定的目標（包括類型：監聽或同步輸出，網址模式，原始選擇器，以及智能過濾器路徑）儲存到 chrome.storage.local。
			將處理結果回傳給 popup.js。
		監聽標籤頁更新：
			使用 chrome.tabs.onUpdated 監聽所有標籤頁的狀態變化（例如載入完成）。
			當有標籤頁更新時，從 chrome.storage.local 讀取所有已設定的監聽和同步輸出目標。
			對於每個目標：
			檢查當前標籤頁的 URL 是否與目標的網址模式匹配。
			如果匹配，則動態注入相應的內容腳本：
			如果存在智能過濾器，先注入 content_<site_name>.js。
			然後根據目標類型，注入 monitor.js 或 output.js。
			將儲存的原始選擇器和智能過濾器路徑作為參數傳遞給注入的腳本。
		文字數據中繼 (來自 monitor.js / 傳送至 output.js)：
			監聽來自 monitor.js 的訊息（包含監聽到的文字）。
			從 chrome.storage.local 獲取所有已設定的同步輸出目標。
			對於每個匹配的同步輸出目標，使用 chrome.tabs.sendMessage 將文字數據發送到對應的 output.js 實例。
		錯誤處理與日誌：
			對所有 chrome.scripting 和 chrome.storage 操作進行錯誤處理。
			在控制台記錄重要的操作和錯誤信息，用於偵錯。



