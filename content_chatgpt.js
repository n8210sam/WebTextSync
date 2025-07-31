// content_chatgpt.js ChatGPT 網站專用策略

(() => {
  // 選取 ChatGPT 的真實輸入框
  const target = document.querySelector('div.ProseMirror#prompt-textarea[contenteditable="true"]');

  if (!target) {
    console.warn('[WebTextSync][ChatGPT] 無法找到輸入框 (ProseMirror)');
    return;
  }

  chrome.storage.local.get(['monitor_selector', 'output_selector', 'monitor_url', 'output_url'], (data) => {
    const currentUrl = window.location.href.replace(/\/[^\/]*$/, "/*");

    // 作為監聽端：輸入時保存內容
    if (currentUrl === data.monitor_url) {
      target.addEventListener('input', () => {
        const text = target.innerText.trim();
        chrome.storage.local.set({ latestInput: text });
        console.log('[WebTextSync][ChatGPT] 監聽輸入：', text);
      });

      // 視覺提示
      target.style.outline = '2px solid green';
      const tip = document.createElement('div');
      tip.innerText = `監聽中：${target.innerText.slice(0, 20)}...`;
      Object.assign(tip.style, {
        position: 'fixed',
        top: '10px',
        left: '10px',
        background: '#00c853',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '8px',
        zIndex: 9999,
        fontSize: '14px'
      });
      document.body.appendChild(tip);
      setTimeout(() => tip.remove(), 5000);
    }

    // 作為輸出端：定時將儲存內容寫入
    if (currentUrl === data.output_url) {
      setInterval(() => {
        chrome.storage.local.get('latestInput', (res) => {
          if (!res.latestInput) return;
          if (target.innerText !== res.latestInput) {
            target.innerText = res.latestInput;

            // 觸發 input 事件 (有些框架會聽這個來同步狀態)
            target.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('[WebTextSync][ChatGPT] 同步輸出：', res.latestInput);
          }
        });
      }, 500);

      // 視覺提示
      target.style.outline = '2px solid blue';
      const tip = document.createElement('div');
      tip.innerText = `輸出目標：${target.innerText.slice(0, 20)}...`;
      Object.assign(tip.style, {
        position: 'fixed',
        top: '10px',
        left: '10px',
        background: '#2962ff',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '8px',
        zIndex: 9999,
        fontSize: '14px'
      });
      document.body.appendChild(tip);
      setTimeout(() => tip.remove(), 5000);
    }
  });
})();
