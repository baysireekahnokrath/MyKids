// รหัส 4 หลักของลูกแต่ละคน (ตั้งเองครั้งแรก เก็บในเครื่องนี้เท่านั้น)
// หมายเหตุ: เป็นตัวล็อกกันพี่น้องเปิดของกัน ไม่ใช่ระบบความปลอดภัยระดับสูง
// เพราะเว็บนี้เป็นไฟล์สาธารณะ — เนื้อหาในแอปจึงต้องไม่เป็นความลับ

const SALT = 'mykids-v1';

// แฮชของ "รหัสผู้ปกครอง" (ใช้รีเซ็ตรหัสลูกที่ลืม) — ตัวรหัสจริงไม่ได้อยู่ในโค้ด
const PARENT_HASH = 'c9181bf82cee5ab643b19eec8ec94bcfae3b3a9207bfdbe74c3d926f083e89e2';

export const PIN_LENGTH = 4;
export const PARENT_LENGTH = 6;

// ---------- เก็บข้อมูล (มีตัวสำรองถ้าเบราว์เซอร์ไม่ให้เขียน) ----------
const mem = { local: {}, session: {} };

function read(store, key) {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return mem[store][key] ?? null;
  }
}

function write(store, key, value) {
  mem[store][key] = value;
  try {
    const s = store === 'local' ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key); else s.setItem(key, value);
  } catch { /* ใช้ค่าในหน่วยความจำแทน */ }
}

// ---------- แฮช ----------
export async function sha256(text) {
  try {
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* ไปใช้วิธีสำรอง */ }
  // สำรอง (เช่น เปิดผ่าน http ธรรมดา): FNV-1a
  let h = 2166136261;
  for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return `f${(h >>> 0).toString(16)}`;
}

const pinKey = (kid) => `mykids.pin.${kid}`;
const hashPin = (kid, pin) => sha256(`${SALT}:${kid}:${pin}`);

export const hasPin = (kid) => !!read('local', pinKey(kid));

export async function setPin(kid, pin) {
  write('local', pinKey(kid), await hashPin(kid, pin));
}

export async function checkPin(kid, pin) {
  const stored = read('local', pinKey(kid));
  return !!stored && stored === await hashPin(kid, pin);
}

export function clearPin(kid) {
  write('local', pinKey(kid), null);
}

export async function checkParentCode(code) {
  const h = await sha256(`${SALT}:parent:${code}`);
  // ถ้าเครื่องนี้ใช้แฮชสำรอง (ไม่มี crypto.subtle) จะตรวจรหัสผู้ปกครองไม่ได้
  return h === PARENT_HASH;
}

// ---------- ปลดล็อกในรอบนี้ (ปิดแท็บ/ปิดแอป = ล็อกใหม่) ----------
const SESSION_KEY = 'mykids.unlocked';

function unlockedList() {
  try { return JSON.parse(read('session', SESSION_KEY) || '[]'); } catch { return []; }
}

export const isUnlocked = (kid) => unlockedList().includes(kid);

export function unlock(kid) {
  const list = unlockedList();
  if (!list.includes(kid)) write('session', SESSION_KEY, JSON.stringify([...list, kid]));
}

export function lock(kid) {
  write('session', SESSION_KEY, JSON.stringify(unlockedList().filter((k) => k !== kid)));
}
