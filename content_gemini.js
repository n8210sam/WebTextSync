// content_gemini.js  Gemini 網站專用策略
(() => {
  // 偵測 Gemini 對話框 DOM 結構
  const target = document.querySelector('div.ql-editor.textarea.new-input-ui');

  if (!target) {
    console.warn('[WebTextSync][Gemini] 無法找到輸入對話框');
    return;
  }

  // 判斷是監聽方或輸出方
  chrome.storage.local.get(['monitor_selector', 'output_selector', 'monitor_url', 'output_url'], (data) => {
    const currentUrl = window.location.href.replace(/\/[^\/]*$/, "/*");

    if (currentUrl === data.monitor_url) {
      // 註冊輸入監聽
      target.addEventListener('input', () => {
        const text = target.innerText.trim();
        chrome.storage.local.set({ latestInput: text });
        console.log('[WebTextSync][Gemini] 已監聽輸入：', text);
      });
    }

    if (currentUrl === data.output_url) {
      // 定時同步輸出
      setInterval(() => {
        chrome.storage.local.get('latestInput', (res) => {
          if (res.latestInput && target.innerText !== res.latestInput) {
            target.innerText = res.latestInput;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('[WebTextSync][Gemini] 已輸出同步內容：', res.latestInput);
          }
        });
      }, 500);
    }
  });
})();
