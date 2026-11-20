/* Creative apps: Freeform (canvas drawing) and 2048 (id "game"). */
(function () {
'use strict';
const D = window.Duo, h = D.h, ui = D.ui;

/* ==================================================================== Freeform */
D.registerApp({ id: 'freeform', name: 'Freeform', icon: 'freeform', c: ['#ffd60a', '#ff9f0a'], mount(body, ctx) {
  const W = 900, H = 1100, cv = h('canvas.fcanvas', { width: W, height: H, 'aria-label': 'Drawing canvas' }), g = cv.getContext('2d', { willReadFrequently: true });
  let color = '#ffffff', size = 8, tool = 'pen', bg = D.store.get('ff.bg', '#1c1c28'), undo = [], redo = [], last = null, drawing = false;
  const paintBg = () => { g.globalCompositeOperation = 'source-over'; g.fillStyle = bg; g.fillRect(0, 0, W, H); };
  const snap = () => { undo.push(g.getImageData(0, 0, W, H)); if (undo.length > 25) undo.shift(); redo = []; upd(); };
  const restore = d => g.putImageData(d, 0, 0);
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const stroke = (a, b) => {
    g.lineCap = g.lineJoin = 'round'; g.lineWidth = tool === 'eraser' ? size * 2.5 : size; g.strokeStyle = tool === 'eraser' ? bg : color;
    if (tool === 'marker') g.globalAlpha = .45; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.globalAlpha = 1;
  };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); snap(); drawing = true; last = pt(e); stroke(last, [last[0] + .01, last[1]]); });
  cv.addEventListener('pointermove', e => { if (!drawing) return; const p = pt(e); stroke(last, p); last = p; });
  const end = () => { drawing = false; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const bUndo = ui.ibtn('undo', () => { if (!undo.length) return; redo.push(g.getImageData(0, 0, W, H)); restore(undo.pop()); upd(); }, 'Undo');
  const bRedo = ui.ibtn('redo', () => { if (!redo.length) return; undo.push(g.getImageData(0, 0, W, H)); restore(redo.pop()); upd(); }, 'Redo');
  function upd() { bUndo.disabled = !undo.length; bRedo.disabled = !redo.length; }
  const COLORS = ['#ffffff', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#bf5af2', '#ff6bd6', '#111111'];
  const sw = h('div.rowf.gap8', { style: 'flex-wrap:wrap;justify-content:center' }, COLORS.map(c => h('button.cdot', { style: 'background:' + c, 'aria-label': 'Colour ' + c, class: c === color ? 'on' : '', onclick: e => { color = c; if (tool === 'eraser') setTool('pen'); [...sw.children].forEach(x => x.classList.toggle('on', x === e.currentTarget)); } })));
  const tools = ui.seg([['pen', 'Pen'], ['marker', 'Marker'], ['eraser', 'Eraser']], tool, v => { tool = v; });
  const setTool = v => { tool = v; tools.set(v); };
  const sz = ui.range({ min: 2, max: 48, value: size, label: 'Brush size', onInput: v => { size = v; } });
  const toBlob = () => new Promise(r => cv.toBlob(r, 'image/png'));
  const save = async () => { await D.photos.add(await toBlob(), { name: 'Freeform ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }); ctx.toast({ title: 'Freeform', body: 'Saved to Photos', icon: 'photos', app: 'photos' }); };
  const exp = async () => D.download('freeform.png', await toBlob(), 'image/png');
  const clear = async () => { if (await ctx.confirm('Clear canvas?', '', { ok: 'Clear', danger: true })) { snap(); paintBg(); } };
  const bgBtn = h('button.btn.sm', { onclick: async () => { const c = await ctx.menu('Background', [['Midnight', '#1c1c28'], ['Paper', '#f5f3ee'], ['Black', '#000000'], ['Blueprint', '#10325a']]); if (c) { bg = c; D.store.set('ff.bg', c); snap(); paintBg(); } } }, 'Paper');
  body.append(ui.nav('Freeform', { right: h('div.rowf', [bUndo, bRedo, ui.ibtn('photos', save, 'Save to Photos'), ui.ibtn('download', exp, 'Export PNG'), ui.ibtn('trash', clear, 'Clear')]) }),
    h('div.fstage', cv), h('div.ftools.glass', [tools, sw, h('div.rowf.gap8', { style: 'align-items:center' }, [h('span.small', 'Size'), sz, bgBtn])]));
  bgBtn.textContent = 'Background';
  ctx.keys(e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? bRedo : bUndo).click(); } });
  paintBg(); upd();
} });

/* ======================================================================= 2048 */
D.registerApp({ id: 'game', name: '2048', icon: 'game', c: ['#f6a23a', '#d9531e'], mount(body, ctx) {
  const N = 4; let grid, score = 0, best = D.store.get('g2048.best', 0), over = false, won = false, prev = null, nid = 1;
  const board = h('div.g-board', { tabindex: 0, 'aria-label': '2048 board' }), sc = h('b.g-n'), bs = h('b.g-n'), msg = h('div.g-msg.hide');
  const empty = () => Array.from({ length: N }, () => Array(N).fill(null));
  const cells = () => { const o = []; grid.forEach((r, y) => r.forEach((t, x) => !t && o.push([x, y]))); return o; };
  const spawn = () => { const c = cells(); if (!c.length) return; const [x, y] = c[Math.floor(Math.random() * c.length)]; grid[y][x] = { id: nid++, v: Math.random() < .9 ? 2 : 4, isNew: true }; };
  function start() { grid = empty(); score = 0; over = won = false; prev = null; spawn(); spawn(); msg.classList.add('hide'); draw(); }
  const clone = () => ({ grid: grid.map(r => r.map(t => t && { ...t })), score });
  function slide(line) {   // returns [newLine, gained, moved]
    const t = line.filter(Boolean), out = []; let gain = 0;
    for (let i = 0; i < t.length; i++) { if (t[i + 1] && t[i].v === t[i + 1].v) { out.push({ id: t[i].id, v: t[i].v * 2, merged: true }); gain += t[i].v * 2; i++; } else out.push({ ...t[i] }); }
    while (out.length < N) out.push(null);
    return [out, gain, out.some((x, i) => (x && x.id) !== (line[i] && line[i].id) || (x && x.merged))];
  }
  function move(dir) {
    if (over) return; const before = clone(); let moved = false, gain = 0;
    const get = (i, j) => dir === 0 ? [j, i] : dir === 1 ? [N - 1 - j, i] : dir === 2 ? [i, j] : [i, N - 1 - j];   // 0 left,1 right,2 up,3 down  → [x,y]
    for (let i = 0; i < N; i++) {
      const line = []; for (let j = 0; j < N; j++) { const [x, y] = get(i, j); line.push(grid[y][x]); }
      const [nl, g, m] = slide(line); gain += g; moved = moved || m;
      for (let j = 0; j < N; j++) { const [x, y] = get(i, j); grid[y][x] = nl[j]; }
    }
    if (!moved) return; prev = before; score += gain; spawn();
    if (score > best) { best = score; D.store.set('g2048.best', best); }
    if (!won && grid.some(r => r.some(t => t && t.v >= 2048))) { won = true; say('You made 2048!', 'Keep going'); }
    if (!cells().length && !canMove()) { over = true; say('Game over', 'Try again'); }
    if (D.settings.get('sounds')) D.audio.beep(gain ? 520 + Math.min(gain, 400) : 300, .06, 'triangle', .05);
    draw();
  }
  const canMove = () => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const t = grid[y][x]; if (!t) return true; if (x < N - 1 && grid[y][x + 1] && grid[y][x + 1].v === t.v) return true; if (y < N - 1 && grid[y + 1][x] && grid[y + 1][x].v === t.v) return true; } return false; };
  const say = (t, b) => { msg.classList.remove('hide'); msg.replaceChildren(h('b', t), h('button.btn.primary', { onclick: () => over ? start() : msg.classList.add('hide') }, b)); };
  function draw() {
    board.replaceChildren(...Array.from({ length: N * N }, () => h('i.g-bg')));
    grid.forEach((r, y) => r.forEach((t, x) => t && board.append(h('div.g-tile', { class: `v${Math.min(t.v, 4096)} ${t.isNew ? 'new' : ''} ${t.merged ? 'mrg' : ''}`, style: `--x:${x};--y:${y}` }, h('span', t.v)))));
    grid.forEach(r => r.forEach(t => { if (t) { t.isNew = false; t.merged = false; } })); board.append(msg); sc.textContent = score; bs.textContent = best; undoB.disabled = !prev;
  }
  const undoB = ui.ibtn('undo', () => { if (!prev) return; grid = prev.grid; score = prev.score; prev = null; over = false; msg.classList.add('hide'); draw(); }, 'Undo');
  ctx.keys(e => { const d = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3, a: 0, d: 1, w: 2, s: 3 }[e.key]; if (d !== undefined) { e.preventDefault(); move(d); } });
  let sx = 0, sy = 0;
  board.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  board.addEventListener('pointerup', e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; move(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 1) : (dy < 0 ? 2 : 3)); });
  body.append(ui.nav('2048', { right: h('div.rowf', [undoB, ui.ibtn('refresh', start, 'New game')]) }),
    h('div.g-wrap', [h('div.g-hd', [h('div.g-box.glass', [h('span', 'Score'), sc]), h('div.g-box.glass', [h('span', 'Best'), bs])]), board, h('div.muted.small', { style: 'text-align:center;margin-top:10px' }, 'Arrow keys, WASD or swipe. Merge equal tiles.')]));
  start();
} });
})();
