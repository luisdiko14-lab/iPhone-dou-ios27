/* Utility apps: Calculator, Converter, Notes, Contacts */
(function () {
'use strict';
const D = window.Duo, h = D.h, ui = D.ui;

/* =============================================================== Calculator */
/* A real expression parser (no eval): + − × ÷ ^ % ! parentheses, functions, constants, implicit multiplication. */
function evaluate(src, deg = true) {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/\s+/g, '');
  let i = 0;
  const rad = x => deg ? x * Math.PI / 180 : x, back = x => deg ? x * 180 / Math.PI : x;
  const F = { sin: x => Math.sin(rad(x)), cos: x => Math.cos(rad(x)), tan: x => Math.tan(rad(x)), asin: x => back(Math.asin(x)), acos: x => back(Math.acos(x)), atan: x => back(Math.atan(x)),
    ln: Math.log, log: Math.log10, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp };
  const fact = n => { if (n < 0 || n > 170 || Math.abs(n - Math.round(n)) > 1e-9) throw 0; let r = 1; for (let k = 2; k <= Math.round(n); k++) r *= k; return r; };
  const isStart = c => c !== undefined && (c === '(' || /[a-z]/i.test(c) || /[\d.]/.test(c));
  function expr() { let v = term(); while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const r = term(); v = o === '+' ? v + r : v - r; } return v; }
  function term() {
    let v = unary();
    for (;;) {
      if (s[i] === '*' || s[i] === '/') { const o = s[i++]; const r = unary(); if (o === '/' && r === 0) throw 0; v = o === '*' ? v * r : v / r; }
      else if (s[i] === '(' || (s[i] !== undefined && /[a-z]/i.test(s[i]))) v *= unary();   // implicit multiplication: 2π, 3(4+1)
      else return v;
    }
  }
  function unary() { if (s[i] === '-') { i++; return -unary(); } if (s[i] === '+') { i++; return unary(); } return power(); }
  function power() { let v = postfix(); if (s[i] === '^') { i++; return Math.pow(v, unary()); } return v; }
  function postfix() { let v = primary(); for (;;) { if (s[i] === '!') { i++; v = fact(v); } else if (s[i] === '%') { i++; v /= 100; } else return v; } }
  function primary() {
    if (s[i] === '(') { i++; const v = expr(); if (s[i] === ')') i++; return v; }
    const m = /^(\d+\.?\d*|\.\d+)(?:e([+-]?\d+))?/i.exec(s.slice(i));
    if (m) { i += m[0].length; return parseFloat(m[0]); }
    const w = /^[a-z]+/i.exec(s.slice(i)); if (!w) throw 0;
    const name = w[0].toLowerCase(); i += name.length;
    if (name === 'pi') return Math.PI; if (name === 'e') return Math.E;
    if (F[name]) { const arg = s[i] === '(' ? (i++, (() => { const v = expr(); if (s[i] === ')') i++; return v; })()) : primary(); return F[name](arg); }
    throw 0;
  }
  if (!s) throw 0;
  const v = expr(); if (i < s.length || !isFinite(v) || isNaN(v)) throw 0; return v;
}
D.calc = evaluate;
D.fmtNum = n => {
  if (Math.abs(n) < 1e-12) return '0'; const x = +n.toPrecision(12);
  if (Math.abs(x) >= 1e15 || (Math.abs(x) < 1e-7 && x !== 0)) return x.toExponential(6).replace(/\.?0+e/, 'e');
  return String(x);
};

D.registerApp({ id: 'calculator', name: 'Calculator', icon: 'calculator', c: ['#4b5068', '#1c1f30'], mount(body, ctx) {
  let expr = '', lastExpr = '', justEq = false, deg = true;
  const hist = () => D.store.get('calc.history', []);
  const prev = h('div.c-prev'), main = h('div.c-main');
  const degKey = h('button.key.fn', { onclick: () => { deg = !deg; degKey.textContent = deg ? 'Deg' : 'Rad'; refresh(); } }, 'Deg');
  const refresh = () => {
    if (justEq) { prev.textContent = lastExpr + ' ='; main.textContent = expr; }
    else { let pv = ''; try { if (expr && /[-+×÷^%!(a-zπ√]/i.test(expr.replace(/^-/, ''))) pv = '= ' + D.fmtNum(evaluate(expr, deg)); } catch (e) {} prev.textContent = pv; main.textContent = expr || '0'; }
    main.style.fontSize = Math.max(30, 64 - Math.max(0, main.textContent.length - 8) * 3.6) + 'px';
  };
  const add = t => { if (justEq) { if (/^[\d.π(a-z√]/i.test(t)) expr = ''; justEq = false; } expr += t; refresh(); };
  const equals = () => {
    if (!expr) return;
    try { const r = D.fmtNum(evaluate(expr, deg)); D.store.update('calc.history', a => [{ e: expr, r, t: Date.now() }, ...a].slice(0, 40), []); lastExpr = expr; expr = r; justEq = true; D.audio.click(); }
    catch (e) { prev.textContent = 'Error'; main.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 220 }); return; }
    refresh();
  };
  const back = () => { if (justEq) { expr = ''; justEq = false; } expr = expr.replace(/(sin|cos|tan|asin|acos|atan|ln|log|√|cbrt|abs)\($/, '').replace(/.$/, (m, off, str) => str.length ? '' : ''); refresh(); };
  const backspace = () => { if (justEq) { justEq = false; } const m = /(sin|cos|tan|asin|acos|atan|ln|log|√|cbrt|abs)\($/.exec(expr); expr = m ? expr.slice(0, -m[0].length) : expr.slice(0, -1); refresh(); };
  const neg = () => { if (!expr) return; justEq = false; expr = expr.startsWith('-(') && expr.endsWith(')') ? expr.slice(2, -1) : /^-?[\d.]+$/.test(expr) ? (expr.startsWith('-') ? expr.slice(1) : '-' + expr) : '-(' + expr + ')'; refresh(); };
  const K = (label, cls, fn) => h('button.key', { class: cls, onclick: fn, 'aria-label': label }, label);
  const std = [['AC', 'ac', () => { expr = ''; lastExpr = ''; justEq = false; refresh(); }], ['⌫', 'fn', backspace], ['%', 'fn', () => add('%')], ['÷', 'op', () => add('÷')],
    ['7', '', () => add('7')], ['8', '', () => add('8')], ['9', '', () => add('9')], ['×', 'op', () => add('×')],
    ['4', '', () => add('4')], ['5', '', () => add('5')], ['6', '', () => add('6')], ['−', 'op', () => add('−')],
    ['1', '', () => add('1')], ['2', '', () => add('2')], ['3', '', () => add('3')], ['+', 'op', () => add('+')],
    ['±', 'fn', neg], ['0', '', () => add('0')], ['.', '', () => add('.')], ['=', 'eq', equals]];
  const sci = [['sin', 'fn', () => add('sin(')], ['cos', 'fn', () => add('cos(')], ['tan', 'fn', () => add('tan(')], [degKey],
    ['ln', 'fn', () => add('ln(')], ['log', 'fn', () => add('log(')], ['√', 'fn', () => add('√(')], ['x²', 'fn', () => add('^2')],
    ['xʸ', 'fn', () => add('^')], ['π', 'fn', () => add('π')], ['e', 'fn', () => add('e')], ['n!', 'fn', () => add('!')],
    ['(', 'fn', () => add('(')], [')', 'fn', () => add(')')], ['|x|', 'fn', () => add('abs(')], ['∛', 'fn', () => add('cbrt(')]];
  const calc = h('div.calc', { class: ctx.wide ? 'sci' : '' }, [
    h('div.c-disp', [prev, main]),
    h('div.c-keys', [h('div.c-pad.c-sci', sci.map(k => k[0] instanceof Node ? k[0] : K(k[0], k[1], k[2]))), h('div.c-pad', std.map(k => K(k[0], k[1], k[2])))])
  ]);
  const sciBtn = ui.ibtn('fn' in D.icons ? 'fn' : 'layers', () => calc.classList.toggle('sci'), 'Scientific');
  const openHist = () => {
    const list = hist(); let el;
    el = h('div.c-hist', [ui.nav('History', { left: ui.back(() => el.remove(), 'Back'), right: ui.ibtn('trash', () => { D.store.set('calc.history', []); el.remove(); }, 'Clear history', 'danger') }),
      list.length ? h('div.scroll', list.map(x => h('button.hrow', { onclick: () => { expr = x.r; justEq = false; el.remove(); refresh(); } }, [h('small', x.e), h('b', x.r)]))) : ui.empty('clock', 'No history yet', 'Press = to save a calculation.')]);
    body.append(el);
  };
  body.append(ui.nav('Calculator', { left: ctx.wide ? null : sciBtn, right: ui.ibtn('clock', openHist, 'History') }), calc);
  ctx.keys(e => {
    const k = e.key; if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9.]$/.test(k)) add(k); else if (k === '+') add('+'); else if (k === '-') add('−'); else if (k === '*') add('×'); else if (k === '/') { e.preventDefault(); add('÷'); }
    else if (k === '^') add('^'); else if (k === '(' || k === ')') add(k); else if (k === '%') add('%'); else if (k === '!') add('!');
    else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); } else if (k === 'Backspace') backspace(); else if (k.toLowerCase() === 'c') { expr = ''; justEq = false; refresh(); }
  });
  refresh();
} });

/* =============================================================== Converter */
const UNITS = {
  Length: { base: 'm', u: { mm: .001, cm: .01, m: 1, km: 1000, in: .0254, ft: .3048, yd: .9144, mi: 1609.344, nmi: 1852 } },
  Mass: { base: 'kg', u: { mg: 1e-6, g: .001, kg: 1, t: 1000, oz: .028349523125, lb: .45359237, st: 6.35029318 } },
  Temperature: { special: true, u: { '°C': 1, '°F': 1, K: 1 } },
  Volume: { base: 'L', u: { mL: .001, L: 1, 'm³': 1000, tsp: .00492892, tbsp: .0147868, 'fl oz': .0295735, cup: .236588, pt: .473176, qt: .946353, gal: 3.785411784 } },
  Speed: { base: 'm/s', u: { 'm/s': 1, 'km/h': 1 / 3.6, mph: .44704, kn: .514444, 'ft/s': .3048 } },
  Area: { base: 'm²', u: { 'cm²': 1e-4, 'm²': 1, ha: 1e4, 'km²': 1e6, 'in²': 6.4516e-4, 'ft²': .09290304, ac: 4046.8564224, 'mi²': 2589988.110336 } },
  Data: { base: 'B', u: { bit: .125, B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 } },
  Time: { base: 's', u: { ms: .001, s: 1, min: 60, h: 3600, day: 86400, week: 604800, year: 31557600 } },
  Energy: { base: 'J', u: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6 } },
  Currency: { live: true, u: {} }
};
const toC = (v, u) => u === '°C' ? v : u === '°F' ? (v - 32) * 5 / 9 : v - 273.15;
const fromC = (c, u) => u === '°C' ? c : u === '°F' ? c * 9 / 5 + 32 : c + 273.15;
const fmtU = n => { if (!isFinite(n)) return '—'; if (n === 0) return '0'; const a = Math.abs(n); return a >= 1e12 || a < 1e-5 ? n.toExponential(4) : (+n.toPrecision(8)).toLocaleString(undefined, { maximumFractionDigits: 8 }); };

D.registerApp({ id: 'converter', name: 'Converter', icon: 'converter', c: ['#ff9f43', '#ee5a24'], mount(body, ctx) {
  let cat = D.store.get('conv.cat', 'Length'), from, to, val = 1, rates = null, rateErr = '';
  const out = h('div.scroll'), catsEl = h('div.cats');
  const loadRates = async () => {
    const c = D.store.get('rates', null); if (c && Date.now() - c.t < 6 * 3600e3) { rates = c; return; }
    try { const r = await fetch('https://api.frankfurter.app/latest?from=USD'); if (!r.ok) throw 0; const j = await r.json(); rates = { t: Date.now(), r: { USD: 1, ...j.rates } }; D.store.set('rates', rates); rateErr = ''; }
    catch (e) { rates = c; rateErr = c ? 'Offline — showing saved rates' : 'Live rates need an internet connection.'; }
  };
  const unitsOf = () => cat === 'Currency' ? (rates ? Object.keys(rates.r).sort() : []) : Object.keys(UNITS[cat].u);
  const conv = (v, f, t) => {
    if (cat === 'Temperature') return fromC(toC(v, f), t);
    if (cat === 'Currency') return v / rates.r[f] * rates.r[t];
    const U = UNITS[cat].u; return v * U[f] / U[t];
  };
  const render = async () => {
    catsEl.replaceChildren(...Object.keys(UNITS).map(k => h('button.chip', { class: k === cat ? 'on' : '', onclick: () => { cat = k; D.store.set('conv.cat', k); from = to = null; render(); } }, k)));
    if (cat === 'Currency' && !rates) { out.replaceChildren(h('div.pad.muted', 'Loading live rates…')); await loadRates(); }
    const us = unitsOf();
    if (!us.length) { out.replaceChildren(ui.empty('globe', 'No rates available', rateErr)); return; }
    if (!us.includes(from)) from = cat === 'Currency' ? 'USD' : us[Math.min(2, us.length - 1)];
    if (!us.includes(to)) to = cat === 'Currency' ? (us.includes('EUR') ? 'EUR' : us[0]) : us[Math.min(3, us.length - 1)] === from ? us[0] : us[Math.min(3, us.length - 1)];
    const inp = ui.input({ type: 'number', inputmode: 'decimal', value: val, step: 'any', 'aria-label': 'Value', oninput: () => { val = parseFloat(inp.value); upd(); } });
    const sel = (cur, set) => { const s = h('select.input', { 'aria-label': 'Unit', onchange: () => { set(s.value); upd(); } }, us.map(u => h('option', { value: u, selected: u === cur }, u))); return s; };
    const fs = sel(from, v => from = v), ts = sel(to, v => to = v), res = h('div.input', { style: 'font-size:22px;font-weight:300;min-height:48px;display:flex;align-items:center', 'aria-live': 'polite' });
    const all = h('div.cv-all');
    const upd = () => {
      const v = isNaN(val) ? NaN : conv(val, from, to); res.textContent = fmtU(v);
      all.replaceChildren(...us.filter(u => u !== from).map(u => h('div', [h('b', fmtU(conv(val, from, u))), u])));
    };
    out.replaceChildren(h('div.card.cv-box', [h('div.cv-row', [inp, fs]), h('button.ibtn.cv-swap', { 'aria-label': 'Swap units', onclick: () => { [from, to] = [to, from]; render(); } }, D.ico('converter')), h('div.cv-row', [res, ts])]),
      rateErr && h('div.err.pad', { style: 'padding-top:10px' }, rateErr), h('div.eyebrow', { style: 'margin:16px 4px 8px' }, 'All conversions'), all,
      cat === 'Currency' && rates && h('div.tiny.muted', { style: 'margin-top:12px' }, 'Rates: Frankfurter / ECB · updated ' + new Date(rates.t).toLocaleString()));
    upd();
  };
  body.append(ui.nav('Converter'), catsEl, out); render();
} });

/* ==================================================================== Notes */
D.registerApp({ id: 'notes', name: 'Notes', icon: 'notes', c: ['#ffe46b', '#ffb800'], mount(body, ctx) {
  let sel = null, q = '', saveT = 0;
  const all = () => D.store.get('notes', []);
  const write = a => D.store.set('notes', a);
  const title = n => (String(n.text || '').split('\n')[0] || 'New Note').slice(0, 60);
  const listEl = h('div.scroll'), ta = h('textarea.ntext', { placeholder: 'Start typing…', 'aria-label': 'Note text', disabled: true });
  const foot = h('div.nfoot'), pinBtn = ui.ibtn('pin', () => togglePin(), 'Pin'), delBtn = ui.ibtn('trash', () => del(), 'Delete', 'danger');
  const cur = () => all().find(n => n.id === sel);
  const stats = () => { const t = ta.value, w = (t.trim().match(/\S+/g) || []).length; foot.replaceChildren(h('span', w + ' words · ' + t.length + ' characters'), h('span', cur() ? 'Edited ' + new Date(cur().ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')); };
  const renderList = () => {
    const f = q.trim().toLowerCase(), notes = all().filter(n => !f || String(n.text || '').toLowerCase().includes(f)).sort((a, b) => (b.pin - a.pin) || (b.ts - a.ts));
    listEl.replaceChildren(...(notes.length ? notes.map(n => h('button.nrow', { class: n.id === sel ? 'sel' : '', onclick: () => open(n.id) },
      h('b', [n.pin && h('span.pinm', { html: D.icon('pin') }), title(n)]), h('span', ui.ago(n.ts) + '  ' + (String(n.text || '').split('\n').slice(1).join(' ').slice(0, 50) || 'No additional text')))) : [ui.empty('notes', f ? 'No matches' : 'No notes yet', f ? '' : 'Tap the pencil to write your first note.')]));
  };
  const open = id => { sel = id; const n = cur(); ta.disabled = !n; ta.value = n ? n.text : ''; pinBtn.classList.toggle('on', !!(n && n.pin)); renderList(); stats(); split.show('r'); };
  const create = (text = '') => { const n = { id: D.uid(), text, ts: Date.now(), pin: false }; write([n, ...all()]); open(n.id); setTimeout(() => ta.focus(), 380); };
  const togglePin = () => { const n = cur(); if (!n) return; write(all().map(x => x.id === n.id ? { ...x, pin: !x.pin } : x)); pinBtn.classList.toggle('on', !n.pin); renderList(); };
  const del = async () => { const n = cur(); if (!n) return; if (!(await ctx.confirm('Delete note?', 'This can’t be undone.', { ok: 'Delete', danger: true }))) return; write(all().filter(x => x.id !== n.id)); sel = null; ta.value = ''; ta.disabled = true; renderList(); stats(); split.show('l'); };
  ta.addEventListener('input', () => {
    clearTimeout(saveT); saveT = setTimeout(() => { const n = cur(); if (!n) return; write(all().map(x => x.id === n.id ? { ...x, text: ta.value, ts: Date.now() } : x)); }, 250); stats();
  });
  const left = [ui.nav('Notes', { right: ui.ibtn('edit', () => create(), 'New note') }), h('div.toolbar', ui.search('Search notes', v => { q = v; renderList(); })), listEl];
  const right = [ui.nav('', { left: ui.back(() => split.show('l'), 'Notes'), right: [pinBtn, ui.ibtn('download', () => { const n = cur(); n && D.download(title(n).replace(/[^\w ]+/g, '') + '.txt', n.text); }, 'Export'), delBtn] }), ta, foot];
  right[0].classList.add('back-only-nav'); const split = ui.split(ctx, left, right);
  if (ctx.wide) right[0].querySelector('.nav-l').replaceChildren();
  body.append(split);
  ctx.sub('notes', () => { renderList(); if (sel && !cur()) { sel = null; ta.value = ''; ta.disabled = true; } });
  renderList(); stats();
  if (ctx.args.text) create(ctx.args.text); else if (ctx.wide && all()[0]) open([...all()].sort((a, b) => (b.pin - a.pin) || (b.ts - a.ts))[0].id);
} });

/* ================================================================ Contacts */
function parseVCard(t) {
  return t.split(/END:VCARD/i).map(b => {
    const get = k => { const m = new RegExp('^' + k + '[^:]*:(.*)$', 'im').exec(b); return m ? m[1].trim() : ''; };
    const n = get('N').split(';'), fn = get('FN');
    const first = n[1] || (fn.split(' ')[0] || ''), last = n[0] || fn.split(' ').slice(1).join(' ');
    return (first || last) ? { id: D.uid(), first, last, phone: get('TEL'), email: get('EMAIL'), notes: get('NOTE') } : null;
  }).filter(Boolean);
}
D.registerApp({ id: 'contacts', name: 'Contacts', icon: 'contacts', c: ['#9aa3b8', '#5a6275'], mount(body, ctx) {
  let sel = null, q = '', editing = false;
  const all = () => D.store.get('contacts', []);
  const write = a => D.store.set('contacts', a);
  const name = c => ((c.first || '') + ' ' + (c.last || '')).trim() || c.email || c.phone || 'No Name';
  const listEl = h('div.scroll'), detail = h('div.scroll');
  const renderList = () => {
    const f = q.trim().toLowerCase(), cs = all().filter(c => !f || (name(c) + c.phone + c.email).toLowerCase().includes(f)).sort((a, b) => name(a).localeCompare(name(b)));
    if (!cs.length) { listEl.replaceChildren(ui.empty('contacts', f ? 'No matches' : 'No contacts', f ? '' : 'Tap + to add someone.')); return; }
    const out = []; let L = '';
    cs.forEach(c => { const l = (name(c)[0] || '#').toUpperCase(); if (l !== L) { L = l; out.push(h('div.csec', L)); } out.push(h('button.crow', { class: c.id === sel ? 'sel' : '', onclick: () => show(c.id) }, ui.avatar(name(c), 40), h('b.ellip', name(c)))); });
    listEl.replaceChildren(...out);
  };
  const form = c => {
    const f = { first: ui.input({ value: c.first || '', placeholder: 'First name' }), last: ui.input({ value: c.last || '', placeholder: 'Last name' }),
      phone: ui.input({ value: c.phone || '', placeholder: 'Phone', type: 'tel' }), email: ui.input({ value: c.email || '', placeholder: 'Email', type: 'email' }), notes: h('textarea.input', { rows: 3, placeholder: 'Notes', value: c.notes || '' }) };
    return h('div.col.gap12', { style: 'padding-top:6px' }, [ui.field('First name', f.first), ui.field('Last name', f.last), ui.field('Phone', f.phone), ui.field('Email', f.email), ui.field('Notes', f.notes),
      h('div.rowf.gap8', [h('button.btn.grow', { onclick: () => { editing = false; c.isNew ? (sel = null, split.show('l'), renderDetail()) : renderDetail(); } }, 'Cancel'),
        h('button.btn.primary.grow', { onclick: () => {
          const nc = { id: c.id, first: f.first.value.trim(), last: f.last.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), notes: f.notes.value.trim() };
          if (!nc.first && !nc.last && !nc.email && !nc.phone) { ctx.alert('Add a name, phone or email first.'); return; }
          write(c.isNew ? [...all(), nc] : all().map(x => x.id === c.id ? nc : x)); sel = nc.id; editing = false; renderList(); renderDetail(); } }, 'Save')])]);
  };
  const renderDetail = () => {
    const c = all().find(x => x.id === sel);
    if (!c) { detail.replaceChildren(ui.empty('contacts', 'No contact selected', 'Pick someone from the list.')); return; }
    if (editing) { detail.replaceChildren(form(c)); return; }
    const act = (icon, label, fn, off) => h('button.btn', { onclick: fn, disabled: off }, D.ico(icon), label);
    const row = (k, v, href) => v && h('div.lrow', h('div.tx', h('b', k), href ? h('a', { href, style: 'color:inherit;text-decoration:none' }, v) : h('span', v)));
    detail.replaceChildren(h('div.cdetail', [ui.avatar(name(c), 96), h('h2', name(c)),
      h('div.cacts', [act('messages', 'Message', () => ctx.open('messages', { to: c.id }), false), act('send', 'Email', () => { location.href = 'mailto:' + c.email; }, !c.email), act('upload', 'Call', () => { location.href = 'tel:' + c.phone; }, !c.phone)]),
      h('div.card.cinfo', [row('phone', c.phone, 'tel:' + c.phone), row('email', c.email, 'mailto:' + c.email), row('notes', c.notes)]),
      h('div.rowf.gap8', { style: 'margin-top:14px' }, [h('button.btn', { onclick: () => D.download(name(c) + '.vcf', `BEGIN:VCARD\nVERSION:3.0\nN:${c.last || ''};${c.first || ''};;;\nFN:${name(c)}\nTEL:${c.phone || ''}\nEMAIL:${c.email || ''}\nNOTE:${(c.notes || '').replace(/\n/g, '\\n')}\nEND:VCARD\n`, 'text/vcard') }, D.ico('download'), 'vCard'),
        h('button.btn', { onclick: () => { editing = true; renderDetail(); } }, D.ico('edit'), 'Edit'),
        h('button.btn.danger', { onclick: async () => { if (await ctx.confirm('Delete contact?', name(c), { ok: 'Delete', danger: true })) { write(all().filter(x => x.id !== c.id)); sel = null; renderList(); renderDetail(); split.show('l'); } } }, D.ico('trash'))])]));
  };
  const show = id => { sel = id; editing = false; renderList(); renderDetail(); split.show('r'); };
  const add = () => { sel = '__new'; editing = true; const c = { id: D.uid(), isNew: true }; sel = c.id; detail.replaceChildren(form(c)); split.show('r'); };
  const importV = async () => { const [f] = await D.pickFile('.vcf,text/vcard'); if (!f) return; const cs = parseVCard(await D.readFile(f)); write([...all(), ...cs]); ctx.toast({ title: 'Imported ' + cs.length + ' contacts', icon: 'contacts' }); };
  const left = [ui.nav('Contacts', { left: ui.ibtn('upload', importV, 'Import vCard'), right: ui.ibtn('plus', add, 'Add contact') }), h('div.toolbar', ui.search('Search', v => { q = v; renderList(); })), listEl];
  const right = [ui.nav('', { left: ctx.wide ? null : ui.back(() => split.show('l'), 'Contacts') }), detail];
  const split = ui.split(ctx, left, right); body.append(split);
  ctx.sub('contacts', () => { renderList(); if (!editing) renderDetail(); });
  renderList(); renderDetail();
  if (ctx.wide && all()[0]) show([...all()].sort((a, b) => name(a).localeCompare(name(b)))[0].id);
} });
})();
