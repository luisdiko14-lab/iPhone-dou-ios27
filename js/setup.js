/* Setup Assistant: the first-run flow (Hello → language → region → cellular → Wi-Fi →
   privacy → Banana ID → terms → personalise → done). It runs on both displays from one
   shared state. Cellular and Wi-Fi are simulated and drive the status bar; "Banana ID" is a
   fictional local account (nothing is sent anywhere, no password is stored). */
(function () {
'use strict';
const D = window.Duo, h = D.h, ui = D.ui;

/* ---------------------------------------------------------------- i18n */
const LANGS = [['en', 'English', 'English'], ['de', 'Deutsch', 'German'], ['sq', 'Shqip', 'Albanian'], ['es', 'Español', 'Spanish'], ['fr', 'Français', 'French'],
  ['it', 'Italiano', 'Italian'], ['pt', 'Português', 'Portuguese'], ['tr', 'Türkçe', 'Turkish'], ['nl', 'Nederlands', 'Dutch'], ['ja', '日本語', 'Japanese'], ['ko', '한국어', 'Korean'], ['zh', '中文', 'Chinese']];
const T = {
  en: { cont: 'Continue', back: 'Back', start: 'Get Started', swipe: 'Swipe up to begin', lang: 'Select Your Language', langSub: 'You can change this later in Settings.', region: 'Select Your Country or Region', search: 'Search',
    cell: 'Set Up Cellular', cellSub: 'Connect to your carrier for calls, messages and 5G data.', connect: 'Connect', connecting: 'Connecting to {c}…', connected: 'Connected · {g}', later: 'Set Up Later', cellNote: 'Simulated carrier. No real SIM is used.',
    wifi: 'Choose a Wi-Fi Network', wifiSub: 'Join a network to download apps and sync.', pass: 'Password', join: 'Join', joining: 'Joining…', useCell: 'Use Cellular Connection', secured: 'Secured', open: 'Open', wifiNote: 'Simulated networks. Online apps use your real connection.',
    priv: 'Data & Privacy', privBody: 'Duo OS keeps your notes, photos, messages and settings on this device. If the Python server is running, it can also sync to your own computer. Nothing is sent to anyone else.',
    bid: 'Sign in with Banana ID', bidSub: 'Your Banana ID is used for sync, backups and Messages.', email: 'Banana ID', name: 'Your name', passw: 'Passphrase', signin: 'Sign In', create: 'Create a Banana ID', haveOne: 'I already have a Banana ID', bidNote: 'Banana ID is fictional and lives only on this device. Don’t type a real password.', signing: 'Signing in…', skip: 'Set Up Later in Settings',
    terms: 'Terms and Conditions', agree: 'Agree', disagree: 'Disagree', mustAgree: 'You need to agree to the terms to continue.', termsBody: 'This is a fictional demo operating system. It is provided as is, without warranty. All data stays in your browser unless you run the optional Python server yourself. It is not affiliated with Apple or any other company.',
    pers: 'Make It Yours', persSub: 'Choose a wallpaper and a name.', devName: 'Device name', wall: 'Wallpaper', accent: 'Accent',
    done: 'Welcome to iPhone Duo', hi: 'Hi, {n}', doneSub: 'Unfold it, fold it, and make it yours.', hello: 'Hello' },
  de: { cont: 'Fortfahren', back: 'Zurück', start: 'Los geht’s', swipe: 'Zum Starten nach oben wischen', lang: 'Wähle deine Sprache', langSub: 'Du kannst das später in den Einstellungen ändern.', region: 'Land oder Region wählen', search: 'Suchen',
    cell: 'Mobilfunk einrichten', cellSub: 'Verbinde dich mit deinem Anbieter für Anrufe, Nachrichten und 5G-Daten.', connect: 'Verbinden', connecting: 'Verbinde mit {c}…', connected: 'Verbunden · {g}', later: 'Später einrichten', cellNote: 'Simulierter Anbieter. Es wird keine echte SIM verwendet.',
    wifi: 'WLAN-Netzwerk wählen', wifiSub: 'Verbinde dich mit einem Netzwerk, um Apps zu laden und zu synchronisieren.', pass: 'Passwort', join: 'Verbinden', joining: 'Verbinde…', useCell: 'Mobilfunkverbindung verwenden', secured: 'Gesichert', open: 'Offen', wifiNote: 'Simulierte Netzwerke. Online-Apps nutzen deine echte Verbindung.',
    priv: 'Daten & Datenschutz', privBody: 'Duo OS speichert Notizen, Fotos, Nachrichten und Einstellungen auf diesem Gerät. Läuft der Python-Server, kann er auch mit deinem eigenen Computer synchronisieren. Nichts wird an andere gesendet.',
    bid: 'Mit Banana ID anmelden', bidSub: 'Deine Banana ID wird für Sync, Backups und Nachrichten verwendet.', email: 'Banana ID', name: 'Dein Name', passw: 'Passphrase', signin: 'Anmelden', create: 'Banana ID erstellen', haveOne: 'Ich habe schon eine Banana ID', bidNote: 'Banana ID ist fiktiv und existiert nur auf diesem Gerät. Gib kein echtes Passwort ein.', signing: 'Anmelden…', skip: 'Später in den Einstellungen',
    terms: 'Bedingungen', agree: 'Zustimmen', disagree: 'Ablehnen', mustAgree: 'Du musst den Bedingungen zustimmen, um fortzufahren.', termsBody: 'Dies ist ein fiktives Demo-Betriebssystem, bereitgestellt ohne Gewähr. Alle Daten bleiben in deinem Browser, außer du startest den optionalen Python-Server. Keine Verbindung zu Apple oder anderen Firmen.',
    pers: 'Mach es zu deinem', persSub: 'Wähle ein Hintergrundbild und einen Namen.', devName: 'Gerätename', wall: 'Hintergrund', accent: 'Akzent', done: 'Willkommen bei iPhone Duo', hi: 'Hallo, {n}', doneSub: 'Auf- und zuklappen und nach Wunsch anpassen.', hello: 'Hallo' },
  sq: { cont: 'Vazhdo', back: 'Mbrapa', start: 'Fillo', swipe: 'Rrëshqit lart për të nisur', lang: 'Zgjidh gjuhën', langSub: 'Mund ta ndryshosh më vonë te Cilësimet.', region: 'Zgjidh shtetin ose rajonin', search: 'Kërko',
    cell: 'Konfiguro rrjetin celular', cellSub: 'Lidhu me operatorin për thirrje, mesazhe dhe të dhëna 5G.', connect: 'Lidhu', connecting: 'Po lidhet me {c}…', connected: 'U lidh · {g}', later: 'Konfiguro më vonë', cellNote: 'Operator i simuluar. Nuk përdoret SIM i vërtetë.',
    wifi: 'Zgjidh një rrjet Wi-Fi', wifiSub: 'Bashkohu me një rrjet për të shkarkuar aplikacione.', pass: 'Fjalëkalimi', join: 'Bashkohu', joining: 'Po bashkohet…', useCell: 'Përdor lidhjen celulare', secured: 'I siguruar', open: 'I hapur', wifiNote: 'Rrjete të simuluara. Aplikacionet përdorin lidhjen tënde reale.',
    priv: 'Të dhënat & Privatësia', privBody: 'Duo OS i ruan shënimet, fotot, mesazhet dhe cilësimet në këtë pajisje. Nëse serveri Python po ekzekutohet, mund të sinkronizojë me kompjuterin tënd. Asgjë nuk i dërgohet askujt tjetër.',
    bid: 'Hyr me Banana ID', bidSub: 'Banana ID përdoret për sinkronizim, kopje rezervë dhe mesazhe.', email: 'Banana ID', name: 'Emri yt', passw: 'Fjalëkalimi', signin: 'Hyr', create: 'Krijo një Banana ID', haveOne: 'Kam tashmë një Banana ID', bidNote: 'Banana ID është fiktive dhe ekziston vetëm në këtë pajisje. Mos shkruaj fjalëkalim të vërtetë.', signing: 'Po hyn…', skip: 'Konfiguro më vonë',
    terms: 'Kushtet', agree: 'Pranoj', disagree: 'Nuk pranoj', mustAgree: 'Duhet të pranosh kushtet për të vazhduar.', termsBody: 'Ky është një sistem operativ demo fiktiv, pa garanci. Të dhënat mbeten në shfletuesin tënd. Nuk lidhet me Apple apo ndonjë kompani tjetër.',
    pers: 'Bëje tëndin', persSub: 'Zgjidh një sfond dhe një emër.', devName: 'Emri i pajisjes', wall: 'Sfondi', accent: 'Theksi', done: 'Mirë se vjen në iPhone Duo', hi: 'Përshëndetje, {n}', doneSub: 'Hape, mbylle dhe personalizoje.', hello: 'Përshëndetje' },
  es: { cont: 'Continuar', back: 'Atrás', start: 'Comenzar', swipe: 'Desliza hacia arriba para empezar', lang: 'Selecciona tu idioma', langSub: 'Puedes cambiarlo más tarde en Ajustes.', region: 'Selecciona tu país o región', search: 'Buscar',
    cell: 'Configurar datos móviles', cellSub: 'Conéctate a tu operador para llamadas, mensajes y datos 5G.', connect: 'Conectar', connecting: 'Conectando a {c}…', connected: 'Conectado · {g}', later: 'Configurar más tarde', cellNote: 'Operador simulado. No se usa una SIM real.',
    wifi: 'Elige una red Wi-Fi', wifiSub: 'Conéctate a una red para descargar apps.', pass: 'Contraseña', join: 'Unirse', joining: 'Uniéndose…', useCell: 'Usar conexión móvil', secured: 'Segura', open: 'Abierta', wifiNote: 'Redes simuladas. Las apps usan tu conexión real.',
    priv: 'Datos y privacidad', privBody: 'Duo OS guarda tus notas, fotos, mensajes y ajustes en este dispositivo. Si el servidor Python está activo, puede sincronizar con tu propio ordenador. No se envía nada a nadie más.',
    bid: 'Inicia sesión con Banana ID', bidSub: 'Tu Banana ID se usa para sincronizar, copias y Mensajes.', email: 'Banana ID', name: 'Tu nombre', passw: 'Frase de acceso', signin: 'Iniciar sesión', create: 'Crear un Banana ID', haveOne: 'Ya tengo un Banana ID', bidNote: 'Banana ID es ficticio y solo existe en este dispositivo. No escribas una contraseña real.', signing: 'Iniciando sesión…', skip: 'Configurar más tarde',
    terms: 'Términos y condiciones', agree: 'Aceptar', disagree: 'Rechazar', mustAgree: 'Debes aceptar los términos para continuar.', termsBody: 'Este es un sistema operativo de demostración ficticio, sin garantía. Los datos permanecen en tu navegador. No está afiliado a Apple ni a ninguna otra empresa.',
    pers: 'Hazlo tuyo', persSub: 'Elige un fondo y un nombre.', devName: 'Nombre del dispositivo', wall: 'Fondo', accent: 'Color', done: 'Te damos la bienvenida a iPhone Duo', hi: 'Hola, {n}', doneSub: 'Ábrelo, ciérralo y personalízalo.', hello: 'Hola' },
  fr: { cont: 'Continuer', back: 'Retour', start: 'Commencer', swipe: 'Balayez vers le haut pour commencer', lang: 'Choisissez votre langue', langSub: 'Vous pourrez la modifier dans Réglages.', region: 'Choisissez votre pays ou région', search: 'Rechercher',
    cell: 'Configurer le réseau cellulaire', cellSub: 'Connectez-vous à votre opérateur pour les appels, messages et données 5G.', connect: 'Se connecter', connecting: 'Connexion à {c}…', connected: 'Connecté · {g}', later: 'Configurer plus tard', cellNote: 'Opérateur simulé. Aucune vraie carte SIM.',
    wifi: 'Choisissez un réseau Wi-Fi', wifiSub: 'Rejoignez un réseau pour télécharger des apps.', pass: 'Mot de passe', join: 'Rejoindre', joining: 'Connexion…', useCell: 'Utiliser le réseau cellulaire', secured: 'Sécurisé', open: 'Ouvert', wifiNote: 'Réseaux simulés. Les apps utilisent votre vraie connexion.',
    priv: 'Données et confidentialité', privBody: 'Duo OS garde vos notes, photos, messages et réglages sur cet appareil. Si le serveur Python tourne, il peut synchroniser avec votre propre ordinateur. Rien n’est envoyé à des tiers.',
    bid: 'Se connecter avec Banana ID', bidSub: 'Votre Banana ID sert à la synchronisation, aux sauvegardes et à Messages.', email: 'Banana ID', name: 'Votre nom', passw: 'Phrase secrète', signin: 'Se connecter', create: 'Créer un Banana ID', haveOne: 'J’ai déjà un Banana ID', bidNote: 'Banana ID est fictif et n’existe que sur cet appareil. Ne saisissez pas de vrai mot de passe.', signing: 'Connexion…', skip: 'Configurer plus tard',
    terms: 'Conditions générales', agree: 'Accepter', disagree: 'Refuser', mustAgree: 'Vous devez accepter les conditions pour continuer.', termsBody: 'Ceci est un système d’exploitation de démonstration fictif, fourni sans garantie. Les données restent dans votre navigateur. Sans lien avec Apple ni aucune autre société.',
    pers: 'Personnalisez', persSub: 'Choisissez un fond d’écran et un nom.', devName: 'Nom de l’appareil', wall: 'Fond d’écran', accent: 'Accent', done: 'Bienvenue sur iPhone Duo', hi: 'Bonjour, {n}', doneSub: 'Dépliez-le, repliez-le, faites-en le vôtre.', hello: 'Bonjour' }
};
D.langs = LANGS;
D.lang = () => D.store.get('lang', null) || (navigator.language || 'en').slice(0, 2);
D.t = (k, v) => { const L = T[D.lang()] || T.en; let s = L[k] != null ? L[k] : (T.en[k] != null ? T.en[k] : k); if (v) Object.keys(v).forEach(x => { s = s.replace('{' + x + '}', v[x]); }); return s; };

/* ------------------------------------------------------- network state */
const NETS = [{ ssid: 'Duo-Home', secure: true, lv: 3 }, { ssid: 'CoffeeShop Guest', secure: false, lv: 3 }, { ssid: 'FreeWiFi_Lounge', secure: false, lv: 2 }, { ssid: 'Neighbor 2.4G', secure: true, lv: 2 }, { ssid: 'Duo Lab 6E', secure: true, lv: 1 }];
const NDEF = { cell: { on: false, carrier: 'Free WiFi 5G', gen: '5G' }, wifi: { on: false, ssid: '', secure: false } };
D.net = { NETS, CARRIER: 'Free WiFi 5G',
  get() { const n = D.store.get('net', null) || {}; return { cell: { ...NDEF.cell, ...(n.cell || {}) }, wifi: { ...NDEF.wifi, ...(n.wifi || {}) } }; },
  set(p) { const n = this.get(); if (p.cell) n.cell = { ...n.cell, ...p.cell }; if (p.wifi) n.wifi = { ...n.wifi, ...p.wifi }; D.store.set('net', n); D.fire('net', n); } };

/* -------------------------------------------------------------- state */
const dev = () => document.getElementById('device');
const COUNTRIES = ['Albania', 'Austria', 'Belgium', 'Brazil', 'Canada', 'China', 'Croatia', 'France', 'Germany', 'Greece', 'India', 'Italy', 'Japan', 'Kosovo', 'Mexico', 'Netherlands', 'North Macedonia', 'Portugal', 'South Korea', 'Spain', 'Switzerland', 'Türkiye', 'United Kingdom', 'United States'];
const TZ2C = { 'Europe/Tirane': 'Albania', 'Europe/Berlin': 'Germany', 'Europe/Paris': 'France', 'Europe/London': 'United Kingdom', 'Europe/Rome': 'Italy', 'Europe/Madrid': 'Spain', 'America/New_York': 'United States', 'America/Los_Angeles': 'United States', 'America/Chicago': 'United States', 'Asia/Tokyo': 'Japan', 'Europe/Istanbul': 'Türkiye' };
const STEPS = ['hello', 'lang', 'region', 'cell', 'wifi', 'privacy', 'bid', 'terms', 'personal', 'done'];
const step = () => D.store.get('setup.step', 0), done = () => !!D.store.get('setup.done', false);
const S = D.setup = {
  STEPS, done,
  init() { dev().dataset.setup = done() ? 'false' : 'true'; },
  go(i) { D.store.set('setup.step', Math.max(0, Math.min(STEPS.length - 1, i))); D.fire('setup'); },
  next() { S.go(step() + 1); }, back() { S.go(step() - 1); },
  finish() { D.store.set('setup.done', true); D.fire('setup'); dev().dataset.setup = 'false'; D.fire('setup:done'); },
  restart() { D.store.set('setup.done', false); D.store.set('setup.step', 0); dev().dataset.setup = 'true'; D.fire('setup'); },
  mount(screen) {
    const el = h('div.setup', { role: 'dialog', 'aria-label': 'Setup Assistant' }); let shown = -1, cleanup = null;
    const render = () => {
      const i = step(), id = STEPS[i]; if (i === shown && !el.dataset.force) return;
      const back = i > 0 && id !== 'done'; const dir = i >= shown ? 'fwd' : 'bk'; shown = i;
      cleanup && cleanup(); cleanup = null;
      const pane = h('div.spane', { class: dir }); const api = { screen, add: f => { const p = cleanup; cleanup = () => { p && p(); f(); }; } };
      pane.append(...[back && h('button.sback', { onclick: S.back }, D.ico('back'), D.t('back')), P[id](api)].filter(Boolean));
      el.replaceChildren(pane); el.dataset.step = id; el.setAttribute('lang', D.lang());
    };
    D.on('setup', render); D.on('lang', () => { shown = -1; render(); }); render(); return el;
  }
};

/* ------------------------------------------------------------- helpers */
const btn = (label, fn, cls = 'primary') => h('button.btn.sbtn', { class: cls, onclick: fn }, label);
const head = (title, sub, icon) => h('div.shead', [icon, h('h2', title), sub && h('p', sub)]);
const foot = (...kids) => h('div.sfoot', kids.filter(Boolean));
const banana = (s = 64) => h('span.banana', { style: `width:${s}px;height:${s}px`, html: '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="bnn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset="1" stop-color="#ffb700"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="#2a2418"/><g transform="rotate(-18 32 32)"><path d="M12 24C13 44 28 54 50 46c3-1 3-5 0-5-17 3-27-6-28-17-1-3-9-3-10 0z" fill="url(#bnn)" stroke="#c98a00" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 24c4 14 14 20 30 19" fill="none" stroke="#e6a100" stroke-width="1.4" stroke-linecap="round" opacity=".7"/><path d="M12.5 22.5c0-4 1-8 3.5-11l3 1.5c-2 2.5-3 6-2.5 9.5z" fill="#6b4a14"/><circle cx="50.5" cy="43.5" r="2.4" fill="#4a3208"/></g></svg>' });
const checkIc = () => h('span.chk', D.ico('check'));
const wifiLv = n => h('span.wlv', { class: 'l' + n }, [h('i'), h('i'), h('i')]);

/* --------------------------------------------------------------- steps */
const GREETS = ['Hello', 'Hallo', 'Përshëndetje', 'Hola', 'Bonjour', 'Ciao', 'Olá', 'こんにちは', '안녕하세요', '你好', 'Merhaba', 'Hej'];
const P = {
  hello(api) {
    const g = h('div.greet', GREETS[0]); let i = 0; const iv = setInterval(() => { i = (i + 1) % GREETS.length; g.classList.remove('in'); void g.offsetWidth; g.textContent = GREETS[i]; g.classList.add('in'); }, 1900); api.add(() => clearInterval(iv));
    const root = h('div.sstep.hello', { style: 'touch-action:none' }, [h('div.hmid', [banana(72), g]), foot(btn(D.t('start'), S.next), h('div.sub', D.t('swipe')))]);
    let y0 = null; // swipe up anywhere to begin
    root.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; y0 = e.clientY; try { root.setPointerCapture(e.pointerId); } catch (_) {} });
    root.addEventListener('pointermove', e => { if (y0 == null) return; const dy = Math.min(0, (e.clientY - y0) / D.scale()); root.style.transform = `translateY(${dy}px)`; root.style.opacity = String(Math.max(.25, 1 + dy / 260)); });
    const end = e => { if (y0 == null) return; const dy = (e.clientY - y0) / D.scale(); y0 = null; root.style.transform = ''; root.style.opacity = ''; if (dy < -60) S.next(); };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', () => { y0 = null; root.style.transform = ''; root.style.opacity = ''; });
    return root;
  },
  lang() {
    const cur = D.lang(), list = h('div.slist', LANGS.map(([c, n, en]) => h('button.srow', { class: c === cur ? 'on' : '', onclick: () => { D.store.set('lang', c); document.documentElement.lang = c; D.fire('lang'); } }, [h('b', n), h('span', en), c === cur && checkIc()])));
    return h('div.sstep', [head(D.t('lang'), D.t('langSub'), h('div.sicon', D.ico('globe'))), list, foot(btn(D.t('cont'), S.next))]);
  },
  region() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; let sel = D.store.get('region', null) || TZ2C[tz] || 'United States', q = '';
    const list = h('div.slist'), draw = () => list.replaceChildren(...COUNTRIES.filter(c => c.toLowerCase().includes(q)).map(c => h('button.srow', { class: c === sel ? 'on' : '', onclick: () => { sel = c; draw(); } }, [h('b', c), c === sel && checkIc()])));
    draw();
    return h('div.sstep', [head(D.t('region')), ui.search(D.t('search'), v => { q = v.trim().toLowerCase(); draw(); }), list, foot(btn(D.t('cont'), () => { D.store.set('region', sel); const us = sel === 'United States'; D.settings.set({ hour24: !us && sel !== 'Canada', units: us ? 'f' : 'c' }); S.next(); }))]);
  },
  cell(api) {
    const n = D.net.get().cell; let busy = false;
    const bars = h('div.bigbars', [1, 2, 3, 4].map(() => h('i'))), msg = h('div.cmsg'), go = btn(D.t('connect'), connect), later = h('button.slink', { onclick: () => { D.net.set({ cell: { on: false } }); S.next(); } }, D.t('later')), cont = btn(D.t('cont'), S.next);
    const ui2 = () => { const c = D.net.get().cell; bars.classList.toggle('on', c.on && !busy); msg.textContent = busy ? D.t('connecting', { c: D.net.CARRIER }) : c.on ? D.t('connected', { g: c.gen }) : D.net.CARRIER; msg.classList.toggle('ok', c.on && !busy); go.classList.toggle('hide', c.on || busy); cont.classList.toggle('hide', !c.on || busy); later.classList.toggle('hide', c.on || busy); bars.classList.toggle('busy', busy); };
    let t; async function connect() { busy = true; ui2(); t = setTimeout(() => { busy = false; D.net.set({ cell: { on: true, carrier: D.net.CARRIER, gen: '5G' } }); ui2(); }, 2300); } api.add(() => clearTimeout(t));
    ui2(); return h('div.sstep.center', [head(D.t('cell'), D.t('cellSub')), h('div.carrier.glass', [bars, h('div.cname', D.net.CARRIER), msg]), h('div.sub', D.t('cellNote')), foot(go, cont, later)]);
  },
  wifi(api) {
    const list = h('div.slist'); let joining = null, open = null, t;
    const cur = () => D.net.get().wifi;
    const join = (net, pw) => { joining = net.ssid; open = null; draw(); t = setTimeout(() => { joining = null; D.net.set({ wifi: { on: true, ssid: net.ssid, secure: net.secure } }); draw(); }, 1500); };
    api.add(() => clearTimeout(t));
    const draw = () => {
      const w = cur(), rows = NETS.map(n => {
        const on = w.on && w.ssid === n.ssid;
        const row = h('button.srow.net', { class: on ? 'on' : '', onclick: () => { if (on || joining) return; if (n.secure) { open = open === n.ssid ? null : n.ssid; draw(); } else join(n); } },
          [on ? checkIc() : h('span.chk'), h('div.tx', [h('b', n.ssid), h('span', n.secure ? D.t('secured') : D.t('open'))]), joining === n.ssid ? h('span.spin') : wifiLv(n.lv)]);
        if (open !== n.ssid) return row;
        const pw = h('input.input', { type: 'password', placeholder: D.t('pass'), autocomplete: 'off', 'aria-label': D.t('pass') }); const ok = () => { if (pw.value.length >= 8) join(n); else { pw.classList.add('bad'); } };
        pw.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ok(); }); setTimeout(() => pw.focus(), 30);
        return h('div.pwbox', [row, h('div.rowf.gap8', [pw, h('button.btn.primary.sm', { onclick: ok }, D.t('join'))])]);
      });
      list.replaceChildren(...rows); cont.classList.toggle('hide', !w.on); cellBtn.classList.toggle('hide', w.on || !D.net.get().cell.on);
    };
    const cont = btn(D.t('cont'), S.next), cellBtn = h('button.slink', { onclick: () => { D.net.set({ wifi: { on: false, ssid: '' } }); S.next(); } }, D.t('useCell'));
    draw(); return h('div.sstep', [head(D.t('wifi'), D.t('wifiSub')), list, h('div.sub', D.t('wifiNote')), foot(cont, cellBtn, h('button.slink', { class: D.net.get().cell.on ? 'hide' : '', onclick: S.next }, D.t('later')))]);
  },
  privacy() {
    return h('div.sstep.center', [head(D.t('priv'), null, h('div.sicon.blue', D.ico('layers'))), h('p.sbody', D.t('privBody')), foot(btn(D.t('cont'), S.next))]);
  },
  bid(api) {
    const acc = D.store.get('bid', null); let mode = 'in';
    const email = ui.input({ placeholder: D.t('email'), type: 'email', 'aria-label': D.t('email'), value: acc ? acc.email : '' }), name = ui.input({ placeholder: D.t('name'), 'aria-label': D.t('name'), value: acc ? acc.name : '' }), pw = h('input.input', { type: 'password', placeholder: D.t('passw'), autocomplete: 'off', 'aria-label': D.t('passw') });
    const form = h('div.sform'), go = btn(D.t('signin'), submit), toggle = h('button.slink', { onclick: () => { mode = mode === 'in' ? 'new' : 'in'; draw(); } });
    const draw = () => { form.replaceChildren(...(mode === 'new' ? [name] : []), email, pw); go.textContent = mode === 'in' ? D.t('signin') : D.t('create'); toggle.textContent = mode === 'in' ? D.t('create') : D.t('haveOne'); };
    let t; function submit() {
      const e = email.value.trim(); if (!/^\S+@\S+\.\S+$/.test(e)) { email.classList.add('bad'); email.focus(); return; } if (!pw.value) { pw.classList.add('bad'); pw.focus(); return; }
      const nm = (name.value.trim() || e.split('@')[0]).slice(0, 30); go.disabled = true; go.textContent = D.t('signing'); pw.value = '';
      t = setTimeout(() => { D.store.set('bid', { email: e, name: nm.charAt(0).toUpperCase() + nm.slice(1) }); S.next(); }, 1100);
    } api.add(() => clearTimeout(t));
    [email, name, pw].forEach(i => { i.addEventListener('input', () => i.classList.remove('bad')); i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') submit(); }); });
    draw(); return h('div.sstep.center', [head(D.t('bid'), D.t('bidSub'), banana(68)), form, h('div.sub', D.t('bidNote')), foot(go, toggle, h('button.slink', { onclick: () => { D.store.set('bid', null); S.next(); } }, D.t('skip')))]);
  },
  terms() {
    return h('div.sstep', [head(D.t('terms')), h('div.sterms.glass', [h('p', D.t('termsBody')), h('p', '1. Be kind to the banana.  2. No real credentials, please.  3. Have fun folding.')]), foot(btn(D.t('agree'), S.next), h('button.slink', { onclick: () => D.toast({ title: D.t('terms'), body: D.t('mustAgree'), icon: 'bell' }) }, D.t('disagree')))]);
  },
  personal() {
    const cur = D.settings.get('wallpaper'), nm = ui.input({ value: D.settings.get('deviceName'), 'aria-label': D.t('devName'), maxlength: 24 }); nm.addEventListener('keydown', e => e.stopPropagation()); nm.addEventListener('change', () => D.settings.set({ deviceName: nm.value.trim() || 'iPhone Duo' }));
    const wg = h('div.swall'), drawW = () => wg.replaceChildren(...D.WALLPAPERS.map(([k, n]) => h('button.wtile', { class: D.settings.get('wallpaper') === k ? 'on' : '', 'aria-label': n, onclick: () => { D.settings.set({ wallpaper: k }); drawW(); } }, [h('div.wall.wpv.small', { 'data-wall': k }, [h('i.b1'), h('i.b2'), h('i.b3')]), h('span', n)])));
    const dots = h('div.rowf.gap8', { style: 'justify-content:center' }, ['#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#ffd60a'].map(c => h('button.cdot', { style: 'background:' + c, 'aria-label': c, class: D.settings.get('accent') === c ? 'on' : '', onclick: e => { D.settings.set({ accent: c }); [...dots.children].forEach(x => x.classList.toggle('on', x === e.currentTarget)); } })));
    drawW(); return h('div.sstep', [head(D.t('pers'), D.t('persSub')), h('div.sform', [h('label.sl', D.t('devName')), nm, h('label.sl', D.t('wall')), wg, h('label.sl', D.t('accent')), dots]), foot(btn(D.t('cont'), () => { D.settings.set({ deviceName: nm.value.trim() || 'iPhone Duo' }); S.next(); }))]);
  },
  done() {
    const b = D.store.get('bid', null);
    return h('div.sstep.center', [h('div.hmid', [banana(84), h('h2.big', D.t('done')), h('p.sbody', b ? D.t('hi', { n: b.name }) + '. ' + D.t('doneSub') : D.t('doneSub'))]), foot(btn(D.t('start'), () => { S.finish(); D.toast({ title: D.settings.get('deviceName'), body: D.t('done'), icon: 'home' }); }))]);
  }
};
})();
