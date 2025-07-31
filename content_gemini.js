// content_gemini.js  Gemini 網站專用策略

WebTextSync.syncTarget = () => { // Gemini 對話框 DOM 結構
  const strSyncTarget = 'div.ql-editor.textarea.new-input-ui' ;
  return document.querySelector(strSyncTarget);
};
