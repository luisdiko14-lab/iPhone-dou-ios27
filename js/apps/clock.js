/* Time apps: Clock (world / alarms / stopwatch / timer), Calendar, Reminders.
   Alarms, timers and reminder notifications run as background services, so they
   fire even when the app is closed. */
(function () {
'use strict';
const D = window.Duo, h = D.h, ui = D.ui;

D.ring = (title, body, icon = 'bell', app) => { D.toast({ title, body, icon, app, ms: 9000 }); if (D.settings.get('sounds')) D.audio.alarm(3); };

/* ---------------------------------------------------------- background services */
const fired = new Map();
D.services.push(() => {
  D.sys.onTick(() => {
    const n = new Date(), hm = D.pad(n.getHours()) + ':' + D.pad(n.getMinutes()), dk = D.dayKey(n);
    D.store.get('alarms', []).forEach(a => {
      const key = a.id + dk + hm;
      if (!a.on || a.time !== hm || fired.has(key)) return;
      if (a.days && a.days.length && !a.days.includes(n.getDay())) return;
      fired.set(key, 1); D.ring(a.label || 'Alarm', hm, 'clock', 'clock');
      if (!a.days || !a.days.length) D.store.update('alarms', arr => arr.map(x => x.id === a.id ? { ...x, on: false } : x), []);
    });
    if (fired.size > 200) fired.clear();
    const t = D.store.get('timer', null);
    if (t && t.end && Date.now() >= t.end) { D.store.set('timer', null); D.ring('Timer', 'Time’s up!', 'clock', 'clock'); }
    const now = Date.now();
    const rs = D.store.get('reminders', []); let dirty = false;
    rs.forEach(r => { if (r.due && !r.done && !r.notified && r.due <= now) { r.notified = true; dirty = true; D.ring('Reminder', r.title, 'reminders', 'reminders'); } });
    if (dirty) D.store.set('reminders', rs);
  });
});

/* ===================================================================== Clock */
const sw = { running: false, start: 0, acc: 0, laps: [] };   // stopwatch lives outside the app so it keeps running
const swMs = () => sw.acc + (sw.running ? performance.now() - sw.start : 0);
const fmtSw = ms => { const t = Math.floor(ms / 10), cs = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000); return D.pad(m) + ':' + D.pad(s) + '.' + D.pad(cs); };
const cityName = tz => tz.split('/').pop().replace(/_/g, ' ');
const tzOffsetH = tz => { const n = new Date(); const t = new Date(n.toLocaleString('en-US', { timeZone: tz })), l = new Date(n.toLocaleString('en-US')); return Math.round((t - l) / 36e5 * 2) / 2; };
const allZones = () => (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Tirane', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Dubai', 'Australia/Sydney']);
const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const repeatLabel = d => !d || !d.length ? 'Once' : d.length === 7 ? 'Every day' : (d.join() === '1,2,3,4,5' ? 'Weekdays' : d.join() === '0,6' ? 'Weekends' : d.map(x => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][x]).join(' '));

D.registerApp({ id: 'clock', name: 'Clock', icon: 'clock', c: ['#3a3e50', '#0f1018'], mount(body, ctx) {
  let tab = D.store.get('clock.tab', 'world'), view = h('div.fill.col');
  const tabs = ui.seg([['world', 'World'], ['alarm', 'Alarms'], ['stopwatch', 'Stopwatch'], ['timer', 'Timer']], tab, v => { tab = v; D.store.set('clock.tab', v); render(); });
  let stopTick = null;
  const clear = () => { stopTick && stopTick(); stopTick = null; };
  const ring = (frac, big, small) => {
    const C = 2 * Math.PI * 44;
    return h('div.ringbox', [h('svg', { viewBox: '0 0 100 100' }, [h('circle', { cx: 50, cy: 50, r: 44, fill: 'none', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 4 }),
      h('circle.rarc', { cx: 50, cy: 50, r: 44, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': C * (1 - frac), transform: 'rotate(-90 50 50)' })]),
      h('div.rbig', big), h('div.rsmall', small)]);
  };

  /* ---- world ---- */
  function world() {
    const cities = D.store.get('clock.cities', () => [localTz(), 'America/New_York', 'Europe/London', 'Asia/Tokyo']);
    let ticks = '';
    for (let i = 0; i < 12; i++) ticks += `<i class="tick" style="transform:rotate(${i * 30}deg)"></i>`;
    const analog = h('div.analog', { html: ticks + '<i class="hand hh"></i><i class="hand hm"></i><i class="hand hs"></i><i class="pin"></i>' });
    const rows = h('div');
    const draw = () => {
      const n = new Date();
      rows.replaceChildren(...cities.map(tz => {
        let t = '--:--', diff = 0; try { t = D.fmtTime(new Date(n.toLocaleString('en-US', { timeZone: tz }))); diff = tzOffsetH(tz); } catch (e) {}
        return h('div.lrow', [h('div.tx', [h('b', cityName(tz)), h('span', tz === localTz() ? 'Local time' : (diff === 0 ? 'Same time' : (diff > 0 ? '+' : '') + diff + 'h from you'))]), h('span.wtime', t),
          tz === localTz() ? null : h('button.ibtn', { 'aria-label': 'Remove ' + cityName(tz), onclick: () => { D.store.set('clock.cities', cities.filter(x => x !== tz)); render(); } }, D.ico('close'))]);
      }));
      const s = n.getSeconds() + n.getMilliseconds() / 1000, m = n.getMinutes() + s / 60, hr = (n.getHours() % 12) + m / 60;
      analog.querySelector('.hs').style.transform = `rotate(${s * 6}deg)`; analog.querySelector('.hm').style.transform = `rotate(${m * 6}deg)`; analog.querySelector('.hh').style.transform = `rotate(${hr * 30}deg)`;
    };
    const add = async () => {
      const zs = allZones().filter(z => !cities.includes(z)), q = await ctx.prompt('Add city', { placeholder: 'e.g. Tokyo, New York, London', ok: 'Search' }); if (!q) return;
      const f = q.trim().toLowerCase().replace(/ /g, '_'), hits = zs.filter(z => z.toLowerCase().includes(f)).slice(0, 8);
      if (!hits.length) { ctx.alert('No match', 'Try the name of a big city, like “Paris”.'); return; }
      const pick = hits.length === 1 ? hits[0] : await ctx.menu('Choose a time zone', hits.map(z => [z.replace(/_/g, ' ')  , z]));
      if (pick) { D.store.set('clock.cities', [...cities, pick]); render(); }
    };
    stopTick = D.sys.onTick(draw); draw();
    return h('div.scroll', [h('div.analogwrap', analog), h('div.card', rows), h('div.rowf', { style: 'justify-content:center;margin-top:12px' }, h('button.btn', { onclick: add }, D.ico('plus'), 'Add city'))]);
  }

  /* ---- alarms ---- */
  function alarm() {
    const list = h('div.card'); let days = [];
    const tin = h('input.input', { type: 'time', value: '07:30', 'aria-label': 'Alarm time', style: 'font-size:28px;font-weight:300;text-align:center' });
    const lab = ui.input({ placeholder: 'Label (optional)', 'aria-label': 'Alarm label' });
    const chips = h('div.rowf.gap8', { style: 'justify-content:center;flex-wrap:wrap' }, DAYS.map((d, i) => h('button.chip', { 'aria-label': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i], onclick: e => { days = days.includes(i) ? days.filter(x => x !== i) : [...days, i].sort(); e.currentTarget.classList.toggle('on', days.includes(i)); } }, d)));
    const draw = () => {
      const as = D.store.get('alarms', []).slice().sort((a, b) => a.time.localeCompare(b.time));
      list.replaceChildren(...(as.length ? as.map(a => h('div.lrow', [h('div.tx', [h('b.atime', { class: a.on ? '' : 'off' }, a.time), h('span', (a.label || 'Alarm') + ', ' + repeatLabel(a.days))]),
        ui.switch(a.on, v => D.store.update('alarms', arr => arr.map(x => x.id === a.id ? { ...x, on: v } : x), []), 'Alarm ' + a.time),
        h('button.ibtn', { 'aria-label': 'Delete alarm', onclick: () => D.store.update('alarms', arr => arr.filter(x => x.id !== a.id), []) }, D.ico('trash'))])) : [ui.empty('clock', 'No alarms', 'Set a time below and press Add.')]));
    };
    ctx.sub('alarms', draw); draw();
    return h('div.scroll', [list, h('div.card.col.gap12', { style: 'margin-top:12px' }, [tin, lab, chips, h('button.btn.primary', { onclick: () => {
      D.store.update('alarms', a => [...a, { id: D.uid(), time: tin.value || '07:30', label: lab.value.trim(), on: true, days: [...days] }], []); lab.value = ''; D.audio.click(); } }, D.ico('plus'), 'Add alarm')])]);
  }

  /* ---- stopwatch ---- */
  function stopwatch() {
    const big = h('div.swbig'), laps = h('div.card.hide'); const go = h('button.btn.primary.lg'), lap = h('button.btn.lg');
    const draw = () => {
      big.textContent = fmtSw(swMs()); go.textContent = sw.running ? 'Stop' : (sw.acc ? 'Resume' : 'Start'); go.classList.toggle('danger', sw.running);
      lap.textContent = sw.running ? 'Lap' : 'Reset'; lap.disabled = !sw.running && !sw.acc;
      laps.classList.toggle('hide', !sw.laps.length);
      laps.replaceChildren(...sw.laps.map((l, i) => h('div.lrow', [h('span', 'Lap ' + (sw.laps.length - i)), h('span.wtime', fmtSw(l.split)), h('span.muted', fmtSw(l.total))])));
    };
    go.onclick = () => { if (sw.running) { sw.acc += performance.now() - sw.start; sw.running = false; } else { sw.start = performance.now(); sw.running = true; } draw(); };
    lap.onclick = () => { if (sw.running) { const t = swMs(), prev = sw.laps[0] ? sw.laps[0].total : 0; sw.laps.unshift({ split: t - prev, total: t }); } else { sw.acc = 0; sw.laps = []; } draw(); };
    const iv = setInterval(() => { if (sw.running) big.textContent = fmtSw(swMs()); }, 40); stopTick = () => clearInterval(iv);
    draw();
    return h('div.scroll', [big, h('div.rowf.gap12', { style: 'justify-content:center;margin:10px 0 18px' }, [lap, go]), laps]);
  }

  /* ---- timer ---- */
  function timer() {
    const t0 = D.store.get('timer', null), box = h('div.col', { style: 'align-items:center;gap:18px;padding-top:8px' });
    const num = (v, max, label) => h('label.tnum', [h('input.input', { type: 'number', min: 0, max, value: v, 'aria-label': label, style: 'text-align:center;font-size:34px;font-weight:300;padding:10px 4px' }), h('span', label)]);
    const draw = () => {
      const t = D.store.get('timer', null); box.replaceChildren();
      if (!t) {
        const hh = num(0, 23, 'hours'), mm = num(5, 59, 'min'), ss = num(0, 59, 'sec');
        box.append(h('div.rowf.gap8', [hh, mm, ss]), h('button.btn.primary.lg', { onclick: () => {
          const total = (+hh.firstChild.value || 0) * 3600 + (+mm.firstChild.value || 0) * 60 + (+ss.firstChild.value || 0); if (total <= 0) return;
          D.store.set('timer', { end: Date.now() + total * 1000, total }); D.audio.click(); } }, 'Start'));
        return;
      }
      const left = t.end ? Math.max(0, (t.end - Date.now()) / 1000) : t.paused, big = h('span');
      const r = ring(left / t.total, ui.dur(Math.ceil(left)), 'of ' + ui.dur(t.total));
      box.append(r, h('div.rowf.gap12', [h('button.btn.lg', { onclick: () => D.store.set('timer', null) }, 'Cancel'),
        h('button.btn.primary.lg', { onclick: () => { const c = D.store.get('timer'); D.store.set('timer', c.end ? { total: c.total, end: null, paused: Math.max(0, (c.end - Date.now()) / 1000) } : { total: c.total, end: Date.now() + c.paused * 1000 }); } }, t.end ? 'Pause' : 'Resume')]));
    };
    const upd = () => { const t = D.store.get('timer', null); if (!t || !t.end) return; const left = Math.max(0, (t.end - Date.now()) / 1000), C = 2 * Math.PI * 44; const a = box.querySelector('.rarc'), b = box.querySelector('.rbig'); if (a) a.setAttribute('stroke-dashoffset', C * (1 - left / t.total)); if (b) b.textContent = ui.dur(Math.ceil(left)); };
    ctx.sub('timer', draw); stopTick = D.sys.onTick(upd); draw();
    return h('div.scroll', box);
  }

  function render() { clear(); view.replaceChildren({ world, alarm, stopwatch, timer }[tab]()); }
  body.append(ui.nav('Clock'), h('div.tabs', tabs), view); render();
  return { destroy: clear };
} });

/* ================================================================== Calendar */
const EVC = ['#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#0a84ff', '#bf5af2'];
D.calendar = {
  upcoming(n = 3) {
    const out = [], now = new Date(), today = D.dayKey(now), ev = D.store.get('events', {});
    for (let i = 0; i < 30 && out.length < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i), k = D.dayKey(d);
      (ev[k] || []).forEach(e => {
        const [hh, mm] = (e.time || '00:00').split(':').map(Number), ts = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime();
        if (i === 0 && e.time && ts < now.getTime() - 36e5) return;
        out.push({ title: e.title, ts, color: e.color || EVC[4], when: (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : D.fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })) + (e.time ? ' · ' + e.time : '') });
      });
    }
    D.store.get('reminders', []).filter(r => r.due && !r.done).forEach(r => out.push({ title: r.title, ts: r.due, color: '#ff9f0a', when: 'Reminder · ' + new Date(r.due).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }));
    return out.filter(o => o.ts > now.getTime() - 36e5).sort((a, b) => a.ts - b.ts).slice(0, n);
  }
};
D.registerApp({ id: 'calendar', name: 'Calendar', icon: 'calendar', c: ['#ffffff', '#e4e6ee'],
  tile() {
    const w = h('span.caltile', [h('b'), h('i')]);
    D.sys.onTick(() => { const n = new Date(), a = n.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(), b = String(n.getDate()); if (w.firstChild.textContent !== a) w.firstChild.textContent = a; if (w.lastChild.textContent !== b) w.lastChild.textContent = b; });
    return w;
  },
  mount(body, ctx) {
    const now = new Date(); let y = now.getFullYear(), m = now.getMonth(), sel = D.dayKey(now), color = EVC[4];
    let fd = 0; try { const l = new Intl.Locale(navigator.language), wi = l.weekInfo || (l.getWeekInfo && l.getWeekInfo()); fd = wi ? wi.firstDay % 7 : 0; } catch (e) {}
    const grid = h('div.cgrid'), title = h('h2.mtitle'), dayList = h('div.card'), form = h('div.card.col.gap12');
    const ev = () => D.store.get('events', {});
    const draw = () => {
      title.textContent = new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const first = new Date(y, m, 1), lead = (first.getDay() - fd + 7) % 7, dim = new Date(y, m + 1, 0).getDate(), cells = [];
      for (let i = 0; i < 7; i++) cells.push(h('div.cwd', ['S', 'M', 'T', 'W', 'T', 'F', 'S'][(i + fd) % 7]));
      for (let i = 0; i < lead; i++) cells.push(h('div'));
      for (let d = 1; d <= dim; d++) {
        const k = y + '-' + D.pad(m + 1) + '-' + D.pad(d), list = ev()[k] || [];
        cells.push(h('button.cday', { class: (k === D.dayKey(now) ? 'today ' : '') + (k === sel ? 'sel' : ''), 'aria-label': D.fmtDate(new Date(y, m, d)), onclick: () => { sel = k; draw(); } },
          h('span', d), h('div.dots2', list.slice(0, 3).map(e => h('i', { style: 'background:' + (e.color || EVC[4]) })))));
      }
      grid.replaceChildren(...cells);
      const [sy, sm, sd] = sel.split('-').map(Number), list = (ev()[sel] || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      dayList.replaceChildren(h('div.eyebrow', D.fmtDate(new Date(sy, sm - 1, sd), { weekday: 'long', month: 'long', day: 'numeric' })),
        ...(list.length ? list.map(e => h('div.lrow', [h('i.evbar', { style: 'background:' + (e.color || EVC[4]) }), h('div.tx', [h('b', e.title), h('span', e.time || 'All day')]),
          h('button.ibtn', { 'aria-label': 'Delete event', onclick: () => D.store.update('events', o => { o[sel] = (o[sel] || []).filter(x => x.id !== e.id); if (!o[sel].length) delete o[sel]; return { ...o }; }, {}) }, D.ico('trash'))])) : [h('div.muted.small', { style: 'padding:12px 4px' }, 'No events')]));
    };
    const tin = ui.input({ placeholder: 'New event', 'aria-label': 'Event title' }), time = h('input.input', { type: 'time', 'aria-label': 'Event time', style: 'width:130px' });
    const dots = h('div.rowf.gap8', EVC.map(c => h('button.cdot', { style: 'background:' + c, 'aria-label': 'Colour ' + c, class: c === color ? 'on' : '', onclick: e => { color = c; [...dots.children].forEach(x => x.classList.toggle('on', x === e.currentTarget)); } })));
    const addEv = () => { const t = tin.value.trim(); if (!t) { tin.focus(); return; } D.store.update('events', o => ({ ...o, [sel]: [...(o[sel] || []), { id: D.uid(), title: t, time: time.value, color }] }), {}); tin.value = ''; time.value = ''; D.audio.click(); };
    tin.addEventListener('keydown', e => { if (e.key === 'Enter') addEv(); });
    form.append(h('div.rowf.gap8', [tin, time]), h('div.rowf', { style: 'justify-content:space-between' }, [dots, h('button.btn.primary.sm', { onclick: addEv }, D.ico('plus'), 'Add')]));
    const nav = (d) => { m += d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); };
    const head = h('div.rowf', { style: 'justify-content:space-between;padding:0 16px 10px' }, [ui.ibtn('back', () => nav(-1), 'Previous month'), title, ui.ibtn('chev', () => nav(1), 'Next month')]);
    const left = h('div.col', [head, grid]), right = h('div.col.gap12', [dayList, form]);
    body.append(ui.nav('Calendar', { right: h('button.navbtn.today', { onclick: () => { y = now.getFullYear(); m = now.getMonth(); sel = D.dayKey(now); draw(); } }, 'Today') }),
      h('div.scroll', ctx.wide ? h('div.cal2', [left, right]) : [left, h('div', { style: 'height:12px' }), right]));
    ctx.sub('events', draw); draw();
  } });

/* ================================================================== Reminders */
D.registerApp({ id: 'reminders', name: 'Reminders', icon: 'reminders', c: ['#ff9f0a', '#ff6a00'], mount(body, ctx) {
  let tab = D.store.get('rem.tab', 'today'), due = null;
  const all = () => D.store.get('reminders', []), write = a => D.store.set('reminders', a);
  const list = h('div.card'), inp = ui.input({ placeholder: 'New reminder', 'aria-label': 'New reminder' });
  const dueBtn = h('button.ibtn', { 'aria-label': 'Set due time', onclick: async () => {
    const v = await ctx.prompt('Due date & time', { type: 'datetime-local', value: due ? new Date(due - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '', ok: 'Set' });
    if (v === null) return; due = v ? new Date(v).getTime() : null; dueBtn.classList.toggle('on', !!due); dueBtn.title = due ? new Date(due).toLocaleString() : 'Set due time'; } }, D.ico('bell'));
  const add = () => { const t = inp.value.trim(); if (!t) return; write([{ id: D.uid(), title: t, due, done: false, flag: false, ts: Date.now() }, ...all()]); inp.value = ''; due = null; dueBtn.classList.remove('on'); D.audio.click(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  const filt = r => { const sod = new Date().setHours(0, 0, 0, 0), eod = sod + 864e5; return { today: !r.done && r.due && r.due < eod, scheduled: !r.done && r.due, all: !r.done, flagged: !r.done && r.flag, done: r.done }[tab]; };
  const draw = () => {
    const rs = all().filter(filt).sort((a, b) => (a.due || 9e15) - (b.due || 9e15) || b.ts - a.ts);
    list.replaceChildren(...(rs.length ? rs.map(r => h('div.lrow', [h('button.rcheck', { class: r.done ? 'on' : '', 'aria-label': r.done ? 'Mark not done' : 'Mark done', onclick: () => write(all().map(x => x.id === r.id ? { ...x, done: !x.done } : x)) }, r.done ? D.ico('check') : null),
      h('div.tx', [h('b', { class: r.done ? 'strike' : '' }, r.title), r.due && h('span', { style: r.due < Date.now() && !r.done ? 'color:#ff8a80;opacity:1' : '' }, new Date(r.due).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))]),
      h('button.ibtn', { class: r.flag ? 'on' : '', 'aria-label': 'Flag', onclick: () => write(all().map(x => x.id === r.id ? { ...x, flag: !x.flag } : x)) }, D.ico('flag')),
      h('button.ibtn', { 'aria-label': 'Delete reminder', onclick: () => write(all().filter(x => x.id !== r.id)) }, D.ico('trash'))])) : [ui.empty('reminders', tab === 'done' ? 'Nothing completed' : 'All clear', tab === 'done' ? '' : 'Add a reminder above.')]));
    const n = all().filter(r => !r.done).length; D.fire('reminders:count', n);
  };
  const tabs = ui.seg([['today', 'Today'], ['scheduled', 'Scheduled'], ['all', 'All'], ['flagged', 'Flagged'], ['done', 'Done']], tab, v => { tab = v; D.store.set('rem.tab', v); draw(); });
  body.append(ui.nav('Reminders', { right: all().some(r => r.done) ? ui.ibtn('trash', () => write(all().filter(r => !r.done)), 'Clear completed') : null }), h('div.tabs', tabs),
    h('div.toolbar', [inp, dueBtn, h('button.btn.primary', { onclick: add }, 'Add')]), h('div.scroll', list));
  ctx.sub('reminders', draw); draw();
} });
})();
