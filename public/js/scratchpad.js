// ที่ทดเลข/ที่เขียนคำ: เขียนได้ด้วยนิ้ว เมาส์ และ Apple Pencil (Pointer Events)
// - Apple Pencil: ใช้แรงกดปรับความหนาเส้น
// - โหมด "เฉพาะ Apple Pencil" กันฝ่ามือสัมผัสโดนจอ

export function createScratchpad({ title = 'ที่ทด', hint = 'เขียนด้วยนิ้วหรือ Apple Pencil ได้เลย', height = 260 } = {}) {
  const root = document.createElement('section');
  root.className = 'pad';
  root.innerHTML = `
    <div class="pad-bar">
      <div class="pad-title"><span aria-hidden="true">✏️</span> ${title}<small>${hint}</small></div>
      <div class="pad-tools" role="toolbar" aria-label="เครื่องมือเขียน">
        <button type="button" class="tool active" data-tool="pen" aria-pressed="true">ดินสอ</button>
        <button type="button" class="tool" data-tool="eraser" aria-pressed="false">ยางลบ</button>
        <span class="swatches" role="group" aria-label="สี">
          <button type="button" class="swatch active" data-color="#1F2A44" style="--s:#1F2A44" aria-label="สีดำ"></button>
          <button type="button" class="swatch" data-color="#2F6FED" style="--s:#2F6FED" aria-label="สีน้ำเงิน"></button>
          <button type="button" class="swatch" data-color="#E5484D" style="--s:#E5484D" aria-label="สีแดง"></button>
        </span>
        <button type="button" class="tool" data-act="undo">ย้อนกลับ</button>
        <button type="button" class="tool" data-act="clear">ล้างทั้งหมด</button>
        <label class="pen-only"><input type="checkbox" data-act="penonly"> เฉพาะ Apple Pencil</label>
      </div>
    </div>
    <canvas class="pad-canvas" style="height:${height}px" aria-label="พื้นที่เขียน"></canvas>
  `;

  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  let strokes = [];
  let current = null;
  let activePointer = null;
  let tool = 'pen';
  let color = '#1F2A44';
  let penOnly = false;

  function drawSegment(stroke, from, to) {
    ctx.save();
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pressure = stroke.pen ? 0.55 + to.p * 0.9 : 1;
    ctx.lineWidth = stroke.size * pressure;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawDot(stroke, p) {
    ctx.save();
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    ctx.fillStyle = stroke.color;
    const pressure = stroke.pen ? 0.55 + p.p * 0.9 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (stroke.size * pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => {
      if (s.points.length === 1) drawDot(s, s.points[0]);
      for (let i = 1; i < s.points.length; i += 1) drawSegment(s, s.points[i - 1], s.points[i]);
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  const toPoint = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (penOnly && e.pointerType === 'touch') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (activePointer !== null) return;
    e.preventDefault();
    activePointer = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ไม่เป็นไร */ }
    const isPen = e.pointerType === 'pen';
    current = {
      color,
      erase: tool === 'eraser',
      size: tool === 'eraser' ? 26 : isPen ? 3 : 4,
      pen: isPen,
      points: [toPoint(e)],
    };
    strokes.push(current);
    drawDot(current, current.points[0]);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!current || e.pointerId !== activePointer) return;
    e.preventDefault();
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    (events.length ? events : [e]).forEach((ev) => {
      const next = toPoint(ev);
      const prev = current.points[current.points.length - 1];
      current.points.push(next);
      drawSegment(current, prev, next);
    });
  });

  const end = (e) => {
    if (e.pointerId !== activePointer) return;
    current = null;
    activePointer = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.tool) {
      tool = btn.dataset.tool;
      root.querySelectorAll('[data-tool]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    } else if (btn.dataset.color) {
      color = btn.dataset.color;
      tool = 'pen';
      root.querySelectorAll('[data-tool]').forEach((b) => {
        const on = b.dataset.tool === 'pen';
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      root.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', b === btn));
    } else if (btn.dataset.act === 'undo') {
      strokes.pop();
      redraw();
    } else if (btn.dataset.act === 'clear') {
      clear();
    }
  });

  root.querySelector('[data-act="penonly"]').addEventListener('change', (e) => {
    penOnly = e.target.checked;
  });

  function clear() {
    strokes = [];
    current = null;
    activePointer = null;
    redraw();
  }

  // วาดใหม่เมื่อขนาดเปลี่ยน (หมุนจอ iPad ฯลฯ)
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => resize()).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }
  requestAnimationFrame(resize);

  return {
    el: root,
    clear,
    strokeCount: () => strokes.length,
  };
}
