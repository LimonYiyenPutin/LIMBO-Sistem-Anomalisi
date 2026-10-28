'use strict';

(function () {
  const q = new URLSearchParams(location.search);
  const title = q.get('title') || 'LIMBO_OS';
  const body = q.get('body') || '';
  const tag = q.get('tag') || 'SYSTEM FAULT';
  const severity = q.get('severity') || 'error';
  const glitch = q.get('glitch') !== '0';
  let buttons = ['TAMAM'];
  try {
    const parsed = JSON.parse(q.get('buttons') || '["TAMAM"]');
    if (Array.isArray(parsed) && parsed.length) buttons = parsed.slice(0, 3);
  } catch (_) {}

  document.body.dataset.severity = severity;
  document.body.dataset.glitch = glitch ? '1' : '0';
  document.title = title;
  document.getElementById('title').textContent = title;
  document.getElementById('tag').textContent = tag;
  document.getElementById('message').textContent = body;

  const iconEl = document.getElementById('dialogIcon');
  iconEl.textContent = severity === 'ghost' ? '†' : severity === 'boss' ? '☠' : severity === 'warn' ? '!' : severity === 'info' ? 'i' : '!';

  const statusRight = document.getElementById('statusRight');
  const pids = ['PID 0x0009', 'PID 0x1A4F', 'PID 0xDEAD', 'PID 0x0F12', 'PID UNKNOWN'];
  statusRight.textContent = pids[Math.floor(Math.random() * pids.length)];

  const btnWrap = document.getElementById('buttons');
  btnWrap.replaceChildren();
  let puzzle = null;
  try {
    const parsed = JSON.parse(q.get('puzzle') || 'null');
    if (Array.isArray(parsed) && parsed.length >= 2) puzzle = parsed.map(String).slice(0, 6);
  } catch (_) {}
  if (puzzle) {
    const pad = document.getElementById('puzzle');
    pad.hidden = false;
    document.getElementById('buttons').hidden = true;
    setupPuzzle(puzzle);
  } else {
    buttons.forEach((label, index) => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (index === 0 ? ' primary' : '');
      btn.textContent = String(label);
      btn.addEventListener('click', () => {
        try { window.popupAPI && window.popupAPI.close(); } catch (_) {}
      });
      btnWrap.appendChild(btn);
    });
  }

  function setupPuzzle(seq) {
    const grid = document.getElementById('puzzleGrid');
    const display = document.getElementById('puzzleDisplay');
    const state = document.getElementById('puzzleState');
    const note = document.getElementById('puzzleNote');
    let entered = [];
    let locked = false;
    const values = seq.slice();
    // Decoys make the sequence a real choice instead of a single button.
    const decoyPool = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X', 'E'];
    while (values.length < 9) {
      const d = decoyPool[Math.floor(Math.random() * decoyPool.length)];
      values.push(d);
    }
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    const render = () => {
      display.textContent = entered.map((c) => c).join(' ') + (entered.length < seq.length ? ' ' + '_ '.repeat(seq.length - entered.length).trim() : '');
      state.textContent = `${entered.length} / ${seq.length}`;
    };
    render();
    values.forEach((value) => {
      const btn = document.createElement('button');
      btn.className = 'pbtn';
      btn.textContent = value;
      btn.addEventListener('click', () => {
        if (locked) return;
        if (value === seq[entered.length]) {
          entered.push(value);
          btn.classList.add('ok');
          note.textContent = 'PARÇA KABUL EDİLDİ.';
          render();
          if (entered.length === seq.length) {
            locked = true;
            note.textContent = 'ERİŞİM ONAYLANDI.';
            document.body.classList.add('solved');
            try { window.popupAPI && window.popupAPI.solve(seq.join('')); } catch (_) {}
          }
        } else {
          entered = [];
          note.textContent = 'HATALI SIRA // SIFIRLANDI.';
          document.body.classList.remove('shake');
          void document.body.offsetWidth;
          document.body.classList.add('shake');
          render();
        }
      });
      grid.appendChild(btn);
    });
  }
  document.getElementById('closeX').addEventListener('click', () => {
    try { window.popupAPI && window.popupAPI.close(); } catch (_) {}
  });

  // Occasional content corruption for certain severities.
  if (glitch && severity !== 'info') {
    const replacements = {
      'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '$', 't': '7'
    };
    setTimeout(() => {
      const el = document.getElementById('message');
      let n = 0;
      const interval = setInterval(() => {
        n++;
        if (n > 5) { clearInterval(interval); el.textContent = body; return; }
        el.textContent = body.replace(/[aeiost]/gi, (c) => Math.random() < 0.45 ? replacements[c.toLowerCase()] || c : c);
        setTimeout(() => { el.textContent = body; }, 70);
      }, 1700);
    }, 2300);
  }
})();
