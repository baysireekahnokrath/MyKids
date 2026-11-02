import { KIDS, SCHEDULE, PRACTICE, DICTATION, POEMS, FRACTION_WORKSHEETS } from './data/content.js';
import {
  getProgress, setProgress, todayISO, thaiDate, thaiDateRange, countdown,
  speak, speakLines, stopSpeaking, shuffle, toast,
} from './util.js';
import { createScratchpad } from './scratchpad.js';
import * as Fr from './fractions.js';
import * as Auth from './auth.js';
import {
  PALETTES, NEUTRAL, getTheme, applyTheme, openThemePicker, avatar,
} from './theme.js';

const app = document.getElementById('app');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// ธีมของลูกแต่ละคน (ถ้ายังไม่เคยเลือก ใช้ค่าเริ่มต้นของคนนั้น)
const themeOf = (kidId) => getTheme(kidId, KIDS[kidId].theme);

let cleanup = null; // ล้างตัวฟังคีย์บอร์ด ฯลฯ ของหน้าก่อนหน้า

function mount(html, kidId) {
  stopSpeaking();
  if (cleanup) { cleanup(); cleanup = null; }
  applyTheme(kidId ? themeOf(kidId) : NEUTRAL);
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

const topbar = (backHref, backLabel, actions = '') => `
  <header class="topbar">
    <a class="back" href="${backHref}">← ${backLabel}</a>
    ${actions ? `<div class="topbar-actions">${actions}</div>` : ''}
  </header>`;

// ---------- หน้าแรก ----------
function upcoming(kidId) {
  const today = todayISO();
  return (SCHEDULE[kidId] || [])
    .map((item) => ({ ...item, cd: countdown(item, today) }))
    .filter((item) => item.cd.state !== 'past');
}

function nextImportant(kidId) {
  const list = upcoming(kidId);
  return list.find((i) => i.kind !== 'practice') || list[0] || null;
}

function renderHome() {
  const cards = Object.values(KIDS).map((kid) => {
    const theme = themeOf(kid.id);
    const p = PALETTES.find((x) => x.id === theme.palette) || PALETTES[0];
    const unlocked = Auth.isUnlocked(kid.id);
    let nextHTML;
    if (!unlocked) {
      nextHTML = `<div class="next lock-note">🔒 ${Auth.hasPin(kid.id) ? 'ใส่รหัสของ ' + kid.name + ' เพื่อเข้า' : 'แตะเพื่อตั้งรหัสของ ' + kid.name}</div>`;
    } else {
      const next = nextImportant(kid.id);
      nextHTML = next
        ? `<div class="next"><span class="next-label">ถัดไป</span> ${esc(next.title)} <strong class="cd cd-${next.cd.state}">${next.cd.text}</strong></div>`
        : '<div class="next muted">ยังไม่มีกำหนดการ</div>';
    }
    return `
      <a class="kid-card" href="#/k/${kid.id}" style="--c:${p.main};--c2:${p.c2};--soft:${p.soft};--deep:${p.deep}">
        <div class="avatar" aria-hidden="true">${avatar(theme, 72)}</div>
        <div class="kid-info"><h2>${kid.name}</h2><p>${kid.grade}</p></div>
        ${nextHTML}
      </a>`;
  }).join('');

  mount(`
    <main class="wrap">
      <header class="home-head">
        <h1>MyKids <span>ฝึกทบทวน</span></h1>
        <p>วันนี้ ${thaiDate(todayISO())}</p>
      </header>
      <h2 class="section-title">ใครจะฝึกวันนี้?</h2>
      <div class="kid-grid">${cards}</div>
      <p class="foot">เขียนด้วยนิ้วหรือ Apple Pencil ได้ · รหัสและความคืบหน้าเก็บไว้ในเครื่องนี้</p>
    </main>`, null);
}

// ---------- ใส่รหัสของใครของมัน ----------
function renderPin(kidId) {
  const kid = KIDS[kidId];
  const theme = themeOf(kidId);
  let mode = Auth.hasPin(kidId) ? 'enter' : 'create';
  let entered = '';
  let first = '';
  let busy = false;
  let fails = 0;
  let blockedUntil = 0;

  mount(`
    <main class="wrap">
      ${topbar('#/', 'กลับ')}
      <section class="pin-card">
        <div class="avatar big" aria-hidden="true">${avatar(theme, 96)}</div>
        <h1 id="pin-title"></h1>
        <p id="pin-sub" class="lead"></p>
        <div id="dots" class="dots" aria-hidden="true"></div>
        <div class="keypad" role="group" aria-label="แป้นตัวเลข">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="key" data-k="${n}">${n}</button>`).join('')}
          <span></span>
          <button type="button" class="key" data-k="0">0</button>
          <button type="button" class="key key-fn" data-k="back" aria-label="ลบ">⌫</button>
        </div>
        <p id="pin-msg" class="pin-msg" role="alert"></p>
        <button type="button" class="link-btn" id="forgot"></button>
      </section>
    </main>`, kidId);

  const $ = (s) => app.querySelector(s);
  const need = () => (mode === 'parent' ? Auth.PARENT_LENGTH : Auth.PIN_LENGTH);

  function paint(message = '') {
    const titles = {
      enter: `สวัสดี ${kid.name}!`,
      create: `ตั้งรหัสของ ${kid.name}`,
      confirm: 'ใส่รหัสเดิมอีกครั้ง',
      parent: 'สำหรับผู้ปกครอง',
    };
    const subs = {
      enter: 'ใส่รหัส 4 หลักของหนูเพื่อเข้าฝึก',
      create: 'เลือกเลข 4 หลักที่จำง่าย ใช้ทุกครั้งที่เข้าแอป (ไม่บอกคนอื่นนะ)',
      confirm: 'พิมพ์เลข 4 หลักเดิมอีกครั้งเพื่อยืนยัน',
      parent: 'ใส่รหัสผู้ปกครอง 6 หลัก เพื่อรีเซ็ตรหัสของ ' + kid.name,
    };
    $('#pin-title').textContent = titles[mode];
    $('#pin-sub').textContent = subs[mode];
    $('#dots').innerHTML = Array.from({ length: need() }, (_, i) => `<span class="dot ${i < entered.length ? 'on' : ''}"></span>`).join('');
    $('#pin-msg').textContent = message;
    $('#forgot').textContent = mode === 'parent' ? '← กลับไปใส่รหัสของหนู' : (mode === 'enter' ? 'ลืมรหัส? ให้ผู้ใหญ่ช่วย' : '');
    $('#forgot').hidden = mode === 'create' || mode === 'confirm';
  }

  function shake(message) {
    const card = $('.pin-card');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    entered = '';
    paint(message);
  }

  async function submit() {
    busy = true;
    try {
      if (mode === 'create') {
        first = entered; entered = ''; mode = 'confirm'; paint();
      } else if (mode === 'confirm') {
        if (entered === first) {
          await Auth.setPin(kidId, entered);
          Auth.unlock(kidId);
          route();
        } else {
          first = ''; mode = 'create'; shake('เลขสองครั้งไม่ตรงกัน ลองตั้งใหม่นะ');
        }
      } else if (mode === 'enter') {
        if (Date.now() < blockedUntil) {
          shake('พักก่อนนะ ลองใหม่อีกสักครู่');
        } else if (await Auth.checkPin(kidId, entered)) {
          Auth.unlock(kidId);
          route();
        } else {
          fails += 1;
          if (fails >= 5) { blockedUntil = Date.now() + 30000; fails = 0; shake('ใส่ผิดหลายครั้งแล้ว พัก 30 วินาทีนะ'); } else shake('รหัสไม่ถูก ลองอีกครั้ง');
        }
      } else if (mode === 'parent') {
        if (await Auth.checkParentCode(entered)) {
          Auth.clearPin(kidId);
          mode = 'create'; entered = ''; paint(`รีเซ็ตแล้ว — ให้ ${kid.name} ตั้งรหัสใหม่ได้เลย`);
        } else {
          shake('รหัสผู้ปกครองไม่ถูกต้อง');
        }
      }
    } finally {
      busy = false;
    }
  }

  async function press(k) {
    if (busy) return;
    if (k === 'back') { entered = entered.slice(0, -1); paint(); return; }
    if (entered.length >= need()) return;
    entered += k;
    paint();
    if (entered.length === need()) await submit();
  }

  app.querySelector('.keypad').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) press(b.dataset.k);
  });
  $('#forgot').addEventListener('click', () => {
    entered = '';
    mode = mode === 'parent' ? 'enter' : 'parent';
    paint();
  });
  const onKey = (e) => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
  };
  window.addEventListener('keydown', onKey);
  cleanup = () => window.removeEventListener('keydown', onKey);
  paint();
}

// ---------- หน้าของลูกแต่ละคน ----------
function renderKid(kidId) {
  const kid = KIDS[kidId];
  const all = SCHEDULE[kidId] || [];
  const today = todayISO();
  const rows = all.map((item) => ({ ...item, cd: countdown(item, today) }));
  const coming = rows.filter((r) => r.cd.state !== 'past');
  const past = rows.filter((r) => r.cd.state === 'past');

  const rowHTML = (r) => `
    <li class="sched ${r.cd.state === 'past' ? 'is-past' : ''}">
      <div class="sched-date"><span>${esc(thaiDateRange(r))}</span></div>
      <div class="sched-main">
        <div class="sched-title"><span class="kind kind-${r.kind}">${{ exam: 'สอบ', submit: 'ส่งงาน', practice: 'ฝึก', todo: 'ต้องทำ' }[r.kind]}</span> ${esc(r.title)}</div>
        ${r.scope ? `<div class="sched-scope">${esc(r.scope)}</div>` : ''}
      </div>
      <div class="cd cd-${r.cd.state}">${r.cd.text}</div>
    </li>`;

  const practice = (PRACTICE[kidId] || []).map((p) => {
    if (p.type === 'soon') {
      return `<div class="practice-card is-soon"><div class="p-icon">${p.icon}</div><div><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p></div></div>`;
    }
    const progress = practiceStatus(kidId, p);
    return `
      <a class="practice-card" href="#/k/${kidId}/${p.id}">
        <div class="p-icon">${p.icon}</div>
        <div><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p>${progress ? `<p class="p-progress">${progress}</p>` : ''}</div>
      </a>`;
  }).join('');

  mount(`
    <main class="wrap">
      ${topbar('#/', 'หน้าแรก', `
        <button type="button" class="back" id="btn-theme">🎨 ธีมของฉัน</button>
        <button type="button" class="back" id="btn-lock">🔒 ล็อก</button>`)}
      <section class="hero">
        <div class="avatar big" id="hero-avatar" aria-hidden="true">${avatar(themeOf(kidId), 96)}</div>
        <div><h1>${kid.name}</h1><p>${kid.grade}</p></div>
      </section>
      <h2 class="section-title">ฝึกเลย</h2>
      <div class="practice-grid">${practice}</div>
      <h2 class="section-title">กำหนดการสอบ/ส่งงาน</h2>
      ${coming.length ? `<ul class="sched-list">${coming.map(rowHTML).join('')}</ul>` : '<p class="muted">ยังไม่มีกำหนดการ</p>'}
      ${past.length ? `<details class="past"><summary>ที่ผ่านไปแล้ว (${past.length})</summary><ul class="sched-list">${past.map(rowHTML).join('')}</ul></details>` : ''}
    </main>`, kidId);

  document.getElementById('btn-theme').addEventListener('click', () => {
    openThemePicker(kidId, (theme) => {
      document.getElementById('hero-avatar').innerHTML = avatar(theme, 96);
    });
  });
  document.getElementById('btn-lock').addEventListener('click', () => {
    Auth.lock(kidId);
    location.hash = '#/';
  });
}

function practiceStatus(kidId, p) {
  if (p.type === 'dict') {
    const sets = DICTATION[kidId] || [];
    const done = sets.filter((s) => getProgress(`${kidId}.dict.${s.id}`)?.firstTry === s.words.length).length;
    return `ถูกหมดทุกคำแล้ว ${done}/${sets.length} ครั้ง`;
  }
  if (p.type === 'poem') {
    const poems = POEMS[kidId] || [];
    const done = poems.filter((x) => getProgress(`${kidId}.poem.${x.id}`)?.memorized).length;
    return `ท่องได้แล้ว ${done}/${poems.length} บท`;
  }
  if (p.type === 'frac') {
    const best = getProgress(`${kidId}.frac.ws9`);
    return best ? `ใบงานชุดที่ 9 ทำได้ดีที่สุด ${best.score}/${best.total}` : '';
  }
  return '';
}

// ---------- เขียนไทย (ฟังคำแล้วเขียน) ----------
function renderDictList(kidId) {
  const kid = KIDS[kidId];
  const sets = DICTATION[kidId] || [];
  const items = sets.map((s) => {
    const pr = getProgress(`${kidId}.dict.${s.id}`);
    const cd = countdown({ date: s.date }, todayISO());
    const status = pr
      ? `<span class="badge ${pr.firstTry === s.words.length ? 'badge-ok' : 'badge-mid'}">ถูกครั้งแรก ${pr.firstTry}/${pr.total}</span>`
      : '<span class="badge">ยังไม่ได้ฝึก</span>';
    return `
      <a class="set-card" href="#/k/${kidId}/dict/${s.id}">
        <div class="set-num">${s.id}</div>
        <div class="set-main">
          <h3>ครั้งที่ ${s.id} <small>${thaiDate(s.date)} · ${cd.state === 'past' ? 'ผ่านไปแล้ว' : cd.text}</small></h3>
          <p>${esc(s.unit)} · ${s.words.length} คำ</p>
        </div>
        ${status}
      </a>`;
  }).join('');
  mount(`
    <main class="wrap">
      ${topbar(`#/k/${kidId}`, kid.name)}
      <h1 class="page-title">✍️ เขียนไทย ชุดที่ 1</h1>
      <p class="lead">เลือกครั้งที่จะฝึก — ฟังคำแล้วเขียนลงในช่องเขียน จากนั้นกดดูคำตอบเพื่อตรวจ</p>
      <div class="set-list">${items}</div>
    </main>`, kidId);
}

function renderDictSet(kidId, setId) {
  const kid = KIDS[kidId];
  const set = (DICTATION[kidId] || []).find((s) => String(s.id) === String(setId));
  if (!set) { location.hash = `#/k/${kidId}/dict`; return; }

  mount(`
    <main class="wrap">
      ${topbar(`#/k/${kidId}/dict`, 'เขียนไทย')}
      <h1 class="page-title">ครั้งที่ ${set.id} <small>${esc(set.unit)}</small></h1>
      <div class="seg" role="tablist">
        <button type="button" role="tab" class="seg-btn active" data-mode="write" aria-selected="true">✍️ เขียนตามเสียง</button>
        <button type="button" role="tab" class="seg-btn" data-mode="study" aria-selected="false">👀 ทบทวนคำ</button>
      </div>
      <div id="host"></div>
    </main>`, kidId);

  const host = document.getElementById('host');
  const tabs = app.querySelectorAll('.seg-btn');
  const setMode = (mode) => {
    tabs.forEach((t) => {
      const on = t.dataset.mode === mode;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    if (mode === 'write') startWrite(host, kidId, set);
    else startStudy(host, set);
  };
  tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
  setMode('write');
}

function startStudy(host, set) {
  host.innerHTML = `
    <div class="row between">
      <p class="lead">อ่านและฟังคำให้คุ้น แล้วลองซ่อนคำดูว่าเขียนได้ไหม</p>
      <label class="switch"><input type="checkbox" id="hide"> ซ่อนคำ (แตะเพื่อดู)</label>
    </div>
    <ul class="word-grid">
      ${set.words.map((w, i) => `
        <li><button type="button" class="word-chip" data-i="${i}"><span class="w">${esc(w)}</span></button>
        <button type="button" class="mini-speak" data-say="${i}" aria-label="ฟังคำ ${esc(w)}">🔊</button></li>`).join('')}
    </ul>`;
  const hide = host.querySelector('#hide');
  const chips = host.querySelectorAll('.word-chip');
  hide.addEventListener('change', () => chips.forEach((c) => c.classList.toggle('covered', hide.checked)));
  chips.forEach((c) => c.addEventListener('click', () => { if (hide.checked) c.classList.toggle('covered'); }));
  host.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => {
    if (!speak(set.words[Number(b.dataset.say)])) toast('เครื่องนี้ไม่มีเสียงภาษาไทย ให้พ่อแม่อ่านให้ฟังแทนนะ');
  }));
}

function startWrite(host, kidId, set) {
  let queue = shuffle(set.words).map((w) => ({ w, wrong: false }));
  const total = queue.length;
  let firstTry = 0;
  let cleared = 0;
  const tricky = [];
  const pad = createScratchpad({ title: 'เขียนคำที่ได้ยิน', hint: 'เขียนด้วยนิ้วหรือ Apple Pencil', height: 230 });

  host.innerHTML = `
    <div class="stage-top"><span id="count"></span><span id="score"></span></div>
    <div class="word-card">
      <button type="button" id="listen" class="btn btn-big">🔊 ฟังคำ</button>
      <div id="answer" class="answer" aria-live="polite"></div>
      <div class="row center">
        <button type="button" id="reveal" class="btn">👁 ดูคำตอบ</button>
      </div>
      <div id="verdict" class="verdict" hidden>
        <button type="button" id="ok" class="btn btn-ok">เขียนถูก ✅</button>
        <button type="button" id="no" class="btn btn-no">ยังไม่ถูก ❌</button>
      </div>
    </div>
    <div id="padhost"></div>`;
  host.querySelector('#padhost').appendChild(pad.el);

  const $ = (s) => host.querySelector(s);
  const answer = $('#answer');

  function say() {
    if (!queue.length) return;
    if (!speak(queue[0].w)) toast('เครื่องนี้ไม่มีเสียงภาษาไทย ให้พ่อแม่อ่านคำให้ แล้วกด “ดูคำตอบ” เพื่อตรวจ');
  }

  function show(autoSpeak) {
    if (!queue.length) { finish(); return; }
    pad.clear();
    $('#count').textContent = `คำที่ ${cleared + 1} / ${total}`;
    $('#score').textContent = `ถูกครั้งแรก ${firstTry}`;
    answer.textContent = 'เขียนคำที่ได้ยินลงในช่องด้านล่าง แล้วกด “ดูคำตอบ”';
    answer.classList.remove('shown');
    $('#reveal').hidden = false;
    $('#verdict').hidden = true;
    if (autoSpeak) say();
  }

  function finish() {
    const key = `${kidId}.dict.${set.id}`;
    const prev = getProgress(key);
    if (!prev || firstTry >= prev.firstTry) setProgress(key, { firstTry, total, at: Date.now() });
    const perfect = firstTry === total;
    host.innerHTML = `
      <div class="result">
        <div class="result-emoji">${perfect ? '🌟' : '👍'}</div>
        <h2>${perfect ? 'เก่งมาก! ถูกหมดเลย' : 'ทำได้ดีมาก!'}</h2>
        <p class="big-score">ถูกตั้งแต่ครั้งแรก ${firstTry} / ${total} คำ</p>
        ${tricky.length ? `<p>คำที่ควรฝึกอีกหน่อย:</p><ul class="tricky">${tricky.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
        <div class="row center">
          <button type="button" id="again" class="btn btn-primary">ฝึกอีกรอบ</button>
          <a class="btn" href="#/k/${kidId}/dict">กลับไปเลือกครั้งที่</a>
        </div>
      </div>`;
    host.querySelector('#again').addEventListener('click', () => startWrite(host, kidId, set));
  }

  $('#listen').addEventListener('click', say);
  $('#reveal').addEventListener('click', () => {
    answer.textContent = queue[0].w;
    answer.classList.add('shown');
    $('#reveal').hidden = true;
    $('#verdict').hidden = false;
  });
  $('#ok').addEventListener('click', () => {
    const cur = queue.shift();
    cleared += 1;
    if (!cur.wrong) firstTry += 1;
    show(true);
  });
  $('#no').addEventListener('click', () => {
    const cur = queue.shift();
    if (!cur.wrong) tricky.push(cur.w);
    cur.wrong = true;
    queue.push(cur); // ให้ลองใหม่ตอนท้ายรอบ
    show(true);
  });

  show(false);
}

// ---------- เศษส่วน ----------
function renderFracMenu(kidId) {
  const kid = KIDS[kidId];
  const ws = FRACTION_WORKSHEETS.map((w) => {
    const best = getProgress(`${kidId}.frac.${w.id}`);
    return `
      <a class="set-card" href="#/k/${kidId}/frac/${w.id}">
        <div class="set-num">📄</div>
        <div class="set-main"><h3>${esc(w.title)}</h3><p>${esc(w.subtitle)}</p></div>
        <span class="badge ${best && best.score === best.total ? 'badge-ok' : ''}">${best ? `ดีที่สุด ${best.score}/${best.total}` : 'ยังไม่ได้ทำ'}</span>
      </a>`;
  }).join('');
  mount(`
    <main class="wrap">
      ${topbar(`#/k/${kidId}`, kid.name)}
      <h1 class="page-title">➗ เศษส่วน: เปรียบเทียบ</h1>
      <p class="lead">เติม &gt; &lt; หรือ = ให้ถูก — มีที่ทดเลขให้ใช้ระหว่างทำ และมีวิธีคิดอธิบายหลังตอบทุกข้อ</p>
      <div class="set-list">
        ${ws}
        <a class="set-card" href="#/k/${kidId}/frac/random">
          <div class="set-num">🎲</div>
          <div class="set-main"><h3>สุ่มโจทย์ไม่จำกัด</h3><p>เศษส่วนแท้ · จำนวนคละ · เศษเกิน ปนกัน</p></div>
          <span class="badge">ฝึกได้เรื่อยๆ</span>
        </a>
      </div>
    </main>`, kidId);
}

function renderFracQuiz(kidId, mode) {
  const kid = KIDS[kidId];
  const sheet = FRACTION_WORKSHEETS.find((w) => w.id === mode);
  const random = mode === 'random';
  if (!sheet && !random) { location.hash = `#/k/${kidId}/frac`; return; }

  let problems = random ? [] : sheet.items.map((p, i) => ({ pair: p, no: i + 1 }));
  let index = 0;
  let correct = 0;
  let answered = 0;
  let streak = 0;
  const wrong = [];
  const pad = createScratchpad({ title: 'ที่ทดเลข', hint: 'ทดวิธีคิดด้วยนิ้วหรือ Apple Pencil', height: 250 });

  mount(`
    <main class="wrap">
      ${topbar(`#/k/${kidId}/frac`, 'เศษส่วน')}
      <h1 class="page-title">${random ? '🎲 สุ่มโจทย์' : esc(sheet.title)} <small>${random ? 'ฝึกได้ไม่จำกัด' : esc(sheet.subtitle)}</small></h1>
      <div id="quiz"></div>
    </main>`, kidId);
  const quiz = document.getElementById('quiz');

  function frame() {
    quiz.innerHTML = `
      <div class="stage-top"><span id="count"></span><span id="score"></span></div>
      <div class="problem-card">
        <div id="problem" class="problem" role="group" aria-label="โจทย์"></div>
        <div class="answers" role="group" aria-label="คำตอบ">
          <button type="button" class="rel" data-r=">"><span>&gt;</span><small>มากกว่า</small></button>
          <button type="button" class="rel" data-r="="><span>=</span><small>เท่ากับ</small></button>
          <button type="button" class="rel" data-r="<"><span>&lt;</span><small>น้อยกว่า</small></button>
        </div>
        <div id="feedback" class="feedback" hidden></div>
      </div>
      <div id="padhost"></div>`;
    quiz.querySelector('#padhost').appendChild(pad.el);
    quiz.querySelectorAll('.rel').forEach((b) => b.addEventListener('click', () => answer(b.dataset.r)));
  }

  function next() {
    if (random) {
      problems.push({ pair: Fr.randomProblem(), no: problems.length + 1 });
    }
    return problems[index];
  }

  function show() {
    const cur = next();
    if (!cur) { finish(); return; }
    pad.clear();
    const [a, b] = cur.pair;
    quiz.querySelector('#count').textContent = random ? `ข้อที่ ${index + 1}` : `ข้อ ${index + 1} / ${problems.length}`;
    quiz.querySelector('#score').textContent = random
      ? `ถูก ${correct}/${answered}${streak >= 3 ? ` · 🔥 ติดกัน ${streak}` : ''}`
      : `ถูก ${correct}/${answered}`;
    quiz.querySelector('#problem').innerHTML = `${Fr.numHTML(a)}<span class="box" id="box">?</span>${Fr.numHTML(b)}`;
    const fb = quiz.querySelector('#feedback');
    fb.hidden = true;
    fb.innerHTML = '';
    quiz.querySelectorAll('.rel').forEach((btn) => { btn.disabled = false; btn.classList.remove('picked', 'right', 'bad'); });
  }

  function answer(rel) {
    const cur = problems[index];
    const [a, b] = cur.pair;
    const truth = Fr.compare(a, b);
    const ok = rel === truth;
    answered += 1;
    if (ok) { correct += 1; streak += 1; } else { streak = 0; wrong.push(cur); }
    quiz.querySelector('#box').textContent = truth;
    quiz.querySelector('#box').classList.add(ok ? 'ok' : 'no');
    quiz.querySelectorAll('.rel').forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.r === truth) btn.classList.add('right');
      else if (btn.dataset.r === rel) btn.classList.add('bad');
    });
    quiz.querySelector('#score').textContent = random
      ? `ถูก ${correct}/${answered}${streak >= 3 ? ` · 🔥 ติดกัน ${streak}` : ''}`
      : `ถูก ${correct}/${answered}`;
    const isLast = !random && index === problems.length - 1;
    const fb = quiz.querySelector('#feedback');
    fb.hidden = false;
    fb.className = `feedback ${ok ? 'is-ok' : 'is-no'}`;
    fb.innerHTML = `
      <h3>${ok ? '✅ ถูกต้อง!' : `❌ ยังไม่ใช่ — ที่ถูกคือ ${truth} (${Fr.relWord(truth)})`}</h3>
      <ol class="why">${Fr.explain(a, b).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
      <div class="row">
        <button type="button" id="next" class="btn btn-primary">${isLast ? 'ดูผลคะแนน' : 'ข้อต่อไป →'}</button>
        ${random ? '<a class="btn" href="#/k/' + kidId + '/frac">จบการฝึก</a>' : ''}
      </div>`;
    fb.querySelector('#next').addEventListener('click', () => { index += 1; show(); });
    fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function finish() {
    const total = problems.length;
    const key = `${kidId}.frac.${mode}`;
    const prev = getProgress(key);
    const isFirstRound = !problems.retry;
    if (isFirstRound && (!prev || correct > prev.score)) setProgress(key, { score: correct, total, at: Date.now() });
    const perfect = wrong.length === 0;
    quiz.innerHTML = `
      <div class="result">
        <div class="result-emoji">${perfect ? '🌟' : '👍'}</div>
        <h2>${perfect ? 'เก่งมาก! ถูกทุกข้อ' : 'ทำเสร็จแล้ว!'}</h2>
        <p class="big-score">ถูก ${correct} / ${answered} ข้อ</p>
        ${wrong.length ? `<p>ข้อที่ควรดูอีกครั้ง:</p>
          <ul class="tricky wrongs">${wrong.map((w) => `<li>${esc(Fr.text(w.pair[0]))} ? ${esc(Fr.text(w.pair[1]))} → <b>${esc(Fr.compare(w.pair[0], w.pair[1]))}</b></li>`).join('')}</ul>` : ''}
        <div class="row center">
          ${wrong.length ? '<button type="button" id="retry" class="btn btn-primary">ทำข้อที่ผิดอีกครั้ง</button>' : ''}
          <button type="button" id="restart" class="btn ${wrong.length ? '' : 'btn-primary'}">ทำใหม่ทั้งชุด</button>
          <a class="btn" href="#/k/${kidId}/frac">กลับ</a>
        </div>
      </div>`;
    quiz.querySelector('#restart').addEventListener('click', () => renderFracQuiz(kidId, mode));
    quiz.querySelector('#retry')?.addEventListener('click', () => {
      problems = wrong.splice(0).map((w, i) => ({ pair: w.pair, no: i + 1 }));
      problems.retry = true;
      index = 0; correct = 0; answered = 0; streak = 0;
      frame();
      show();
    });
  }

  frame();
  show();
}

// ---------- อาขยาน ----------
function firstWord(line) {
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter('th', { granularity: 'word' });
      for (const s of seg.segment(line)) { if (s.isWordLike) return s.segment; }
    }
  } catch { /* ใช้วิธีสำรอง */ }
  return line.slice(0, 4);
}

function renderPoemList(kidId) {
  const kid = KIDS[kidId];
  const items = (POEMS[kidId] || []).map((p) => {
    const done = getProgress(`${kidId}.poem.${p.id}`)?.memorized;
    return `
      <a class="set-card" href="#/k/${kidId}/poem/${p.id}">
        <div class="set-num">📜</div>
        <div class="set-main"><h3>${esc(p.title)}</h3><p>${esc(p.set)} · ${p.lines.length} บรรทัด</p></div>
        <span class="badge ${done ? 'badge-ok' : ''}">${done ? 'ท่องได้แล้ว ✅' : 'กำลังฝึก'}</span>
      </a>`;
  }).join('');
  mount(`
    <main class="wrap">
      ${topbar(`#/k/${kidId}`, kid.name)}
      <h1 class="page-title">📜 ท่องอาขยาน</h1>
      <p class="lead">ท่องวันละนิดทุกวัน ซ่อนบรรทัดแล้วลองท่องจากความจำ</p>
      <div class="set-list">${items}</div>
    </main>`, kidId);
}

function renderPoem(kidId, poemId) {
  const kid = KIDS[kidId];
  const poem = (POEMS[kidId] || []).find((p) => p.id === poemId);
  if (!poem) { location.hash = `#/k/${kidId}/poem`; return; }
  const key = `${kidId}.poem.${poem.id}`;
  let mode = 'full';
  let revealed = new Set();

  mount(`
    <main class="wrap">
      ${topbar(`#/k/${kidId}/poem`, 'อาขยาน')}
      <h1 class="page-title">${esc(poem.title)} <small>${esc(poem.author)}</small></h1>
      <div class="seg" role="tablist">
        <button type="button" role="tab" class="seg-btn active" data-mode="full">อ่านทั้งบท</button>
        <button type="button" role="tab" class="seg-btn" data-mode="first">เห็นแค่คำแรก</button>
        <button type="button" role="tab" class="seg-btn" data-mode="hide">ซ่อนทั้งบรรทัด</button>
      </div>
      <ol class="poem" id="poem"></ol>
      <div class="row">
        <button type="button" id="readall" class="btn">🔊 ฟังทั้งบท</button>
        <button type="button" id="reset" class="btn">ซ่อนใหม่</button>
        <label class="switch"><input type="checkbox" id="mem"> ท่องได้แล้ว ✅</label>
      </div>
    </main>`, kidId);

  const list = document.getElementById('poem');
  const tabs = app.querySelectorAll('.seg-btn');
  const mem = document.getElementById('mem');
  mem.checked = !!getProgress(key)?.memorized;

  function draw() {
    list.innerHTML = poem.lines.map((line, i) => {
      const open = mode === 'full' || revealed.has(i);
      let content;
      if (open) content = esc(line);
      else if (mode === 'first') content = `${esc(firstWord(line))} <span class="blank">………</span>`;
      else content = '<span class="blank">＿＿＿＿＿＿＿＿</span>';
      return `<li><button type="button" class="poem-line ${open ? '' : 'covered'}" data-i="${i}" ${mode === 'full' ? 'disabled' : ''}>${content}</button>
        <button type="button" class="mini-speak" data-say="${i}" aria-label="ฟังบรรทัดที่ ${i + 1}">🔊</button></li>`;
    }).join('');
  }

  tabs.forEach((t) => t.addEventListener('click', () => {
    mode = t.dataset.mode;
    revealed = new Set();
    tabs.forEach((x) => { const on = x === t; x.classList.toggle('active', on); x.setAttribute('aria-selected', String(on)); });
    draw();
  }));
  list.addEventListener('click', (e) => {
    const say = e.target.closest('[data-say]');
    if (say) {
      if (!speak(poem.lines[Number(say.dataset.say)])) toast('เครื่องนี้ไม่มีเสียงภาษาไทย');
      return;
    }
    const line = e.target.closest('.poem-line');
    if (!line || mode === 'full') return;
    const i = Number(line.dataset.i);
    if (revealed.has(i)) revealed.delete(i); else revealed.add(i);
    draw();
  });
  document.getElementById('readall').addEventListener('click', () => {
    if (!speakLines(poem.lines)) toast('เครื่องนี้ไม่มีเสียงภาษาไทย ให้พ่อแม่อ่านให้ฟังแทนนะ');
  });
  document.getElementById('reset').addEventListener('click', () => { revealed = new Set(); draw(); });
  mem.addEventListener('change', () => setProgress(key, { memorized: mem.checked, at: Date.now() }));
  draw();
}

// ---------- ตัวจัดเส้นทาง ----------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [root, kidId, section, item] = parts;
  if (root === 'k' && KIDS[kidId]) {
    if (!Auth.isUnlocked(kidId)) return renderPin(kidId); // ของใครของมัน: ต้องใส่รหัสก่อน
    if (!section) return renderKid(kidId);
    const has = (type) => (PRACTICE[kidId] || []).some((p) => p.type === type);
    if (section === 'dict' && has('dict')) return item ? renderDictSet(kidId, item) : renderDictList(kidId);
    if (section === 'frac' && has('frac')) return item ? renderFracQuiz(kidId, item) : renderFracMenu(kidId);
    if (section === 'poem' && has('poem')) return item ? renderPoem(kidId, item) : renderPoemList(kidId);
    return renderKid(kidId);
  }
  return renderHome();
}

window.addEventListener('hashchange', route);
route();
