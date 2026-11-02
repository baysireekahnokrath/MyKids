// ตรรกะเศษส่วน: เปรียบเทียบ อธิบายวิธีคิด และสุ่มโจทย์
// รูปแบบตัวเลข: {w: จำนวนเต็ม, n: เศษ, d: ส่วน}  เช่น 2 9/10 = {w:2, n:9, d:10}, 10/3 = {w:0, n:10, d:3}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const lcm = (a, b) => (a / gcd(a, b)) * b;

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];

// เศษเกิน: (w*d + n) / d
const improper = ({ w, n, d }) => ({ n: w * d + n, d });

// เทียบค่า: คืน '>' | '<' | '='
export function compare(a, b) {
  const x = improper(a);
  const y = improper(b);
  const left = x.n * y.d;
  const right = y.n * x.d;
  if (left > right) return '>';
  if (left < right) return '<';
  return '=';
}

// แปลงเป็นจำนวนคละ (ไม่ย่อ)
const toMixed = ({ w, n, d }) => {
  const total = w * d + n;
  return { w: Math.floor(total / d), n: total % d, d };
};

export const text = ({ w, n, d }) => {
  if (n === 0) return `${w}`;
  return w > 0 ? `${w} ${n}/${d}` : `${n}/${d}`;
};

const isImproper = ({ w, n, d }) => w === 0 && n >= d;

const REL_WORD = { '>': 'มากกว่า', '<': 'น้อยกว่า', '=': 'เท่ากับ' };
export const relWord = (r) => REL_WORD[r];

// อธิบายวิธีคิดเป็นข้อความสั้นๆ ทีละบรรทัด (ภาษาไทย ระดับ ป.4)
export function explain(a, b) {
  const lines = [];
  const ma = toMixed(a);
  const mb = toMixed(b);

  const conv = [];
  if (isImproper(a)) conv.push(`${text(a)} = ${text(ma)}`);
  if (isImproper(b)) conv.push(`${text(b)} = ${text(mb)}`);
  if (conv.length) lines.push(`แปลงเศษเกินเป็นจำนวนคละ: ${conv.join(' , ')}`);

  if (ma.w !== mb.w) {
    lines.push(`จำนวนเต็มต่างกัน: ${ma.w} กับ ${mb.w} (ดูจำนวนเต็มก่อน ไม่ต้องดูเศษส่วน)`);
  } else {
    if (ma.w > 0) lines.push(`จำนวนเต็มเท่ากัน (${ma.w}) → เทียบเศษส่วนที่ตามมา`);
    const pa = { n: ma.n, d: ma.d };
    const pb = { n: mb.n, d: mb.d };
    if (pa.n === 0 && pb.n === 0) {
      lines.push('ไม่มีเศษส่วนเหลือทั้งสองข้าง');
    } else if (pa.n === 0 || pb.n === 0) {
      lines.push(`${pa.n === 0 ? 'ข้างซ้าย' : 'ข้างขวา'}ไม่มีเศษส่วน (เป็นจำนวนเต็มพอดี)`);
    } else {
      const L = lcm(pa.d, pb.d);
      const xa = pa.n * (L / pa.d);
      const xb = pb.n * (L / pb.d);
      lines.push(`ทำส่วนให้เท่ากันที่ ${L}: ${pa.n}/${pa.d} = ${xa}/${L} และ ${pb.n}/${pb.d} = ${xb}/${L}`);
      lines.push(`เทียบเศษ: ${xa} ${xa > xb ? '>' : xa < xb ? '<' : '='} ${xb}`);
    }
  }
  lines.push(`ดังนั้น ${text(a)} ${compare(a, b)} ${text(b)}`);
  return lines;
}

// ---------- สุ่มโจทย์ ----------
function properFraction(minD = 3, maxD = 12) {
  const d = randInt(minD, maxD);
  return { w: 0, n: randInt(1, d - 1), d };
}

function equalPair(type) {
  const d = randInt(2, 9);
  const n = randInt(1, d - 1);
  const k = randInt(2, 5);
  const w = type === 'prop' ? 0 : randInt(1, 8);
  if (type === 'impMix') {
    return [{ w: 0, n: w * d + n, d }, { w, n: n * k, d: d * k }];
  }
  return [{ w, n, d }, { w, n: n * k, d: d * k }];
}

function unequalPair(type) {
  for (let i = 0; i < 50; i += 1) {
    let a;
    let b;
    if (type === 'prop') {
      a = properFraction();
      b = properFraction();
    } else if (type === 'mixSame') {
      const w = randInt(1, 9);
      a = { ...properFraction(), w };
      b = { ...properFraction(), w };
    } else if (type === 'mixDiff') {
      const w1 = randInt(1, 9);
      const w2 = randInt(1, 9);
      a = { ...properFraction(), w: w1 };
      b = { ...properFraction(), w: w2 };
    } else if (type === 'impMix') {
      const d = randInt(2, 9);
      a = { w: 0, n: randInt(d + 1, d * 4), d };
      b = { ...properFraction(), w: randInt(1, 4) };
    } else {
      a = properFraction();
      b = { ...properFraction(), w: randInt(1, 5) };
    }
    if (compare(a, b) !== '=') return [a, b];
  }
  return [properFraction(), { ...properFraction(), w: 2 }];
}

// คืน [a, b] โดยสุ่มคำตอบ > < = ให้กระจายพอๆ กัน
export function randomProblem() {
  const rel = pick(['>', '<', '=']);
  const type = pick(['prop', 'mixSame', 'mixDiff', 'impMix', 'propMix']);
  let [a, b] = rel === '=' ? equalPair(type === 'mixDiff' || type === 'propMix' ? 'mixSame' : type) : unequalPair(type);
  if (rel !== '=' && compare(a, b) !== rel) [a, b] = [b, a];
  if (Math.random() < 0.5) [a, b] = [b, a];
  return [a, b];
}

// ---------- แสดงผลเป็น HTML ----------
export function numHTML({ w, n, d }) {
  const frac = n === 0
    ? ''
    : `<span class="frac"><span class="fn">${n}</span><span class="fd">${d}</span></span>`;
  const whole = w > 0 || n === 0 ? `<span class="whole">${w}</span>` : '';
  return `<span class="num">${whole}${frac}</span>`;
}
