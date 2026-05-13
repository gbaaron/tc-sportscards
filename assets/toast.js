// Lightweight toast notification system
(function () {
  function ensureContainer() {
    let c = document.getElementById('tc-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'tc-toast-container';
      c.style.cssText = 'position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:10px;z-index:9999;pointer-events:none;';
      document.body.appendChild(c);
    }
    return c;
  }
  window.showToast = function (message, type = 'success', duration = 3200) {
    const c = ensureContainer();
    const t = document.createElement('div');
    const bg = type === 'error' ? '#a01919' : type === 'info' ? '#1a2638' : '#1f5e3a';
    t.style.cssText = `pointer-events:auto;background:${bg};color:#fdfbf7;padding:14px 20px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-family:'Source Sans 3',sans-serif;font-size:15px;font-weight:500;max-width:340px;animation:tcToastIn 0.25s ease-out;border-left:4px solid ${type === 'error' ? '#e63946' : type === 'info' ? '#3a5a8a' : '#3eb96f'};`;
    t.textContent = message;
    c.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'tcToastOut 0.25s ease-in forwards';
      setTimeout(() => t.remove(), 260);
    }, duration);
  };
  // Inject the animation styles once
  if (!document.getElementById('tc-toast-styles')) {
    const s = document.createElement('style');
    s.id = 'tc-toast-styles';
    s.textContent = `@keyframes tcToastIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes tcToastOut{to{transform:translateX(20px);opacity:0}}`;
    document.head.appendChild(s);
  }
})();
