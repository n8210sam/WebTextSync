// content_chatgpt.js ChatGPT 網站專用策略

WebTextSync.syncTargetElement = () => { // ChatGPT 的真實輸入框
  const strSyncTarget = 'div.ProseMirror#prompt-textarea[contenteditable="true"]' ;
  return document.querySelector(strSyncTarget);
};

