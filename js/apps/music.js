/* Music: a real WebAudio engine. Built-in tracks are generated live by a small
   step sequencer (no audio files shipped); you can also import your own audio,
   stored in IndexedDB. Both feed the shared analyser used by the visualizer. */
(function () {
'use strict';
const D = window.Duo, h = D.h, ui = D.ui;

const GEN = [
  { id: 'g1', title: 'Glass Hour', artist: 'Duo Generative', bpm: 84, root: 57, scale: [0, 3, 7, 10, 12, 15], hue: 265, pat: [0, 2, 4, 2, 5, 3, 4, 1] },
  { id: 'g2', title: 'Fold Lines', artist: 'Duo Generative', bpm: 108, root: 52, scale: [0, 2, 4, 7, 9, 12], hue: 190, pat: [0, 3, 5, 3, 1, 4, 2, 4] },
  { id: 'g3', title: 'Ember Drift', artist: 'Duo Generative', bpm: 72, root: 55, scale: [0, 2, 3, 5, 7, 8, 10], hue: 18, pat: [0, 4, 2, 6, 3, 5, 1, 4] },
  { id: 'g4', title: 'Lagoon Night', artist: 'Duo Generative', bpm: 96, root: 60, scale: [0, 2, 5, 7, 9, 12], hue: 160, pat: [1, 3, 5, 4, 2, 0, 3, 5] }
].map(t => ({ ...t, gen: true, dur: 120 }));
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

let imported = [], cur = null, playing = false, shuffle = false, repeat = 'all';
let el = null, elSrc = null, genStart = 0, genPause = 0, nextStep = 0, step = 0, timer = null, bus = null;
const loadImported = async () => {
  try { imported = (await D.blobs.all('tracks')).map(r => ({ id: r.id, title: r.title, artist: r.artist || 'Imported', dur: r.dur || 0, blob: r.blob, hue: 300 })); } catch (e) { imported = []; }
  D.fire('music:list');
};
const list = () => [...GEN, ...imported];

function stopGen() { clearInterval(timer); timer = null; if (bus) { try { bus.disconnect(); } catch (e) {} bus = null; } }
function note(c, dst, f, t, d, type, g) {
  const o = c.createOscillator(), v = c.createGain(); o.type = type; o.frequency.value = f;
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .02); v.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(v); v.connect(dst); o.start(t); o.stop(t + d + .05);
}
function startGen(t, offset = 0) {
  const c = D.audio.get(); if (!c) return;
  stopGen(); bus = c.createGain(); bus.gain.value = .9; bus.connect(D.audio.master);
  const spb = 60 / t.bpm / 2; step = 0; nextStep = c.currentTime + .05; genStart = performance.now() - offset * 1000;
  timer = setInterval(() => {
    while (nextStep < c.currentTime + .25) {
      const i = step % 8, bar = Math.floor(step / 8), chord = [0, 0, 3, 5][bar % 4], idx = t.pat[i];
      const n = t.root + t.scale[(idx + chord) % t.scale.length] + (idx + chord >= t.scale.length ? 12 : 0);
      note(c, bus, mtof(n + 12), nextStep, spb * 1.6, 'triangle', .13);
      if (i % 4 === 0) { note(c, bus, mtof(t.root + t.scale[chord % t.scale.length] - 12), nextStep, spb * 3.8, 'sine', .22); }
      if (i === 0) [2, 4].forEach(k => note(c, bus, mtof(t.root + t.scale[(chord + k) % t.scale.length]), nextStep, spb * 7.5, 'sine', .05));
      if (i % 2 === 1) { /* soft hat */ const b = c.createBuffer(1, 800, c.sampleRate), d = b.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length); const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; g.gain.value = .05; s.connect(g); g.connect(bus); s.start(nextStep); }
      nextStep += spb; step++;
    }
  }, 60);
}
function ensureEl() {
  if (el) return el; el = new Audio(); el.preload = 'auto';
  const c = D.audio.get(); if (c) { try { elSrc = c.createMediaElementSource(el); elSrc.connect(D.audio.master); } catch (e) {} }
  el.addEventListener('ended', () => M.next(true)); el.addEventListener('error', () => { if (cur && !cur.gen) { playing = false; D.fire('music'); D.toast({ title: 'Music', body: 'Could not play that file.', icon: 'music' }); } });
  return el;
}
let objUrl = null;
const M = D.music = {
  list, get playing() { return playing; }, get shuffle() { return shuffle; }, get repeat() { return repeat; },
  current: () => cur,
  play(id) {
    const t = list().find(x => x.id === id) || list()[0]; if (!t) return;
    cur = t; playing = true; D.store.set('music.last', t.id);
    if (t.gen) { if (el) el.pause(); startGen(t); }
    else { stopGen(); const e = ensureEl(); if (objUrl) URL.revokeObjectURL(objUrl); objUrl = URL.createObjectURL(t.blob); e.src = objUrl; e.play().catch(() => {}); }
    D.fire('music');
  },
  pause() { if (!cur) return; if (cur.gen) { genPause = (performance.now() - genStart) / 1000; stopGen(); } else if (el) el.pause(); playing = false; D.fire('music'); },
  resume() { if (!cur) return M.play(D.store.get('music.last', 'g1')); playing = true; if (cur.gen) startGen(cur, genPause); else if (el) el.play().catch(() => {}); D.fire('music'); },
  toggle() { playing ? M.pause() : M.resume(); },
  next(auto) {
    const l = list(); if (!l.length) return; const i = l.findIndex(x => x.id === (cur && cur.id));
    if (auto && repeat === 'one' && cur) return M.play(cur.id);
    if (auto && repeat === 'off' && i === l.length - 1 && !shuffle) { M.pause(); genPause = 0; return; }
    M.play(shuffle ? l[Math.floor(Math.random() * l.length)].id : l[(i + 1) % l.length].id);
  },
  prev() { const l = list(); if (M.position() > 3) return M.seek(0); const i = l.findIndex(x => x.id === (cur && cur.id)); M.play(l[(i - 1 + l.length) % l.length].id); },
  position() { if (!cur) return 0; if (cur.gen) return playing ? (performance.now() - genStart) / 1000 : genPause; return el ? el.currentTime : 0; },
  duration() { return !cur ? 0 : cur.gen ? cur.dur : (el && isFinite(el.duration) ? el.duration : cur.dur || 0); },
  progress() { const d = M.duration(); return d ? Math.min(1, M.position() / d) : 0; },
  seek(s) { if (!cur) return; if (cur.gen) { genPause = s; if (playing) startGen(cur, s); } else if (el) el.currentTime = s; D.fire('music:tick'); },
  setShuffle(v) { shuffle = v; D.fire('music'); }, cycleRepeat() { repeat = { all: 'one', one: 'off', off: 'all' }[repeat]; D.fire('music'); },
  async import() {
    const files = await D.pickFile('audio/*', true); if (!files || !files.length) return 0;
    for (const f of files) await D.blobs.put('tracks', { title: f.name.replace(/\.[^.]+$/, ''), artist: 'Imported', blob: f, size: f.size });
    await loadImported(); return files.length;
  },
  async remove(id) { if (cur && cur.id === id) { M.pause(); cur = null; } await D.blobs.del('tracks', id); await loadImported(); D.fire('music'); }
};
D.services.push(() => {
  loadImported();
  setInterval(() => { if (playing) { D.fire('music:tick'); if (cur && cur.gen && M.position() >= cur.dur) M.next(true); } }, 500);
  if ('mediaSession' in navigator) { try { navigator.mediaSession.setActionHandler('play', M.resume); navigator.mediaSession.setActionHandler('pause', M.pause); navigator.mediaSession.setActionHandler('nexttrack', () => M.next()); navigator.mediaSession.setActionHandler('previoustrack', M.prev); } catch (e) {} }
});

const art = (t, big) => h('div.mart', { style: t ? `background:linear-gradient(145deg,hsl(${t.hue} 80% 62%),hsl(${(t.hue + 50) % 360} 70% 30%))` : '', class: big ? 'big' : '' }, D.ico('music'));

D.registerApp({ id: 'music', name: 'Music', icon: 'music', c: ['#fd5c77', '#c1123e'], mount(body, ctx) {
  const lib = h('div.card'), now = h('div.np'); let raf = 0;
  const ttl = h('b.nptitle'), sub = h('span.npartist'), cv = h('canvas.viz', { width: 320, height: 90 });
  const seekr = ui.range({ min: 0, max: 1000, value: 0, label: 'Seek', onInput: v => M.seek(v / 1000 * M.duration()) });
  const t1 = h('span'), t2 = h('span');
  const bPlay = h('button.ibtn.big', { 'aria-label': 'Play or pause', onclick: () => M.toggle() }), bShuf = ui.ibtn('shuffle', () => M.setShuffle(!M.shuffle), 'Shuffle'), bRep = h('button.ibtn', { 'aria-label': 'Repeat', onclick: () => M.cycleRepeat() }, D.ico('repeat'));
  const vol = ui.range({ min: 0, max: 100, value: D.settings.get('volume') * 100, label: 'Volume', onInput: v => D.settings.set({ volume: v / 100 }) });
  const artHolder = h('div.arth');
  now.append(artHolder, ttl, sub, h('div.seekrow', [t1, seekr, t2]), h('div.rowf.gap12', { style: 'justify-content:center;align-items:center' }, [bShuf, ui.ibtn('prev', () => M.prev(), 'Previous'), bPlay, ui.ibtn('next', () => M.next(), 'Next'), bRep]), h('div.rowf.gap8', { style: 'align-items:center;padding:0 8px' }, [D.ico('volume'), vol]), cv);
  const drawNow = () => {
    const t = M.current(); ttl.textContent = t ? t.title : 'Nothing playing'; sub.textContent = t ? t.artist : 'Pick a track';
    artHolder.replaceChildren(art(t, true)); bPlay.replaceChildren(D.ico(M.playing ? 'pause' : 'play')); bShuf.classList.toggle('on', M.shuffle);
    bRep.classList.toggle('on', M.repeat !== 'off'); bRep.title = 'Repeat: ' + M.repeat; bRep.dataset.mode = M.repeat;
    [...lib.querySelectorAll('.lrow')].forEach(r => r.classList.toggle('now', !!t && r.dataset.id === t.id));
  };
  const drawLib = () => {
    lib.replaceChildren(...M.list().map(t => h('div.lrow', { dataset: { id: t.id }, onclick: () => M.play(t.id) }, [art(t), h('div.tx', [h('b', t.title), h('span', t.artist + (t.gen ? ' · generated live' : ''))]),
      t.gen ? null : h('button.ibtn', { 'aria-label': 'Remove ' + t.title, onclick: e => { e.stopPropagation(); M.remove(t.id); } }, D.ico('trash'))])));
    drawNow();
  };
  const tick = () => { if (!seekr.matches(':active')) { seekr.set(M.progress() * 1000); } t1.textContent = ui.dur(M.position()); t2.textContent = ui.dur(M.duration()); };
  const viz = () => {
    raf = requestAnimationFrame(viz); const g = cv.getContext('2d'), w = cv.width, hh = cv.height; g.clearRect(0, 0, w, hh);
    if (!M.playing) return; const a = D.audio.analyser; if (!a) return; const d = new Uint8Array(a.frequencyBinCount); a.getByteFrequencyData(d);
    const n = 32, bw = w / n; for (let i = 0; i < n; i++) { const v = d[i] / 255, bh = Math.max(3, v * hh); g.fillStyle = `hsla(${340 - i * 4},90%,${60 + v * 15}%,.9)`; g.beginPath(); g.roundRect(i * bw + 2, hh - bh, bw - 4, bh, 3); g.fill(); }
  };
  const offs = [D.on('music', drawNow), D.on('music:tick', tick), D.on('music:list', drawLib)];
  ctx.cleanup(() => { cancelAnimationFrame(raf); offs.forEach(f => f()); });
  const imp = async () => { const n = await M.import(); if (n) ctx.toast({ title: 'Music', body: n + ' track' + (n > 1 ? 's' : '') + ' imported', icon: 'music' }); };
  body.append(ui.nav('Music', { right: ui.ibtn('plus', imp, 'Import audio') }), h('div.scroll', ctx.wide ? h('div.cal2', [now, lib]) : [now, h('div', { style: 'height:12px' }), lib]));
  drawLib(); tick(); viz();
} });
})();
