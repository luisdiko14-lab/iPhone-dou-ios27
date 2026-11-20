/* Shared UI components for the apps (glass buttons, nav bars, sliders…). */
(function () {
'use strict';
const D = window.Duo, h = D.h;
const ui = D.ui = {};

const paint = i => i.style.setProperty('--p', ((i.value - i.min) / ((i.max - i.min) || 1) * 100) + '%');
ui.paint = paint;
ui.range = (o = {}) => {
  const i = h('input', { type: 'range', min: o.min ?? 0, max: o.max ?? 100, step: o.step ?? 1, value: o.value ?? 0, 'aria-label': o.label || 'slider', class: o.class });
  paint(i); i.addEventListener('input', () => { paint(i); o.onInput && o.onInput(+i.value, i); });
  if (o.onChange) i.addEventListener('change', () => o.onChange(+i.value, i));
  i.set = v => { i.value = v; paint(i); };
  return i;
};
ui.icon = (n, cls) => D.ico(n, cls);
ui.btn = (label, onclick, cls = '') => h('button.btn', { class: cls, onclick }, typeof label === 'string' && D.icons[label] && !/\s/.test(label) && cls.includes('icon') ? D.ico(label) : label);
ui.ibtn = (icon, onclick, label, cls = '') => h('button.ibtn', { onclick, 'aria-label': label || icon, title: label || icon, class: cls }, D.ico(icon));
ui.back = (fn, label = 'Back') => h('button.navbtn', { onclick: fn, 'aria-label': label }, D.ico('back'), label);
ui.nav = (title, o = {}) => h('div.nav', [h('div.nav-l', o.left), h('h1', title), h('div.nav-r', o.right)]);
ui.seg = (opts, value, onChange, cls = '') => {
  const el = h('div.seg', { class: cls }), btns = {};
  opts.forEach(([v, label]) => { btns[v] = h('button', { onclick: () => { el.set(v); onChange && onChange(v); } }, label); el.append(btns[v]); });
  el.set = v => { el.value = v; Object.entries(btns).forEach(([k, b]) => b.classList.toggle('on', String(k) === String(v))); };
  el.set(value); return el;
};
ui.switch = (value, onChange, label) => {
  const el = h('button.sw', { role: 'switch', 'aria-label': label || 'switch', onclick: () => { el.set(!el.on); onChange && onChange(el.on); } }, h('i'));
  el.set = v => { el.on = !!v; el.classList.toggle('on', el.on); el.setAttribute('aria-checked', el.on); }; el.set(value); return el;
};
ui.search = (ph, onInput, value = '') => {
  const i = h('input', { type: 'search', placeholder: ph, value, autocomplete: 'off', spellcheck: 'false', oninput: () => onInput(i.value) });
  return h('label.search', D.ico('search'), i);
};
ui.empty = (icon, title, sub) => h('div.empty', [h('div.empty-ic', D.ico(icon)), h('b', title), sub && h('span', sub)]);
ui.avatar = (name, size = 44) => {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return h('span.avatar', { style: `width:${size}px;height:${size}px;font-size:${size * .4}px;background:linear-gradient(145deg,hsl(${hue} 70% 62%),hsl(${(hue + 40) % 360} 70% 42%))` }, (name.trim()[0] || '?').toUpperCase());
};
ui.field = (label, input) => h('label.field', h('span', label), input);
ui.input = (o = {}) => h('input.input', { type: 'text', autocomplete: 'off', spellcheck: 'false', ...o });
ui.ago = ts => {
  const s = (Date.now() - ts) / 1000;
  if (s < 45) return 'now'; if (s < 3600) return Math.round(s / 60) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
ui.dur = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m + ':' + D.pad(s % 60); };

/* list/detail layout: side-by-side on the wide display, slide-over on the cover */
ui.split = (ctx, left, right) => {
  const el = h('div.split', { class: ctx.wide ? 'wide' : 'narrow', dataset: { show: 'l' } }, [h('div.pane-l', left), h('div.pane-r', right)]);
  el.show = w => { el.dataset.show = w; };
  return el;
};
})();
