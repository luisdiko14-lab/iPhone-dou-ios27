/* Messages: "Duo Assistant" (a local command bot that really creates notes,
   reminders and calculations) and "Room" (shared chat between tabs via
   BroadcastChannel, and between devices when server.py is running). */
(function () {
'use strict';
const D = window.Duo, h = D.h, ui = D.ui;

const bc = 'BroadcastChannel' in window ? new BroadcastChannel('duo27-room') : null;
const me = D.store.get('msg.me', null) || (() => { const id = D.uid(); D.store.set('msg.me', id); return id; })();
let lastSrv = 0;

const msgs = k => D.store.get('msg.' + k, []);
const push = (k, m) => { const a = msgs(k).concat(m).slice(-300); D.store.set('msg.' + k, a); D.fire('msg:' + k, m); };

/* ---- room transport ---- */
const sendRoom = async text => {
  const m = { id: D.uid(), from: me, name: D.settings.get('deviceName'), text, ts: Date.now() };
  push('room', m); bc && bc.postMessage(m);
  if (D.api.up) { try { await D.api.call('api/messages', { method: 'POST', json: { from: me, name: m.name, text, cid: m.id } }); } catch (e) {} }
};
if (bc) bc.onmessage = e => { const m = e.data; if (m && m.id && !msgs('room').some(x => x.id === m.id)) { push('room', m); D.toast({ title: m.name || 'Room', body: m.text, icon: 'messages', app: 'messages', args: { to: 'room' } }); } };
D.services.push(() => setInterval(async () => {
  if (!D.api.up) return;
  try {
    const r = await D.api.call('api/messages?since=' + lastSrv); lastSrv = r.now || lastSrv;
    (r.messages || []).forEach(m => { if (m.from === me || msgs('room').some(x => x.id === m.cid)) return; const mm = { id: m.cid || 's' + m.id, from: m.from, name: m.name, text: m.text, ts: m.ts * 1000 }; push('room', mm); D.toast({ title: m.name || 'Room', body: m.text, icon: 'messages', app: 'messages', args: { to: 'room' } }); });
  } catch (e) {}
}, 2500));

/* ---- assistant ---- */
const HELP = 'I can really do things:\n/note <text>  saves a note\n/remind <text> in <n> min  sets a reminder\n/calc <expr>  calculates\n/time  /date  /weather\n/joke  /coin  /roll\n/clear  clears this chat';
const JOKES = ['Why did the foldable phone go to therapy? It had too many unresolved creases.', 'I told my phone a secret. Now it’s in the cloud.', 'There are 10 kinds of people: those who understand binary and those who don’t.'];
async function bot(input) {
  const t = input.trim(), [cmd, ...rest] = t.split(/\s+/), arg = rest.join(' ');
  switch (cmd.toLowerCase()) {
    case '/help': case 'help': case 'hi': case 'hello': return HELP;
    case '/time': return 'It is ' + D.fmtTime(new Date(), true) + '.';
    case '/date': return D.fmtDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    case '/coin': return Math.random() < .5 ? 'Heads' : 'Tails';
    case '/roll': { const n = +arg || 6; return 'Rolled ' + (1 + Math.floor(Math.random() * Math.max(2, n))) + ' (d' + Math.max(2, n) + ')'; }
    case '/joke': return JOKES[Math.floor(Math.random() * JOKES.length)];
    case '/calc': { if (!arg) return 'Usage: /calc 12*(3+4)'; try { return arg + ' = ' + D.fmtNum(D.calc(arg)); } catch (e) { return 'I couldn’t compute that: ' + e.message; } }
    case '/note': { if (!arg) return 'Usage: /note buy milk'; D.store.update('notes', a => [{ id: D.uid(), text: arg, ts: Date.now(), pin: false }, ...a], []); return 'Saved to Notes.'; }
    case '/remind': {
      const m = arg.match(/^(.*?)\s+in\s+(\d+)\s*(s|sec|m|min|h|hr|hours?|minutes?)\b/i); if (!m) return 'Usage: /remind stretch in 10 min';
      const n = +m[2], u = m[3].toLowerCase()[0], ms = n * (u === 's' ? 1e3 : u === 'h' ? 36e5 : 6e4), due = Date.now() + ms;
      D.store.update('reminders', a => [{ id: D.uid(), title: m[1] || 'Reminder', due, done: false, flag: false, ts: Date.now() }, ...a], []); return 'OK, I’ll remind you at ' + D.fmtTime(new Date(due)) + '.';
    }
    case '/weather': { const w = D.weather.current(); return w ? `${w.city}: ${w.temp}° ${w.desc} (H ${w.hi}° / L ${w.lo}°)` : 'No forecast cached yet. Open Weather once while online.'; }
    default: { if (/^[\d\s+\-*/^().%,a-z]+$/i.test(t) && /\d/.test(t) && /[+\-*/^]/.test(t)) { try { return t + ' = ' + D.fmtNum(D.calc(t)); } catch (e) {} } return 'I don’t know that one. Type /help.'; }
  }
}

D.registerApp({ id: 'messages', name: 'Messages', icon: 'messages', c: ['#4cd964', '#16a34a'], mount(body, ctx) {
  const THREADS = [{ id: 'assistant', name: 'Duo Assistant', sub: 'Local helper' }, { id: 'room', name: 'Room', sub: () => D.api.up ? 'Shared with devices on this server' : 'Shared with other tabs' }];
  let cur = ctx.args && ctx.args.to === 'room' ? 'room' : null; const list = h('div.card'), chat = h('div.chat'), feed = h('div.feed'), inp = h('input.input', { placeholder: 'Message', autocomplete: 'off', 'aria-label': 'Message', maxlength: 500 });
  const split = ui.split(ctx, h('div.col', [list]), chat);
  const bubble = (m, mine) => h('div.bub', { class: mine ? 'me' : 'them' }, [!mine && m.name && cur === 'room' ? h('i.bname', m.name) : null, h('span', m.text), h('time', new Date(m.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))]);
  const drawFeed = () => { if (!cur) return; feed.replaceChildren(...msgs(cur).map(m => bubble(m, m.me || m.from === me))); feed.scrollTop = feed.scrollHeight; };
  const drawList = () => list.replaceChildren(...THREADS.map(t => { const l = msgs(t.id).slice(-1)[0]; return h('div.lrow', { onclick: () => open(t.id) }, [ui.avatar(t.name), h('div.tx', [h('b', t.name), h('span', l ? l.text.split('\n')[0] : (typeof t.sub === 'function' ? t.sub() : t.sub))]), l && h('span.muted.small', ui.ago(l.ts))]); }));
  const open = id => { cur = id; const t = THREADS.find(x => x.id === id); title.textContent = t.name; if (id === 'assistant' && !msgs('assistant').length) push('assistant', { id: D.uid(), from: 'bot', text: 'Hi! I’m the Duo Assistant.\n' + HELP, ts: Date.now() }); split.show('r'); drawFeed(); setTimeout(() => inp.focus(), 50); };
  const title = h('b.chat-title');
  const send = async () => {
    const t = inp.value.trim(); if (!t || !cur) return; inp.value = ''; D.audio.click();
    if (cur === 'room') return sendRoom(t);
    if (t === '/clear') { D.store.set('msg.assistant', []); return open('assistant'); }
    push('assistant', { id: D.uid(), me: true, from: me, text: t, ts: Date.now() });
    setTimeout(async () => { const r = await bot(t); push('assistant', { id: D.uid(), from: 'bot', text: r, ts: Date.now() }); }, 250);
  };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') send(); });
  chat.append(h('div.chat-h', [ui.back(() => { cur = null; split.show('l'); drawList(); }, 'Chats'), title]), h('div.scroll', feed), h('div.composer', [inp, h('button.btn.primary.round', { 'aria-label': 'Send', onclick: send }, D.ico('send'))]));
  body.append(ui.nav('Messages'), h('div.fill', split));
  const refresh = k => () => { drawList(); if (cur === k) drawFeed(); };
  ctx.cleanup(D.on('msg:assistant', refresh('assistant'))); ctx.cleanup(D.on('msg:room', refresh('room'))); ctx.bus('api', drawList);
  drawList(); if (cur) open(cur); else if (ctx.wide) open('assistant');
} });
})();
