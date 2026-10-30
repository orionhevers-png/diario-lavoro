(() => {
  'use strict';

  const D = (window.DIARIO && window.DIARIO.giornate) || [];
  const R = window.ROBERTO || { punti: [], decisioni: [] };
  const T = (window.TODO && window.TODO.voci) || [];

  const LISTS = {
    roberto: { key: 'diario.roberto.v1', base: R.punti || [] },
    todo: { key: 'diario.todo.v1', base: T }
  };

  /* ---------- utilità ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmt = (iso, o) => parse(iso).toLocaleDateString('it-IT', o);
  const dayMonth = iso => fmt(iso, { day: 'numeric', month: 'long' });
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /* ---------- stato salvato nel browser ---------- */
  const emptyStore = () => ({ done: {}, extra: [], removed: [] });
  const load = key => { try { return Object.assign(emptyStore(), JSON.parse(localStorage.getItem(key))); } catch (e) { return emptyStore(); } };
  const save = (key, s) => { try { localStorage.setItem(key, JSON.stringify(s)); } catch (e) { /* storage non disponibile */ } };

  function getItems(name) {
    const { key, base } = LISTS[name];
    const s = load(key);
    return [...base, ...s.extra]
      .filter(i => !s.removed.includes(i.id))
      .map(i => {
        const d = s.done[i.id];
        if (d === undefined) return { ...i, fatto: !!i.fatto };
        return { ...i, fatto: !!d, fattoIl: d || null };
      });
  }
  const openItems = name => getItems(name).filter(i => !i.fatto);

  function toggleItem(name, id, wasDone) {
    const { key } = LISTS[name]; const s = load(key);
    s.done[id] = wasDone ? false : todayISO();
    save(key, s);
  }
  function addItem(name, item) {
    const { key } = LISTS[name]; const s = load(key);
    s.extra.push({ id: 'x' + Date.now().toString(36), data: todayISO(), ...item });
    save(key, s);
  }
  function removeItem(name, id) {
    const { key } = LISTS[name]; const s = load(key);
    s.extra = s.extra.filter(i => i.id !== id);
    if (!s.removed.includes(id)) s.removed.push(id);
    save(key, s);
  }

  /* ---------- pezzi di interfaccia ---------- */
  const dueLabel = iso => {
    const diff = Math.round((parse(iso) - parse(todayISO())) / 864e5);
    if (diff < 0) return `<span class="late">Scaduto il ${dayMonth(iso)}</span>`;
    if (diff === 0) return `<span class="soon">Da fare oggi</span>`;
    if (diff === 1) return `<span class="soon">Da fare entro domani</span>`;
    return `Entro il ${dayMonth(iso)}`;
  };

  const sortOpen = (a, b) => {
    if (a.scadenza && b.scadenza) return a.scadenza.localeCompare(b.scadenza);
    if (a.scadenza) return -1;
    if (b.scadenza) return 1;
    return (b.data || '').localeCompare(a.data || '');
  };

  function rowHTML(name, i) {
    const meta = [];
    if (i.fatto) {
      if (i.fattoIl) meta.push(name === 'roberto' ? `Discusso il ${dayMonth(i.fattoIl)}` : `Fatto il ${dayMonth(i.fattoIl)}`);
      if (i.esito) meta.push(`Esito: ${esc(i.esito)}`);
    } else {
      if (i.scadenza) meta.push(dueLabel(i.scadenza));
      if (i.nota) meta.push(esc(i.nota));
      if (i.data && !i.scadenza) meta.push(`Aggiunto il ${dayMonth(i.data)}`);
    }
    return `<li class="row ${i.fatto ? 'is-done' : ''}">
      <label><input type="checkbox" data-act="toggle" data-list="${name}" data-id="${esc(i.id)}" ${i.fatto ? 'checked' : ''}><span class="txt">${esc(i.testo)}</span></label>
      <button type="button" class="del" data-act="remove" data-list="${name}" data-id="${esc(i.id)}" aria-label="Elimina: ${esc(i.testo)}">Elimina</button>
      ${meta.length ? `<div class="meta">${meta.join(' – ')}</div>` : ''}
    </li>`;
  }

  function entryHTML(e) {
    const sec = (titolo, arr, cls) => arr && arr.length
      ? `<section class="blk ${cls || ''}"><h3>${titolo}</h3><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : '';
    const tags = e.tag && e.tag.length ? `<ul class="tags" aria-label="Etichette">${e.tag.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
    return `<article class="entry" id="g-${esc(e.data)}">
      <div class="entry-date"><span class="n">${parse(e.data).getDate()}</span><span class="w">${fmt(e.data, { weekday: 'long' })}</span></div>
      <div class="entry-body">
        <h2>${esc(e.titolo || 'Giornata di lavoro')}</h2>
        ${e.focus ? `<p class="focus">${esc(e.focus)}</p>` : ''}
        ${sec('Cosa ho fatto', e.fatto, 'done')}
        ${sec('Da riprendere', e.aperto, 'open')}
        ${sec('Note', e.note)}
        ${sec('Da portare a Roberto', e.roberto, 'rob')}
        ${tags}
      </div>
    </article>`;
  }

  const head = (titolo, sotto, wd) => `<header class="head"><h1>${wd ? `<span class="wd">${esc(wd)}</span>` : ''}${esc(titolo)}</h1><div class="rule"></div>${sotto ? `<p>${sotto}</p>` : ''}</header>`;
  const sorted = () => [...D].sort((a, b) => b.data.localeCompare(a.data));

  /* ---------- viste ---------- */
  function viewOggi() {
    const iso = todayISO();
    const oggi = D.find(g => g.data === iso);
    const wd = cap(fmt(iso, { weekday: 'long' }));

    const riprendi = [];
    sorted().slice(0, 7).forEach(g => (g.aperto || []).forEach(t => riprendi.push({ t, data: g.data })));
    const rob = openItems('roberto').sort(sortOpen);
    const todo = openItems('todo').sort(sortOpen);

    return `${head(dayMonth(iso), '', wd)}
    <div class="cols">
      <div>
        <section class="panel"><div class="panel-head"><h2>La giornata di oggi</h2><a href="#/diario">Tutte le giornate</a></div>
          ${oggi ? entryHTML(oggi) : `<p class="empty">Oggi non c'è ancora una pagina. Dimmi cosa hai fatto e la scrivo nel diario.</p>`}
        </section>
        <section class="panel"><div class="panel-head"><h2>Da riprendere</h2></div>
          ${riprendi.length ? `<ul class="mini">${riprendi.map(r => `<li>${esc(r.t)}<small>Dalla giornata del ${dayMonth(r.data)}</small></li>`).join('')}</ul>` : `<p class="empty">Niente in sospeso nelle ultime giornate.</p>`}
        </section>
      </div>
      <div>
        <section class="panel"><div class="panel-head"><h2>Per Roberto</h2><a href="#/roberto">Apri la lista</a></div>
          ${rob.length ? `<ul class="mini">${rob.slice(0, 4).map(i => `<li>${esc(i.testo)}</li>`).join('')}</ul>${rob.length > 4 ? `<p class="empty">e altri ${rob.length - 4}</p>` : ''}` : `<p class="empty">Nessun punto aperto per il prossimo sync.</p>`}
        </section>
        <section class="panel"><div class="panel-head"><h2>To-do personale</h2><a href="#/todo">Apri la lista</a></div>
          ${todo.length ? `<ul class="list">${todo.slice(0, 5).map(i => rowHTML('todo', i)).join('')}</ul>` : `<p class="empty">Nessuna cosa da fare. Aggiungine una dalla lista.</p>`}
        </section>
      </div>
    </div>`;
  }

  const filter = { q: '', tag: '' };

  function diaryListHTML() {
    const q = filter.q.trim().toLowerCase();
    const res = sorted().filter(g =>
      (!filter.tag || (g.tag || []).includes(filter.tag)) &&
      (!q || JSON.stringify(g).toLowerCase().includes(q)));
    if (!res.length) return `<p class="empty">${D.length ? 'Nessuna giornata corrisponde alla ricerca.' : 'Il diario è vuoto. Dimmi cosa hai fatto e scrivo la prima giornata.'}</p>`;
    let out = '', month = '';
    res.forEach(g => {
      const m = cap(fmt(g.data, { month: 'long', year: 'numeric' }));
      if (m !== month) { month = m; out += `<h2 class="month">${m}</h2>`; }
      out += entryHTML(g);
    });
    return out;
  }

  function viewDiario() {
    const tags = [...new Set(D.flatMap(g => g.tag || []))].sort();
    return `${head('Giornate', `${D.length} ${D.length === 1 ? 'giornata registrata' : 'giornate registrate'}. Cerca un cliente, un ordine o un progetto per ritrovare cosa hai fatto.`)}
    <div class="tools">
      <div class="field"><label for="q">Cerca nel diario</label><input id="q" type="search" placeholder="Nome cliente, ordine, parola chiave" value="${esc(filter.q)}" autocomplete="off"></div>
      ${tags.length ? `<div class="field"><span id="tl" class="lbl" style="font-family:var(--display);font-weight:600;font-size:.9rem">Etichetta</span><div class="chips" role="group" aria-labelledby="tl">${tags.map(t => `<button type="button" class="chip" data-act="tag" data-tag="${esc(t)}" aria-pressed="${filter.tag === t}">${esc(t)}</button>`).join('')}</div></div>` : ''}
    </div>
    <div id="diary-list">${diaryListHTML()}</div>`;
  }

  function viewRoberto() {
    const all = getItems('roberto');
    const open = all.filter(i => !i.fatto).sort(sortOpen);
    const done = all.filter(i => i.fatto).sort((a, b) => (b.fattoIl || '').localeCompare(a.fattoIl || ''));
    const dec = (R.decisioni || []).slice().sort((a, b) => b.data.localeCompare(a.data));
    return `${head('Sync con Roberto', 'Quello che devi vedere al prossimo sync. Quando un punto è chiuso, spuntalo: passa tra i discussi con la data.')}
    <form class="add" data-act="add" data-list="roberto">
      <div class="field grow"><label for="r-t">Nuovo punto da discutere</label><input id="r-t" name="testo" type="text" required placeholder="Cosa devi chiedere o chiarire"></div>
      <div class="field grow"><label for="r-n">Contesto (facoltativo)</label><input id="r-n" name="nota" type="text" placeholder="Ordine, cliente, a cosa serve"></div>
      <button class="btn" type="submit">Aggiungi punto</button>
    </form>
    <p class="hint">I punti aggiunti da qui restano in questo browser. Per salvarli nel repository chiedimelo.</p>
    <h2 class="group-title">Da discutere</h2>
    ${open.length ? `<ul class="list">${open.map(i => rowHTML('roberto', i)).join('')}</ul>` : `<p class="empty">Nessun punto aperto. Aggiungine uno quando ti viene in mente.</p>`}
    <h2 class="group-title">Decisioni e richieste di Roberto da ricordare</h2>
    ${dec.length ? `<ul class="decisions">${dec.map(d => `<li><span class="d">${dayMonth(d.data)}</span>${esc(d.testo)}</li>`).join('')}</ul>` : `<p class="empty">Nessuna per ora.</p>`}
    <h2 class="group-title">Già discussi</h2>
    ${done.length ? `<ul class="list">${done.map(i => rowHTML('roberto', i)).join('')}</ul>` : `<p class="empty">Nessun punto chiuso finora.</p>`}`;
  }

  function viewTodo() {
    const all = getItems('todo');
    const open = all.filter(i => !i.fatto).sort(sortOpen);
    const done = all.filter(i => i.fatto).sort((a, b) => (b.fattoIl || '').localeCompare(a.fattoIl || ''));
    return `${head('To-do personale', 'Le tue cose da fare, separate da quelle da vedere con Roberto.')}
    <form class="add" data-act="add" data-list="todo">
      <div class="field grow"><label for="t-t">Nuova cosa da fare</label><input id="t-t" name="testo" type="text" required placeholder="Cosa devi fare"></div>
      <div class="field"><label for="t-d">Entro il (facoltativo)</label><input id="t-d" name="scadenza" type="date"></div>
      <button class="btn" type="submit">Aggiungi</button>
    </form>
    <p class="hint">Le cose aggiunte da qui restano in questo browser. Per salvarle nel repository chiedimelo.</p>
    <h2 class="group-title">Da fare</h2>
    ${open.length ? `<ul class="list">${open.map(i => rowHTML('todo', i)).join('')}</ul>` : `<p class="empty">Tutto fatto. Aggiungi la prossima cosa da fare.</p>`}
    <h2 class="group-title">Fatte</h2>
    ${done.length ? `<ul class="list">${done.map(i => rowHTML('todo', i)).join('')}</ul>` : `<p class="empty">Ancora niente di spuntato.</p>`}`;
  }

  /* ---------- router ---------- */
  const ROUTES = {
    oggi: { view: viewOggi, title: 'Oggi' },
    diario: { view: viewDiario, title: 'Giornate' },
    roberto: { view: viewRoberto, title: 'Sync con Roberto' },
    todo: { view: viewTodo, title: 'To-do personale' }
  };
  const current = () => { const n = location.hash.replace(/^#\//, ''); return ROUTES[n] ? n : 'oggi'; };

  function counters() {
    const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n ? n : ''; };
    set('c-diario', D.length);
    set('c-roberto', openItems('roberto').length);
    set('c-todo', openItems('todo').length);
  }

  function render(resetScroll) {
    const name = current();
    document.getElementById('view').innerHTML = ROUTES[name].view();
    document.title = `${ROUTES[name].title} – Diario di bordo`;
    document.querySelectorAll('[data-route]').forEach(a => {
      if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    counters();
    if (resetScroll) window.scrollTo(0, 0);
  }

  /* ---------- eventi ---------- */
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.act === 'toggle') {
      toggleItem(el.dataset.list, el.dataset.id, !el.checked);
      render(false);
    }
  });

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'remove') {
      if (confirm('Eliminare questa voce?')) { removeItem(el.dataset.list, el.dataset.id); render(false); }
    } else if (el.dataset.act === 'tag') {
      filter.tag = filter.tag === el.dataset.tag ? '' : el.dataset.tag;
      render(false);
    }
  });

  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-act="add"]');
    if (!f) return;
    e.preventDefault();
    const fd = new FormData(f);
    const testo = String(fd.get('testo') || '').trim();
    if (!testo) return;
    const item = { testo };
    if (fd.get('nota')) item.nota = String(fd.get('nota')).trim();
    if (fd.get('scadenza')) item.scadenza = String(fd.get('scadenza'));
    addItem(f.dataset.list, item);
    render(false);
    const first = document.querySelector(`form[data-list="${f.dataset.list}"] input[name="testo"]`);
    if (first) first.focus();
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'q') {
      filter.q = e.target.value;
      document.getElementById('diary-list').innerHTML = diaryListHTML();
    }
  });

  window.addEventListener('hashchange', () => render(true));
  render(false);
})();
