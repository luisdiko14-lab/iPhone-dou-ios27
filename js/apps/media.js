/* Media apps: Camera (getUserMedia), Photos (IndexedDB gallery), Voice Memos (MediaRecorder). */
(function () {
'use strict';
const D = window.Duo, h = D.h, ui = D.ui;

const blobToThumb = (blob, max = 360) => new Promise(res => {
  const img = new Image(), u = URL.createObjectURL(blob);
  img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); c.toBlob(b => res(b), 'image/jpeg', .8); };
  img.onerror = () => { URL.revokeObjectURL(u); res(null); }; img.src = u;
});
D.photos = {
  async add(blob, meta = {}) { const thumb = await blobToThumb(blob); return D.blobs.put('photos', { blob, thumb: thumb || blob, ts: Date.now(), fav: false, type: blob.type, name: meta.name || 'IMG_' + D.pad(new Date().getHours()) + D.pad(new Date().getMinutes()) + D.pad(new Date().getSeconds()), ...meta }); },
  all: async () => (await D.blobs.all('photos')).sort((a, b) => b.ts - a.ts)
};

/* ===================================================================== Camera */
D.registerApp({ id: 'camera', name: 'Camera', icon: 'camera', c: ['#6b6f7a', '#1c1d22'], mount(body, ctx) {
  const vid = h('video.camvid', { autoplay: true, playsinline: true, muted: true }), msg = h('div.cammsg.hide'), flashEl = h('div.camflash');
  const thumb = h('button.camthumb', { 'aria-label': 'Open Photos', onclick: () => ctx.open('photos') });
  let stream = null, facing = 'user', mirror = true, timer = 0;
  const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
  const start = async () => {
    stop(); msg.classList.add('hide');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera API unavailable (needs https or localhost).');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
      vid.srcObject = stream; vid.classList.toggle('mirror', facing === 'user'); await vid.play().catch(() => {});
    } catch (e) {
      msg.classList.remove('hide'); msg.replaceChildren(D.ico('camera'), h('b', 'Camera unavailable'), h('span', (e && e.name === 'NotAllowedError') ? 'Permission was denied. Allow camera access in your browser.' : (e.message || 'No camera found.')), h('button.btn', { onclick: importPhoto }, D.ico('upload'), 'Import a photo instead'));
    }
  };
  const importPhoto = async () => { const fs = await D.pickFile('image/*', true); for (const f of fs) await D.photos.add(f, { name: f.name.replace(/\.[^.]+$/, '') }); if (fs.length) { ctx.toast({ title: 'Photos', body: fs.length + ' imported', icon: 'photos' }); refreshThumb(); } };
  const refreshThumb = async () => { const a = await D.photos.all(); thumb.style.backgroundImage = a[0] ? `url(${URL.createObjectURL(a[0].thumb)})` : ''; };
  const shoot = async () => {
    if (!stream || !vid.videoWidth) return ctx.toast({ title: 'Camera', body: 'No live camera to capture from.', icon: 'camera' });
    const c = document.createElement('canvas'); c.width = vid.videoWidth; c.height = vid.videoHeight; const g = c.getContext('2d');
    if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(vid, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .92)); await D.photos.add(blob);
    flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); if (D.settings.get('sounds')) D.audio.beep(1800, .05, 'square', .06); refreshThumb();
  };
  const countdown = async n => { const tag = h('div.camcount'); body.append(tag); for (let i = n; i > 0; i--) { tag.textContent = i; await D.sleep(1000); } tag.remove(); shoot(); };
  const tm = ui.ibtn('clock', () => { timer = timer ? 0 : 3; tm.classList.toggle('on', !!timer); tm.title = timer ? 'Timer 3s' : 'Timer off'; }, 'Self-timer');
  const shut = h('button.shutter', { 'aria-label': 'Take photo', onclick: () => timer ? countdown(timer) : shoot() }, h('i'));
  body.append(ui.nav('Camera', { right: h('div.rowf', [tm, ui.ibtn('upload', importPhoto, 'Import')]) }),
    h('div.camstage', [vid, msg, flashEl]), h('div.camctl', [thumb, shut, ui.ibtn('flip', () => { facing = facing === 'user' ? 'environment' : 'user'; start(); }, 'Flip camera')]));
  ctx.cleanup(stop); ctx.keys(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); shoot(); } });
  refreshThumb(); start();
} });

/* ===================================================================== Photos */
D.registerApp({ id: 'photos', name: 'Photos', icon: 'photos', c: ['#ff6a88', '#8a4bff'], mount(body, ctx) {
  let items = [], fav = false, urls = [];
  const grid = h('div.pgrid'), viewer = h('div.pview.hide');
  const rev = () => { urls.forEach(URL.revokeObjectURL); urls = []; };
  const url = b => { const u = URL.createObjectURL(b); urls.push(u); return u; };
  const draw = async () => {
    items = (await D.photos.all()).filter(p => !fav || p.fav); rev();
    grid.replaceChildren(...(items.length ? items.map((p, i) => h('button.pcell', { 'aria-label': p.name, onclick: () => open(i), style: `background-image:url(${url(p.thumb)})` }, p.fav ? D.ico('heart') : null)) : [ui.empty('photos', fav ? 'No favourites' : 'No photos', fav ? 'Tap the heart on a photo.' : 'Take one in Camera or import with +.')]));
  };
  const open = i => {
    const p = items[i]; if (!p) return; const u = url(p.blob);
    const close = () => { viewer.classList.add('hide'); viewer.replaceChildren(); };
    viewer.classList.remove('hide');
    viewer.replaceChildren(h('div.pvbar', [ui.back(close, 'Photos'), h('b', p.name), h('span', D.fmtDate(new Date(p.ts), { month: 'short', day: 'numeric', year: 'numeric' }))]), h('img.pvimg', { src: u, alt: p.name }),
      h('div.pvact', [
        ui.ibtn('heart', async () => { p.fav = !p.fav; await D.blobs.put('photos', p); await draw(); open(items.findIndex(x => x.id === p.id)); }, 'Favourite', p.fav ? 'on' : ''),
        ui.ibtn('download', () => D.download((p.name || 'photo') + '.' + ((p.type || 'image/jpeg').split('/')[1] || 'jpg'), p.blob, p.type), 'Save to device'),
        ui.ibtn('edit', async () => { const n = await ctx.prompt('Rename', { value: p.name, ok: 'Rename' }); if (n) { p.name = n; await D.blobs.put('photos', p); await draw(); open(items.findIndex(x => x.id === p.id)); } }, 'Rename'),
        ui.ibtn('trash', async () => { if (await ctx.confirm('Delete photo?', 'This cannot be undone.', { ok: 'Delete', danger: true })) { await D.blobs.del('photos', p.id); close(); draw(); } }, 'Delete')]));
    viewer.onkeydown = null;
  };
  const imp = async () => { const fs = await D.pickFile('image/*', true); for (const f of fs) await D.photos.add(f, { name: f.name.replace(/\.[^.]+$/, '') }); draw(); };
  const seg = ui.seg([['all', 'All'], ['fav', 'Favourites']], 'all', v => { fav = v === 'fav'; draw(); });
  body.append(ui.nav('Photos', { right: ui.ibtn('plus', imp, 'Import photos') }), h('div.tabs', seg), h('div.scroll', grid), viewer);
  ctx.bus('blobs:photos', draw); ctx.cleanup(rev); draw();
} });

/* ================================================================ Voice Memos */
D.registerApp({ id: 'voicememos', name: 'Voice Memos', icon: 'mic', c: ['#3a3a44', '#0e0e12'], mount(body, ctx) {
  const list = h('div.card'), big = h('div.rectime', '0:00'), cv = h('canvas.viz', { width: 320, height: 70 }), status = h('div.muted.small', { style: 'text-align:center' }, 'Tap record to start');
  const rec = h('button.recbtn', { 'aria-label': 'Record', onclick: () => recording ? finish() : begin() }, h('i'));
  let recording = false, mr = null, stream = null, chunks = [], t0 = 0, raf = 0, an = null, audio = null, playingId = null, urls = [];
  const cleanupRec = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; cancelAnimationFrame(raf); };
  const begin = async () => {
    try {
      if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('Recording is not supported here.');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const c = D.audio.get(); if (c) { const s = c.createMediaStreamSource(stream); an = c.createAnalyser(); an.fftSize = 64; s.connect(an); }
      mr = new MediaRecorder(stream); chunks = []; mr.ondataavailable = e => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        const dur = (Date.now() - t0) / 1000, blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); cleanupRec();
        if (dur < .4) { status.textContent = 'Too short, nothing saved'; return; }
        await D.blobs.put('memos', { blob, dur, ts: Date.now(), title: 'Memo ' + new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }); status.textContent = 'Saved';
      };
      mr.start(); recording = true; t0 = Date.now(); rec.classList.add('on'); status.textContent = 'Recording…';
      const loop = () => { raf = requestAnimationFrame(loop); big.textContent = ui.dur((Date.now() - t0) / 1000); const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); if (!an) return; const d = new Uint8Array(an.frequencyBinCount); an.getByteTimeDomainData(d); g.strokeStyle = '#ff453a'; g.lineWidth = 2; g.beginPath(); d.forEach((v, i) => { const x = i / (d.length - 1) * cv.width, y = v / 255 * cv.height; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
      loop();
    } catch (e) { status.textContent = (e && e.name === 'NotAllowedError') ? 'Microphone permission denied' : (e.message || 'No microphone found'); }
  };
  const finish = () => { recording = false; rec.classList.remove('on'); if (mr && mr.state !== 'inactive') mr.stop(); };
  const draw = async () => {
    urls.forEach(URL.revokeObjectURL); urls = []; const ms = (await D.blobs.all('memos')).sort((a, b) => b.ts - a.ts);
    list.replaceChildren(...(ms.length ? ms.map(m => h('div.lrow', [
      h('button.ibtn', { 'aria-label': 'Play ' + m.title, onclick: () => { if (audio) { audio.pause(); } if (playingId === m.id) { playingId = null; return draw(); } const u = URL.createObjectURL(m.blob); urls.push(u); audio = new Audio(u); playingId = m.id; audio.onended = () => { playingId = null; draw(); }; audio.play().catch(() => {}); draw(); } }, D.ico(playingId === m.id ? 'pause' : 'play')),
      h('div.tx', [h('b', m.title), h('span', ui.dur(m.dur) + ' · ' + D.bytes(m.blob.size))]),
      h('button.ibtn', { 'aria-label': 'Rename', onclick: async () => { const n = await ctx.prompt('Rename memo', { value: m.title, ok: 'Rename' }); if (n) { m.title = n; D.blobs.put('memos', m); } } }, D.ico('edit')),
      h('button.ibtn', { 'aria-label': 'Download', onclick: () => D.download(m.title + '.' + ((m.blob.type.split('/')[1] || 'webm').split(';')[0]), m.blob, m.blob.type) }, D.ico('download')),
      h('button.ibtn', { 'aria-label': 'Delete', onclick: () => D.blobs.del('memos', m.id) }, D.ico('trash'))])) : [ui.empty('mic', 'No recordings', 'Press the red button.')]));
  };
  body.append(ui.nav('Voice Memos'), h('div.scroll', [h('div.recpanel', [big, cv, rec, status]), list]));
  ctx.bus('blobs:memos', draw); ctx.cleanup(() => { if (recording) { try { mr.stop(); } catch (e) {} } cleanupRec(); if (audio) audio.pause(); urls.forEach(URL.revokeObjectURL); }); draw();
} });
})();
