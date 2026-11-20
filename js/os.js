/* =====================================================================
   OS shell — Screen (one per physical display), power/boot, lock,
   status bar, widgets, home screens, app host, dialogs, keyboard.
   ===================================================================== */
(function () {
'use strict';
const D = window.Duo, h = D.h;
const devEl = () => document.getElementById('device');

D.registerApp = def => { D.apps[def.id] = def; if (!D.appOrder.includes(def.id)) D.appOrder.push(def.id); };
const have = ids => ids.filter(id => D.apps[id]);
D.layout = {
  dock: ['messages', 'browser', 'camera', 'music', 'settings'],
  grid: ['clock', 'calendar', 'weather', 'notes', 'reminders', 'calculator', 'photos', 'maps', 'files', 'contacts', 'voicememos', 'converter', 'freeform', 'terminal', 'game']
};
D.scale = () => parseFloat(document.getElementById('rig').style.getPropertyValue('--s')) || 1;
D.active = () => D.screens.find(s => s.kind === (D.fold && D.fold.folded ? 'cover' : 'inner'));
D.openApp = (id, args) => { const s = D.active(); if (s) { D.lock.set(false); s.open(id, null, args); } };

/* ------------------------------------------------------------ system */
const tickers = new Set();
D.sys = {
  battery: { level: 1, charging: false },
  onTick(fn) { tickers.add(fn); try { fn(); } catch (e) { console.error(e); } return () => tickers.delete(fn); }
};
setInterval(() => tickers.forEach(f => { try { f(); } catch (e) { console.error(e); } }), 1000);
if (navigator.getBattery) navigator.getBattery().then(b => {
  const u = () => { D.sys.battery = { level: b.level, charging: b.charging }; D.fire('battery'); };
  b.addEventListener('levelchange', u); b.addEventListener('chargingchange', u); u();
}).catch(() => {});
addEventListener('online', () => D.fire('net')); addEventListener('offline', () => D.fire('net'));

/* -------------------------------------------------------- power & lock */
D.lock = {
  get: () => devEl().dataset.locked === 'true',
  set(v) { devEl().dataset.locked = v ? 'true' : 'false'; D.fire('lock', v); }
};
let bootTimer = 0;
D.power = {
  state: 'booting',
  set(s) { this.state = s; devEl().dataset.power = s; D.fire('power', s); },
  boot() {
    clearTimeout(bootTimer); this.set('booting'); D.lock.set(true);
    bootTimer = setTimeout(() => { this.set('on'); D.audio.chime && D.settings.get('sounds') && D.audio.beep(660, .25, 'sine', .08); }, 3400);
  },
  off() { clearTimeout(bootTimer); this.set('off'); },
  toggle() { this.state === 'off' ? this.boot() : this.off(); },
  restart() { D.screens.forEach(s => s.close(true)); this.off(); setTimeout(() => this.boot(), 900); }
};

/* ------------------------------------------------------------- widgets */
const W = {
  clock(screen) {
    const t = h('div.t'), d = h('div.d'), el = h('div.clockw', [t, d]);
    D.sys.onTick(() => { const a = D.fmtClock(), b = D.fmtDate(); if (t.textContent !== a) t.textContent = a; if (d.textContent !== b) d.textContent = b; });
    return el;
  },
  weather(screen) {
    const el = h('div.wg.glass.wx', { role: 'button', onclick: () => screen.open('weather', el) });
    const r = () => {
      const c = D.weather && D.weather.current();
      el.replaceChildren(h('div.eyebrow', c ? c.city : 'WEATHER'), h('div.temp', c ? c.temp + '°' : '--°'),
        h('div.cond', c ? c.desc : 'Tap to set up'), ...(c ? [h('div.hl', 'H:' + c.hi + '°  L:' + c.lo + '°')] : []));
    };
    D.store.on('weather', r); D.on('settings', r); r(); return el;
  },
  music(screen) {
    const art = h('div.art'), tt = h('div.tt'), ar = h('div.ar'), pg = h('div.prog', h('i'));
    const btn = (ic, fn, l) => h('button', { 'aria-label': l, onclick: e => { e.stopPropagation(); fn(); } }, D.ico(ic));
    const pp = btn('play', () => D.music.toggle(), 'Play or pause');
    const el = h('div.wg.glass.mu', { role: 'button', onclick: () => screen.open('music', el) },
      [art, tt, ar, pg, h('div.ctrl', [btn('prev', () => D.music.prev(), 'Previous'), pp, btn('next', () => D.music.next(), 'Next')])]);
    const r = () => { const t = D.music.current(); tt.textContent = t ? t.title : 'Not playing'; ar.textContent = t ? t.artist : 'Music'; pp.replaceChildren(D.ico(D.music.playing ? 'pause' : 'play')); el.classList.toggle('playing', D.music.playing); };
    D.on('music', r); D.on('music:tick', () => { pg.firstChild.style.transform = `scaleX(${D.music.progress()})`; }); r(); return el;
  },
  agenda(screen) {
    const el = h('div.wg.glass.ag', { role: 'button', onclick: () => screen.open('calendar', el) });
    const r = () => {
      const items = D.calendar ? D.calendar.upcoming(3) : [];
      el.replaceChildren(h('div.eyebrow', 'UP NEXT'), items.length ? items.map(it => h('div.agi', [h('i', { style: 'background:' + it.color }), h('div', [h('b', it.title), h('span', it.when)])])) : h('div.agnone', 'Nothing scheduled'));
    };
    D.store.on('events', r); D.store.on('reminders', r); D.sys.onTick(() => { if (new Date().getSeconds() === 0) r(); }); r(); return el;
  }
};

const LOGO = '<div class="lg a"></div><div class="lg b"></div><div class="lg shine"></div>';

/* -------------------------------------------------------------- Screen */
class Screen {
  constructor(root, kind) {
    this.root = root; this.kind = kind; this.wide = kind === 'inner'; this.app = null;
    root.classList.add('ui', 'k-' + kind); this.build(); D.screens.push(this);
  }
  build() {
    const r = this.root; r.replaceChildren();
    this.wall = h('div.wall', [1, 2, 3, 4, 5, 6].map(n => h('i.b' + n)));
    this.home = h('div.home'); this.host = h('div.apphost'); this.toasts = h('div.toasts');
    this.sb = this.statusBar(); this.lock = this.lockScreen(); this.setupEl = D.setup ? D.setup.mount(this) : null; this.boot = h('div.boot', [h('div.logo', { html: LOGO }), h('div.bname', 'iOS 27'), h('div.bbar', h('i'))]);
    let y0 = null;
    this.bar = h('div.homebar', { role: 'button', 'aria-label': 'Home',
      onpointerdown: e => { y0 = e.clientY; try { this.bar.setPointerCapture(e.pointerId); } catch (_) {} }, onpointercancel: () => { y0 = null; }, onpointerup: e => { if (y0 != null && (Math.abs(e.clientY - y0) < 6 || (e.clientY - y0) / D.scale() < -24)) this.close(); y0 = null; } });
    r.append(this.wall, this.home, this.host, this.sb, this.toasts, this.lock, this.bar, ...(this.setupEl ? [this.setupEl] : []), this.boot);
    this.wide ? this.homeWide() : this.homeNarrow();
  }
  statusBar() {
    const t = h('span.t'), wifi = h('span.wifi'), batt = h('span.batt', h('i')), bars = h('span.bars', [1, 2, 3, 4].map(() => h('b'))), gen = h('span.gen'), nosim = h('span.off', 'No SIM');
    const upd = () => {
      const a = D.fmtTime(); if (t.textContent !== a) t.textContent = a;
      const b = D.sys.battery; batt.firstChild.style.width = Math.round(b.level * 100) + '%';
      batt.classList.toggle('chg', b.charging); batt.classList.toggle('low', b.level < .2 && !b.charging);
      const n = D.net ? D.net.get() : { cell: { on: true, gen: '5G' }, wifi: { on: navigator.onLine } };
      bars.classList.toggle('hide', !n.cell.on); gen.classList.toggle('hide', !n.cell.on); nosim.classList.toggle('hide', n.cell.on); gen.textContent = n.cell.gen || '';
      const key = n.wifi.on ? 'on:' + n.wifi.ssid : 'off'; if (wifi.dataset.k !== key) { wifi.dataset.k = key; wifi.title = n.wifi.on ? n.wifi.ssid : ''; wifi.innerHTML = n.wifi.on ? D.icon('wifi') : ''; }
    };
    D.sys.onTick(upd); D.on('battery', upd); D.on('net', upd); D.on('settings', upd); D.store.on('net', upd);
    return h('div.sb', [h('span.l', t), h('span.r', [nosim, bars, gen, wifi, batt])]);
  }
  lockScreen() {
    const time = h('div.l-time'), date = h('div.l-date');
    D.sys.onTick(() => { const a = D.fmtClock(), b = D.fmtDate(); if (time.textContent !== a) time.textContent = a; if (date.textContent !== b) date.textContent = b; });
    const cam = h('button.l-cam.glass', { 'aria-label': 'Camera', onpointerdown: e => e.stopPropagation(), onclick: e => { e.stopPropagation(); D.lock.set(false); this.open('camera'); } }, D.ico('camera'));
    const el = h('div.lock', { role: 'button', tabindex: 0, 'aria-label': 'Swipe up to unlock' },
      [time, date, h('div.l-wx', []), h('div.l-hint', [D.ico('chev'), h('span', 'Swipe up to unlock')]), cam]);
    const wx = el.querySelector('.l-wx'), rw = () => { const c = D.weather && D.weather.current(); wx.textContent = c ? `${c.city}  ·  ${c.temp}°  ${c.desc}` : ''; };
    D.store.on('weather', rw); rw();
    let y0 = null;
    el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; y0 = e.clientY; try { el.setPointerCapture(e.pointerId); } catch (_) {} el.style.transition = 'none'; });
    el.addEventListener('pointermove', e => { if (y0 == null) return; el.style.transform = `translateY(${Math.min(0, (e.clientY - y0) / D.scale())}px)`; });
    const end = e => {
      if (y0 == null) return; const dy = (e.clientY - y0) / D.scale(); y0 = null; el.style.transition = ''; el.style.transform = '';
      if (dy < -70 || Math.abs(dy) < 6) D.lock.set(false);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { y0 = null; el.style.transition = ''; el.style.transform = ''; });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); D.lock.set(false); } });
    return el;
  }
  iconBtn(id) {
    const a = D.apps[id];
    const tile = h('span.tile', { style: `background:linear-gradient(160deg,${a.c[0]},${a.c[1]})` }, a.tile ? a.tile() : h('span.g', { html: D.icon(a.icon) }));
    const b = h('button.icon', { 'aria-label': a.name, dataset: { app: id }, onclick: () => this.open(id, b) }, tile, h('span.lbl', a.name));
    return b;
  }
  homeWide() {
    const hm = this.home;
    const grid = h('div.grid', have(D.layout.grid).map(id => this.iconBtn(id)));
    const br = D.ui.range({ min: .35, max: 1, step: .01, value: D.settings.get('brightness'), label: 'Brightness', onInput: v => D.settings.set({ brightness: v }) });
    const vo = D.ui.range({ min: 0, max: 1, step: .01, value: D.settings.get('volume'), label: 'Volume', onInput: v => { D.settings.set({ volume: v }); } });
    D.on('settings', s => { br.set(s.brightness); vo.set(s.volume); });
    hm.append(
      h('div.clockcard.glass', W.clock(this)),
      h('div.widgets', [W.weather(this), W.music(this), W.agenda(this)]),
      grid,
      h('div.strip.glass', [h('span.si', D.ico('sun')), br, h('span.si', D.ico('volume')), vo]),
      h('div.dock.glass', [h('span.shine'), have(D.layout.dock).map(id => this.iconBtn(id))])
    );
  }
  homeNarrow() {
    const hm = this.home, ids = have(D.layout.grid), pages = [];
    for (let i = 0; i < ids.length; i += 12) pages.push(ids.slice(i, i + 12));
    const sc = h('div.pager', pages.map(p => h('div.page', p.map(id => this.iconBtn(id)))));
    const dots = h('div.dots', pages.map((_, i) => h('button', { 'aria-label': 'Page ' + (i + 1), onclick: () => sc.scrollTo({ left: i * sc.clientWidth, behavior: 'smooth' }) })));
    const upd = () => { const i = Math.round(sc.scrollLeft / (sc.clientWidth || 1)); [...dots.children].forEach((d, n) => d.classList.toggle('on', n === i)); };
    sc.addEventListener('scroll', upd); upd(); dots.firstChild && dots.firstChild.classList.add('on');
    let sx = null, sl = 0, moved = false;
    sc.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { sx = e.clientX; sl = sc.scrollLeft; moved = false; } });
    sc.addEventListener('pointermove', e => { if (sx == null) return; const dx = (e.clientX - sx) / D.scale(); if (Math.abs(dx) > 6) { moved = true; sc.style.scrollSnapType = 'none'; sc.scrollLeft = sl - dx; } });
    const up = () => { if (sx == null) return; sx = null; sc.style.scrollSnapType = ''; if (moved) sc.scrollTo({ left: Math.round(sc.scrollLeft / sc.clientWidth) * sc.clientWidth, behavior: 'smooth' }); };
    sc.addEventListener('pointerup', up); sc.addEventListener('pointerleave', up);
    sc.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    hm.append(W.clock(this), h('div.widgets', [W.weather(this), W.music(this)]), sc, dots,
      h('div.dock.glass', [h('span.shine'), have(D.layout.dock).map(id => this.iconBtn(id))]));
  }
  origin(el) {
    if (!el) return [this.root.offsetWidth / 2, this.root.offsetHeight / 2];
    let x = el.offsetWidth / 2, y = el.offsetHeight / 2, n = el;
    while (n && n !== this.root) { x += n.offsetLeft; y += n.offsetTop; const p = n.offsetParent; if (p && p !== this.root) { x -= p.scrollLeft; y -= p.scrollTop; } n = p; }
    return [x, y];
  }
  /* ---- app host ---- */
  open(id, from, args) {
    const def = D.apps[id]; if (!def) return;
    if (this.app) { if (this.app.id === id && !args) return; this.close(true); }
    const [ox, oy] = this.origin(from);
    const body = h('div.app-body.k-' + this.kind), win = h('div.app', { dataset: { app: id }, style: `--ox:${ox}px;--oy:${oy}px` }, body);
    const a = this.app = { id, def, win, body, cleanups: [], keyFns: [], ctx: null, inst: null };
    a.ctx = this.makeCtx(a, args);
    this.host.append(win);
    try { a.inst = def.mount(body, a.ctx) || {}; } catch (e) { console.error(e); body.append(h('div.pad', { style: 'padding-top:80px' }, 'This app hit an error: ' + e.message)); a.inst = {}; }
    requestAnimationFrame(() => requestAnimationFrame(() => win.classList.add('open')));
    this.home.classList.add('away'); this.root.dataset.app = id; D.fire('app:open', this, id);
  }
  close(instant) {
    const a = this.app; if (!a) return; this.app = null;
    try { a.inst && a.inst.destroy && a.inst.destroy(); } catch (e) { console.error(e); }
    a.cleanups.forEach(f => { try { f(); } catch (e) { console.error(e); } });
    this.home.classList.remove('away'); delete this.root.dataset.app;
    if (instant) a.win.remove(); else { a.win.classList.remove('open'); setTimeout(() => a.win.remove(), 460); }
    D.fire('app:close', this, a.id);
  }
  makeCtx(a, args) {
    const screen = this, win = a.win;
    const dlg = (title, bodyEls, buttons, onBackdrop) => new Promise(res => {
      const done = v => { d.remove(); res(v); };
      const d = h('div.dlg', { onclick: e => { if (e.target === d) done(onBackdrop); } },
        h('div.dlg-card.glass', [h('h3', title), bodyEls, h('div.dlg-b', buttons(done))]));
      win.append(d); requestAnimationFrame(() => d.classList.add('in'));
      return d;
    });
    return {
      screen, kind: this.kind, wide: this.wide, args: args || {}, body: a.body,
      close: () => screen.close(), open: (id, ar) => screen.open(id, null, ar), toast: o => screen.toast(o),
      sub: (k, fn) => a.cleanups.push(D.store.on(k, fn)), bus: (ev, fn) => a.cleanups.push(D.on(ev, fn)),
      tick: fn => a.cleanups.push(D.sys.onTick(fn)), cleanup: fn => a.cleanups.push(fn),
      listen: (t, ev, fn, o) => { t.addEventListener(ev, fn, o); a.cleanups.push(() => t.removeEventListener(ev, fn, o)); },
      keys: (fn, o = {}) => a.keyFns.push(e => { const t = e.target; if (!o.inputs && t && (t.matches && t.matches('input,textarea,select,[contenteditable]'))) return; fn(e); }),
      prompt: (title, o = {}) => new Promise(res => {
        const inp = o.multiline ? h('textarea.input', { rows: 4, value: o.value || '', placeholder: o.placeholder || '' }) : D.ui.input({ value: o.value || '', placeholder: o.placeholder || '', type: o.type || 'text' });
        let d; const done = v => { d.remove(); res(v); };
        d = h('div.dlg', { onclick: e => { if (e.target === d) done(null); } },
          h('div.dlg-card.glass', [h('h3', title), o.message && h('p', o.message), inp,
            h('div.dlg-b', [h('button.btn', { onclick: () => done(null) }, 'Cancel'), h('button.btn.primary', { onclick: () => done(inp.value) }, o.ok || 'OK')])]));
        inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !o.multiline) done(inp.value); if (e.key === 'Escape') done(null); });
        win.append(d); requestAnimationFrame(() => d.classList.add('in')); setTimeout(() => inp.focus(), 60);
      }),
      confirm: (title, message, o = {}) => dlg(title, message && h('p', message), done => [h('button.btn', { onclick: () => done(false) }, 'Cancel'), h('button.btn.primary', { class: o.danger ? 'danger' : '', onclick: () => done(true) }, o.ok || 'OK')], false),
      alert: (title, message) => dlg(title, message && h('p', message), done => [h('button.btn.primary', { onclick: () => done(true) }, 'OK')], true),
      /* action sheet: items = [[label, value?, cssClass?], …] → resolves with value (or label) / null */
      menu: (title, items) => new Promise(res => {
        let d; const done = v => { d.remove(); res(v); };
        d = h('div.dlg.sheet', { onclick: e => { if (e.target === d) done(null); } },
          h('div.dlg-card.glass', [title && h('h3', title),
            h('div.menu', items.map(([label, val, cls]) => h('button.btn.menuitem', { class: cls || '', onclick: () => done(val === undefined ? label : val) }, label))),
            h('div.dlg-b', h('button.btn', { onclick: () => done(null) }, 'Cancel'))]));
        win.append(d); requestAnimationFrame(() => d.classList.add('in'));
      })
    };
  }
  toast(o) {
    const t = h('div.toast.glass', { role: 'status', onclick: () => { t.remove(); if (o.app) { D.lock.set(false); this.open(o.app, null, o.args); } } },
      [h('span.tile.sm', { html: D.icon(o.icon || 'bell') }), h('div.tx', [h('b', o.title || ''), o.body && h('span', o.body)])]);
    this.toasts.append(t); requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 450); }, o.ms || 4500);
  }
}
D.Screen = Screen;

/* ---------------------------------------------------------- keyboard */
addEventListener('keydown', e => {
  const s = D.active(); if (!s || D.power.state !== 'on') return;
  const typing = e.target && e.target.matches && e.target.matches('input,textarea,select,[contenteditable]');
  if (D.lock.get()) { if ((e.key === 'Enter' || e.key === ' ') && !typing) { e.preventDefault(); D.lock.set(false); } return; }
  const a = s.app; if (!a) return;
  if (e.key === 'Escape') { const d = a.win.querySelector('.dlg'); if (d) { d.remove(); return; } s.close(); return; }
  a.keyFns.forEach(f => f(e));
}, true);
})();
