// เครื่องมือเล็กๆ: เก็บความคืบหน้า, วันที่ (เวลาไทย), เสียงอ่านภาษาไทย

// ---------- เก็บความคืบหน้าในเครื่อง (localStorage) ----------
const KEY = 'mykids.v1';
let memory = {};

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return memory;
  }
}

function writeAll(data) {
  memory = data;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* เก็บในหน่วยความจำแทน ถ้าเบราว์เซอร์ไม่ให้เขียน */
  }
}

export function getProgress(key) {
  return readAll()[key] ?? null;
}

export function setProgress(key, value) {
  const all = readAll();
  all[key] = value;
  writeAll(all);
}

// ---------- วันที่ (เขตเวลา Asia/Bangkok) ----------
const TZ = 'Asia/Bangkok';

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function dayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function daysUntil(iso, from = todayISO()) {
  return dayNumber(iso) - dayNumber(from);
}

export function thaiDate(iso, withWeekday = true) {
  const d = new Date(`${iso}T12:00:00+07:00`);
  return d.toLocaleDateString('th-TH', {
    timeZone: TZ, day: 'numeric', month: 'short', ...(withWeekday ? { weekday: 'short' } : {}),
  });
}

export function thaiDateRange(item) {
  if (!item.end) return thaiDate(item.date);
  return `${thaiDate(item.date)} – ${thaiDate(item.end)}`;
}

// ข้อความนับถอยหลัง + สถานะ ('today' | 'soon' | 'later' | 'past')
export function countdown(item, today = todayISO()) {
  const last = item.end || item.date;
  const toStart = daysUntil(item.date, today);
  const toEnd = daysUntil(last, today);
  if (toEnd < 0) return { text: 'ผ่านไปแล้ว', state: 'past', days: toEnd };
  if (toStart <= 0) return { text: 'วันนี้!', state: 'today', days: 0 };
  if (toStart === 1) return { text: 'พรุ่งนี้', state: 'soon', days: 1 };
  return { text: `อีก ${toStart} วัน`, state: toStart <= 3 ? 'soon' : 'later', days: toStart };
}

// ---------- เสียงอ่านภาษาไทย (Web Speech API) ----------
function thaiVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith('th')) || null;
}

if ('speechSynthesis' in window) {
  // บางเครื่องโหลดรายการเสียงช้า
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {});
  window.speechSynthesis.getVoices();
}

// คืนค่า true ถ้าเริ่มอ่านได้, false ถ้าเครื่องนี้ไม่มีเสียงไทย
export function speak(text, rate = 0.75) {
  const voice = thaiVoice();
  if (!voice) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'th-TH';
  u.voice = voice;
  u.rate = rate;
  window.speechSynthesis.speak(u);
  return true;
}

// อ่านหลายบรรทัดต่อกัน (เช่น อาขยานทั้งบท)
export function speakLines(lines, rate = 0.7) {
  const voice = thaiVoice();
  if (!voice) return false;
  window.speechSynthesis.cancel();
  lines.forEach((line) => {
    const u = new SpeechSynthesisUtterance(line);
    u.lang = 'th-TH';
    u.voice = voice;
    u.rate = rate;
    window.speechSynthesis.speak(u);
  });
  return true;
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// ---------- อื่นๆ ----------
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}
