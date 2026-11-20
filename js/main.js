/* Boot: build the two live displays, start power-on, probe the Python backend. */
(function () {
'use strict';
const D = window.Duo;
D.api.initKey();
D.settings.apply();
try { if (/[?&]setup=skip/.test(location.search)) D.store.set('setup.done', true); } catch (e) {}
document.documentElement.lang = D.lang();
D.setup.init();
new D.Screen(document.getElementById('uiR'), 'inner');
new D.Screen(document.getElementById('uiC'), 'cover');
D.services.forEach(fn => { try { fn(); } catch (e) { console.error('service failed', e); } });
D.power.boot();
D.api.ping().then(up => { if (up) D.api.pull().catch(() => {}); });
D.fire('ready');
})();
