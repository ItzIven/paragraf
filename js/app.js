import { device, activeProfile, loadProfile, onChange } from './store.js';
import { loadContent, refreshRemote } from './content.js';
import { $, $$ } from './ui.js';
import { renderGate } from './views/profiles.js';
import * as heute from './views/heute.js';
import * as bloecke from './views/bloecke.js';
import * as karten from './views/karten.js';
import * as schemata from './views/schemata.js';
import * as pruefen from './views/pruefen.js';
import * as einstellungen from './views/einstellungen.js';

const routes = { heute, bloecke, karten, schemata, pruefen, einstellungen };
let current = null;

function route() {
  const view = $('#view');
  if (!activeProfile()) { document.body.classList.add('gated'); $('.nav').hidden = true; renderGate(view, start); return; }
  $('.nav').hidden = false;
  const [name, ...params] = (location.hash.replace(/^#\/?/, '') || 'heute').split('/');
  const r = routes[name] || heute;
  current = r;
  $$('.nav a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === name || (!routes[name] && a.dataset.tab === 'heute')));
  $$('.nav a[aria-current]').forEach((a) => a.setAttribute('aria-current', 'page'));
  view.innerHTML = '';
  r.render(view, params.map(decodeURIComponent));
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

async function start(profileId) {
  loadProfile(profileId);
  await refreshRemote();
  if (!location.hash) location.hash = '#/heute'; else route();
}

window.addEventListener('hashchange', route);
onChange(() => current?.onStoreChange?.());

(async function boot() {
  await loadContent();
  if (device.active && activeProfile()) await start(device.active); else route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

export { route };
