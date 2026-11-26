/* Kora core: pure logic, no DOM. Works in browsers (window.KoraCore) and Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KoraCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const POS = ['GK', 'DEF', 'MID', 'FWD', 'ANY'];
  const SIZES = [5, 6, 7, 8, 9, 11];

  let _n = 0;
  function uid(prefix) {
    _n++;
    return (prefix || 'x') + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36) + _n.toString(36);
  }

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- state ---------- */
  function defaultState() {
    return {
      v: 1,
      settings: { groupName: '', lang: 'auto', theme: 'auto', accent: '#1f7a46', currency: 'EGP', perSide: 7, defaultCost: 600, roundStep: 0 },
      players: [],
      matches: []
    };
  }

  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);
  const str = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max || 80) : '');
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  function normalize(input) {
    const s = defaultState();
    if (!input || typeof input !== 'object') return s;
    const st = input.settings || {};
    s.settings.groupName = str(st.groupName, 40);
    s.settings.lang = ['ar', 'en', 'auto'].includes(st.lang) ? st.lang : 'auto';
    s.settings.theme = ['light', 'dark', 'auto'].includes(st.theme) ? st.theme : 'auto';
    s.settings.accent = /^#[0-9a-fA-F]{6}$/.test(st.accent) ? st.accent : s.settings.accent;
    s.settings.currency = str(st.currency, 12) || 'EGP';
    s.settings.perSide = SIZES.includes(st.perSide) ? st.perSide : 7;
    s.settings.defaultCost = clamp(num(st.defaultCost, 600), 0, 1e6);
    s.settings.roundStep = [0, 1, 5, 10, 50].includes(st.roundStep) ? st.roundStep : 0;
    const seen = new Set();
    (Array.isArray(input.players) ? input.players : []).forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      const id = str(p.id, 40) || uid('p');
      if (seen.has(id)) return;
      seen.add(id);
      const name = str(p.name, 40);
      if (!name) return;
      s.players.push({
        id: id, name: name, pos: POS.includes(p.pos) ? p.pos : 'ANY',
        rating: clamp(Math.round(num(p.rating, 3)), 1, 5), phone: str(p.phone, 24), active: p.active !== false
      });
    });
    (Array.isArray(input.matches) ? input.matches : []).forEach(function (m) {
      if (!m || typeof m !== 'object') return;
      const id = str(m.id, 40) || uid('m');
      if (s.matches.some(function (x) { return x.id === id; })) return;
      const match = {
        id: id,
        date: /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : today(),
        time: /^\d{2}:\d{2}$/.test(m.time) ? m.time : '20:00',
        venue: str(m.venue, 60),
        perSide: SIZES.includes(m.perSide) ? m.perSide : 7,
        cost: clamp(num(m.cost, 0), 0, 1e6),
        extras: (Array.isArray(m.extras) ? m.extras : []).filter(function (e) { return e && typeof e === 'object'; }).map(function (e) {
          return { id: str(e.id, 40) || uid('e'), label: str(e.label, 40), amount: clamp(num(e.amount, 0), 0, 1e6) };
        }),
        roundStep: [0, 1, 5, 10, 50].includes(m.roundStep) ? m.roundStep : 0,
        rsvp: {}, order: [], guests: [], teams: null, score: null, stats: {}, paid: {}, votes: {},
        votingClosed: !!m.votingClosed, mvp: null, mvpTie: null, status: m.status === 'played' ? 'played' : 'upcoming', seed: Math.floor(num(m.seed, 1))
      };
      (Array.isArray(m.guests) ? m.guests : []).forEach(function (g) {
        if (!g || typeof g !== 'object' || !str(g.name, 40)) return;
        match.guests.push({ id: str(g.id, 40) || uid('g'), name: str(g.name, 40), pos: POS.includes(g.pos) ? g.pos : 'ANY', rating: clamp(Math.round(num(g.rating, 3)), 1, 5) });
      });
      const known = new Set(s.players.map(function (p) { return p.id; }).concat(match.guests.map(function (g) { return g.id; })));
      const rs = m.rsvp && typeof m.rsvp === 'object' ? m.rsvp : {};
      Object.keys(rs).forEach(function (k) { if (known.has(k) && ['in', 'out', 'maybe'].includes(rs[k])) match.rsvp[k] = rs[k]; });
      match.guests.forEach(function (g) { match.rsvp[g.id] = 'in'; });
      (Array.isArray(m.order) ? m.order : []).forEach(function (k) { if (match.rsvp[k] === 'in' && match.order.indexOf(k) < 0) match.order.push(k); });
      Object.keys(match.rsvp).forEach(function (k) { if (match.rsvp[k] === 'in' && match.order.indexOf(k) < 0) match.order.push(k); });
      if (m.teams && Array.isArray(m.teams.A) && Array.isArray(m.teams.B)) {
        const ids = new Set(match.order);
        match.teams = { A: m.teams.A.filter(function (k) { return ids.has(k); }), B: m.teams.B.filter(function (k) { return ids.has(k); }) };
      }
      if (m.score && typeof m.score === 'object') match.score = { A: clamp(Math.round(num(m.score.A, 0)), 0, 99), B: clamp(Math.round(num(m.score.B, 0)), 0, 99) };
      const stats = m.stats && typeof m.stats === 'object' ? m.stats : {};
      Object.keys(stats).forEach(function (k) {
        if (known.has(k) && stats[k] && typeof stats[k] === 'object') match.stats[k] = { g: clamp(Math.round(num(stats[k].g, 0)), 0, 99), a: clamp(Math.round(num(stats[k].a, 0)), 0, 99) };
      });
      const paid = m.paid && typeof m.paid === 'object' ? m.paid : {};
      Object.keys(paid).forEach(function (k) { if (known.has(k) && paid[k]) match.paid[k] = true; });
      const votes = m.votes && typeof m.votes === 'object' ? m.votes : {};
      Object.keys(votes).forEach(function (k) { if (known.has(k) && known.has(votes[k]) && k !== votes[k]) match.votes[k] = votes[k]; });
      if (typeof m.mvp === 'string' && known.has(m.mvp)) match.mvp = m.mvp;
      if (Array.isArray(m.mvpTie)) match.mvpTie = m.mvpTie.filter(function (k) { return known.has(k); });
      s.matches.push(match);
    });
    return s;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(dateStr, n) {
    const p = dateStr.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2] + n);
    return today(d);
  }

  /* ---------- attendance ---------- */
  function newMatch(settings, over) {
    return Object.assign({
      id: uid('m'), date: today(), time: '20:00', venue: '', perSide: settings.perSide, cost: settings.defaultCost, extras: [],
      roundStep: settings.roundStep || 0,
      rsvp: {}, order: [], guests: [], teams: null, score: null, stats: {}, paid: {}, votes: {}, votingClosed: false, mvp: null, mvpTie: null,
      status: 'upcoming', seed: 1
    }, over || {});
  }

  function capacity(m) { return m.perSide * 2; }

  function attendance(m, players) {
    const cap = capacity(m);
    const confirmed = m.order.slice(0, cap);
    const waitlist = m.order.slice(cap);
    const active = players.filter(function (p) { return p.active || m.rsvp[p.id]; }).map(function (p) { return p.id; });
    const maybe = active.filter(function (id) { return m.rsvp[id] === 'maybe'; });
    const out = active.filter(function (id) { return m.rsvp[id] === 'out'; });
    const noreply = active.filter(function (id) { return !m.rsvp[id]; });
    return { confirmed: confirmed, waitlist: waitlist, maybe: maybe, out: out, noreply: noreply, capacity: cap };
  }

  function setRsvp(m, id, status) {
    if (status === 'in') {
      m.rsvp[id] = 'in';
      if (m.order.indexOf(id) < 0) m.order.push(id);
    } else {
      if (status === 'none') delete m.rsvp[id]; else m.rsvp[id] = status;
      m.order = m.order.filter(function (k) { return k !== id; });
    }
    syncTeams(m);
    cleanupVotes(m);
  }

  function addGuest(m, g) {
    const guest = { id: uid('g'), name: str(g.name, 40), pos: POS.includes(g.pos) ? g.pos : 'ANY', rating: clamp(Math.round(num(g.rating, 3)), 1, 5) };
    if (!guest.name) return null;
    m.guests.push(guest);
    setRsvp(m, guest.id, 'in');
    return guest;
  }

  function removeGuest(m, id) {
    m.guests = m.guests.filter(function (g) { return g.id !== id; });
    delete m.rsvp[id]; delete m.stats[id]; delete m.paid[id];
    m.order = m.order.filter(function (k) { return k !== id; });
    syncTeams(m); cleanupVotes(m);
  }

  function entity(id, state, m) {
    const p = state.players.find(function (x) { return x.id === id; });
    if (p) return p;
    const g = m && m.guests.find(function (x) { return x.id === id; });
    return g ? Object.assign({ guest: true, active: true }, g) : null;
  }

  /* ---------- teams ---------- */
  function posImbalance(A, B) {
    let d = 0;
    ['GK', 'DEF', 'MID', 'FWD'].forEach(function (k) {
      const a = A.filter(function (p) { return p.pos === k; }).length;
      const b = B.filter(function (p) { return p.pos === k; }).length;
      d += Math.abs(a - b);
    });
    return d;
  }
  const sum = function (t) { return t.reduce(function (s, p) { return s + p.rating; }, 0); };

  function balanceTeams(list, seed) {
    const rnd = rng(seed || 1);
    const n = list.length;
    const hi = Math.ceil(n / 2), lo = n - hi;
    const capA = n % 2 && rnd() < 0.5 ? lo : hi;
    const capB = n - capA;
    const arr = shuffle(list, rnd).sort(function (a, b) { return b.rating - a.rating; });
    const A = [], B = [];
    const pinned = new Set();
    arr.filter(function (p) { return p.pos === 'GK'; }).slice(0, 2).forEach(function (p, i) {
      const t = i % 2 ? B : A;
      if (t.length < (i % 2 ? capB : capA)) { t.push(p); pinned.add(p.id); }
    });
    arr.filter(function (p) { return !pinned.has(p.id); }).forEach(function (p) {
      const canA = A.length < capA, canB = B.length < capB;
      let toA;
      if (canA && !canB) toA = true; else if (!canA && canB) toA = false;
      else if (sum(A) !== sum(B)) toA = sum(A) < sum(B);
      else if (A.length !== B.length) toA = A.length < B.length;
      else toA = rnd() < 0.5;
      (toA ? A : B).push(p);
    });
    const score = function () { return Math.abs(sum(A) - sum(B)) * 100 + posImbalance(A, B) * 10; };
    let best = score(), improved = true, guard = 0;
    while (improved && guard++ < 50) {
      improved = false;
      for (let i = 0; i < A.length; i++) {
        for (let j = 0; j < B.length; j++) {
          if (pinned.has(A[i].id) || pinned.has(B[j].id)) continue;
          [A[i], B[j]] = [B[j], A[i]];
          const sc = score();
          if (sc < best) { best = sc; improved = true; } else { [A[i], B[j]] = [B[j], A[i]]; }
        }
      }
    }
    return { A: A.map(function (p) { return p.id; }), B: B.map(function (p) { return p.id; }) };
  }

  function teamsFor(m, state) {
    const ids = attendance(m, state.players).confirmed;
    const list = ids.map(function (id) { return entity(id, state, m); }).filter(Boolean);
    return list;
  }

  function autoTeams(m, state, reseed) {
    if (reseed) m.seed = (m.seed || 1) + 1;
    const list = teamsFor(m, state);
    m.teams = balanceTeams(list, m.seed + hash(m.id));
    return m.teams;
  }

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 100000; }

  /* Keep teams consistent with attendance: drop absent, place newcomers on the smaller side. */
  function syncTeams(m) {
    if (!m.teams) return;
    const cap = m.order.slice(0, capacity(m));
    const set = new Set(cap);
    m.teams.A = m.teams.A.filter(function (k) { return set.has(k); });
    m.teams.B = m.teams.B.filter(function (k) { return set.has(k); });
    const placed = new Set(m.teams.A.concat(m.teams.B));
    cap.forEach(function (k) {
      if (!placed.has(k)) (m.teams.A.length <= m.teams.B.length ? m.teams.A : m.teams.B).push(k);
    });
  }

  function moveToTeam(m, id, team) {
    if (!m.teams) return;
    m.teams.A = m.teams.A.filter(function (k) { return k !== id; });
    m.teams.B = m.teams.B.filter(function (k) { return k !== id; });
    m.teams[team].push(id);
  }

  function formation(n, hasGK) {
    const outfield = hasGK ? n - 1 : n;
    if (outfield <= 0) return { DEF: 0, MID: 0, FWD: 0 };
    const fwd = Math.max(1, Math.floor(outfield * 0.25));
    let def = Math.round(outfield * 0.35);
    def = Math.min(def, outfield - fwd);
    return { DEF: def, MID: outfield - def - fwd, FWD: fwd };
  }

  function layout(players) {
    const gk = players.filter(function (p) { return p.pos === 'GK'; });
    const keeper = gk[0] || null;
    const rest = players.filter(function (p) { return p !== keeper; });
    const lines = { GK: keeper ? [keeper] : [], DEF: [], MID: [], FWD: [] };
    const any = [];
    rest.forEach(function (p) {
      if (p.pos === 'DEF' || p.pos === 'MID' || p.pos === 'FWD') lines[p.pos].push(p);
      else if (p.pos === 'GK') lines.DEF.push(p);
      else any.push(p);
    });
    const target = formation(players.length, !!keeper);
    any.sort(function (a, b) { return b.rating - a.rating; });
    any.forEach(function (p) {
      let bestK = 'MID', bestD = -1e9;
      ['MID', 'DEF', 'FWD'].forEach(function (k) {
        const d = target[k] - lines[k].length;
        if (d > bestD) { bestD = d; bestK = k; }
      });
      lines[bestK].push(p);
    });
    return { lines: ['GK', 'DEF', 'MID', 'FWD'].map(function (k) { return { pos: k, players: lines[k] }; }), hasGK: !!keeper };
  }

  /* ---------- money (all integer minor units) ---------- */
  const toCents = function (x) { return Math.round(num(x, 0) * 100); };

  function totalCents(m) {
    return toCents(m.cost) + (m.extras || []).reduce(function (s, e) { return s + toCents(e.amount); }, 0);
  }

  function splitCost(total, n, step) {
    if (n <= 0) return { per: [], collected: 0, surplus: 0, total: total };
    const st = Math.round((step || 0) * 100);
    if (st <= 1) {
      const base = Math.floor(total / n), rem = total - base * n;
      const per = [];
      for (let i = 0; i < n; i++) per.push(base + (i < rem ? 1 : 0));
      return { per: per, collected: total, surplus: 0, total: total };
    }
    const share = Math.ceil(total / n / st) * st;
    const per = [];
    for (let i = 0; i < n; i++) per.push(share);
    return { per: per, collected: share * n, surplus: share * n - total, total: total };
  }

  function matchShares(m, players) {
    const ids = attendance(m, players).confirmed;
    const sp = splitCost(totalCents(m), ids.length, m.roundStep);
    const shares = {};
    ids.forEach(function (id, i) { shares[id] = sp.per[i]; });
    const paidCents = ids.reduce(function (s, id) { return s + (m.paid[id] ? shares[id] : 0); }, 0);
    return { ids: ids, shares: shares, split: sp, paid: paidCents, outstanding: sp.collected - paidCents };
  }

  /* ---------- result, MVP ---------- */
  function setStat(m, id, key, delta) {
    const s = m.stats[id] || (m.stats[id] = { g: 0, a: 0 });
    s[key] = clamp(s[key] + delta, 0, 99);
  }
  function teamGoals(m) {
    const r = { A: 0, B: 0 };
    if (!m.teams) return r;
    ['A', 'B'].forEach(function (t) { m.teams[t].forEach(function (id) { r[t] += (m.stats[id] && m.stats[id].g) || 0; }); });
    return r;
  }

  function cleanupVotes(m) {
    const ids = new Set(m.order.slice(0, capacity(m)));
    Object.keys(m.votes).forEach(function (v) { if (!ids.has(v) || !ids.has(m.votes[v])) delete m.votes[v]; });
    if (m.mvp && !ids.has(m.mvp)) m.mvp = null;
  }

  function castVote(m, voter, target) {
    const ids = m.order.slice(0, capacity(m));
    if (m.votingClosed) return { ok: false, error: 'closed' };
    if (ids.indexOf(voter) < 0 || ids.indexOf(target) < 0) return { ok: false, error: 'not_participant' };
    if (voter === target) return { ok: false, error: 'self' };
    const changed = !!m.votes[voter] && m.votes[voter] !== target;
    m.votes[voter] = target;
    return { ok: true, changed: changed };
  }

  function tally(m) {
    const counts = {};
    Object.keys(m.votes).forEach(function (v) { counts[m.votes[v]] = (counts[m.votes[v]] || 0) + 1; });
    const entries = Object.keys(counts).map(function (id) { return { id: id, votes: counts[id] }; }).sort(function (a, b) { return b.votes - a.votes; });
    const top = entries.length ? entries[0].votes : 0;
    return { entries: entries, leaders: entries.filter(function (e) { return e.votes === top; }).map(function (e) { return e.id; }), total: Object.keys(m.votes).length };
  }

  function closeVoting(m) {
    const t = tally(m);
    m.votingClosed = true;
    m.mvp = null; m.mvpTie = null;
    if (t.leaders.length === 1) m.mvp = t.leaders[0];
    else if (t.leaders.length > 1) m.mvpTie = t.leaders;
    return t;
  }
  function reopenVoting(m) { m.votingClosed = false; m.mvp = null; m.mvpTie = null; }
  function resolveTie(m, id) { if (m.mvpTie && m.mvpTie.indexOf(id) >= 0) { m.mvp = id; m.mvpTie = null; } }

  /* ---------- season ---------- */
  function seasonStats(state) {
    const rows = {};
    const played = state.matches.filter(function (m) { return m.status === 'played'; });
    function row(id, name) { return rows[id] || (rows[id] = { id: id, name: name, played: 0, w: 0, d: 0, l: 0, goals: 0, assists: 0, mvp: 0, owes: 0, pts: 0 }); }
    state.players.forEach(function (p) { row(p.id, p.name); });
    played.forEach(function (m) {
      const sh = matchShares(m, state.players);
      const guestIds = new Set(m.guests.map(function (g) { return g.id; }));
      sh.ids.forEach(function (id) {
        if (guestIds.has(id)) return;
        const r = rows[id]; if (!r) return;
        r.played++;
        const st = m.stats[id]; if (st) { r.goals += st.g; r.assists += st.a; }
        if (!m.paid[id]) r.owes += sh.shares[id];
        if (m.teams && m.score) {
          const t = m.teams.A.indexOf(id) >= 0 ? 'A' : 'B';
          const f = m.score[t], a = m.score[t === 'A' ? 'B' : 'A'];
          if (f > a) r.w++; else if (f < a) r.l++; else r.d++;
        }
      });
      if (m.mvp && rows[m.mvp]) rows[m.mvp].mvp++;
    });
    const list = Object.keys(rows).map(function (k) {
      const r = rows[k];
      r.pts = r.w * 3 + r.d;
      r.rate = played.length ? r.played / played.length : 0;
      return r;
    });
    return { rows: list, matches: played.length };
  }

  return {
    POS: POS, SIZES: SIZES, uid: uid, rng: rng, defaultState: defaultState, normalize: normalize, today: today, addDays: addDays,
    newMatch: newMatch, capacity: capacity, attendance: attendance, setRsvp: setRsvp, addGuest: addGuest, removeGuest: removeGuest, entity: entity,
    balanceTeams: balanceTeams, autoTeams: autoTeams, syncTeams: syncTeams, moveToTeam: moveToTeam, formation: formation, layout: layout,
    toCents: toCents, totalCents: totalCents, splitCost: splitCost, matchShares: matchShares,
    setStat: setStat, teamGoals: teamGoals, castVote: castVote, tally: tally, closeVoting: closeVoting, reopenVoting: reopenVoting, resolveTie: resolveTie,
    seasonStats: seasonStats
  };
});
