/* System apps: Files, Terminal, Settings.
   D.fs is a real virtual file system persisted in localStorage. When server.py is
   running, Files also gets a "Server" tab that reads and writes real files in ./storage. */
(function () {
'use strict';
const D = window.Duo, h = D.h, ui = D.ui;

/* ======================================================================= VFS */
const SEED = () => ({ type: 'dir', c: { Documents: { type: 'dir', c: { 'welcome.txt': { type: 'file', t: 'Welcome to iPhone Duo OS.\nEverything in this folder is stored on this device.\n', ts: Date.now() } } }, Downloads: { type: 'dir', c: {} }, Pictures: { type: 'dir', c: {} } } });
const root = () => D.store.get('fs', SEED);
const parts = p => p.split('/').filter(Boolean);
const norm = (p, cwd = '/') => { const o = []; (p.startsWith('/') ? p : cwd + '/' + p).split('/').forEach(s => { if (!s || s === '.') return; if (s === '..') o.pop(); else o.push(s); }); return '/' + o.join('/'); };
const fs = D.fs = {
  norm,
  node(p) { let n = root(); for (const s of parts(p)) { if (!n || n.type !== 'dir' || !Object.prototype.hasOwnProperty.call(n.c, s)) return null; n = n.c[s]; } return n; },
  _mut(fn) { const r = JSON.parse(JSON.stringify(root())); const out = fn(r); D.store.set('fs', r); return out; },
  _parent(r, p) { const ps = parts(p), name = ps.pop(); let n = r; for (const s of ps) { n = n.c && n.c[s]; if (!n || n.type !== 'dir') throw new Error('No such directory: ' + p); } return [n, name]; },
  ls(p) { const n = fs.node(p); if (!n) throw new Error('No such file or directory: ' + p); if (n.type !== 'dir') return [[p.split('/').pop(), n]]; return Object.entries(n.c).sort((a, b) => (b[1].type === 'dir') - (a[1].type === 'dir') || a[0].localeCompare(b[0])); },
  read(p) { const n = fs.node(p); if (!n) throw new Error('No such file: ' + p); if (n.type === 'dir') throw new Error(p + ' is a directory'); return n.t; },
  write(p, t, append) { return fs._mut(r => { const [d, name] = fs._parent(r, p); if (!name) throw new Error('Bad path'); if (d.c[name] && d.c[name].type === 'dir') throw new Error(p + ' is a directory'); d.c[name] = { type: 'file', t: (append && d.c[name] ? d.c[name].t : '') + t, ts: Date.now() }; }); },
  mkdir(p) { return fs._mut(r => { const [d, name] = fs._parent(r, p); if (!name) throw new Error('Bad path'); if (d.c[name]) throw new Error('Already exists: ' + p); d.c[name] = { type: 'dir', c: {} }; }); },
  rm(p) { return fs._mut(r => { const [d, name] = fs._parent(r, p); if (!name || !d.c[name]) throw new Error('No such file or directory: ' + p); delete d.c[name]; }); },
  mv(a, b) { const n = fs.node(a); if (!n) throw new Error('No such file or directory: ' + a); if (fs.node(b) && fs.node(b).type === 'dir') b = norm(a.split('/').pop(), b); if (b === a || b.startsWith(a + '/')) throw new Error('Cannot move into itself'); const copy = JSON.parse(JSON.stringify(n)); fs._mut(r => { const [d2, n2] = fs._parent(r, b); d2.c[n2] = copy; const [d1, n1] = fs._parent(r, a); delete d1.c[n1]; }); },
  cp(a, b) { const n = fs.node(a); if (!n) throw new Error('No such file or directory: ' + a); if (fs.node(b) && fs.node(b).type === 'dir') b = norm(a.split('/').pop(), b); const copy = JSON.parse(JSON.stringify(n)); fs._mut(r => { const [d, name] = fs._parent(r, b); d.c[name] = copy; }); },
  size(n) { return n.type === 'file' ? n.t.length : Object.values(n.c).reduce((s, x) => s + fs.size(x), 0); }
};

/* ===================================================================== Files */
D.registerApp({ id: 'files', name: 'Files', icon: 'files', c: ['#2f8fff', '#0b4fd0'], mount(body, ctx) {
  let where = D.store.get('files.where', 'local'), path = '/', edit = null; const view = h('div.fill.col'), crumbs = h('div.crumbs');
  const remote = () => where === 'server';
  const srv = async (url, o) => D.api.call(url, o);
  const q = p => 'api/' + 'files?path=' + encodeURIComponent(p);
  const err = e => ctx.alert('Error', e.message || String(e));
  const join = (a, b) => (a === '/' ? '' : a) + '/' + b;
  async function entries() {
    if (!remote()) return fs.ls(path).map(([n, x]) => ({ name: n, dir: x.type === 'dir', size: x.type === 'file' ? x.t.length : fs.size(x), mtime: x.ts }));
    const r = await srv(q(path)); return r.entries.map(e => ({ name: e.name, dir: e.dir, size: e.size, mtime: e.mtime * 1000 }));
  }
  const readTxt = async p => remote() ? (await srv('api/file?path=' + encodeURIComponent(p))) : fs.read(p);
  const writeTxt = async (p, t) => remote() ? srv('api/file?path=' + encodeURIComponent(p), { method: 'PUT', body: t, headers: { 'Content-Type': 'text/plain' } }) : fs.write(p, t);
  const mkdir = async p => remote() ? srv('api/mkdir?path=' + encodeURIComponent(p), { method: 'POST' }) : fs.mkdir(p);
  const del = async p => remote() ? srv('api/file?path=' + encodeURIComponent(p), { method: 'DELETE' }) : fs.rm(p);

  async function render() {
    crumbs.replaceChildren(...['/', ...parts(path)].map((s, i, a) => h('button.crumb', { onclick: () => { path = '/' + a.slice(1, i + 1).join('/'); render(); } }, s === '/' ? (remote() ? 'Server' : 'This iPhone') : s)));
    if (edit) return renderEdit();
    let list; try { list = await entries(); } catch (e) { view.replaceChildren(ui.empty('files', 'Can’t open', e.message)); return; }
    const card = h('div.card', list.length ? list.map(e => h('div.lrow', { onclick: async () => { if (e.dir) { path = join(path, e.name); render(); } else openFile(join(path, e.name)); } },
      [h('span.fic', { class: e.dir ? 'dir' : '' }, D.ico(e.dir ? 'files' : 'file')), h('div.tx', [h('b', e.name), h('span', (e.dir ? '' : D.bytes(e.size)) + (e.mtime ? (e.dir ? '' : ' · ') + new Date(e.mtime).toLocaleDateString() : ''))]),
        h('button.ibtn', { 'aria-label': 'Actions for ' + e.name, onclick: ev => { ev.stopPropagation(); actions(e); } }, D.ico('edit'))])) : [ui.empty('files', 'Empty folder', 'Create a file or folder with the buttons below.')]);
    view.replaceChildren(h('div.scroll', card));
  }
  async function actions(e) {
    const p = join(path, e.name), a = await ctx.menu(e.name, [...(e.dir ? [] : [['Download', 'dl']]), ['Rename', 'rn'], ['Delete', 'del', 'danger']]); if (!a) return;
    try {
      if (a === 'dl') D.download(e.name, await readTxt(p));
      if (a === 'del' && await ctx.confirm('Delete “' + e.name + '”?', '', { ok: 'Delete', danger: true })) { await del(p); }
      if (a === 'rn') { const n = await ctx.prompt('Rename', { value: e.name, ok: 'Rename' }); if (n && n !== e.name) { if (remote()) { const t = await readTxt(p); await writeTxt(join(path, n), t); await del(p); } else fs.mv(p, join(path, n)); } }
    } catch (x) { err(x); } render();
  }
  async function openFile(p) { try { const t = await readTxt(p); edit = { p, t: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }; render(); } catch (e) { err(e); } }
  function renderEdit() {
    const ta = h('textarea.editor', { value: edit.t, spellcheck: false, 'aria-label': 'File contents' }); let dirty = false; ta.oninput = () => { dirty = true; };
    view.replaceChildren(h('div.rowf', { style: 'padding:6px 14px;gap:10px' }, [ui.back(() => { edit = null; render(); }, 'Back'), h('b.grow', edit.p.split('/').pop()), h('button.btn.primary.sm', { onclick: async () => { try { await writeTxt(edit.p, ta.value); dirty = false; ctx.toast({ title: 'Saved', body: edit.p, icon: 'files' }); } catch (e) { err(e); } } }, 'Save')]), h('div.fill', { style: 'padding:0 12px 12px' }, ta));
  }
  const newFile = async () => { const n = await ctx.prompt('New file', { placeholder: 'name.txt', ok: 'Create' }); if (!n) return; try { await writeTxt(join(path, n.replace(/\//g, '-')), ''); } catch (e) { err(e); } render(); };
  const newDir = async () => { const n = await ctx.prompt('New folder', { placeholder: 'Folder name', ok: 'Create' }); if (!n) return; try { await mkdir(join(path, n.replace(/\//g, '-'))); } catch (e) { err(e); } render(); };
  const upload = async () => { const fl = await D.pickFile('text/*,.json,.md,.csv,.js,.py,.html,.css,.txt', true); for (const f of fl) { try { if (f.size > 2e6) throw new Error(f.name + ' is larger than 2 MB'); await writeTxt(join(path, f.name), await D.readFile(f)); } catch (e) { err(e); } } render(); };
  const tabs = ui.seg([['local', 'On device'], ['server', 'Server']], where, v => { if (v === 'server' && !D.api.up) { tabs.set(where); return ctx.alert('Server offline', 'Start it with:  python3 server.py  and reload this page from http://localhost:8080.'); } where = v; D.store.set('files.where', v); path = '/'; edit = null; render(); });
  if (where === 'server' && !D.api.up) { where = 'local'; tabs.set('local'); }
  body.append(ui.nav('Files'), h('div.tabs', tabs), crumbs, view, h('div.toolbar.center', [h('button.btn', { onclick: newFile }, D.ico('plus'), 'File'), h('button.btn', { onclick: newDir }, D.ico('plus'), 'Folder'), h('button.btn', { onclick: upload }, D.ico('upload'), 'Upload')]));
  ctx.bus('api', () => { if (remote() && !D.api.up) { where = 'local'; tabs.set('local'); path = '/'; render(); } });
  ctx.sub('fs', () => { if (!remote() && !edit) render(); }); render();
} });

/* ================================================================== Terminal */
D.registerApp({ id: 'terminal', name: 'Terminal', icon: 'terminal', c: ['#2b2b30', '#050507'], mount(body, ctx) {
  let cwd = '/', hist = D.store.get('term.hist', []), hi = -1; const out = h('div.tout', { role: 'log' }), inp = h('input.tin', { autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': 'Command' }), pr = h('span.tprompt');
  const user = 'duo', host = () => D.settings.get('deviceName').toLowerCase().replace(/\s+/g, '-');
  const prompt = () => { pr.textContent = `${user}@${host()}:${cwd === '/' ? '/' : cwd.replace(/^\/(.*)$/, '~/$1')}$`; };
  const print = (t, cls = '') => { String(t).split('\n').forEach(l => out.append(h('div.tl', { class: cls }, l || ' '))); out.parentElement.scrollTop = out.parentElement.scrollHeight; };
  const P = p => fs.norm(p, cwd), up0 = Date.now();
  const C = {
    help: () => print('Commands: ' + Object.keys(C).sort().join('  ')),
    ls(a) { const flags = a.filter(x => x.startsWith('-')).join(''), ps = a.filter(x => !x.startsWith('-')), p = P(ps[0] || '.'); const e = fs.ls(p); print(flags.includes('l') ? e.map(([n, x]) => `${x.type === 'dir' ? 'd' : '-'}rw-  ${String(fs.size(x)).padStart(7)}  ${n}${x.type === 'dir' ? '/' : ''}`).join('\n') : e.map(([n, x]) => n + (x.type === 'dir' ? '/' : '')).join('   ') || ' '); },
    cd(a) { const p = P(a[0] || '/'), n = fs.node(p); if (!n) throw new Error('cd: no such directory: ' + (a[0] || '')); if (n.type !== 'dir') throw new Error('cd: not a directory'); cwd = p; prompt(); },
    pwd: () => print(cwd), whoami: () => print(user), hostname: () => print(host()),
    cat(a) { if (!a.length) throw new Error('cat: missing file'); a.forEach(f => print(fs.read(P(f)).replace(/\n$/, ''))); },
    mkdir(a) { a.forEach(p => fs.mkdir(P(p))); }, touch(a) { a.forEach(p => { if (!fs.node(P(p))) fs.write(P(p), ''); }); },
    rm(a) { const ps = a.filter(x => !x.startsWith('-')); if (!ps.length) throw new Error('rm: missing operand'); ps.forEach(p => { const n = fs.node(P(p)); if (n && n.type === 'dir' && !a.some(x => /^-.*r/.test(x))) throw new Error('rm: ' + p + ' is a directory (use -r)'); fs.rm(P(p)); }); },
    mv(a) { if (a.length < 2) throw new Error('mv: need source and destination'); fs.mv(P(a[0]), P(a[1])); }, cp(a) { if (a.length < 2) throw new Error('cp: need source and destination'); fs.cp(P(a[0]), P(a[1])); },
    head(a) { const n = a[0] === '-n' ? +a[1] : 10, f = a[0] === '-n' ? a[2] : a[0]; print(fs.read(P(f)).split('\n').slice(0, n).join('\n')); },
    tail(a) { const n = a[0] === '-n' ? +a[1] : 10, f = a[0] === '-n' ? a[2] : a[0]; print(fs.read(P(f)).replace(/\n$/, '').split('\n').slice(-n).join('\n')); },
    wc(a) { const t = fs.read(P(a[0])); print(`${t.split('\n').length - (t.endsWith('\n') ? 1 : 0)} ${(t.match(/\S+/g) || []).length} ${t.length} ${a[0]}`); },
    grep(a) { if (a.length < 2) throw new Error('grep: usage grep PATTERN FILE'); const re = new RegExp(a[0], 'i'); fs.read(P(a[1])).split('\n').forEach((l, i) => { if (re.test(l)) print(`${i + 1}: ${l}`); }); },
    date: () => print(new Date().toString()), uptime: () => print('up ' + ui.dur((Date.now() - up0) / 1000) + ' (this session)'),
    uname: () => print('DuoOS 27.0 (web) ' + navigator.platform), echo: () => {},
    clear: () => out.replaceChildren(), history: () => print(hist.map((c, i) => `${String(i + 1).padStart(4)}  ${c}`).join('\n')),
    calc(a) { print(D.fmtNum(D.calc(a.join(' ')))); },
    open(a) { if (!a[0] || !D.apps[a[0]]) throw new Error('open: unknown app. Try: ' + Object.keys(D.apps).join(' ')); ctx.open(a[0]); },
    apps: () => print(Object.keys(D.apps).join('  ')),
    neofetch() { print(`   ,--.     ${user}@${host()}\n  /    \\    ----------------\n  |  ◐  |   OS: DuoOS 27 (web)\n  \\    /    Display: 776x836 inner / 376x836 cover\n   '--'     Fold: ${Math.round(D.fold.angle)}°\n            Apps: ${Object.keys(D.apps).length}\n            Server: ${D.api.up ? 'online' : 'offline'}\n            UA: ${navigator.userAgent.slice(0, 40)}…`, 'accent'); },
    async sysinfo() { if (!D.api.up) throw new Error('sysinfo needs server.py (python3 server.py)'); const s = await D.api.call('api/sysinfo'); print(Object.entries(s).map(([k, v]) => k.padEnd(12) + String(v)).join('\n')); },
    async curl(a) { if (!a[0]) throw new Error('curl: usage curl URL'); const r = await fetch(a[0]); print((await r.text()).slice(0, 2000)); }
  };
  async function run(line) {
    print(pr.textContent + ' ' + line, 'cmd'); line = line.trim(); if (!line) return;
    hist = [...hist.filter(x => x !== line), line].slice(-60); D.store.set('term.hist', hist); hi = -1;
    // simple tokenizer with quotes and > / >> redirection (echo only)
    const tok = (line.match(/"[^"]*"|'[^']*'|>>|>|[^\s>]+/g) || []).map(t => /^["']/.test(t) ? t.slice(1, -1) : t);
    let redir = null, mode = false; const ri = tok.findIndex(t => t === '>' || t === '>>');
    if (ri >= 0) { mode = tok[ri] === '>>'; redir = tok[ri + 1]; tok.splice(ri); }
    const [cmd, ...args] = tok;
    try {
      if (cmd === 'echo') { const t = args.join(' '); if (redir) fs.write(P(redir), t + '\n', mode); else print(t); return; }
      if (!C[cmd]) { print(cmd + ': command not found. Try “help”.', 'err'); return; }
      await C[cmd](args);
    } catch (e) { print(e.message || String(e), 'err'); }
  }
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { const v = inp.value; inp.value = ''; run(v); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.min(hist.length - 1, hi + 1); inp.value = hist[hist.length - 1 - hi] || ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.max(-1, hi - 1); inp.value = hi < 0 ? '' : hist[hist.length - 1 - hi]; }
    else if (e.key === 'Tab') { e.preventDefault(); const w = inp.value.split(/\s+/), last = w.pop(), c = (w.length ? (() => { try { return fs.ls(P(last.includes('/') ? last.replace(/[^/]*$/, '') || '/' : '.')).map(x => x[0]); } catch (x) { return []; } })() : Object.keys(C)).filter(n => n.startsWith(last.split('/').pop())); if (c.length === 1) inp.value = [...w, (last.includes('/') ? last.replace(/[^/]*$/, '') : '') + c[0]].join(' '); else if (c.length) print(c.join('  ')); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.replaceChildren(); }
  });
  body.append(ui.nav('Terminal'), h('div.term', { onclick: () => inp.focus() }, [h('div.scroll.tscroll', out), h('div.tline', [pr, inp])]));
  print('DuoOS 27 shell. Type “help”. Files here are the same ones the Files app shows.', 'accent'); prompt(); setTimeout(() => inp.focus(), 380);
  if (ctx.args && ctx.args.cmd) run(ctx.args.cmd);
} });

/* ==================================================================== Settings */
D.registerApp({ id: 'settings', name: 'Settings', icon: 'settings', c: ['#8e8e93', '#48484a'], mount(body, ctx) {
  const S = () => D.settings.all(), set = p => D.settings.set(p);
  const stack = []; const view = h('div.fill.col'); const navt = ui.nav('Settings');
  const row = (label, right, onclick, icon) => h('div.lrow', { onclick, class: onclick ? 'tap' : '' }, [icon && h('span.sico', { style: `background:${icon[1]}` }, D.ico(icon[0])), h('div.tx', h('b', label)), right]);
  const sec = (title, ...rows) => h('div.setsec', [title && h('div.eyebrow', title), h('div.card', rows.filter(Boolean))]);
  const swrow = (label, key, ic) => row(label, ui.switch(S()[key], v => set({ [key]: v }), label), null, ic);
  const slider = (label, key, min, max, step, fmt = v => v) => { const val = h('span.muted', fmt(S()[key])); return h('div.lrow.col.slr', [h('div.rowf', { style: 'justify-content:space-between;width:100%' }, [h('b', label), val]), ui.range({ min, max, step, value: S()[key], label, onInput: v => { val.textContent = fmt(v); set({ [key]: v }); } })]); };
  const pages = {
    main() {
      const info = D.api.up ? 'Server online' : 'Server offline';
      const bid = D.store.get('bid', null), nt = D.net.get();
      return [h('div.profile.glass', { onclick: () => go('bid') }, [ui.avatar(bid ? bid.name : S().deviceName, 56), h('div.tx', [h('b', bid ? bid.name : S().deviceName), h('span', bid ? bid.email : 'Sign in with Banana ID'), h('span', 'DuoOS 27 · ' + info)])]),
        sec('', row('Wi-Fi', h('span.muted', nt.wifi.on ? nt.wifi.ssid : 'Off'), () => go('wifi'), ['wifi', '#0a84ff']), row('Cellular', h('span.muted', nt.cell.on ? nt.cell.gen : 'Off'), () => go('cell'), ['wifi', '#30d158']), row('Banana ID', h('span.muted', bid ? bid.name : 'Not signed in'), () => go('bid'), ['contacts', '#ffb800'])),
        sec('', row('Wallpaper', h('span.muted', D.WALLPAPERS.find(w => w[0] === S().wallpaper)[1]), () => go('wall'), ['photos', '#5e5ce6']), row('Display & Glass', null, () => go('display'), ['sun', '#0a84ff']), row('Fold & Motion', null, () => go('fold'), ['fold', '#ff9f0a']), row('Sounds', h('span.muted', S().sounds ? 'On' : 'Off'), () => go('sound'), ['volume', '#ff375f'])),
        sec('', row('Language', h('span.muted', (D.langs.find(l => l[0] === D.lang()) || ['', D.lang()])[1]), () => go('lang'), ['globe', '#5e5ce6']), row('General', null, () => go('general'), ['settings', '#8e8e93']), row('Storage', null, () => go('storage'), ['layers', '#30b0c7']), row('Server', h('span.muted', D.api.up ? 'Online' : 'Offline'), () => go('server'), ['wifi', '#34c759'])),
        sec('', row('Restart', null, async () => { if (await ctx.confirm('Restart iPhone Duo?', '', { ok: 'Restart' })) { ctx.close(); D.power.boot(); } }, ['refresh', '#636366']), row('Power off', null, async () => { if (await ctx.confirm('Power off?', 'Press P or the power button to start again.', { ok: 'Power off', danger: true })) { ctx.close(); D.power.off(); } }, ['power', '#ff453a']), row('About', null, () => go('about'), ['home', '#0a84ff']))];
    },
    wall() { return [sec('Wallpaper (original artwork, Liquid-Glass style)'), h('div.wgrid', D.WALLPAPERS.map(([k, n]) => h('button.wtile', { 'data-wall': k, class: S().wallpaper === k ? 'on' : '', 'aria-label': n, onclick: () => { set({ wallpaper: k }); render(); } }, [h('div.wall.wpv', { 'data-wall': k }, [h('i.b1'), h('i.b2'), h('i.b3'), h('i.b5')]), h('span', n)]))), swrow('Film grain', 'grain')]; },
    display() { return [sec('Glass', h('div.lrow', [h('div.tx', h('b', 'Material')), ui.seg([['clear', 'Clear'], ['frosted', 'Frosted'], ['tinted', 'Tinted']], S().glass, v => set({ glass: v }))]), slider('Blur', 'blur', 0, 50, 1, v => v + ' px'), slider('Brightness', 'brightness', .6, 1.3, .01, v => Math.round(v * 100) + '%')),
      sec('Accent', h('div.lrow', h('div.rowf.gap8', { style: 'flex-wrap:wrap' }, ['#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#64d2ff'].map(c => h('button.cdot', { style: 'background:' + c, 'aria-label': c, class: S().accent === c ? 'on' : '', onclick: () => { set({ accent: c }); render(); } }))))),
      sec('Time', swrow('24-hour time', 'hour24'), row('Temperature', ui.seg([['c', '°C'], ['f', '°F']], S().units, v => set({ units: v }))))]; },
    fold() { const P = { Soft: [110, .82], Default: [150, .74], Snappy: [230, .7] }, cur = Object.entries(P).find(([, v]) => v[0] === S().stiffness && v[1] === S().damping);
      return [sec('Fold physics', h('div.lrow', [h('div.tx', h('b', 'Hinge feel')), ui.seg(Object.keys(P).map(k => [k, k]), cur ? cur[0] : '', v => { set({ stiffness: P[v][0], damping: P[v][1] }); render(); })]), slider('Stiffness', 'stiffness', 60, 320, 5), slider('Damping', 'damping', .4, 1.1, .01, v => v.toFixed(2))),
        sec('Motion', swrow('Reduce motion', 'reduceMotion')), h('div.card', h('div.lrow', [h('button.btn.primary', { onclick: () => D.fold.toggle() }, D.ico('fold'), D.fold.folded ? 'Unfold now' : 'Fold now')]))]; },
    sound() { return [sec('', swrow('Interface sounds', 'sounds'), slider('Volume', 'volume', 0, 1, .01, v => Math.round(v * 100) + '%')), h('div.card', h('div.lrow', [h('button.btn', { onclick: () => D.audio.chime() }, 'Play test sound')]))]; },
    general() { const n = ui.input({ value: S().deviceName, 'aria-label': 'Device name', maxlength: 24 }); n.addEventListener('change', () => { set({ deviceName: n.value.trim() || 'iPhone Duo' }); });
      return [sec('Name', h('div.lrow', n)), sec('', row('Run Setup Assistant again', null, async () => { if (await ctx.confirm('Run setup again?', 'Language, Wi-Fi and Banana ID screens will reappear. Your data stays.', { ok: 'Restart setup' })) { ctx.close(); D.setup.restart(); } }), row('Reset all settings', null, async () => { if (await ctx.confirm('Reset settings?', 'Your data stays.', { ok: 'Reset' })) { D.store.set('settings', {}); D.settings.apply(); render(); } }))]; },
    storage() { const rows = h('div.card'), draw = async () => { const items = [['Notes', D.store.get('notes', []).length], ['Contacts', D.store.get('contacts', []).length], ['Reminders', D.store.get('reminders', []).length], ['Photos', (await D.blobs.all('photos')).length], ['Voice memos', (await D.blobs.all('memos')).length], ['Imported music', (await D.blobs.all('tracks')).length]]; let est = ''; try { const e = await navigator.storage.estimate(); est = D.bytes(e.usage) + ' of ' + D.bytes(e.quota); } catch (x) {}
        rows.replaceChildren(...items.map(([a, b]) => h('div.lrow', [h('div.tx', h('b', a)), h('span.muted', String(b))])), h('div.lrow', [h('div.tx', h('b', 'Browser storage')), h('span.muted', est || 'n/a')])); }; draw();
      return [sec('Your data'), rows, h('div.card', h('div.lrow', h('button.btn.danger', { onclick: async () => { if (await ctx.confirm('Erase everything?', 'Deletes notes, photos, memos, files and settings from this browser.', { ok: 'Erase all', danger: true })) { D.store.clear(); await D.blobs.clearAll(); location.reload(); } } }, D.ico('trash'), 'Erase all data')))]; },
    server() { const box = h('div.card'); const draw = async () => { await D.api.ping(); box.replaceChildren(h('div.lrow', [h('div.tx', [h('b', D.api.up ? 'Connected' : 'Not running'), h('span', D.api.up ? 'Files, Messages and state sync use the Python backend.' : 'Run  python3 server.py  then open http://localhost:8080')]), h('span.dot', { class: D.api.up ? 'ok' : '' })]));
        if (D.api.up) { try { const s = await D.api.call('api/sysinfo'); box.append(...Object.entries(s).map(([k, v]) => h('div.lrow', [h('div.tx', h('b', k)), h('span.muted', String(v))]))); } catch (e) {} box.append(h('div.lrow', h('div.rowf.gap8', [h('button.btn', { onclick: async () => { await D.api.push(); ctx.toast({ title: 'Server', body: 'State uploaded', icon: 'upload' }); } }, 'Push state'), h('button.btn', { onclick: async () => { await D.api.pull(); render(); } }, 'Pull state')]))); } }; draw();
      return [sec('Python backend'), box, h('div.card', h('div.lrow', h('button.btn', { onclick: () => { draw(); } }, D.ico('refresh'), 'Check again')))]; },
    wifi() { const w = D.net.get().wifi; return [sec('', row('Wi-Fi', ui.switch(w.on, v => { D.net.set({ wifi: v ? { on: true, ssid: w.ssid || D.net.NETS[0].ssid } : { on: false } }); render(); }, 'Wi-Fi'))), sec('Networks', ...D.net.NETS.map(n => row(n.ssid, w.on && w.ssid === n.ssid ? h('span.muted', 'Connected') : h('span.muted', n.secure ? 'Secured' : 'Open'), async () => { if (n.secure) { const pw = await ctx.prompt('Password for “' + n.ssid + '”', { type: 'password', ok: 'Join' }); if (!pw || pw.length < 8) { if (pw !== null) ctx.alert('Wrong password', 'Use at least 8 characters (simulated network).'); return; } } D.net.set({ wifi: { on: true, ssid: n.ssid, secure: n.secure } }); render(); }))), h('div.muted.small', { style: 'padding:6px 18px' }, 'Simulated networks. Online apps use your real connection.')]; },
    cell() { const c = D.net.get().cell; return [sec('', row('Cellular', ui.switch(c.on, v => { D.net.set({ cell: { on: v } }); render(); }, 'Cellular')), row('Carrier', h('span.muted', c.carrier)), h('div.lrow', [h('div.tx', h('b', 'Network')), ui.seg([['5G', '5G'], ['LTE', 'LTE'], ['4G', '4G']], c.gen, v => D.net.set({ cell: { gen: v } }))]))]; },
    bid() { const b = D.store.get('bid', null); if (b) return [h('div.profile.glass', [ui.avatar(b.name, 56), h('div.tx', [h('b', b.name), h('span', b.email)])]), h('div.card', h('div.lrow', h('button.btn.danger', { onclick: async () => { if (await ctx.confirm('Sign out of Banana ID?', 'Your data stays on this device.', { ok: 'Sign out', danger: true })) { D.store.set('bid', null); render(); } } }, 'Sign Out'))), h('div.muted.small', { style: 'padding:6px 18px' }, 'Banana ID is fictional and stored only on this device.')];
      return [h('div.card', h('div.lrow', h('button.btn.primary', { onclick: async () => { const e = await ctx.prompt('Banana ID', { placeholder: 'name@example.com', ok: 'Sign in' }); if (!e) return; if (!/^\S+@\S+\.\S+$/.test(e)) return ctx.alert('Invalid', 'Enter an email-style ID.'); D.store.set('bid', { email: e.trim(), name: e.split('@')[0].replace(/^./, c => c.toUpperCase()) }); render(); } }, 'Sign in'))), h('div.muted.small', { style: 'padding:6px 18px' }, 'No password is stored. Banana ID is fictional.')]; },
    lang() { return [sec('', ...D.langs.map(([c, n, en]) => row(n + '  ·  ' + en, D.lang() === c ? D.ico('check') : null, () => { D.store.set('lang', c); document.documentElement.lang = c; D.fire('lang'); render(); })))]; },
    about() { return [sec('', ...[['Model', 'iPhone Duo (foldable)'], ['Software', 'DuoOS 27'], ['Inner display', '776 × 836'], ['Cover display', '376 × 836'], ['Apps', String(Object.keys(D.apps).length)], ['Crease', 'None (single live display while open)']].map(([a, b]) => h('div.lrow', [h('div.tx', h('b', a)), h('span.muted', b)]))),
      h('div.muted.small', { style: 'padding:6px 18px' }, 'An independent web experiment. Wallpapers and UI are original. Not affiliated with Apple.')]; }
  };
  const titles = { wifi: 'Wi-Fi', cell: 'Cellular', bid: 'Banana ID', lang: 'Language', wall: 'Wallpaper', display: 'Display & Glass', fold: 'Fold & Motion', sound: 'Sounds', general: 'General', storage: 'Storage', server: 'Server', about: 'About' };
  const go = p => { stack.push(p); render(); };
  function render() {
    const p = stack[stack.length - 1] || 'main', sc = h('div.scroll', pages[p]()); view.replaceChildren(sc);
    const t = navt.querySelector('h1'); t.textContent = p === 'main' ? 'Settings' : titles[p]; const l = navt.querySelector('.nav-l'); l.replaceChildren(...(p === 'main' ? [] : [ui.back(() => { stack.pop(); render(); }, 'Settings')]));
  }
  body.append(navt, view); ctx.bus('api', () => { if (!stack.length) render(); }); render();
} });
})();
