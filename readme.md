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



