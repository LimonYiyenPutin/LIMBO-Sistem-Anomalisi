'use strict';

(function () {
  const q = new URLSearchParams(location.search);
  const logEl = document.getElementById('log');
  const codePanel = document.getElementById('codePanel');
  const codeValue = document.getElementById('codeValue');
  const footer = document.getElementById('footer');
  const termTitle = document.getElementById('termTitle');

  termTitle.textContent = q.get('title') || 'SISTEM GUNLUKLERI';
  footer.textContent = q.get('footer') || 'UID 0x0009 // SESSION ACTIVE';
  const initialCode = q.get('code') || '';
  setCode(initialCode);

  let initialLines = [];
  try { initialLines = JSON.parse(q.get('lines') || '[]'); } catch (_) {}
  if (Array.isArray(initialLines)) initialLines.forEach(addLine);

  document.getElementById('closeX').addEventListener('click', () => {
    try { window.popupAPI && window.popupAPI.close(); } catch (_) {}
  });

  if (window.popupAPI && window.popupAPI.onTerminalUpdate) {
    window.popupAPI.onTerminalUpdate((data) => {
      if (!data) return;
      if (data.title) termTitle.textContent = data.title;
      if (data.footer) footer.textContent = data.footer;
      if (Array.isArray(data.lines)) data.lines.forEach(addLine);
      if (typeof data.code === 'string' && data.code) setCode(data.code);
      if (data.clear) logEl.replaceChildren();
      if (data.glitch) {
        document.body.classList.remove('glitch');
        void document.body.offsetWidth;
        document.body.classList.add('glitch');
      }
    });
  }

  function setCode(code) {
    if (!code) { codePanel.classList.add('hidden'); return; }
    codePanel.classList.remove('hidden');
    codeValue.textContent = code;
  }

  function addLine(line) {
    const el = document.createElement('div');
    const kind = line && line.kind ? line.kind : 'normal';
    el.className = 'line ' + kind;
    if (line && line.text === '') { el.className = 'line gap'; }
    else {
      const time = new Date();
      const stamp = [time.getHours(), time.getMinutes(), time.getSeconds()]
        .map((n) => String(n).padStart(2, '0')).join(':');
      if (line && line.noTime) {
        el.textContent = line.text;
      } else {
        const t = document.createElement('span');
        t.className = 't';
        t.textContent = '[' + stamp + ']';
        el.appendChild(t);
        el.appendChild(document.createTextNode(line && line.text != null ? String(line.text) : String(line)));
      }
    }
    logEl.appendChild(el);
    while (logEl.children.length > 160) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function tickClock() {
    const d = new Date();
    const el = document.getElementById('clock');
    if (el) el.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  }
  setInterval(tickClock, 1000);
  tickClock();
})();
