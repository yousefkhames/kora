(function () {
  'use strict';
  const C = window.KoraCore, DICT = window.KORA_I18N, KEY = 'kora.v1';
  let S = load();
  let memOnly = false;
  let ui = { voter: '', sort: 'pts', modalSubmit: null, flash: '' };

  /* ---------- storage ---------- */
  function load() {
    try { const raw = localStorage.getItem(KEY); return C.normalize(raw ? JSON.parse(raw) : null); } catch (e) { return C.normalize(null); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { if (!memOnly) { memOnly = true; toast(t('saveFailed')); } }
  }

  /* ---------- i18n ---------- */
  function lang() {
    if (S.settings.lang === 'ar' || S.settings.lang === 'en') return S.settings.lang;
    return (navigator.language || 'en').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }
  function t(k, p) {
    let s = (DICT[lang()][k] !== undefined ? DICT[lang()][k] : DICT.en[k]);
    if (s === undefined) return k;
    if (p) Object.keys(p).forEach(function (x) { s = s.split('{' + x + '}').join(p[x]); });
    return s;
  }
  const locale = function () { return lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB'; };
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(cents) {
    const a = cents / 100;
    const n = a.toLocaleString(locale(), { minimumFractionDigits: Number.isInteger(a) ? 0 : 2, maximumFractionDigits: 2 });
    return n + ' ' + S.settings.currency;
  }
  function parseDate(d) { const p = d.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function fmtDate(d, o) { return parseDate(d).toLocaleDateString(locale(), o || { weekday: 'long', day: 'numeric', month: 'short' }); }

  /* ---------- helpers ---------- */
  const ICON = {
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z"/><path d="M12 3v4.5M20.5 9.6l-4.9.5M17.2 19l-3-4.7M6.8 19l3-4.7M3.5 9.6l4.9.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.7a3.3 3.3 0 010 6.3M18 14.8c2 .6 3.2 2.3 3.5 5"/>',
    table: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 5l-7 7 7 7"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>', check: '<path d="M5 12l5 5 9-10"/>', cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'
  };
  const ic = function (n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + '</svg>'; };
  const posLabel = function (p) { return t('pos' + p + 's'); };
  const stars = function (n) { return '<span class="stars" aria-label="' + n + '/5">' + '★'.repeat(n) + '<span style="opacity:.25">' + '★'.repeat(5 - n) + '</span></span>'; };
  const initial = function (n) { return esc(Array.from(n)[0] || '?'); };
  const getMatch = function (id) { return S.matches.find(function (m) { return m.id === id; }); };
  const nameOf = function (id, m) { const e = C.entity(id, S, m); return e ? e.name : '?'; };
  const sortMatches = function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); };

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function shareWa(text) {
    const url = 'https://wa.me/?text=' + encodeURIComponent(text);
    window.__lastWa = url;
    const w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url;
  }
  function copyText(text) {
    const done = function () { toast(t('copied')); };
    const fallback = function () {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) done(); else toast(t('copyFailed'));
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    window.__lastCopied = text;
  }

  /* ---------- routing ---------- */
  function route() {
    const h = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    if (h[0] === 'm' && h[1]) return { name: 'match', id: h[1], sec: ['att', 'lineup', 'cost', 'result'].indexOf(h[2]) >= 0 ? h[2] : 'att' };
    if (['players', 'table', 'settings'].indexOf(h[0]) >= 0) return { name: h[0] };
    return { name: 'matches' };
  }

  /* ---------- theme ---------- */
  function lum(hex) {
    const v = [1, 3, 5].map(function (i) { const c = parseInt(hex.substr(i, 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function applyTheme() {
    const r = document.documentElement, L = lang();
    r.lang = L; r.dir = L === 'ar' ? 'rtl' : 'ltr';
    const th = S.settings.theme === 'auto' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : S.settings.theme;
    r.dataset.theme = th;
    r.style.setProperty('--brand', S.settings.accent);
    r.style.setProperty('--on-brand', lum(S.settings.accent) > 0.45 ? '#10231a' : '#ffffff');
    document.title = (S.settings.groupName ? S.settings.groupName + ' · ' : '') + t('appName');
    const mt = document.querySelector('meta[name=theme-color]'); if (mt) mt.content = S.settings.accent;
  }

  /* ---------- render ---------- */
  function render() {
    applyTheme();
    const r = route();
    let body = '', back = false;
    if (r.name === 'matches') body = viewMatches();
    else if (r.name === 'match') { const m = getMatch(r.id); if (m) { body = viewMatch(m, r.sec); back = true; } else { location.hash = '#/'; return; } }
    else if (r.name === 'players') body = viewPlayers();
    else if (r.name === 'table') body = viewTable();
    else body = viewSettings();
    const nav = [['matches', '#/', 'ball', 'navMatches'], ['players', '#/players', 'users', 'navPlayers'], ['table', '#/table', 'table', 'navTable'], ['settings', '#/settings', 'gear', 'navSettings']]
      .map(function (n) { const cur = r.name === n[0] || (r.name === 'match' && n[0] === 'matches'); return '<a href="' + n[1] + '"' + (cur ? ' aria-current="page"' : '') + '>' + ic(n[2]) + t(n[3]) + '</a>'; }).join('');
    document.getElementById('app').innerHTML =
      '<div class="shell"><header class="top">' +
      (back ? '<a class="iconbtn" href="#/" aria-label="' + t('back') + '"><svg viewBox="0 0 24 24" style="' + (lang() === 'ar' ? 'transform:scaleX(-1)' : '') + '">' + ICON.back + '</svg></a>' : '') +
      '<a class="brand" href="#/"><img src="logo.svg" alt=""><span><b>' + esc(S.settings.groupName || t('appName')) + '</b><small>' + (S.settings.groupName ? t('appName') : t('tagline')) + '</small></span></a><span class="spacer"></span>' +
      (r.name === 'matches' ? '<button class="btn sm" data-act="match-new">' + ic('plus') + t('newMatch') + '</button>' : '') +
      '</header><main>' + body + '</main></div><nav class="nav" aria-label="main"><div>' + nav + '</div></nav>';
  }
  function rerender() { save(); render(); }

  /* ---------- views ---------- */
  function viewMatches() {
    if (!S.matches.length) return '<div class="card empty"><div class="big">⚽</div><h2>' + t('noMatches') + '</h2><p class="muted">' + t('noMatchesHelp') + '</p>' +
      '<div class="row wrap" style="justify-content:center"><button class="btn" data-act="match-new">' + ic('plus') + t('newMatch') + '</button><button class="btn ghost" data-act="demo">' + t('loadDemo') + '</button></div></div>';
    const up = S.matches.filter(function (m) { return m.status !== 'played'; }).sort(sortMatches);
    const past = S.matches.filter(function (m) { return m.status === 'played'; }).sort(sortMatches).reverse();
    return (up.length ? '<h1>' + t('upcoming') + '</h1>' + up.map(matchCard).join('') : '') + (past.length ? '<h1>' + t('past') + '</h1>' + past.map(matchCard).join('') : '');
  }
  function matchCard(m) {
    const a = C.attendance(m, S.players), d = parseDate(m.date);
    const pct = Math.min(100, Math.round(a.confirmed.length / a.capacity * 100));
    const played = m.status === 'played' && m.score;
    return '<a class="card matchcard" href="#/m/' + m.id + '/' + (played ? 'result' : 'att') + '">' +
      '<div class="dateblock"><b>' + d.getDate() + '</b><span>' + esc(d.toLocaleDateString(locale(), { month: 'short' })) + '</span></div>' +
      '<div class="grow"><div class="ttl">' + esc(fmtDate(m.date, { weekday: 'long' })) + ' · ' + esc(m.time) + '</div>' +
      '<div class="muted small">' + esc(m.venue || ' ') + '</div>' +
      (played ? '<div class="row"><span class="chip ok">' + t('playedChip') + '</span><b>' + m.score.A + ' - ' + m.score.B + '</b>' + (m.mvp ? '<span class="chip lime">★ ' + esc(nameOf(m.mvp, m)) + '</span>' : '') + '</div>'
        : '<div class="bar"><i style="width:' + pct + '%"></i></div><div class="row wrap small"><b>' + t('confirmedCount', { n: a.confirmed.length, cap: a.capacity }) + '</b>' +
        (a.waitlist.length ? '<span class="chip warn">' + t('waitlistN', { n: a.waitlist.length }) + '</span>' : '') + (a.maybe.length ? '<span class="chip">' + t('maybeN', { n: a.maybe.length }) + '</span>' : '') + '</div>') +
      '</div></a>';
  }

  function viewMatch(m, sec) {
    const tabs = [['att', 'secAttendance'], ['lineup', 'secLineup'], ['cost', 'secCost'], ['result', 'secResult']]
      .map(function (x) { return '<a href="#/m/' + m.id + '/' + x[0] + '"' + (sec === x[0] ? ' aria-current="page"' : '') + '>' + t(x[1]) + '</a>'; }).join('');
    const head = '<div class="card"><div class="row between"><div class="grow"><div class="ttl" style="font-size:1.2rem">' + esc(fmtDate(m.date)) + ' · ' + esc(m.time) + '</div>' +
      '<div class="muted">' + esc(m.venue || '') + ' · ' + t('perSide') + ': ' + m.perSide + '</div></div>' +
      '<button class="iconbtn" data-act="match-edit" data-id="' + m.id + '" aria-label="' + t('edit') + '">' + ic('edit') + '</button></div>' +
      '<div class="row wrap" style="margin-top:10px"><button class="btn sm soft" data-act="match-dup" data-id="' + m.id + '">' + ic('cal') + t('duplicateMatch') + '</button>' +
      '<button class="btn sm danger" data-act="match-del" data-id="' + m.id + '">' + ic('trash') + t('deleteMatch') + '</button></div></div>';
    const view = sec === 'att' ? secAttendance(m) : sec === 'lineup' ? secLineup(m) : sec === 'cost' ? secCost(m) : secResult(m);
    return head + '<nav class="tabs" aria-label="sections">' + tabs + '</nav>' + view;
  }

  function secAttendance(m) {
    const a = C.attendance(m, S.players);
    const pct = Math.min(100, Math.round(a.confirmed.length / a.capacity * 100));
    const people = S.players.filter(function (p) { return p.active || m.rsvp[p.id]; });
    const rows = people.map(function (p) {
      const st = m.rsvp[p.id] || '', wi = a.waitlist.indexOf(p.id);
      return '<div class="prow"><div class="av' + (p.pos === 'GK' ? ' g' : '') + '">' + initial(p.name) + '</div><div class="grow"><div class="pname">' + esc(p.name) + '</div><div class="pmeta"><span class="chip">' + posLabel(p.pos) + '</span>' +
        (wi >= 0 ? '<span class="chip warn">' + t('waitlist', { n: wi + 1 }) + '</span>' : '') + '</div></div>' +
        '<div class="seg" role="group" aria-label="' + esc(p.name) + '">' + ['in', 'maybe', 'out'].map(function (v) {
          return '<button class="' + v + '" data-act="rsvp" data-id="' + p.id + '" data-v="' + v + '" aria-pressed="' + (st === v) + '">' + t('rsvp' + v[0].toUpperCase() + v.slice(1)) + '</button>';
        }).join('') + '</div></div>';
    }).join('');
    const guests = m.guests.map(function (g) {
      const wi = a.waitlist.indexOf(g.id);
      return '<div class="prow"><div class="av">' + initial(g.name) + '</div><div class="grow"><div class="pname">' + esc(g.name) + '</div><div class="pmeta"><span class="chip lime">' + t('guest') + '</span><span class="chip">' + posLabel(g.pos) + '</span>' + (wi >= 0 ? '<span class="chip warn">' + t('waitlist', { n: wi + 1 }) + '</span>' : '') + '</div></div>' +
        '<button class="iconbtn" data-act="guest-del" data-id="' + g.id + '" aria-label="' + t('removeGuest') + '">' + ic('trash') + '</button></div>';
    }).join('');
    return '<div class="card"><div class="row between"><h2 style="margin:0">' + t('confirmedCount', { n: a.confirmed.length, cap: a.capacity }) + '</h2>' +
      '<div class="row">' + (a.waitlist.length ? '<span class="chip warn">' + t('waitlistN', { n: a.waitlist.length }) + '</span>' : '') + (a.maybe.length ? '<span class="chip">' + t('maybeN', { n: a.maybe.length }) + '</span>' : '') + '</div></div>' +
      '<div class="bar" style="margin:10px 0"><i style="width:' + pct + '%"></i></div><p class="muted small" style="margin:0">' + t('capacityNote', { cap: a.capacity }) + '</p></div>' +
      '<div class="card">' + (S.players.length ? '<div class="plist">' + rows + guests + '</div>' : '<p class="muted">' + t('noPlayers') + '</p><a class="btn" href="#/players">' + t('addPlayer') + '</a>') + '</div>' +
      '<div class="row wrap"><button class="btn soft" data-act="guest-add" data-id="' + m.id + '">' + ic('plus') + t('addGuest') + '</button><button class="btn ghost" data-act="copy-invite" data-id="' + m.id + '">' + ic('copy') + t('copyInvite') + '</button><button class="btn ghost" data-act="wa-invite" data-id="' + m.id + '">' + ic('share') + t('sendWa') + '</button></div>';
  }

  function teamName(k) { return k === 'A' ? t('teamA') : t('teamB'); }
  function pitchSvg(m) {
    const W = 340, H = 460;
    const ys = { A: [38, 92, 146, 198], B: [422, 368, 314, 262] };
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="pitch"><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a9455"/><stop offset="1" stop-color="#1c7340"/></linearGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#pg)"/>';
    for (let i = 0; i < 6; i++) s += '<rect y="' + i * 77 + '" width="' + W + '" height="38.5" fill="#000" opacity=".06"/>';
    s += '<g fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"><rect x="12" y="12" width="' + (W - 24) + '" height="' + (H - 24) + '" rx="4"/><line x1="12" y1="' + H / 2 + '" x2="' + (W - 12) + '" y2="' + H / 2 + '"/><circle cx="' + W / 2 + '" cy="' + H / 2 + '" r="38"/>' +
      '<rect x="95" y="12" width="150" height="46"/><rect x="95" y="' + (H - 58) + '" width="150" height="46"/></g>';
    ['A', 'B'].forEach(function (k) {
      const players = m.teams[k].map(function (id) { return C.entity(id, S, m); }).filter(Boolean);
      const L = C.layout(players);
      L.lines.forEach(function (line, li) {
        const y = ys[k][li], n = line.players.length;
        if (li === 0 && !n) { s += '<circle cx="' + W / 2 + '" cy="' + y + '" r="16" fill="none" stroke="#fff" stroke-opacity=".5" stroke-dasharray="4 4" stroke-width="2"/><text x="' + W / 2 + '" y="' + (y + 4) + '" text-anchor="middle" font-size="11" fill="#fff" opacity=".7">GK?</text>'; return; }
        line.players.forEach(function (p, i) {
          const x = Math.round(W * (i + 1) / (n + 1));
          const fill = k === 'A' ? '#ffffff' : '#ffb703';
          const nm = Array.from(p.name).slice(0, 9).join('');
          s += '<g><circle cx="' + x + '" cy="' + y + '" r="17" fill="' + fill + '" stroke="#10231a" stroke-width="2"/><text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-size="14" font-weight="800" fill="#10231a">' + esc(Array.from(p.name)[0]) + '</text>' +
            '<text x="' + x + '" y="' + (y + 32) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" stroke="#0b2a18" stroke-width="3" paint-order="stroke">' + esc(nm) + '</text></g>';
        });
      });
    });
    return s + '</svg>';
  }
  function lineupText(m) {
    const lines = [t('lineupMsg', { date: fmtDate(m.date) + ' ' + m.time })];
    ['A', 'B'].forEach(function (k) { lines.push('', teamName(k) + ':'); m.teams[k].forEach(function (id) { lines.push('• ' + nameOf(id, m)); }); });
    return lines.join('\n');
  }
  function secLineup(m) {
    const a = C.attendance(m, S.players);
    if (a.confirmed.length < 2) return '<div class="card hint">' + t('needPlayers') + '</div>';
    if (!m.teams) return '<div class="card empty"><div class="big">🧩</div><p class="muted">' + t('teamsHelp') + '</p><button class="btn" data-act="teams-make" data-id="' + m.id + '">' + t('makeTeams') + '</button></div>';
    const strength = function (k) { return m.teams[k].reduce(function (s, id) { const e = C.entity(id, S, m); return s + (e ? e.rating : 0); }, 0); };
    const card = function (k) {
      const players = m.teams[k].map(function (id) { return C.entity(id, S, m); }).filter(Boolean);
      const L = C.layout(players);
      const rows = L.lines.reduce(function (acc, l) { return acc.concat(l.players); }, []).map(function (p) {
        return '<div class="prow"><div class="av' + (p.pos === 'GK' ? ' g' : '') + '">' + initial(p.name) + '</div><div class="grow"><div class="pname">' + esc(p.name) + '</div><div class="pmeta"><span class="chip">' + posLabel(p.pos) + '</span>' + stars(p.rating) + '</div></div>' +
          '<button class="iconbtn" data-act="team-move" data-id="' + p.id + '" data-m="' + m.id + '" data-to="' + (k === 'A' ? 'B' : 'A') + '" aria-label="' + t('moveTeam') + '">' + ic('swap') + '</button></div>';
      }).join('');
      return '<div class="card"><div class="row between"><div class="row"><span class="tdot" style="background:' + (k === 'A' ? '#fff' : '#ffb703') + '"></span><h2 style="margin:0">' + teamName(k) + '</h2></div><span class="chip">' + t('total', { n: strength(k) }) + '</span></div>' +
        (L.hasGK ? '' : '<p class="muted small" style="margin:6px 0 0">' + t('noKeeper') + '</p>') + '<div class="plist" style="margin-top:6px">' + rows + '</div></div>';
    };
    return '<div class="pitchwrap">' + pitchSvg(m) + '</div><div class="row wrap" style="margin-bottom:12px"><button class="btn" data-act="teams-reshuffle" data-id="' + m.id + '">' + ic('swap') + t('reshuffle') + '</button><button class="btn ghost" data-act="copy-lineup" data-id="' + m.id + '">' + ic('copy') + t('copyLineup') + '</button><button class="btn ghost" data-act="wa-lineup" data-id="' + m.id + '">' + ic('share') + t('sendWa') + '</button></div>' +
      '<p class="muted small">' + t('teamsHelp') + '</p><div class="teams">' + card('A') + card('B') + '</div>';
  }

  function stepOpts(m) {
    return [0, 1, 5, 10, 50].map(function (v) { return '<option value="' + v + '"' + (m.roundStep === v ? ' selected' : '') + '>' + (v ? v + ' ' + esc(S.settings.currency) : t('roundNone')) + '</option>'; }).join('');
  }
  function payText(m) {
    const sh = C.matchShares(m, S.players);
    const names = sh.ids.filter(function (id) { return !m.paid[id]; }).map(function (id) { return nameOf(id, m); });
    return t('payMsg', { date: fmtDate(m.date), per: money(sh.split.per[0] || 0), names: names.join('، ').replace(/، /g, lang() === 'ar' ? '، ' : ', ') });
  }
  function secCost(m) {
    const sh = C.matchShares(m, S.players), tot = C.totalCents(m);
    const extras = m.extras.map(function (e) {
      return '<div class="prow"><div class="grow pname">' + esc(e.label || '—') + '</div><b>' + money(C.toCents(e.amount)) + '</b><button class="iconbtn" data-act="extra-del" data-id="' + e.id + '" data-m="' + m.id + '" aria-label="' + t('delete') + '">' + ic('trash') + '</button></div>';
    }).join('');
    const rows = sh.ids.map(function (id) {
      const g = m.guests.some(function (x) { return x.id === id; });
      return '<div class="prow"><div class="av">' + initial(nameOf(id, m)) + '</div><div class="grow"><div class="pname">' + esc(nameOf(id, m)) + '</div>' + (g ? '<span class="chip lime">' + t('guest') + '</span>' : '') + '</div><b>' + money(sh.shares[id]) + '</b>' +
        '<button class="btn sm ' + (m.paid[id] ? '' : 'ghost') + '" data-act="paid" data-id="' + id + '" data-m="' + m.id + '" aria-pressed="' + !!m.paid[id] + '">' + (m.paid[id] ? ic('check') + t('paid') : t('markPaid')) + '</button></div>';
    }).join('');
    const pct = sh.split.collected ? Math.round(sh.paid / sh.split.collected * 100) : 0;
    return '<div class="card"><h2>' + t('cost') + '</h2><div class="grid2"><div><label class="f" for="cost">' + t('pitchCost') + ' (' + esc(S.settings.currency) + ')</label><input id="cost" type="number" inputmode="decimal" min="0" step="any" value="' + m.cost + '" data-chg="cost" data-id="' + m.id + '"></div>' +
      '<div><label class="f" for="step">' + t('rounding') + '</label><select id="step" data-chg="step" data-id="' + m.id + '">' + stepOpts(m) + '</select></div></div>' +
      '<h3 style="margin-top:14px">' + t('extras') + '</h3><div class="plist">' + extras + '</div>' +
      '<form class="row" data-form="extra" data-id="' + m.id + '" style="margin-top:8px"><input type="text" name="label" placeholder="' + t('extraLabel') + '" aria-label="' + t('extraLabel') + '" maxlength="40"><input type="number" name="amount" min="0" step="any" inputmode="decimal" placeholder="0" aria-label="' + t('totalCost') + '" style="width:110px" required><button class="iconbtn" aria-label="' + t('addExtra') + '">' + ic('plus') + '</button></form></div>' +
      '<div class="card"><div class="row between"><div><div class="muted small">' + t('totalCost') + '</div><b style="font-size:1.4rem">' + money(tot) + '</b></div><div style="text-align:end"><div class="muted small">' + t('perHead') + '</div><b style="font-size:1.4rem">' + (sh.ids.length ? money(sh.split.per[0]) : '—') + '</b></div></div>' +
      (sh.split.surplus ? '<p class="muted small" style="margin:8px 0 0">' + t('surplus', { n: money(sh.split.surplus) }) + '</p>' : '') + '</div>' +
      '<div class="card">' + (sh.ids.length ? '<div class="row between small" style="margin-bottom:6px"><b>' + t('collected', { a: money(sh.paid), b: money(sh.split.collected) }) + '</b><span class="chip ' + (sh.outstanding ? 'warn' : 'ok') + '">' + (sh.outstanding ? t('outstanding', { n: money(sh.outstanding) }) : t('allPaid')) + '</span></div><div class="bar"><i style="width:' + pct + '%"></i></div><div class="plist" style="margin-top:8px">' + rows + '</div>' +
        '<button class="btn ghost" style="margin-top:10px" data-act="copy-pay" data-id="' + m.id + '"' + (sh.outstanding ? '' : ' disabled') + '>' + ic('copy') + t('copyPay') + '</button><button class="btn ghost" data-act="wa-pay" data-id="' + m.id + '"' + (sh.outstanding ? '' : ' disabled') + '>' + ic('share') + t('sendWa') + '</button>' : '<p class="muted">' + t('noParticipants') + '</p>') + '</div>';
  }

  function secResult(m) {
    const a = C.attendance(m, S.players);
    if (!m.teams || a.confirmed.length < 2) return '<div class="card hint">' + t('needPlayers') + ' <a href="#/m/' + m.id + '/lineup"><b>' + t('secLineup') + '</b></a></div>';
    const sc = m.score || { A: 0, B: 0 }, tg = C.teamGoals(m);
    const goalRows = ['A', 'B'].map(function (k) {
      return '<h3 style="margin-top:10px">' + teamName(k) + '</h3><div class="plist">' + m.teams[k].map(function (id) {
        const st = m.stats[id] || { g: 0, a: 0 };
        const step = function (key, lab) { return '<div class="stepper" aria-label="' + lab + '"><button data-act="stat" data-m="' + m.id + '" data-id="' + id + '" data-k="' + key + '" data-d="-1" aria-label="-">−</button><b>' + st[key] + '</b><button data-act="stat" data-m="' + m.id + '" data-id="' + id + '" data-k="' + key + '" data-d="1" aria-label="+">+</button></div>'; };
        return '<div class="prow"><div class="grow pname">' + esc(nameOf(id, m)) + '</div><div class="col" style="text-align:center"><div class="muted" style="font-size:.7rem">' + t('goals') + '</div>' + step('g', t('goals')) + '</div><div style="text-align:center"><div class="muted" style="font-size:.7rem">' + t('assists') + '</div>' + step('a', t('assists')) + '</div></div>';
      }).join('') + '</div>';
    }).join('');
    const mism = m.score && (tg.A !== sc.A || tg.B !== sc.B) && (tg.A + tg.B > 0);
    const resultCard = '<div class="card"><div class="row between"><h2 style="margin:0">' + t('result') + '</h2>' + (m.status === 'played' ? '<span class="chip ok">' + t('playedChip') + '</span>' : '') + '</div>' +
      '<div class="score"><div style="text-align:center"><div class="small muted">' + teamName('A') + '</div><input type="number" min="0" max="99" inputmode="numeric" value="' + sc.A + '" data-chg="scoreA" data-id="' + m.id + '" aria-label="' + teamName('A') + '"></div><b style="font-size:1.5rem">-</b>' +
      '<div style="text-align:center"><div class="small muted">' + teamName('B') + '</div><input type="number" min="0" max="99" inputmode="numeric" value="' + sc.B + '" data-chg="scoreB" data-id="' + m.id + '" aria-label="' + teamName('B') + '"></div></div>' +
      (mism ? '<div class="hint warn small">' + t('goalsMismatch', { a: tg.A, b: tg.B }) + '</div>' : '') + goalRows +
      '<div class="actions" style="justify-content:stretch">' + (m.status === 'played' ? '<button class="btn ghost" data-act="reopen-match" data-id="' + m.id + '">' + t('reopenMatch') + '</button>' : '') + '<button class="btn" style="flex:1" data-act="save-result" data-id="' + m.id + '">' + ic('check') + t('saveResult') + '</button></div></div>';
    return resultCard + mvpCard(m, a);
  }

  function mvpCard(m, a) {
    const ids = a.confirmed, tl = C.tally(m);
    let inner = '<h2>' + t('mvpTitle') + '</h2>';
    if (m.votingClosed) {
      if (m.mvp) inner += '<div class="card winner" style="margin:0 0 10px"><div class="big">🏆</div><div class="small" style="font-weight:700">' + t('winner') + '</div><b style="font-size:1.5rem">' + esc(nameOf(m.mvp, m)) + '</b></div>';
      else if (m.mvpTie) inner += '<div class="hint warn"><b>' + t('tie') + '</b></div><div class="votegrid" style="margin:10px 0">' + m.mvpTie.map(function (id) { return '<button data-act="tie" data-m="' + m.id + '" data-id="' + id + '">' + esc(nameOf(id, m)) + '</button>'; }).join('') + '</div>';
      else inner += '<p class="muted">' + t('noVotes') + '</p>';
      const top = tl.entries.length ? tl.entries[0].votes : 1;
      inner += tl.entries.map(function (e) { return '<div class="tallyrow"><span style="width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(nameOf(e.id, m)) + '</span><div class="bar"><i style="width:' + Math.round(e.votes / top * 100) + '%"></i></div><b>' + e.votes + '</b></div>'; }).join('');
      inner += '<button class="btn ghost" style="margin-top:10px" data-act="reopen-vote" data-id="' + m.id + '">' + t('reopenVoting') + '</button>';
    } else {
      inner += '<p class="muted small" style="margin-top:0">' + t('mvpHelp') + '</p><div class="row between small" style="margin-bottom:6px"><b>' + t('votesCast', { n: tl.total, m: ids.length }) + '</b></div>' +
        '<div class="bar"><i style="width:' + (ids.length ? Math.round(tl.total / ids.length * 100) : 0) + '%"></i></div>' +
        '<label class="f" for="voter">' + t('whoVotes') + '</label><select id="voter" data-chg="voter"><option value="">' + t('pickVoter') + '</option>' + ids.map(function (id) { return '<option value="' + id + '"' + (ui.voter === id ? ' selected' : '') + '>' + esc(nameOf(id, m)) + (m.votes[id] ? ' ✓' : '') + '</option>'; }).join('') + '</select>';
      if (ui.voter && ids.indexOf(ui.voter) >= 0) {
        inner += '<h3 style="margin-top:12px">' + t('voteFor') + '</h3>' + (m.votes[ui.voter] ? '<p class="muted small" style="margin-top:0">' + t('alreadyVoted') + '</p>' : '') +
          '<div class="votegrid">' + ids.filter(function (id) { return id !== ui.voter; }).map(function (id) { return '<button data-act="pick-vote" data-m="' + m.id + '" data-id="' + id + '">' + esc(nameOf(id, m)) + '</button>'; }).join('') + '</div>';
      }
      inner += '<button class="btn" style="margin-top:14px" data-act="close-vote" data-id="' + m.id + '"' + (tl.total ? '' : ' disabled') + '>' + t('closeVoting') + '</button>';
    }
    return '<div class="card">' + inner + '</div>';
  }

  function viewPlayers() {
    const act = S.players.filter(function (p) { return p.active; }), arch = S.players.filter(function (p) { return !p.active; });
    const row = function (p) {
      return '<div class="prow"><div class="av' + (p.pos === 'GK' ? ' g' : '') + '">' + initial(p.name) + '</div><div class="grow"><div class="pname">' + esc(p.name) + '</div><div class="pmeta"><span class="chip">' + posLabel(p.pos) + '</span>' + stars(p.rating) + '</div></div>' +
        '<button class="iconbtn" data-act="player-edit" data-id="' + p.id + '" aria-label="' + t('edit') + '">' + ic('edit') + '</button></div>';
    };
    return '<div class="row between"><h1>' + t('players') + ' <span class="muted">' + act.length + '</span></h1><button class="btn sm" data-act="player-add">' + ic('plus') + t('addPlayer') + '</button></div>' +
      '<div class="card">' + (act.length ? '<div class="plist">' + act.map(row).join('') + '</div>' : '<p class="muted">' + t('noPlayers') + '</p><button class="btn ghost" data-act="demo">' + t('loadDemo') + '</button>') + '</div>' +
      (arch.length ? '<h3>' + t('archived') + '</h3><div class="card"><div class="plist">' + arch.map(row).join('') + '</div></div>' : '');
  }

  function viewTable() {
    const st = C.seasonStats(S);
    const rows = st.rows.filter(function (r) { return r.played > 0; });
    if (!rows.length) return '<h1>' + t('table') + '</h1><div class="card empty"><div class="big">📊</div><p class="muted">' + t('noTable') + '</p></div>';
    const key = ui.sort;
    rows.sort(function (a, b) { return (b[key] - a[key]) || (b.pts - a.pts) || (b.goals - a.goals) || a.name.localeCompare(b.name); });
    const best = function (k) { const r = st.rows.slice().sort(function (a, b) { return b[k] - a[k] || b.played - a.played; })[0]; return r && r[k] > 0 ? r : null; };
    const sc = best('goals'), mv = best('mvp'), rel = best('rate');
    const top = function (r, lab, val) { return '<div class="card"><span>' + lab + '</span><b>' + (r ? esc(r.name) : '—') + '</b><span>' + (r ? val : '') + '</span></div>'; };
    const cols = [['pts', 'tPts'], ['played', 'tPlayed'], ['w', 'tW'], ['d', 'tD'], ['l', 'tL'], ['goals', 'tGoals'], ['assists', 'tAssists'], ['mvp', 'tMvp'], ['rate', 'tRate'], ['owes', 'tOwes']];
    return '<h1>' + t('table') + '</h1><div class="tops">' + top(sc, t('topScorer'), sc ? sc.goals : '') + top(mv, t('topMvp'), mv ? '★ ' + mv.mvp : '') + top(rel, t('mostReliable'), rel ? Math.round(rel.rate * 100) + '%' : '') + '</div>' +
      '<div class="card"><div class="tblwrap"><table class="tbl"><thead><tr><th>#</th>' + cols.map(function (c) { return '<th><button data-act="sort" data-k="' + c[0] + '" aria-pressed="' + (key === c[0]) + '">' + t(c[1]) + '</button></th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r, i) {
        return '<tr><td>' + (i + 1) + '. <b>' + esc(r.name) + '</b></td><td><b>' + r.pts + '</b></td><td>' + r.played + '</td><td>' + r.w + '</td><td>' + r.d + '</td><td>' + r.l + '</td><td>' + r.goals + '</td><td>' + r.assists + '</td><td>' + r.mvp + '</td><td>' + Math.round(r.rate * 100) + '%</td><td>' + (r.owes ? '<span class="chip warn">' + money(r.owes) + '</span>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  const SWATCHES = ['#1f7a46', '#0b6e99', '#7a3db8', '#c2410c', '#b4233a', '#111827'];
  function viewSettings() {
    const s = S.settings;
    const seg = function (name, opts, cur) { return '<div class="seg" role="group">' + opts.map(function (o) { return '<button data-act="set" data-k="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>'; };
    return '<h1>' + t('settings') + '</h1><div class="card"><label class="f" for="groupName">' + t('group') + '</label><input id="groupName" type="text" maxlength="40" value="' + esc(s.groupName) + '" data-chg="groupName"><p class="muted small" style="margin:4px 0 0">' + t('groupHelp') + '</p>' +
      '<label class="f">' + t('language') + '</label>' + seg('lang', [['auto', t('langAuto')], ['en', 'English'], ['ar', 'العربية']], s.lang) +
      '<label class="f">' + t('theme') + '</label>' + seg('theme', [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]], s.theme) +
      '<label class="f">' + t('accent') + '</label><div class="swatches">' + SWATCHES.map(function (c) { return '<button class="sw" style="background:' + c + '" data-act="set" data-k="accent" data-v="' + c + '" aria-pressed="' + (s.accent.toLowerCase() === c) + '" aria-label="' + c + '"></button>'; }).join('') +
      '<input type="color" value="' + s.accent + '" data-chg="accent" aria-label="' + t('accent') + '"></div></div>' +
      '<div class="card"><div class="grid2"><div><label class="f" for="cur">' + t('currency') + '</label><input id="cur" type="text" maxlength="12" value="' + esc(s.currency) + '" data-chg="currency"></div>' +
      '<div><label class="f" for="dc">' + t('defaultCost') + '</label><input id="dc" type="number" min="0" step="any" inputmode="decimal" value="' + s.defaultCost + '" data-chg="defaultCost"></div></div>' +
      '<p class="muted small" style="margin:4px 0 0">' + t('currencyHelp') + '</p><label class="f" for="ps">' + t('defaultSize') + '</label><select id="ps" data-chg="perSide">' + C.SIZES.map(function (n) { return '<option' + (s.perSide === n ? ' selected' : '') + ' value="' + n + '">' + n + ' v ' + n + '</option>'; }).join('') + '</select></div>' +
      '<div class="card"><h2>' + t('data') + '</h2><p class="muted small" style="margin-top:0">' + t('dataHelp') + '</p><div class="row wrap"><button class="btn soft" data-act="export">' + t('exportData') + '</button><button class="btn soft" data-act="import">' + t('importData') + '</button><button class="btn danger" data-act="reset">' + t('resetAll') + '</button></div></div>' +
      '<p class="footer">' + t('about') + '<br><a href="https://github.com/yousefkhames/kora" rel="noopener">' + t('aboutLink') + '</a></p>';
  }

  /* ---------- modal ---------- */
  function openModal(html, onSubmit) {
    const el = document.getElementById('modal');
    el.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    el.hidden = false; ui.modalSubmit = onSubmit;
    const f = el.querySelector('input:not([type=hidden]),select'); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeModal() { const el = document.getElementById('modal'); el.hidden = true; el.innerHTML = ''; ui.modalSubmit = null; }
  function confirmBox(msg, onYes, danger) {
    openModal('<h2>' + t('confirm') + '</h2><p>' + esc(msg) + '</p><div class="actions"><button class="btn ghost" data-act="modal-close">' + t('cancel') + '</button><button class="btn ' + (danger ? 'danger' : '') + '" data-act="modal-yes">' + t('confirm') + '</button></div>', null);
    ui.yes = onYes;
  }
  const field = function (label, inner) { return '<label class="f">' + label + '</label>' + inner; };
  const posSelect = function (v) { return '<select name="pos">' + C.POS.map(function (p) { return '<option value="' + p + '"' + (v === p ? ' selected' : '') + '>' + t('pos' + p) + '</option>'; }).join('') + '</select>'; };
  const ratingSelect = function (v) { return '<select name="rating">' + [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (v === n ? ' selected' : '') + '>' + '★'.repeat(n) + '</option>'; }).join('') + '</select>'; };
  const btns = function (extra) { return '<div class="actions">' + (extra || '') + '<button type="button" class="btn ghost" data-act="modal-close">' + t('cancel') + '</button><button class="btn" type="submit">' + t('save') + '</button></div>'; };

  function matchForm(m) {
    const isNew = !m;
    const base = m || { date: C.addDays(C.today(), 1), time: '20:00', venue: '', perSide: S.settings.perSide, cost: S.settings.defaultCost };
    openModal('<form data-form="match"><h2>' + (isNew ? t('newMatch') : t('edit')) + '</h2>' +
      '<div class="grid2"><div>' + field(t('date'), '<input type="date" name="date" required value="' + base.date + '">') + '</div><div>' + field(t('time'), '<input type="time" name="time" required value="' + base.time + '">') + '</div></div>' +
      field(t('venue'), '<input type="text" name="venue" maxlength="60" value="' + esc(base.venue) + '">') +
      '<div class="grid2"><div>' + field(t('perSide'), '<select name="perSide">' + C.SIZES.map(function (n) { return '<option value="' + n + '"' + (base.perSide === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>') + '</div>' +
      '<div>' + field(t('pitchCost') + ' (' + esc(S.settings.currency) + ')', '<input type="number" name="cost" min="0" step="any" inputmode="decimal" required value="' + base.cost + '">') + '</div></div>' + btns() + '</form>', function (fd) {
      const v = { date: fd.get('date'), time: fd.get('time'), venue: String(fd.get('venue') || '').trim(), perSide: +fd.get('perSide'), cost: Math.max(0, +fd.get('cost') || 0) };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return false;
      if (isNew) { const nm = C.newMatch(S.settings, v); S.matches.push(nm); closeModal(); save(); location.hash = '#/m/' + nm.id + '/att'; render(); return true; }
      Object.assign(m, v); C.syncTeams(m); closeModal(); rerender(); return true;
    });
  }
  function playerForm(p) {
    openModal('<form data-form="player"><h2>' + (p ? t('edit') : t('addPlayer')) + '</h2>' + field(t('playerName'), '<input type="text" name="name" required maxlength="40" value="' + esc(p ? p.name : '') + '">') +
      '<div class="grid2"><div>' + field(t('position'), posSelect(p ? p.pos : 'ANY')) + '</div><div>' + field(t('rating'), ratingSelect(p ? p.rating : 3)) + '</div></div>' +
      field(t('phone'), '<input type="text" name="phone" inputmode="tel" maxlength="24" value="' + esc(p ? p.phone : '') + '">') +
      btns(p ? '<button type="button" class="btn danger" data-act="player-del" data-id="' + p.id + '">' + t('delete') + '</button><button type="button" class="btn soft" data-act="player-arch" data-id="' + p.id + '">' + (p.active ? t('archive') : t('restore')) + '</button>' : '') + '</form>', function (fd) {
      const v = { name: String(fd.get('name') || '').trim(), pos: fd.get('pos'), rating: +fd.get('rating'), phone: String(fd.get('phone') || '').trim() };
      if (!v.name) return false;
      if (p) Object.assign(p, v); else S.players.push(Object.assign({ id: C.uid('p'), active: true }, v));
      closeModal(); rerender(); return true;
    });
  }
  function guestForm(m) {
    openModal('<form data-form="guest"><h2>' + t('addGuest') + '</h2>' + field(t('guestName'), '<input type="text" name="name" required maxlength="40">') +
      '<div class="grid2"><div>' + field(t('position'), posSelect('ANY')) + '</div><div>' + field(t('rating'), ratingSelect(3)) + '</div></div>' + btns() + '</form>', function (fd) {
      const g = C.addGuest(m, { name: fd.get('name'), pos: fd.get('pos'), rating: +fd.get('rating') });
      if (!g) return false; closeModal(); rerender(); return true;
    });
  }

  /* ---------- actions ---------- */
  function demo() {
    const ar = lang() === 'ar';
    const names = ar ? ['عمر', 'كريم', 'يوسف', 'حسن', 'مصطفى', 'أحمد', 'طارق', 'عادل', 'شريف', 'زياد', 'محمود', 'خالد', 'عمرو', 'هاني'] : ['Omar', 'Karim', 'Youssef', 'Hassan', 'Mostafa', 'Ahmed', 'Tarek', 'Adel', 'Sherif', 'Ziad', 'Mahmoud', 'Khaled', 'Amr', 'Hany'];
    const pos = ['GK', 'DEF', 'DEF', 'MID', 'FWD', 'MID', 'ANY', 'DEF', 'FWD', 'MID', 'GK', 'ANY', 'FWD', 'DEF'];
    const rat = [4, 3, 4, 5, 5, 3, 2, 3, 4, 4, 3, 2, 3, 3];
    if (!S.settings.groupName) S.settings.groupName = t('demoGroup');
    S.settings.defaultCost = 700;
    const ids = names.map(function (n, i) { const p = { id: C.uid('p'), name: n, pos: pos[i], rating: rat[i], phone: '', active: true }; S.players.push(p); return p.id; });
    const rnd = C.rng(11), today = C.today();
    [21, 14, 7].forEach(function (back, k) {
      const m = C.newMatch(S.settings, { date: C.addDays(today, -back), venue: ar ? 'ملعب النصر' : 'Nasr Pitch', perSide: 6, cost: 700, roundStep: 5 });
      ids.filter(function (id, i) { return i < 12 || rnd() < 0.4 ? (i !== 2 + k && i !== 8 - k) : false; }).slice(0, 12).forEach(function (id) { C.setRsvp(m, id, 'in'); });
      C.autoTeams(m, S, false);
      const all = m.teams.A.concat(m.teams.B);
      const goals = [[3, 2], [1, 1], [4, 3]][k];
      ['A', 'B'].forEach(function (tm, ti) { for (let g = 0; g < goals[ti]; g++) { const sc = m.teams[tm][1 + Math.floor(rnd() * (m.teams[tm].length - 1))]; C.setStat(m, sc, 'g', 1); if (rnd() < 0.7) { const as = m.teams[tm][Math.floor(rnd() * m.teams[tm].length)]; if (as !== sc) C.setStat(m, as, 'a', 1); } } });
      m.score = { A: goals[0], B: goals[1] }; m.status = 'played';
      all.forEach(function (id, i) { if (rnd() < 0.8) m.paid[id] = true; });
      all.forEach(function (id) { const tgt = all[Math.floor(rnd() * all.length)]; C.castVote(m, id, tgt); });
      C.closeVoting(m); if (!m.mvp && m.mvpTie) C.resolveTie(m, m.mvpTie[0]);
      S.matches.push(m);
    });
    const next = C.newMatch(S.settings, { date: C.addDays(today, 2), venue: ar ? 'ملعب النصر' : 'Nasr Pitch', perSide: 6, cost: 700, roundStep: 5, extras: [{ id: C.uid('e'), label: ar ? 'مياه' : 'Water', amount: 40 }] });
    ids.slice(0, 9).forEach(function (id) { C.setRsvp(next, id, 'in'); });
    C.setRsvp(next, ids[9], 'maybe'); C.setRsvp(next, ids[10], 'out');
    C.addGuest(next, { name: ar ? 'ضيف: بيشوي' : 'Guest: Bishoy', pos: 'ANY', rating: 3 });
    C.autoTeams(next, S, false);
    S.matches.push(next);
  }

  function inviteText(m) {
    const sh = C.matchShares(m, S.players), per = C.splitCost(C.totalCents(m), m.perSide * 2, m.roundStep).per[0] || 0;
    return t('inviteMsg', { group: S.settings.groupName ? S.settings.groupName + ' ' : '', date: fmtDate(m.date), time: m.time, venue: m.venue ? ' @ ' + m.venue : '', cost: money(per), cap: C.capacity(m) });
  }

  const ACT = {
    'match-new': function () { matchForm(null); },
    'match-edit': function (d) { matchForm(getMatch(d.id)); },
    'match-dup': function (d) {
      const m = getMatch(d.id), nm = C.newMatch(S.settings, { date: C.addDays(m.date, 7), time: m.time, venue: m.venue, perSide: m.perSide, cost: m.cost, roundStep: m.roundStep, extras: m.extras.map(function (e) { return { id: C.uid('e'), label: e.label, amount: e.amount }; }) });
      S.matches.push(nm); save(); location.hash = '#/m/' + nm.id + '/att';
    },
    'match-del': function (d) { confirmBox(t('confirmDeleteMatch'), function () { S.matches = S.matches.filter(function (m) { return m.id !== d.id; }); closeModal(); save(); location.hash = '#/'; render(); }, true); },
    rsvp: function (d) { const m = currentMatch(); const cur = m.rsvp[d.id]; C.setRsvp(m, d.id, cur === d.v ? 'none' : d.v); rerender(); },
    'guest-add': function (d) { guestForm(getMatch(d.id)); },
    'guest-del': function (d) { C.removeGuest(currentMatch(), d.id); rerender(); },
    'wa-invite': function (d) { shareWa(inviteText(getMatch(d.id))); },
    'wa-lineup': function (d) { shareWa(lineupText(getMatch(d.id))); },
    'wa-pay': function (d) { shareWa(payText(getMatch(d.id))); },
    'copy-invite': function (d) { copyText(inviteText(getMatch(d.id))); },
    'teams-make': function (d) { C.autoTeams(getMatch(d.id), S, false); rerender(); },
    'teams-reshuffle': function (d) { C.autoTeams(getMatch(d.id), S, true); rerender(); },
    'team-move': function (d) { C.moveToTeam(getMatch(d.m), d.id, d.to); rerender(); },
    'copy-lineup': function (d) { copyText(lineupText(getMatch(d.id))); },
    'extra-del': function (d) { const m = getMatch(d.m); m.extras = m.extras.filter(function (e) { return e.id !== d.id; }); rerender(); },
    paid: function (d) { const m = getMatch(d.m); if (m.paid[d.id]) delete m.paid[d.id]; else m.paid[d.id] = true; rerender(); },
    'copy-pay': function (d) { copyText(payText(getMatch(d.id))); },
    stat: function (d) { C.setStat(getMatch(d.m), d.id, d.k, +d.d); rerender(); },
    'save-result': function (d) { const m = getMatch(d.id); if (!m.score) m.score = { A: 0, B: 0 }; m.status = 'played'; rerender(); toast(t('playedChip')); },
    'reopen-match': function (d) { getMatch(d.id).status = 'upcoming'; rerender(); },
    'pick-vote': function (d) {
      const m = getMatch(d.m), r = C.castVote(m, ui.voter, d.id);
      if (r.ok) { toast(r.changed ? t('voteChanged') : t('voted')); ui.voter = ''; rerender(); }
    },
    'close-vote': function (d) { C.closeVoting(getMatch(d.id)); ui.voter = ''; rerender(); },
    'reopen-vote': function (d) { C.reopenVoting(getMatch(d.id)); rerender(); },
    tie: function (d) { C.resolveTie(getMatch(d.m), d.id); rerender(); },
    'player-add': function () { playerForm(null); },
    'player-edit': function (d) { playerForm(S.players.find(function (p) { return p.id === d.id; })); },
    'player-arch': function (d) { const p = S.players.find(function (x) { return x.id === d.id; }); p.active = !p.active; closeModal(); rerender(); },
    'player-del': function (d) {
      const p = S.players.find(function (x) { return x.id === d.id; });
      confirmBox(t('confirmDeletePlayer', { n: p.name }), function () {
        const played = S.matches.some(function (m) { return m.status === 'played' && m.order.indexOf(p.id) >= 0; });
        if (played) p.active = false;
        else { S.players = S.players.filter(function (x) { return x.id !== p.id; }); S.matches.forEach(function (m) { C.setRsvp(m, p.id, 'none'); delete m.stats[p.id]; delete m.paid[p.id]; }); }
        closeModal(); rerender();
      }, true);
    },
    demo: function () { demo(); rerender(); },
    sort: function (d) { ui.sort = d.k; render(); },
    set: function (d) { S.settings[d.k] = d.v; rerender(); },
    export: function () {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kora-backup-' + C.today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    },
    import: function () { document.getElementById('importFile').click(); },
    reset: function () { confirmBox(t('confirmReset'), function () { S = C.normalize(null); closeModal(); rerender(); }, true); },
    'modal-close': closeModal,
    'modal-yes': function () { const f = ui.yes; ui.yes = null; if (f) f(); }
  };
  function currentMatch() { const r = route(); return getMatch(r.id); }

  const CHG = {
    cost: function (el) { const m = getMatch(el.dataset.id); m.cost = Math.max(0, +el.value || 0); rerender(); },
    step: function (el) { getMatch(el.dataset.id).roundStep = +el.value; rerender(); },
    scoreA: function (el) { const m = getMatch(el.dataset.id); m.score = m.score || { A: 0, B: 0 }; m.score.A = Math.min(99, Math.max(0, Math.round(+el.value || 0))); rerender(); },
    scoreB: function (el) { const m = getMatch(el.dataset.id); m.score = m.score || { A: 0, B: 0 }; m.score.B = Math.min(99, Math.max(0, Math.round(+el.value || 0))); rerender(); },
    voter: function (el) { ui.voter = el.value; render(); },
    groupName: function (el) { S.settings.groupName = el.value.trim().slice(0, 40); rerender(); },
    currency: function (el) { S.settings.currency = el.value.trim().slice(0, 12) || 'EGP'; rerender(); },
    defaultCost: function (el) { S.settings.defaultCost = Math.max(0, +el.value || 0); rerender(); },
    perSide: function (el) { S.settings.perSide = +el.value; rerender(); },
    accent: function (el) { if (/^#[0-9a-f]{6}$/i.test(el.value)) { S.settings.accent = el.value; rerender(); } }
  };

  document.addEventListener('click', function (e) {
    const modal = document.getElementById('modal');
    if (e.target === modal) { closeModal(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACT[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset); }
  });
  document.addEventListener('change', function (e) {
    const el = e.target.closest('[data-chg]');
    if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el);
  });
  document.addEventListener('submit', function (e) {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    if (f.dataset.form === 'extra') {
      const m = getMatch(f.dataset.id), fd = new FormData(f), amount = +fd.get('amount');
      if (!(amount >= 0) || fd.get('amount') === '') return;
      m.extras.push({ id: C.uid('e'), label: String(fd.get('label') || '').trim().slice(0, 40), amount: amount });
      rerender(); return;
    }
    if (ui.modalSubmit) ui.modalSubmit(new FormData(f));
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.getElementById('modal').hidden) closeModal(); });
  document.getElementById('importFile').addEventListener('change', function (e) {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const rd = new FileReader();
    rd.onload = function () {
      let data = null;
      try { data = JSON.parse(rd.result); } catch (x) { data = null; }
      if (!data || typeof data !== 'object' || !Array.isArray(data.players) || !Array.isArray(data.matches)) { toast(t('importBad')); return; }
      confirmBox(t('confirmImport'), function () { S = C.normalize(data); closeModal(); rerender(); toast(t('importOk')); }, true);
    };
    rd.readAsText(file);
  });
  window.addEventListener('hashchange', function () { ui.voter = ''; render(); window.scrollTo(0, 0); });
  window.__kora = { get state() { return S; } };
  render();
})();
