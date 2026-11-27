import { device, createProfile, checkPin } from '../store.js';
import { esc, toast } from '../ui.js';

const MAX = 3;

export function renderGate(view, onEnter) {
  const profiles = device.profiles;
  view.innerHTML = `
    <div class="gate"><div class="panel">
      <span class="sigil" aria-hidden="true">§</span>
      <h1>Wer lernt?</h1>
      <p class="lead">${profiles.length ? 'Profil wählen und mit PIN entsperren.' : 'Lege dein Profil an. Bis zu drei Personen können die App auf einem Gerät nutzen.'}</p>
      <div class="profiles">
        ${profiles.map((p) => `<button class="profile-btn" data-id="${p.id}"><span class="avatar" style="background:${p.color}">${esc(p.name[0] || '?')}</span><span><b>${esc(p.name)}</b><br><span class="small muted">${p.session ? 'Sync aktiv' : 'nur auf diesem Gerät'}</span></span></button>`).join('')}
      </div>
      ${profiles.length < MAX ? '<button class="btn btn--block" id="new">Neues Profil anlegen</button>' : ''}
    </div></div>`;

  view.querySelectorAll('.profile-btn').forEach((b) => b.onclick = () => pinPad(view, device.profiles.find((p) => p.id === b.dataset.id), onEnter));
  view.querySelector('#new')?.addEventListener('click', () => newProfile(view, onEnter));
}

function newProfile(view, onEnter) {
  const panel = view.querySelector('.panel');
  panel.innerHTML = `
    <h1>Neues Profil</h1>
    <p class="lead">Die PIN schützt dein Profil auf diesem Gerät. Den Abgleich mit dem iPad richtest du danach unter „Mehr → Sync“ ein.</p>
    <form id="f" class="stack" autocomplete="off">
      <div class="field"><label for="n">Name</label><input class="input" id="n" maxlength="20" required></div>
      <div class="field"><label for="p">PIN (4 Ziffern)</label><input class="input" id="p" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></div>
      <div class="btn-row"><button type="button" class="btn btn--ghost" id="back">Zurück</button><button class="btn btn--primary">Profil anlegen</button></div>
    </form>`;
  panel.querySelector('#back').onclick = () => renderGate(view, onEnter);
  panel.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const name = panel.querySelector('#n').value.trim(), pin = panel.querySelector('#p').value;
    if (!/^\d{4}$/.test(pin)) return toast('Die PIN braucht genau 4 Ziffern');
    onEnter(await createProfile(name, pin));
  };
}

function pinPad(view, profile, onEnter) {
  let pin = '';
  const panel = view.querySelector('.panel');
  const draw = () => {
    panel.innerHTML = `
      <div class="row"><span class="avatar" style="background:${profile.color}">${esc(profile.name[0])}</span><h1>${esc(profile.name)}</h1></div>
      <div class="pin" aria-label="${pin.length} von 4 Ziffern">${[0, 1, 2, 3].map((i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="back" aria-label="Zurück zur Auswahl">←</button><button data-k="0">0</button><button data-k="del" aria-label="Ziffer löschen">⌫</button></div>`;
    panel.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => press(b.dataset.k));
  };
  const press = async (k) => {
    if (k === 'back') return renderGate(view, onEnter);
    if (k === 'del') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
    draw();
    if (pin.length === 4) {
      if (await checkPin(profile, pin)) onEnter(profile.id);
      else { toast('PIN falsch'); pin = ''; draw(); }
    }
  };
  const onKey = (e) => { if (!document.body.contains(panel)) return document.removeEventListener('keydown', onKey); if (/^\d$/.test(e.key)) press(e.key); if (e.key === 'Backspace') press('del'); };
  document.addEventListener('keydown', onKey);
  draw();
}
