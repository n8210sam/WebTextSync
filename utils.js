// utils.js：全局共用函式

// export function  // module 版
function generateSmartSelector(el) {
  if (!el) return null;
  if (el.id) return `#${el.id}`; // 直接使用 id 選擇器最精確有效，不必往上累積父層。

  const path = [];

  //while (el.parentElement) {
  while (el && el.nodeType === 1) {
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
}

function showFloatingTip(message, duration = 5000, bgcolor = "#4CAF50", color = "white") {
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
}

function ellipsisText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// 將函數掛到全域
window.generateSmartSelector = generateSmartSelector;
window.showFloatingTip = showFloatingTip;
window.ellipsisText = ellipsisText;
window.debounce = debounce;
console.log('end of === utils.js ===')