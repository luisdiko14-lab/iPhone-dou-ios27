/* =====================================================================
   iPhone Duo · iOS 27 — core runtime
   Namespace, DOM helper, persistent store, blob storage (IndexedDB),
   Python-backend client, settings, audio engine, icons.
   Plain scripts (no modules) so the OS also runs from file://.
   ===================================================================== */
(function () {
'use strict';
const D = window.Duo = { version: '27.0.0', apps: {}, appOrder: [], screens: [], services: [] };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
D.$ = $; D.$$ = $$;

/* ------------------------------------------------------------ utilities */
D.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
D.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
D.pad = n => String(n).padStart(2, '0');
D.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
D.sleep = ms => new Promise(r => setTimeout(r, ms));
D.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
D.bytes = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB';
D.download = (name, blobOrText, type = 'text/plain') => {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
D.readFile = (file, as = 'text') => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error);
  as === 'dataurl' ? r.readAsDataURL(file) : as === 'buffer' ? r.readAsArrayBuffer(file) : r.readAsText(file);
});
D.pickFile = (accept = '', multiple = false) => new Promise(res => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple; i.style.display = 'none';
  i.onchange = () => { res([...i.files]); i.remove(); };
  i.oncancel = () => { res([]); i.remove(); };
  document.body.appendChild(i); i.click();
});

/* ---------------------------------------------------------- hyperscript */
const SVGNS = 'http://www.w3.org/2000/svg';
const SVGTAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'g', 'polyline', 'polygon', 'ellipse', 'defs', 'linearGradient', 'stop', 'text']);
function h(sel, props, ...kids) {
  if (props != null && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  const tag = (/^[a-zA-Z][\w-]*/.exec(sel) || ['div'])[0];
  const el = SVGTAGS.has(tag) ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
  const re = /([.#])([\w-]+)/g; let m;
  while ((m = re.exec(sel))) m[1] === '.' ? el.classList.add(m[2]) : (el.id = m[2]);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.classList.add(...String(v).split(/\s+/).filter(Boolean));
    else if (k === 'style') typeof v === 'string' ? (el.style.cssText += v) : Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'indeterminate') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = k => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(add); else el.append(k instanceof Node ? k : document.createTextNode(String(k))); };
  kids.forEach(add);
  return el;
}
D.h = h;

/* --------------------------------------------------------------- icons */
const I = {
  calculator: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 19h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  weather: '<circle cx="9" cy="9" r="3"/><path d="M9 3v1.5M3 9h1.5M4.8 4.8l1 1M13.2 4.8l-1 1"/><path d="M8 20h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.2A3 3 0 0 0 8 20z"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  photos: '<circle cx="12" cy="7" r="3.2"/><circle cx="17" cy="12" r="3.2"/><circle cx="12" cy="17" r="3.2"/><circle cx="7" cy="12" r="3.2"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  files: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  maps: '<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
  browser: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  reminders: '<circle cx="6" cy="7" r="1.2"/><circle cx="6" cy="12" r="1.2"/><circle cx="6" cy="17" r="1.2"/><path d="M10 7h9M10 12h9M10 17h9"/>',
  voicememos: '<path d="M3 12h1M7 8v8M11 4.5v15M15 8.5v7M19 10.5v3M21.5 12h.01"/>',
  converter: '<path d="M6 8h12l-3.5-3.5M18 16H6l3.5 3.5"/>',
  freeform: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9l3 3-3 3M12.5 15H17"/>',
  game: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  contacts: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  messages: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', chev: '<path d="M9 5l7 7-7 7"/>', down: '<path d="M5 9l7 7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  play: '!<path d="M8 5l11 7-11 7z"/>', pause: '!<rect x="6" y="5" width="4.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.2"/>',
  next: '!<path d="M5 5l9 7-9 7z"/><rect x="15.5" y="5" width="3" height="14" rx="1.2"/>', prev: '!<path d="M19 5l-9 7 9 7z"/><rect x="5.5" y="5" width="3" height="14" rx="1.2"/>',
  stop: '!<rect x="6" y="6" width="12" height="12" rx="2.5"/>', record: '!<circle cx="12" cy="12" r="7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  volume: '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
  download: '<path d="M12 4v11M7.5 11L12 15.5 16.5 11M5 19.5h14"/>', upload: '<path d="M12 16V5M7.5 9L12 4.5 16.5 9M5 19.5h14"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
  flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
  edit: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v8"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  flip: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  undo: '<path d="M9 6L4 11l5 5M4 11h10a5.5 5.5 0 0 1 0 11h-3"/>', redo: '<path d="M15 6l5 5-5 5M20 11H10a5.5 5.5 0 0 0 0 11h3"/>',
  eraser: '<path d="M4 15.5L13 6l6 6-6.5 7H8z"/><path d="M8 19.5h12"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/>',
  bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  shuffle: '<path d="M3 7h3.5c5 0 5 10 10 10H21M3 17h3.5c1.5 0 2.7-.8 3.7-2M14 9c.8-1.2 2-2 3.5-2H21M18.5 4L21 7l-2.5 3M18.5 14l2.5 3-2.5 3"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  send: '<path d="M20.5 3.5L10 14M20.5 3.5l-6.5 17-3.5-6.5L4 10.5z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r=".6"/>',
  more: '!<circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4H6.5A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  flash: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  power: '<path d="M12 3v8M6.8 6.8a8 8 0 1 0 10.4 0"/>',
  fold: '<rect x="3" y="4" width="8" height="16" rx="2.5"/><rect x="13" y="4" width="8" height="16" rx="2.5"/>'
};
D.icons = I;
D.icon = (n, cls = '') => {
  let p = I[n] || ''; const fill = p[0] === '!'; if (fill) p = p.slice(1);
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" ${fill ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${p}</svg>`;
};
D.ico = (n, cls) => { const t = document.createElement('template'); t.innerHTML = D.icon(n, cls); return t.content.firstChild; };

/* -------------------------------------------------------------- store */
const PFX = 'duo27:'; const mem = new Map(); const subs = new Map();
const emit = k => { (subs.get(k) || []).slice().forEach(f => { try { f(D.store.get(k)); } catch (e) { console.error(e); } }); (subs.get('*') || []).forEach(f => f(k)); };
D.store = {
  get(k, def) {
    if (!mem.has(k)) { let v; try { const s = localStorage.getItem(PFX + k); v = s == null ? undefined : JSON.parse(s); } catch (e) { v = undefined; } mem.set(k, v); }
    const v = mem.get(k); return v === undefined ? (typeof def === 'function' ? def() : def) : v;
  },
  set(k, v, silent) {
    mem.set(k, v);
    try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch (e) { D.toast && D.toast({ title: 'Storage full', body: 'Free some space in Settings › Storage.', icon: 'trash' }); }
    if (!silent) emit(k);
    D.api.queueSync();
  },
  update(k, fn, def) { const v = fn(this.get(k, def)); this.set(k, v); return v; },
  on(k, fn) { if (!subs.has(k)) subs.set(k, []); subs.get(k).push(fn); return () => { const a = subs.get(k); a.splice(a.indexOf(fn), 1); }; },
  keys() { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(PFX)) o.push(k.slice(PFX.length)); } return o; },
  snapshot() { const o = {}; this.keys().forEach(k => o[k] = this.get(k)); return o; },
  clear() { this.keys().forEach(k => localStorage.removeItem(PFX + k)); mem.clear(); },
  emit
};
window.addEventListener('storage', e => { if (e.key && e.key.startsWith(PFX)) { const k = e.key.slice(PFX.length); mem.delete(k); emit(k); if (k === 'settings') D.settings.apply(); } });

/* -------------------------------------------------- blobs (IndexedDB) */
const STORES = ['photos', 'memos', 'tracks'];
let dbp = null;
const openDB = () => dbp || (dbp = new Promise((res, rej) => {
  if (!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
  const r = indexedDB.open('duo27', 1);
  r.onupgradeneeded = () => STORES.forEach(n => r.result.objectStoreNames.contains(n) || r.result.createObjectStore(n, { keyPath: 'id' }));
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
const tx = async (st, mode, fn) => { const db = await openDB(); return new Promise((res, rej) => { const t = db.transaction(st, mode); const q = fn(t.objectStore(st)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
const bus = new Map();
D.on = (ev, fn) => { if (!bus.has(ev)) bus.set(ev, []); bus.get(ev).push(fn); return () => { const a = bus.get(ev); const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; };
D.fire = (ev, ...a) => (bus.get(ev) || []).slice().forEach(f => { try { f(...a); } catch (e) { console.error(e); } });
D.blobs = {
  async put(st, rec) { rec.id = rec.id || D.uid(); await tx(st, 'readwrite', s => s.put(rec)); D.fire('blobs:' + st); return rec; },
  get: (st, id) => tx(st, 'readonly', s => s.get(id)),
  all: async st => (await tx(st, 'readonly', s => s.getAll())) || [],
  async del(st, id) { await tx(st, 'readwrite', s => s.delete(id)); D.fire('blobs:' + st); },
  async clearAll() { for (const s of STORES) { await tx(s, 'readwrite', x => x.clear()); D.fire('blobs:' + s); } }
};

/* --------------------------------------------------- Python backend API */
const KEYN = 'duo27:key';
D.api = {
  up: false, info: null, _t: 0,
  key() { try { return localStorage.getItem(KEYN) || ''; } catch (e) { return ''; } },
  setKey(k) { try { k ? localStorage.setItem(KEYN, k) : localStorage.removeItem(KEYN); } catch (e) {} },
  initKey() { const m = /[#&?]key=([\w-]{6,128})/.exec(location.hash); if (m) { this.setKey(m[1]); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} } },
  async ping() {
    try {
      const r = await fetch('api/ping', { cache: 'no-store', headers: this.key() ? { 'X-Duo-Token': this.key() } : {} });
      const j = r.ok ? await r.json() : null;
      this.up = !!(j && j.duo); this.info = this.up ? j : null;
    } catch (e) { this.up = false; this.info = null; }
    D.fire('api'); return this.up;
  },
  async call(path, opts = {}) {
    const r = await fetch(path, { cache: 'no-store', ...opts, headers: { ...(opts.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.key() ? { 'X-Duo-Token': this.key() } : {}), ...(opts.headers || {}) }, body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body });
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : await r.text();
    if (!r.ok) throw new Error((data && data.error) || r.statusText);
    return data;
  },
  queueSync() { if (!this.up) return; clearTimeout(this._t); this._t = setTimeout(() => this.push().catch(() => {}), 900); },
  push() { return this.call('api/state', { method: 'PUT', json: D.store.snapshot() }); },
  async pull() {
    const s = await this.call('api/state'); if (!s || typeof s !== 'object') return;
    Object.keys(s).forEach(k => { mem.set(k, s[k]); try { localStorage.setItem(PFX + k, JSON.stringify(s[k])); } catch (e) {} emit(k); });
    D.settings.apply();
  }
};

/* ------------------------------------------------------------ settings */
const DEF = { wallpaper: 'aurora', glass: 'frosted', blur: 26, brightness: 1, accent: '#0a84ff', hour24: false, reduceMotion: false, stiffness: 150, damping: 0.74, deviceName: 'iPhone Duo', volume: 0.7, grain: true, sounds: true, units: 'c' };
D.settings = {
  DEF,
  all() { return { ...DEF, ...D.store.get('settings', {}) }; },
  get(k) { return this.all()[k]; },
  set(p) { D.store.set('settings', { ...D.store.get('settings', {}), ...p }); this.apply(); },
  apply() {
    const s = this.all(), r = document.documentElement;
    r.style.setProperty('--blur', s.blur); r.style.setProperty('--bright', s.brightness); r.style.setProperty('--accent', s.accent);
    r.dataset.tint = s.glass; r.dataset.wall = s.wallpaper; r.dataset.grain = s.grain ? 'on' : 'off'; r.dataset.motion = s.reduceMotion ? 'reduce' : 'full';
    D.audio.setVolume(s.volume); D.fire('settings', s);
  }
};
D.WALLPAPERS = [['aurora', 'Aurora'], ['solstice', 'Solstice'], ['lagoon', 'Lagoon'], ['orchid', 'Orchid'], ['ember', 'Ember'], ['graphite', 'Graphite']];
D.fmtTime = (d = new Date(), secs = false) => {
  const h24 = D.settings.get('hour24'); let H = d.getHours(); const m = D.pad(d.getMinutes()), s = secs ? ':' + D.pad(d.getSeconds()) : '';
  if (h24) return D.pad(H) + ':' + m + s;
  const ap = H >= 12 ? ' PM' : ' AM'; H = H % 12 || 12; return H + ':' + m + s + (secs ? ap : '');
};
D.fmtClock = (d = new Date()) => { const h24 = D.settings.get('hour24'); let H = d.getHours(); if (!h24) H = H % 12 || 12; return (h24 ? D.pad(H) : H) + ':' + D.pad(d.getMinutes()); };
D.fmtDate = (d = new Date(), o = { weekday: 'long', month: 'long', day: 'numeric' }) => d.toLocaleDateString(undefined, o);
D.dayKey = (d = new Date()) => d.getFullYear() + '-' + D.pad(d.getMonth() + 1) + '-' + D.pad(d.getDate());

/* --------------------------------------------------------------- audio */
let ac = null, master = null, analyser = null, vol = 0.7;
D.audio = {
  get ctx() { return this.get(); },
  get() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ac = new C(); master = ac.createGain(); master.gain.value = vol; analyser = ac.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = .82;
      master.connect(analyser); analyser.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  },
  get master() { this.get(); return master; }, get analyser() { this.get(); return analyser; },
  setVolume(v) { vol = v; if (master) master.gain.value = v; D.fire('volume', v); },
  beep(freq = 880, dur = .14, type = 'sine', gain = .22, when = 0) {
    const c = this.get(); if (!c) return; const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  },
  click() { if (D.settings.get('sounds')) this.beep(1500, .03, 'triangle', .05); },
  chime() { [880, 1174.7, 1568].forEach((f, i) => this.beep(f, .5, 'sine', .2, i * .12)); },
  alarm(n = 4) { for (let i = 0; i < n; i++) { this.beep(988, .16, 'square', .12, i * .4); this.beep(988, .16, 'square', .12, i * .4 + .2); } }
};
addEventListener('pointerdown', () => D.audio.get(), { once: true, capture: true });

/* ---------------------------------------------------------- notifications */
D.toast = o => D.screens.forEach(s => s.toast(o));
})();
