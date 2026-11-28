import { device, saveDevice, progress, commit, activeProfile, logout, connectSync, disconnectSync, syncState, sync, exportData, importData, removeProfile } from '../store.js';
import { db, refreshRemote, importContent, uploadLocal, localPacks, hasCode, unlockWithCode, forgetCode } from '../content.js';
import { CONFIG, hasSync } from '../config.js';
import { esc, toast, sheet } from '../ui.js';

export function render(view, params = []) {
  const p = activeProfile();
  const s = progress.settings;
  const packs = Object.entries(db.packs);
  view.innerHTML = `
    <div class="head"><h1>Einstellungen</h1></div>

    <h2>Darstellung</h2>
    <div class="panel stack">
      <div class="row"><span>Erscheinungsbild</span><span class="spacer"></span>
        <div class="chips" style="margin:0">${[['dark', 'Dunkel'], ['light', 'Hell']].map(([v, l]) => `<button class="chip" data-theme="${v}" aria-pressed="${device.theme === v}">${l}</button>`).join('')}</div></div>
      <div class="row"><span>Schriftgröße</span><span class="spacer"></span>
        <div class="chips" style="margin:0">${[[0.9, 'Klein'], [1, 'Normal'], [1.12, 'Groß'], [1.25, 'Sehr groß']].map(([v, l]) => `<button class="chip" data-scale="${v}" aria-pressed="${Number(device.fontScale || 1) === v}">${l}</button>`).join('')}</div></div>
    </div>

    <h2>Lernen</h2>
    <div class="panel stack">
      <div class="field"><label for="goal">Tagesziel (Wiederholungen)</label><input class="input" id="goal" type="number" min="5" max="300" step="5" value="${s.dailyGoal}"></div>
      <div class="field"><label for="new">Neue Karten pro Tag</label><input class="input" id="new" type="number" min="0" max="100" step="5" value="${s.newPerDay}"></div>
      <div><div class="small muted">Meine Fächer</div><div class="chips">${CONFIG.faecher.map((f) => `<button class="chip" data-fach="${f.id}" aria-pressed="${s.faecher.includes(f.id)}">${f.name}</button>`).join('')}</div></div>
    </div>

    <h2>Profil und Sync</h2>
    <div class="panel stack">
      <div class="row"><span class="avatar" style="background:${p.color}">${esc(p.name[0])}</span><div><b>${esc(p.name)}</b><br><span class="small muted">${p.session ? `Sync mit ${esc(p.session.user.email)}: ${syncState.status}${syncState.error ? ` (${esc(syncState.error)})` : ''}` : 'Lernstand nur auf diesem Gerät'}</span></div></div>
      ${!hasSync() ? '<p class="small muted">Sync ist noch nicht eingerichtet: In <code>js/config.js</code> fehlen Supabase-Adresse und Schlüssel (siehe README).</p>'
        : p.session ? '<div class="btn-row"><button class="btn" id="syncnow">Jetzt abgleichen</button><button class="btn btn--ghost" id="unsync">Sync trennen</button></div>'
        : '<button class="btn btn--primary" id="sync">Mit Sync-Konto verbinden</button>'}
      <div class="btn-row"><button class="btn" id="switch">Profil wechseln</button><button class="btn btn--ghost" id="del">Profil löschen</button></div>
    </div>

    <h2>Sicherung</h2>
    <div class="panel stack">
      <p class="small muted" style="margin:0">Lernstand als Datei sichern oder auf ein anderes Gerät übertragen, auch ohne Sync.</p>
      <div class="btn-row"><button class="btn" id="exp">Lernstand exportieren</button><label class="btn" for="imp">Lernstand importieren</label><input type="file" id="imp" accept="application/json" hidden></div>
    </div>

    <h2 id="zugang">Inhalte</h2>
    <div class="panel stack small">
      ${hasSync() && !p.session ? (hasCode()
        ? '<div class="row"><span>Alle Fächer sind mit dem Zugangscode freigeschaltet.</span><button class="btn btn--ghost" id="nocode">Code entfernen</button></div>'
        : `<form class="stack" id="codeform"><label for="code"><b>Zugangscode</b><br><span class="muted">Einmal je Gerät eingeben, dann stehen alle Fächer für alle Profile bereit, auch offline.</span></label><div class="btn-row"><input id="code" type="password" autocomplete="off" minlength="8" required placeholder="Code" style="flex:1"><button class="btn btn--primary">Freischalten</button></div></form>`) : ''}
      ${packs.map(([f, i]) => `<div class="row"><b>${f}</b><span class="muted">Version ${esc(String(i.version))}, ${i.origin === 'online' ? 'online geladen' : i.origin === 'datei' ? 'aus Datei' : 'mitgeliefert'}</span>${i.demo ? '<span class="demo-note">Demo</span>' : ''}</div>`).join('') || '<span class="muted">Keine Inhalte geladen.</span>'}
      <div class="row"><span class="muted">${db.cards.length} Karten, ${db.questions.length} Fragen, ${db.schemas.length} Schemata, ${db.blocks.length} Lernblöcke</span></div>
      <div class="btn-row">${p.session || hasCode() ? '<button class="btn" id="reload">Inhalte neu laden</button>' : ''}<label class="btn" for="cimp">Inhaltsdateien laden</label><input type="file" id="cimp" accept="application/json,.json" multiple hidden>${p.session && localPacks().length ? '<button class="btn" id="cup">Auf Supabase hochladen</button>' : ''}</div>
      <p class="muted" style="margin:0">Inhalte sind Lernhilfen und ersetzen nicht Gesetz, Richtlinien und die amtlichen Handbücher. Fehler bitte notieren und melden.</p>
    </div>
    <p class="small muted" style="margin-top:24px">${CONFIG.appName} ${CONFIG.version}</p>`;

  const $ = (q) => view.querySelector(q);
  view.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => { device.theme = b.dataset.theme; document.documentElement.dataset.theme = device.theme; saveDevice(); render(view); });
  view.querySelectorAll('[data-scale]').forEach((b) => b.onclick = () => { device.fontScale = Number(b.dataset.scale); document.documentElement.style.setProperty('--scale', device.fontScale); saveDevice(); render(view); });
  view.querySelectorAll('[data-fach]').forEach((b) => b.onclick = () => { const f = b.dataset.fach; s.faecher = s.faecher.includes(f) ? s.faecher.filter((x) => x !== f) : [...s.faecher, f]; if (!s.faecher.length) s.faecher = [f]; commit(); render(view); });
  $('#goal').onchange = (e) => { s.dailyGoal = Math.max(5, Number(e.target.value) || 30); commit(); toast('Tagesziel gespeichert'); };
  $('#new').onchange = (e) => { s.newPerDay = Math.max(0, Number(e.target.value) || 0); commit(); toast('Gespeichert'); };
  $('#switch').onclick = () => { logout(); location.hash = '#/'; location.reload(); };
  $('#del').onclick = () => sheet(`<h2 style="margin-top:0">Profil „${esc(p.name)}“ löschen?</h2><p>Der Lernstand auf diesem Gerät wird entfernt. Ein synchronisierter Stand bleibt im Sync-Konto erhalten.</p><div class="btn-row"><button class="btn" id="no">Abbrechen</button><button class="btn btn--primary" id="yes">Profil löschen</button></div>`, (el, close) => {
    el.querySelector('#no').onclick = close;
    el.querySelector('#yes').onclick = () => { removeProfile(p.id); location.hash = '#/'; location.reload(); };
  });
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
    a.download = `paragraf-${p.name}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  $('#imp').onchange = async (e) => { try { importData(await e.target.files[0].text()); toast('Lernstand übernommen'); render(view); } catch (err) { toast(err.message); } };
  $('#sync')?.addEventListener('click', () => sheet(`
    <h2 style="margin-top:0">Sync-Konto verbinden</h2>
    <p class="small muted">Melde dich mit dem Konto an, das in Supabase für dich angelegt wurde. Auf dem iPad dasselbe Konto verwenden, dann ist der Lernstand überall gleich.</p>
    <form id="f"><div class="field"><label for="e">E-Mail</label><input class="input" id="e" type="email" autocomplete="username" required></div>
    <div class="field"><label for="pw">Passwort</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
    <button class="btn btn--primary btn--block">Verbinden</button></form>`, (el, close) => {
    el.querySelector('#f').onsubmit = async (ev) => {
      ev.preventDefault();
      try { await connectSync(el.querySelector('#e').value, el.querySelector('#pw').value); await refreshRemote(); close(); toast('Sync verbunden'); render(view); }
      catch (err) { toast(`Anmeldung fehlgeschlagen: ${err.message}`); }
    };
  }));
  $('#syncnow')?.addEventListener('click', async () => { await sync(); toast(syncState.status === 'ok' ? 'Abgeglichen' : `Sync: ${syncState.error || syncState.status}`); render(view); });
  $('#unsync')?.addEventListener('click', () => { disconnectSync(); render(view); });
  $('#cimp').onchange = async (e) => {
    const ok = [], bad = [];
    for (const f of e.target.files) { try { ok.push(importContent(await f.text()).fach); } catch { bad.push(f.name); } }
    toast(`${ok.length ? `Geladen: ${ok.join(', ')}` : ''}${bad.length ? `${ok.length ? ' · ' : ''}Nicht lesbar: ${bad.join(', ')}` : ''}`);
    render(view);
  };
  $('#codeform')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try { await unlockWithCode($('#code').value); toast('Alle Fächer freigeschaltet'); render(view); }
    catch (err) { btn.disabled = false; toast(/Zugangscode/.test(err.message) ? 'Zugangscode falsch' : navigator.onLine ? `Fehler: ${err.message}` : 'Keine Internetverbindung'); }
  });
  $('#nocode')?.addEventListener('click', () => { forgetCode(); toast('Zugangscode entfernt'); render(view); });
  $('#cup')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const f = await uploadLocal(); toast(`Hochgeladen: ${f.join(', ')}`); }
    catch (err) { toast(/row-level security|42501|403/i.test(err.message) ? 'Hochladen nicht erlaubt: Konto ist nicht als Admin eingetragen' : `Fehler: ${err.message}`); }
    render(view);
  });
  $('#reload')?.addEventListener('click', async () => { toast((await refreshRemote()) ? 'Inhalte aktualisiert' : 'Keine Online-Inhalte gefunden'); render(view); });
  if (params[0] === 'zugang') $('#zugang')?.scrollIntoView({ block: 'start' });
}
