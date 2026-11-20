/* Fold physics: a damped spring drives the hinge angle (0° open … 180° folded).
   While open there is a single live display (no seam). When folding starts the
   left half receives a frozen clone of the UI so it can swing over the right half. */
(function () {
'use strict';
const D = window.Duo, $ = D.$;
const rig = $('#rig'), slider = $('#hinge'), stateEl = $('#state'), btn = $('#foldBtn'), uiL = $('#uiL');
let a = 0, v = 0, target = 0, last = 0, raf = 0, cloned = false, wasFolded = false;

D.fold = { angle: 0, folded: false, target: 0, toggle: () => setTarget(target > 90 ? 0 : 180), set: t => setTarget(t) };

function syncClone() {
  const inner = D.screens.find(s => s.kind === 'inner'); if (!inner) return;
  const src = inner.root, c = src.cloneNode(true);
  uiL.replaceChildren(...c.childNodes);
  // keep wallpaper / ambient animations in phase so there is no visible jump
  const live = src.querySelectorAll('.wall i, .shine, .l-hint'), cl = uiL.querySelectorAll('.wall i, .shine, .l-hint');
  live.forEach((el, i) => { const an = el.getAnimations && el.getAnimations()[0]; if (an && cl[i] && an.currentTime != null) cl[i].style.animationDelay = `-${an.currentTime}ms`; });
  uiL.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  uiL.querySelectorAll('video,audio').forEach(e => e.remove());
  uiL.setAttribute('inert', '');
}

function apply() {
  const f = a / 180, k = Math.min(1, a / 24), o = Math.max(0, 1 - a / 6);
  rig.style.setProperty('--a', a.toFixed(3)); rig.style.setProperty('--f', f.toFixed(4));
  rig.style.setProperty('--k', k.toFixed(4)); rig.style.setProperty('--o', o.toFixed(4));
  const open = a < 0.02; rig.classList.toggle('is-open', open);
  if (!open && !cloned) { syncClone(); cloned = true; } else if (open && cloned) { cloned = false; uiL.replaceChildren(); }
  const folded = a > 90; D.fold.angle = a; D.fold.target = target;
  if (folded !== D.fold.folded) { D.fold.folded = folded; document.getElementById('device').dataset.folded = folded; D.fire('fold', folded); }
  if (!slider.matches(':active')) { slider.value = a; D.ui.paint(slider); }
  stateEl.textContent = a < 1.5 ? 'Unfolded' : a > 178.5 ? 'Folded' : Math.round(a) + '°';
  btn.lastChild.textContent = target > 90 ? 'Unfold' : 'Fold';
}
function step(now) {
  const dt = Math.min(0.032, (now - last) / 1000); last = now;
  const s = D.settings.all(), K = s.stiffness, C = 2 * Math.sqrt(K) * s.damping;
  v += (K * (target - a) - C * v) * dt; a += v * dt;
  if (a < 0) { a = 0; if (v < 0) v = 0; } if (a > 180) { a = 180; if (v > 0) v = 0; }
  if (Math.abs(target - a) < 0.04 && Math.abs(v) < 0.2) { a = target; v = 0; apply(); raf = 0; return; }
  apply(); raf = requestAnimationFrame(step);
}
function setTarget(t) {
  target = Math.max(0, Math.min(180, t)); D.fold.target = target;
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  btn.lastChild.textContent = target > 90 ? 'Unfold' : 'Fold';
}
btn.addEventListener('click', D.fold.toggle);
slider.addEventListener('input', () => setTarget(+slider.value));
$('#powerBtn').addEventListener('click', () => D.power.toggle());
D.on('power', s => { $('#powerBtn').setAttribute('aria-pressed', s !== 'off'); });
addEventListener('keydown', e => {
  if (e.target.matches && e.target.matches('input,textarea,select,[contenteditable]')) return;
  const s = D.active && D.active();
  if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !(s && s.app)) { e.preventDefault(); D.fold.toggle(); }
  if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !(s && s.app)) { e.preventDefault(); D.power.toggle(); }
});

function fit() {
  const r = $('#stage').getBoundingClientRect();
  rig.style.setProperty('--s', Math.max(.2, Math.min(r.width / 860, r.height / 920, 1.25)).toFixed(4));
}
addEventListener('resize', fit); fit();

D.fold.set0 = x => { a = target = x; v = 0; apply(); };
window.__duo = { setAngle: x => D.fold.set0(x), D };
apply();
})();
