/* Web apps: Weather (Open-Meteo), Maps (OpenStreetMap embed + Nominatim), Browser.
   These need the network. Everything degrades to a clear message when offline. */
(function () {
'use strict';
const D = window.Duo, h = D.h, ui = D.ui;

const WMO = c => c === 0 ? ['Clear', 'sun'] : c <= 2 ? ['Partly cloudy', 'sun'] : c === 3 ? ['Overcast', 'cloud'] : c <= 48 ? ['Fog', 'cloud'] : c <= 57 ? ['Drizzle', 'cloud'] : c <= 67 ? ['Rain', 'cloud'] : c <= 77 ? ['Snow', 'cloud'] : c <= 82 ? ['Showers', 'cloud'] : c <= 86 ? ['Snow showers', 'cloud'] : ['Thunderstorm', 'cloud'];
const TZCITY = { 'Europe/Tirane': 'Tirana', 'Europe/London': 'London', 'Europe/Paris': 'Paris', 'Europe/Berlin': 'Berlin', 'Europe/Rome': 'Rome', 'Europe/Madrid': 'Madrid', 'America/New_York': 'New York', 'America/Chicago': 'Chicago', 'America/Los_Angeles': 'Los Angeles', 'Asia/Tokyo': 'Tokyo', 'Asia/Dubai': 'Dubai', 'Australia/Sydney': 'Sydney', 'Asia/Kolkata': 'Mumbai' };
const getJSON = async (url, ms = 9000) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); } };
const geocode = async q => ((await getJSON('https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=' + encodeURIComponent(q))).results || []);

const T = c => { const f = D.settings.get('units') === 'f'; return Math.round(f ? c * 9 / 5 + 32 : c); };
D.weather = {
  current() { const w = D.store.get('weather', null); if (!w || !w.data) return null; const [desc, ic] = WMO(w.data.code); return { city: w.place.name, temp: T(w.data.temp), desc, icon: ic, hi: T(w.data.hi), lo: T(w.data.lo) }; },
  async refresh(place) {
    place = place || D.store.get('weather', {}).place || await D.weather.defaultPlace();
    const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weather_code&hourly=temperature_2m,weather_code&forecast_days=7&timezone=auto`);
    const data = { temp: j.current.temperature_2m, code: j.current.weather_code, wind: j.current.wind_speed_10m, hum: j.current.relative_humidity_2m, feels: j.current.apparent_temperature, hi: j.daily.temperature_2m_max[0], lo: j.daily.temperature_2m_min[0],
      days: j.daily.time.map((d, i) => ({ d, hi: j.daily.temperature_2m_max[i], lo: j.daily.temperature_2m_min[i], code: j.daily.weather_code[i] })),
      hours: j.hourly.time.slice(0, 48).map((t, i) => ({ t, v: j.hourly.temperature_2m[i], code: j.hourly.weather_code[i] })), at: Date.now() };
    D.store.set('weather', { place, data }); return data;
  },
  async defaultPlace() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone, name = TZCITY[tz] || tz.split('/').pop().replace(/_/g, ' ');
    const r = (await geocode(name))[0]; if (!r) throw new Error('Could not locate ' + name);
    return { name: r.name, lat: r.latitude, lon: r.longitude, country: r.country || '' };
  }
};
D.services.push(() => { const w = D.store.get('weather', null); if (!w || !w.data || Date.now() - w.data.at > 30 * 60 * 1000) setTimeout(() => D.weather.refresh().catch(() => {}), 2500); });

D.registerApp({ id: 'weather', name: 'Weather', icon: 'sun', c: ['#4aa8ff', '#1b5fd1'], mount(body, ctx) {
  const view = h('div.scroll'); let busy = false;
  const draw = () => {
    const w = D.store.get('weather', null), u = D.settings.get('units') === 'f' ? '°F' : '°C';
    if (!w || !w.data) { view.replaceChildren(ui.empty('cloud', busy ? 'Loading forecast…' : 'No forecast yet', busy ? '' : 'Connect to the internet and press refresh, or search for a city.')); return; }
    const d = w.data, [desc] = WMO(d.code), now = new Date().getHours();
    const hrs = d.hours.filter(x => new Date(x.t).getTime() > Date.now() - 36e5).slice(0, 24);
    const lo = Math.min(...d.days.map(x => x.lo)), hi = Math.max(...d.days.map(x => x.hi));
    view.replaceChildren(
      h('div.wxhero', [h('div.wxcity', w.place.name), h('div.wxtemp', T(d.temp) + '°'), h('div.wxdesc', desc), h('div.wxhl', `H:${T(d.hi)}°  L:${T(d.lo)}°`)]),
      h('div.card', [h('div.eyebrow', 'Hourly'), h('div.hours', hrs.map((x, i) => h('div.hr', [h('span', i === 0 ? 'Now' : D.fmtTime(new Date(x.t)).replace(':00', '')), D.ico(WMO(x.code)[1]), h('b', T(x.v) + '°')])))]),
      h('div.card', [h('div.eyebrow', '7-day forecast'), ...d.days.map((x, i) => h('div.drow', [h('span.dn', i === 0 ? 'Today' : new Date(x.d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })), D.ico(WMO(x.code)[1]), h('span.dl', T(x.lo) + '°'),
        h('div.dbar', h('i', { style: `left:${(x.lo - lo) / (hi - lo || 1) * 100}%;right:${100 - (x.hi - lo) / (hi - lo || 1) * 100}%` })), h('span.dh', T(x.hi) + '°')]))]),
      h('div.stats', [['Feels like', T(d.feels) + '°'], ['Humidity', Math.round(d.hum) + '%'], ['Wind', Math.round(d.wind) + ' km/h']].map(([a, b]) => h('div.stat.glass', [h('span', a), h('b', b)]))),
      h('div.muted.small', { style: 'text-align:center;padding:10px' }, 'Updated ' + new Date(d.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · Open-Meteo · ' + u));
  };
  const load = async place => { busy = true; draw(); try { await D.weather.refresh(place); } catch (e) { ctx.toast({ title: 'Weather', body: 'Could not load: ' + (e.message || 'offline'), icon: 'cloud' }); } busy = false; draw(); };
  const search = async () => {
    const q = await ctx.prompt('Search city', { placeholder: 'e.g. Tirana', ok: 'Search' }); if (!q) return;
    try { const rs = await geocode(q); if (!rs.length) return ctx.alert('No results', 'Try another spelling.');
      const pick = await ctx.menu('Choose a place', rs.map((r, i) => [`${r.name}${r.admin1 ? ', ' + r.admin1 : ''}, ${r.country || ''}`, i]));
      if (pick !== undefined && pick !== null) { const r = rs[pick]; load({ name: r.name, lat: r.latitude, lon: r.longitude, country: r.country || '' }); } } catch (e) { ctx.alert('Offline', 'Searching needs an internet connection.'); }
  };
  body.append(ui.nav('Weather', { right: h('div.rowf', [ui.ibtn('search', search, 'Search city'), ui.ibtn('refresh', () => load(), 'Refresh')]) }), view);
  ctx.sub('weather', draw); ctx.bus('settings', draw); draw(); const w = D.store.get('weather', null); if (!w || !w.data || Date.now() - w.data.at > 600000) load();
} });

/* ====================================================================== Maps */
D.registerApp({ id: 'maps', name: 'Maps', icon: 'pin', c: ['#5fd068', '#1a8f3c'], mount(body, ctx) {
  let c = D.store.get('maps.view', { lat: 41.3275, lon: 19.8187, z: 12, label: 'Tirana' });
  const frame = h('iframe.mapframe', { title: 'Map', referrerpolicy: 'no-referrer', loading: 'lazy' }), res = h('div.card.hide');
  const show = () => { const d = 360 / Math.pow(2, c.z) * 1.2, bb = [c.lon - d * 1.4, c.lat - d * .8, c.lon + d * 1.4, c.lat + d * .8].map(x => +x.toFixed(5)).join('%2C'); frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bb}&layer=mapnik&marker=${c.lat}%2C${c.lon}`; D.store.set('maps.view', c); };
  const go = async q => {
    if (!q.trim()) return; res.classList.remove('hide'); res.replaceChildren(h('div.muted.small', { style: 'padding:10px' }, 'Searching…'));
    try { const rs = await getJSON('https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' + encodeURIComponent(q));
      if (!rs.length) { res.replaceChildren(h('div.muted.small', { style: 'padding:10px' }, 'No places found.')); return; }
      res.replaceChildren(...rs.map(r => h('div.lrow', { onclick: () => { c = { lat: +r.lat, lon: +r.lon, z: 13, label: r.display_name.split(',')[0] }; res.classList.add('hide'); show(); } }, [D.ico('pin'), h('div.tx', [h('b', r.display_name.split(',')[0]), h('span', r.display_name)])])));
    } catch (e) { res.replaceChildren(h('div.muted.small', { style: 'padding:10px' }, 'Search needs an internet connection.')); }
  };
  const inp = h('input', { type: 'search', placeholder: 'Search places', autocomplete: 'off', onkeydown: e => { if (e.key === 'Enter') go(inp.value); } });
  const here = () => { if (!navigator.geolocation) return ctx.alert('Unavailable', 'Location is not supported here.'); navigator.geolocation.getCurrentPosition(p => { c = { lat: p.coords.latitude, lon: p.coords.longitude, z: 14, label: 'You' }; show(); }, () => ctx.alert('Location off', 'Allow location access to centre the map on you.'), { timeout: 8000 }); };
  const zoom = d => { c = { ...c, z: D.clamp(c.z + d, 3, 18) }; show(); };
  body.append(ui.nav('Maps', { right: ui.ibtn('pin', here, 'My location') }), h('div.toolbar', [h('label.search', D.ico('search'), inp)]), res,
    h('div.mapwrap', [frame, h('div.zoom.glass', [ui.ibtn('plus', () => zoom(1), 'Zoom in'), ui.ibtn('minus', () => zoom(-1), 'Zoom out')])]));
  show();
} });

/* ==================================================================== Browser */
D.registerApp({ id: 'browser', name: 'Browser', icon: 'globe', c: ['#2a7bff', '#0a3fa8'], mount(body, ctx) {
  const norm = s => { s = s.trim(); if (!s) return ''; if (/^[a-z]+:\/\//i.test(s)) return s; if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s)) return 'https://' + s; return 'https://duckduckgo.com/?q=' + encodeURIComponent(s); };
  const frame = h('iframe.webframe', { title: 'Web page', referrerpolicy: 'no-referrer', sandbox: 'allow-scripts allow-forms allow-popups allow-same-origin' });
  const note = h('div.empty', [h('div.empty-ic', D.ico('globe')), h('b', 'Browser'), h('span', 'Type a web address or a search above. Some sites refuse to be shown inside another page; use ↗ to open those in a real tab.')]);
  const inp = h('input', { type: 'text', placeholder: 'Search or enter address', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Address' });
  let cur = '', hist = [], pos = -1;
  const load = (u, push = true) => { u = norm(u); if (!u) return; cur = u; inp.value = u; frame.classList.remove('hide'); note.classList.add('hide'); frame.src = u; if (push) { hist = hist.slice(0, pos + 1); hist.push(u); pos = hist.length - 1; } };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') load(inp.value); });
  const bm = () => D.store.get('bookmarks', [{ t: 'Wikipedia', u: 'https://en.wikipedia.org' }, { t: 'OpenStreetMap', u: 'https://www.openstreetmap.org' }, { t: 'MDN', u: 'https://developer.mozilla.org' }]);
  const marks = h('div.chips');
  const drawM = () => marks.replaceChildren(...bm().map(b => h('button.chip', { onclick: () => load(b.u), oncontextmenu: e => { e.preventDefault(); D.store.set('bookmarks', bm().filter(x => x.u !== b.u)); drawM(); } }, b.t)));
  const star = async () => { if (!cur) return; if (bm().some(b => b.u === cur)) return ctx.toast({ title: 'Bookmarks', body: 'Already saved', icon: 'star' }); const t = await ctx.prompt('Bookmark name', { value: new URL(cur).hostname, ok: 'Save' }); if (t) { D.store.set('bookmarks', [...bm(), { t, u: cur }]); drawM(); } };
  const go = d => { const p = pos + d; if (p < 0 || p >= hist.length) return; pos = p; load(hist[p], false); };
  body.append(ui.nav('Browser', { right: h('div.rowf', [ui.ibtn('star', star, 'Bookmark'), ui.ibtn('globe', () => cur && window.open(cur, '_blank', 'noopener'), 'Open in a real tab')]) }),
    h('div.toolbar', [ui.ibtn('back', () => go(-1), 'Back'), ui.ibtn('chev', () => go(1), 'Forward'), h('label.search.grow', D.ico('globe'), inp), ui.ibtn('refresh', () => { if (cur) frame.src = cur; }, 'Reload')]),
    marks, h('div.webwrap', [note, frame]));
  frame.classList.add('hide'); drawM(); if (ctx.args && ctx.args.url) load(ctx.args.url);
} });
})();
