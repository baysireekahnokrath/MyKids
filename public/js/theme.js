// ธีมที่ลูกเลือกเองได้: "สไตล์" (ลวดลาย/ความโค้งมน) × "สี" (พาสเทล)
// เก็บแยกคนในเครื่อง ไม่มีผลกับของพี่น้อง

const INK = '#2B2552';

export const PALETTES = [
  { id: 'lavender', name: 'ลาเวนเดอร์', main: '#BDAEE6', soft: '#EDE7FA', deep: '#5B3FA0', c2: '#FFE27A', c3: '#F4B6D2' },
  { id: 'bubblegum', name: 'ชมพูบับเบิ้ล', main: '#F7A8CB', soft: '#FFE3EF', deep: '#B3265F', c2: '#FFD66B', c3: '#A9C4FF' },
  { id: 'mint', name: 'มิ้นต์', main: '#9ADDBF', soft: '#DFF5EA', deep: '#1E7A52', c2: '#FFC9DE', c3: '#FFE27A' },
  { id: 'sky', name: 'ฟ้าน้ำนม', main: '#9FBDF8', soft: '#E4EDFF', deep: '#2D58B8', c2: '#FFE27A', c3: '#F7A8CB' },
  { id: 'peach', name: 'ส้มพีช', main: '#FFB48A', soft: '#FFE8DA', deep: '#B34A12', c2: '#9FBDF8', c3: '#FFE27A' },
  { id: 'butter', name: 'เหลืองเนย', main: '#FFDB70', soft: '#FFF3C9', deep: '#8A6100', c2: '#B7A6E3', c3: '#9ADDBF' },
];

export const STYLES = [
  {
    id: 'flower', name: 'ดอกไม้ยิ้ม', emoji: '🌼',
    radius: '28px', border: '3px', shadow: '5px 5px 0 var(--ink)', press: '2px 2px 0 var(--ink)',
  },
  {
    id: 'blob', name: 'บล็อบยิ้ม', emoji: '🫧',
    radius: '40px', border: '0px', shadow: '0 7px 0 rgba(43,37,82,.16), 0 16px 28px rgba(43,37,82,.10)', press: '0 3px 0 rgba(43,37,82,.16)',
  },
  {
    id: 'doodle', name: 'ดูเดิลสติกเกอร์', emoji: '⭐',
    radius: '18px', border: '3px', shadow: '4px 4px 0 var(--ink)', press: '1px 1px 0 var(--ink)',
  },
];

export const NEUTRAL = { style: 'flower', palette: 'lavender' };

const palette = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];
const style = (id) => STYLES.find((s) => s.id === id) || STYLES[0];

// ---------- เก็บธีมของแต่ละคน ----------
const key = (kid) => `mykids.theme.${kid}`;
const memory = {};

export function getTheme(kid, fallback = NEUTRAL) {
  let raw = memory[kid] ?? null;
  try { raw = localStorage.getItem(key(kid)) ?? raw; } catch { /* ใช้ค่าในหน่วยความจำ */ }
  if (raw) {
    try {
      const t = JSON.parse(raw);
      return { style: style(t.style).id, palette: palette(t.palette).id };
    } catch { /* ใช้ค่าเริ่มต้น */ }
  }
  return { ...fallback };
}

export function saveTheme(kid, theme) {
  const raw = JSON.stringify({ style: theme.style, palette: theme.palette });
  memory[kid] = raw;
  try { localStorage.setItem(key(kid), raw); } catch { /* ไม่เป็นไร */ }
}

// ---------- วาดลวดลายพื้นหลังเป็น SVG ----------
const r1 = (n) => Math.round(n * 10) / 10;

function face(x, y, s = 1, mood = 'smile') {
  const eye = 2.6 * s;
  const mouth = mood === 'o'
    ? `<ellipse cx="${x}" cy="${r1(y + 7 * s)}" rx="${r1(2.4 * s)}" ry="${r1(3 * s)}" fill="${INK}"/>`
    : `<path d="M${r1(x - 5 * s)} ${r1(y + 6 * s)}q${r1(5 * s)} ${r1(5.5 * s)} ${r1(10 * s)} 0" fill="none" stroke="${INK}" stroke-width="${r1(2.2 * s)}" stroke-linecap="round"/>`;
  return `<circle cx="${r1(x - 7 * s)}" cy="${y}" r="${r1(eye)}" fill="${INK}"/><circle cx="${r1(x + 7 * s)}" cy="${y}" r="${r1(eye)}" fill="${INK}"/>${mouth}`;
}

function flower(x, y, r, petal, center, withFace = true) {
  let s = '';
  for (let i = 0; i < 8; i += 1) {
    s += `<ellipse cx="${x}" cy="${r1(y - r * 0.66)}" rx="${r1(r * 0.3)}" ry="${r1(r * 0.42)}" fill="${petal}" transform="rotate(${i * 45} ${x} ${y})"/>`;
  }
  s += `<circle cx="${x}" cy="${y}" r="${r1(r * 0.62)}" fill="${center}"/>`;
  return s + (withFace ? face(x, y + 1, r / 22) : '');
}

function star(x, y, r, color) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.5;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${r1(x + rad * Math.cos(a))},${r1(y + rad * Math.sin(a))}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${color}" stroke="${color}" stroke-width="7" stroke-linejoin="round"/>`;
}

const sparkle = (x, y, r, color) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${color}"/>`;
const heart = (x, y, s, color) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 12C-24 -6 -14 -26 0 -12C14 -26 24 -6 0 12Z" fill="${color}"/>`;
const dot = (x, y, r, color) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const squiggle = (x, y, color, w = 7) => `<path d="M${x} ${y}q9 -16 18 0t18 0t18 0t18 0" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
const pill = (x, y, w, h, color, rot = 0) => `<rect x="${r1(x - w / 2)}" y="${r1(y - h / 2)}" width="${w}" height="${h}" rx="${r1(w / 2)}" fill="${color}" transform="rotate(${rot} ${x} ${y})"/>`;
const arch = (x, y, w, color) => `<path d="M${r1(x - w / 2)} ${y + w / 4}A${r1(w / 2)} ${r1(w / 2)} 0 0 1 ${r1(x + w / 2)} ${y + w / 4}Z" fill="${color}" stroke="${color}" stroke-width="8" stroke-linejoin="round"/>`;
const triangle = (x, y, s, color) => `<polygon points="${x},${r1(y - s)} ${r1(x + s)},${r1(y + s * 0.8)} ${r1(x - s)},${r1(y + s * 0.8)}" fill="${color}" stroke="${color}" stroke-width="12" stroke-linejoin="round"/>`;
const cloud = (x, y, s, color) => `<g fill="${color}"><circle cx="${r1(x - 18 * s)}" cy="${y}" r="${r1(18 * s)}"/><circle cx="${x}" cy="${r1(y - 14 * s)}" r="${r1(22 * s)}"/><circle cx="${r1(x + 20 * s)}" cy="${y}" r="${r1(17 * s)}"/><rect x="${r1(x - 18 * s)}" y="${y}" width="${r1(38 * s)}" height="${r1(17 * s)}"/></g>`;
const cross = (x, y, r, color) => `<path d="M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;

function tile(styleId, p) {
  const { main, c2, c3 } = p;
  let body = '';
  if (styleId === 'flower') {
    body = flower(78, 84, 46, main, c2)
      + flower(268, 150, 38, c3, main)
      + flower(120, 286, 34, c2, c3)
      + star(210, 50, 22, c2) + star(44, 214, 18, c3) + heart(300, 296, 1.1, main)
      + sparkle(332, 44, 16, main) + sparkle(196, 206, 13, c3)
      + dot(170, 130, 5, main) + dot(326, 228, 6, c2) + dot(36, 336, 6, c3) + dot(236, 334, 5, main);
  } else if (styleId === 'blob') {
    body = pill(66, 92, 52, 112, main, -18) + face(60, 84, 1.1)
      + arch(252, 118, 96, c2) + face(252, 124, 1.1, 'o')
      + cloud(112, 280, 1.1, c3) + face(114, 282, 0.9)
      + dot(300, 286, 38, main) + face(300, 290, 1.1)
      + triangle(186, 36, 20, c3)
      + dot(176, 176, 6, c2) + dot(330, 214, 7, c3) + dot(24, 190, 6, main) + dot(214, 338, 6, c2);
  } else {
    body = star(60, 66, 26, c2) + star(280, 252, 22, c3) + star(190, 160, 16, main)
      + squiggle(120, 70, main) + squiggle(40, 280, c3) + squiggle(250, 330, c2, 8)
      + sparkle(310, 70, 18, c3) + sparkle(60, 170, 14, main) + sparkle(190, 280, 15, c2)
      + cross(320, 150, 9, c2) + cross(150, 330, 8, main) + cross(30, 340, 7, c3)
      + dot(250, 40, 6, main) + dot(110, 210, 6, c3) + dot(330, 330, 5, main) + heart(240, 190, 0.8, c3);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">${body}</svg>`;
}

export function patternURL(styleId, paletteId) {
  // ใช้ single quote เพื่อให้ใส่ใน style="..." ได้ (encodeURIComponent จะแปลง " เป็น %22 ให้แล้ว)
  return `url('data:image/svg+xml,${encodeURIComponent(tile(styleId, palette(paletteId)))}')`;
}

// รูปหน้าตัวแทนของลูกแต่ละคน (ดอกไม้ยิ้ม สีตามธีมที่เลือก)
export function avatar(theme, size = 64) {
  const p = palette(theme.palette);
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${flower(32, 32, 28, p.main, p.c2)}</svg>`;
}

// ---------- ใช้ธีมกับทั้งหน้า ----------
export function applyTheme(theme) {
  const p = palette(theme.palette);
  const s = style(theme.style);
  const root = document.documentElement;
  const set = (k, v) => root.style.setProperty(k, v);
  set('--c', p.main); set('--c2', p.c2); set('--c3', p.c3); set('--soft', p.soft); set('--deep', p.deep);
  set('--r', s.radius); set('--bw', s.border); set('--sh', s.shadow); set('--sh-press', s.press);
  set('--pattern', patternURL(s.id, p.id));
  root.dataset.style = s.id;
  root.dataset.palette = p.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#FFF8EC');
}

// ---------- หน้าต่างเลือกธีม ----------
export function openThemePicker(kid, onChange) {
  const previous = document.activeElement;
  let theme = getTheme(kid);

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <h2 id="sheet-title">🎨 ตกแต่งหน้าของหนู</h2>
      <p class="lead">เลือกสไตล์และสีที่ชอบ — เปลี่ยนให้ดูทันที</p>
      <h3>สไตล์</h3>
      <div class="style-grid" id="style-grid"></div>
      <h3>สี</h3>
      <div class="palette-grid" id="palette-grid"></div>
      <div class="row center"><button type="button" class="btn btn-primary" id="sheet-done">เสร็จแล้ว</button></div>
    </div>`;
  document.body.appendChild(backdrop);
  document.body.classList.add('no-scroll');

  const styleGrid = backdrop.querySelector('#style-grid');
  const paletteGrid = backdrop.querySelector('#palette-grid');

  function draw() {
    styleGrid.innerHTML = STYLES.map((s) => `
      <button type="button" class="style-tile ${s.id === theme.style ? 'active' : ''}" data-style="${s.id}" aria-pressed="${s.id === theme.style}"
        style="--tile:${patternURL(s.id, theme.palette)}">
        <span class="style-emoji" aria-hidden="true">${s.emoji}</span>
        <span class="style-name">${s.name}</span>
      </button>`).join('');
    paletteGrid.innerHTML = PALETTES.map((p) => `
      <button type="button" class="swatch-btn ${p.id === theme.palette ? 'active' : ''}" data-palette="${p.id}" aria-pressed="${p.id === theme.palette}">
        <span class="swatch-dot" style="--a:${p.main};--b:${p.c2};--d:${p.c3}"></span>
        <span class="swatch-name">${p.name}</span>
      </button>`).join('');
  }

  function change(next) {
    theme = { ...theme, ...next };
    saveTheme(kid, theme);
    applyTheme(theme);
    draw();
    onChange?.(theme);
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    document.body.classList.remove('no-scroll');
    previous?.focus?.();
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) { close(); return; }
    const st = e.target.closest('[data-style]');
    if (st) change({ style: st.dataset.style });
    const pa = e.target.closest('[data-palette]');
    if (pa) change({ palette: pa.dataset.palette });
  });
  backdrop.querySelector('#sheet-done').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  draw();
  backdrop.querySelector('.style-tile.active')?.focus();
}
