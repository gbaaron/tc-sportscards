// TC Sports Cards — Universal Helper Bot frontend widget (Section 28 of CLAUDE.md)
// Injects a floating chat bubble + expandable panel on every page.
// Talks to /.netlify/functions/helper-bot (OpenAI gpt-3.5-turbo on the server).
(function () {
  if (window.__TC_HELPER_BOT__) return;
  window.__TC_HELPER_BOT__ = true;

  // ---------- Config ----------
  const API_URL = '/.netlify/functions/helper-bot';
  const STORAGE_KEY = 'tc_helper_bot_session';
  const HISTORY_KEY = 'tc_helper_bot_history';
  const MIN_MS_BETWEEN_SENDS = 4000;     // 1 msg / 4s
  const MAX_MESSAGES_PER_SESSION = 40;   // hard stop
  const WELCOME = "Hey, Counter Helper here. Ask about hours, online drops, the rewards program, or anything about the hobby.";

  // ---------- Session ----------
  function getSessionId() {
    let sid = sessionStorage.getItem(STORAGE_KEY);
    if (!sid) {
      sid = 'tc-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
      sessionStorage.setItem(STORAGE_KEY, sid);
    }
    return sid;
  }

  function getHistory() {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory(arr) {
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(-24))); } catch (_) {}
  }

  function getUserEmail() {
    try {
      const raw = localStorage.getItem('tc_user');
      if (!raw) return '';
      const u = JSON.parse(raw);
      return (u && u.email) || '';
    } catch (_) {
      return '';
    }
  }

  // ---------- Styles ----------
  const css = `
    .tc-bot-bubble{
      position:fixed; bottom:24px; right:24px; z-index:9998;
      width:56px; height:56px; border-radius:50%;
      background:linear-gradient(135deg,#14213d 0%,#1d3557 100%);
      color:#f8f3e6; border:none; cursor:pointer;
      box-shadow:0 8px 24px rgba(0,0,0,0.25),0 0 0 4px rgba(212,160,23,0.18);
      display:flex; align-items:center; justify-content:center;
      transition:transform .2s ease, box-shadow .2s ease;
      font-family:'Source Sans 3',sans-serif;
    }
    .tc-bot-bubble:hover{ transform:translateY(-2px) scale(1.04); box-shadow:0 12px 28px rgba(0,0,0,0.3),0 0 0 4px rgba(212,160,23,0.3); }
    .tc-bot-bubble svg{ width:26px; height:26px; }
    .tc-bot-bubble.is-open{ display:none; }
    .tc-bot-bubble .tc-bot-dot{
      position:absolute; top:6px; right:6px; width:10px; height:10px;
      background:#d4a017; border-radius:50%; border:2px solid #14213d;
    }

    .tc-bot-panel{
      position:fixed; bottom:24px; right:24px; z-index:9999;
      width:380px; max-width:calc(100vw - 32px);
      height:560px; max-height:calc(100vh - 48px);
      background:#fdfbf3; border:1px solid #d6c89a; border-radius:14px;
      box-shadow:0 24px 60px rgba(0,0,0,0.3);
      display:none; flex-direction:column; overflow:hidden;
      font-family:'Source Sans 3',sans-serif; color:#2a2a2a;
    }
    .tc-bot-panel.is-open{ display:flex; }

    .tc-bot-head{
      background:linear-gradient(135deg,#14213d 0%,#1d3557 100%);
      color:#f8f3e6; padding:14px 16px;
      display:flex; align-items:center; gap:12px;
      border-bottom:3px solid #d4a017;
    }
    .tc-bot-head-mark{
      width:36px; height:36px; border-radius:8px;
      background:#d4a017; color:#14213d;
      display:flex; align-items:center; justify-content:center;
      font-family:'Oswald',sans-serif; font-weight:700; font-size:14px; letter-spacing:.5px;
    }
    .tc-bot-head-title{ font-family:'Oswald',sans-serif; font-weight:600; font-size:16px; letter-spacing:.4px; }
    .tc-bot-head-sub{ font-size:12px; color:#ede4cc; opacity:.85; margin-top:1px; }
    .tc-bot-head-text{ flex:1; line-height:1.2; }
    .tc-bot-close{
      background:transparent; border:none; color:#f8f3e6; cursor:pointer;
      width:28px; height:28px; border-radius:6px; padding:0;
      display:flex; align-items:center; justify-content:center;
      font-size:20px; line-height:1; opacity:.85;
    }
    .tc-bot-close:hover{ background:rgba(255,255,255,.12); opacity:1; }

    .tc-bot-body{
      flex:1; overflow-y:auto; padding:14px 14px 4px;
      background:#fdfbf3;
      display:flex; flex-direction:column; gap:10px;
    }
    .tc-bot-msg{ max-width:85%; padding:10px 13px; border-radius:12px; font-size:14.5px; line-height:1.45; white-space:pre-wrap; word-wrap:break-word; }
    .tc-bot-msg-bot{ background:#f8f3e6; border:1px solid #e6dcc0; color:#2a2a2a; border-bottom-left-radius:4px; align-self:flex-start; }
    .tc-bot-msg-user{ background:#14213d; color:#fdfbf3; border-bottom-right-radius:4px; align-self:flex-end; }
    .tc-bot-msg-error{ background:#fde8e8; border:1px solid #f2c4c4; color:#9a1f24; align-self:flex-start; }
    .tc-bot-typing{ display:inline-flex; gap:4px; padding:10px 13px; background:#f8f3e6; border:1px solid #e6dcc0; border-radius:12px; border-bottom-left-radius:4px; align-self:flex-start; }
    .tc-bot-typing span{ width:6px; height:6px; border-radius:50%; background:#8a8a8a; animation:tcBotBlink 1.2s infinite ease-in-out; }
    .tc-bot-typing span:nth-child(2){ animation-delay:.15s; }
    .tc-bot-typing span:nth-child(3){ animation-delay:.3s; }
    @keyframes tcBotBlink{ 0%,80%,100%{ opacity:.3; transform:translateY(0); } 40%{ opacity:1; transform:translateY(-2px); } }

    .tc-bot-foot{
      padding:10px 12px 12px; border-top:1px solid #e6dcc0; background:#fdfbf3;
    }
    .tc-bot-form{ display:flex; gap:8px; align-items:flex-end; }
    .tc-bot-input{
      flex:1; resize:none; min-height:42px; max-height:120px;
      padding:10px 12px; border:1px solid #d6c89a; border-radius:8px;
      background:#fff; font-family:inherit; font-size:14.5px; color:#2a2a2a;
      line-height:1.4; outline:none;
    }
    .tc-bot-input:focus{ border-color:#14213d; box-shadow:0 0 0 3px rgba(20,33,61,.12); }
    .tc-bot-send{
      background:#c1272d; color:#fdfbf3; border:none; cursor:pointer;
      width:42px; height:42px; border-radius:8px; padding:0;
      display:flex; align-items:center; justify-content:center;
      transition:background .15s ease;
    }
    .tc-bot-send:hover{ background:#9a1f24; }
    .tc-bot-send:disabled{ background:#b8b0a0; cursor:not-allowed; }
    .tc-bot-send svg{ width:18px; height:18px; }
    .tc-bot-hint{ font-size:11.5px; color:#8a8a8a; margin-top:6px; text-align:center; }

    @media (max-width:520px){
      .tc-bot-panel{
        right:0; bottom:0; left:0; top:0;
        width:100%; height:100%; max-width:100vw; max-height:100vh;
        border-radius:0;
      }
      .tc-bot-bubble{ right:16px; bottom:16px; }
    }
    @media print{
      .tc-bot-bubble, .tc-bot-panel{ display:none !important; }
    }
  `;

  function injectStyles() {
    if (document.getElementById('tc-bot-styles')) return;
    const s = document.createElement('style');
    s.id = 'tc-bot-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------- DOM ----------
  function buildWidget() {
    const bubble = document.createElement('button');
    bubble.className = 'tc-bot-bubble';
    bubble.setAttribute('aria-label', 'Open Counter Helper chat');
    bubble.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
      <span class="tc-bot-dot" aria-hidden="true"></span>
    `;

    const panel = document.createElement('div');
    panel.className = 'tc-bot-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Counter Helper chat');
    panel.innerHTML = `
      <div class="tc-bot-head">
        <div class="tc-bot-head-mark">TC</div>
        <div class="tc-bot-head-text">
          <div class="tc-bot-head-title">Counter Helper</div>
          <div class="tc-bot-head-sub">Ask about the shop, drops, or rewards</div>
        </div>
        <button class="tc-bot-close" aria-label="Close chat">&times;</button>
      </div>
      <div class="tc-bot-body" id="tcBotBody"></div>
      <div class="tc-bot-foot">
        <form class="tc-bot-form" id="tcBotForm">
          <textarea class="tc-bot-input" id="tcBotInput" rows="1" placeholder="Type a question..." maxlength="1000"></textarea>
          <button type="submit" class="tc-bot-send" id="tcBotSend" aria-label="Send message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
        <div class="tc-bot-hint">Powered by AI · For shop info, call (616) 555-0100</div>
      </div>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(panel);
    return { bubble, panel };
  }

  // ---------- State + render ----------
  let isOpen = false;
  let isSending = false;
  let lastSentAt = 0;
  let messageCount = 0;
  let messages = []; // [{role, content}]

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function render(bodyEl) {
    bodyEl.innerHTML = messages.map(m => {
      const cls = m.role === 'user' ? 'tc-bot-msg-user' : (m.error ? 'tc-bot-msg-error' : 'tc-bot-msg-bot');
      return `<div class="tc-bot-msg ${cls}">${escapeHtml(m.content)}</div>`;
    }).join('');
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function pushMessage(role, content, opts) {
    messages.push(Object.assign({ role, content }, opts || {}));
    saveHistory(messages);
  }

  function showTyping(bodyEl) {
    const t = document.createElement('div');
    t.className = 'tc-bot-typing';
    t.id = 'tcBotTyping';
    t.innerHTML = '<span></span><span></span><span></span>';
    bodyEl.appendChild(t);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function hideTyping() {
    const t = document.getElementById('tcBotTyping');
    if (t) t.remove();
  }

  // ---------- Send ----------
  async function sendMessage(text, els) {
    const now = Date.now();
    if (isSending) return;
    if (now - lastSentAt < MIN_MS_BETWEEN_SENDS) {
      const wait = Math.ceil((MIN_MS_BETWEEN_SENDS - (now - lastSentAt)) / 1000);
      pushMessage('assistant', `Slow down a sec — try again in ${wait}s.`, { error: true });
      render(els.body);
      return;
    }
    if (messageCount >= MAX_MESSAGES_PER_SESSION) {
      pushMessage('assistant', "We've chatted a lot today. Give the shop a call at (616) 555-0100 for anything else.", { error: true });
      render(els.body);
      return;
    }

    isSending = true;
    lastSentAt = now;
    messageCount++;
    els.send.disabled = true;
    els.input.value = '';
    els.input.style.height = 'auto';

    pushMessage('user', text);
    render(els.body);
    showTyping(els.body);

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          sessionId: getSessionId(),
          userEmail: getUserEmail()
        })
      });
      hideTyping();

      let data = {};
      try { data = await resp.json(); } catch (_) {}

      if (!resp.ok || !data.reply) {
        pushMessage('assistant', data.reply || "I'm having trouble right now — give the shop a call or try again in a sec.", { error: true });
      } else {
        pushMessage('assistant', data.reply);
      }
      render(els.body);
    } catch (e) {
      hideTyping();
      pushMessage('assistant', "Connection trouble. Try again in a sec.", { error: true });
      render(els.body);
    } finally {
      isSending = false;
      els.send.disabled = false;
      els.input.focus();
    }
  }

  // ---------- Wire ----------
  function open(els) {
    isOpen = true;
    els.bubble.classList.add('is-open');
    els.panel.classList.add('is-open');
    setTimeout(() => els.input.focus(), 50);
  }
  function close(els) {
    isOpen = false;
    els.bubble.classList.remove('is-open');
    els.panel.classList.remove('is-open');
  }

  function init() {
    injectStyles();
    const { bubble, panel } = buildWidget();
    const body = panel.querySelector('#tcBotBody');
    const input = panel.querySelector('#tcBotInput');
    const send = panel.querySelector('#tcBotSend');
    const form = panel.querySelector('#tcBotForm');
    const closeBtn = panel.querySelector('.tc-bot-close');
    const els = { bubble, panel, body, input, send };

    // Hydrate history (within same tab session)
    messages = getHistory();
    if (!messages.length) {
      messages = [{ role: 'assistant', content: WELCOME }];
      saveHistory(messages);
    }
    render(body);

    bubble.addEventListener('click', () => open(els));
    closeBtn.addEventListener('click', () => close(els));

    // Escape closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) close(els);
    });

    // Autosize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(120, input.scrollHeight) + 'px';
    });

    // Enter sends (Shift+Enter = newline)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      sendMessage(text, els);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
