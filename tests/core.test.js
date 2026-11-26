const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../docs/core.js');

function mk(n, seedr) {
  const r = C.rng(seedr || 7);
  const pos = ['GK', 'DEF', 'MID', 'FWD', 'ANY'];
  return Array.from({ length: n }, (_, i) => ({ id: 'p' + i, rating: 1 + Math.floor(r() * 5), pos: pos[Math.floor(r() * 5)], name: 'P' + i }));
}

test('splitCost is exact and fair without rounding', () => {
  for (const [total, n] of [[60000, 14], [10000, 3], [1, 5], [99999, 7], [0, 4]]) {
    const s = C.splitCost(total, n, 0);
    assert.equal(s.per.reduce((a, b) => a + b, 0), total);
    assert.ok(Math.max(...s.per) - Math.min(...s.per) <= 1);
  }
  assert.deepEqual(C.splitCost(500, 0, 0).per, []);
});

test('splitCost rounds up to a step and reports surplus', () => {
  const s = C.splitCost(60000, 14, 5);
  assert.equal(s.per[0] % 500, 0);
  assert.equal(s.per[0], 4500);
  assert.equal(s.collected, 63000);
  assert.equal(s.surplus, 3000);
});

test('totalCents includes extras', () => {
  const m = C.newMatch(C.defaultState().settings, { cost: 600.5, extras: [{ id: 'e', label: 'water', amount: 20.25 }] });
  assert.equal(C.totalCents(m), 62075);
});

test('balanceTeams: sizes, uniqueness, determinism, closeness', () => {
  for (let n = 2; n <= 22; n++) {
    for (let seed = 1; seed <= 8; seed++) {
      const list = mk(n, seed * 13 + n);
      const t = C.balanceTeams(list, seed);
      assert.equal(t.A.length + t.B.length, n);
      assert.ok(Math.abs(t.A.length - t.B.length) <= 1);
      assert.equal(new Set(t.A.concat(t.B)).size, n);
      const rt = (ids) => ids.reduce((s, id) => s + list.find(p => p.id === id).rating, 0);
      if (n >= 8) assert.ok(Math.abs(rt(t.A) - rt(t.B)) <= 2, `n=${n} seed=${seed}`);
      assert.deepEqual(C.balanceTeams(list, seed), t);
    }
  }
});

test('balanceTeams splits two goalkeepers', () => {
  const list = [
    { id: 'g1', rating: 5, pos: 'GK' }, { id: 'g2', rating: 4, pos: 'GK' },
    ...mk(10, 3).map((p, i) => ({ ...p, id: 'x' + i, pos: 'ANY' }))
  ];
  const t = C.balanceTeams(list, 4);
  assert.notEqual(t.A.includes('g1'), t.A.includes('g2'));
});

test('different seeds can give different teams', () => {
  const list = mk(14, 5);
  const seen = new Set();
  for (let s = 1; s <= 10; s++) seen.add(JSON.stringify(C.balanceTeams(list, s).A.slice().sort()));
  assert.ok(seen.size > 1);
});

test('formation sums to the outfield count', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 11]) {
    for (const gk of [true, false]) {
      const f = C.formation(n, gk);
      assert.equal(f.DEF + f.MID + f.FWD, gk ? n - 1 : n);
      assert.ok(f.DEF >= 0 && f.MID >= 0 && f.FWD >= 0);
    }
  }
  assert.deepEqual(C.formation(7, true), { DEF: 2, MID: 3, FWD: 1 });
  assert.deepEqual(C.formation(11, true), { DEF: 4, MID: 4, FWD: 2 });
});

test('layout keeps everyone exactly once', () => {
  const list = mk(7, 9);
  const l = C.layout(list);
  const ids = l.lines.flatMap(x => x.players.map(p => p.id));
  assert.equal(ids.length, 7);
  assert.equal(new Set(ids).size, 7);
});

function setup() {
  const st = C.defaultState();
  for (let i = 0; i < 16; i++) st.players.push({ id: 'p' + i, name: 'P' + i, pos: 'ANY', rating: 3, phone: '', active: true });
  const m = C.newMatch({ perSide: 5, defaultCost: 600, roundStep: 0 }, { id: 'm1' });
  st.matches.push(m);
  return { st, m };
}

test('waitlist follows sign-up order and promotes on drop-out', () => {
  const { st, m } = setup();
  for (let i = 0; i < 12; i++) C.setRsvp(m, 'p' + i, 'in');
  let a = C.attendance(m, st.players);
  assert.equal(a.confirmed.length, 10);
  assert.deepEqual(a.waitlist, ['p10', 'p11']);
  C.setRsvp(m, 'p3', 'out');
  a = C.attendance(m, st.players);
  assert.ok(a.confirmed.includes('p10'));
  assert.deepEqual(a.waitlist, ['p11']);
  C.setRsvp(m, 'p3', 'in');
  assert.deepEqual(C.attendance(m, st.players).waitlist, ['p11', 'p3']);
});

test('guests take a seat and can be removed', () => {
  const { st, m } = setup();
  C.setRsvp(m, 'p0', 'in');
  const g = C.addGuest(m, { name: 'Ali', rating: 4 });
  assert.equal(C.attendance(m, st.players).confirmed.length, 2);
  C.removeGuest(m, g.id);
  assert.equal(C.attendance(m, st.players).confirmed.length, 1);
  assert.equal(C.addGuest(m, { name: '  ' }), null);
});

test('teams stay in sync when attendance changes', () => {
  const { st, m } = setup();
  for (let i = 0; i < 10; i++) C.setRsvp(m, 'p' + i, 'in');
  C.autoTeams(m, st, false);
  assert.equal(m.teams.A.length, 5);
  C.setRsvp(m, 'p0', 'out');
  C.setRsvp(m, 'p1', 'out');
  const all = m.teams.A.concat(m.teams.B);
  assert.equal(all.length, 8);
  assert.ok(!all.includes('p0'));
  C.setRsvp(m, 'p12', 'in');
  assert.equal(m.teams.A.concat(m.teams.B).length, 9);
  C.moveToTeam(m, 'p12', 'A');
  assert.ok(m.teams.A.includes('p12') && !m.teams.B.includes('p12'));
});

test('matchShares: paid and outstanding add up', () => {
  const { st, m } = setup();
  m.cost = 700;
  for (let i = 0; i < 10; i++) C.setRsvp(m, 'p' + i, 'in');
  m.paid.p0 = true; m.paid.p1 = true;
  const s = C.matchShares(m, st.players);
  assert.equal(s.split.collected, 70000);
  assert.equal(s.paid + s.outstanding, 70000);
  assert.equal(s.paid, 14000);
});

test('voting: no self vote, strangers, revote, tie, close', () => {
  const { st, m } = setup();
  for (let i = 0; i < 6; i++) C.setRsvp(m, 'p' + i, 'in');
  assert.equal(C.castVote(m, 'p0', 'p0').error, 'self');
  assert.equal(C.castVote(m, 'p9', 'p1').error, 'not_participant');
  assert.equal(C.castVote(m, 'p0', 'p9').error, 'not_participant');
  assert.ok(C.castVote(m, 'p0', 'p1').ok);
  assert.ok(C.castVote(m, 'p2', 'p3').ok);
  assert.equal(C.tally(m).leaders.length, 2);
  const r = C.castVote(m, 'p0', 'p3');
  assert.ok(r.changed);
  assert.deepEqual(C.tally(m).leaders, ['p3']);
  C.closeVoting(m);
  assert.equal(m.mvp, 'p3');
  assert.equal(C.castVote(m, 'p4', 'p3').error, 'closed');
  C.reopenVoting(m);
  C.castVote(m, 'p4', 'p1'); C.castVote(m, 'p5', 'p1'); C.castVote(m, 'p3', 'p1');
  C.closeVoting(m);
  assert.equal(m.mvp, 'p1');
  C.reopenVoting(m);
  C.castVote(m, 'p1', 'p3'); // now p1:3, p3:3
  C.closeVoting(m);
  assert.equal(m.mvp, null);
  assert.equal(m.mvpTie.length, 2);
  C.resolveTie(m, 'p3');
  assert.equal(m.mvp, 'p3');
  assert.equal(m.mvpTie, null);
});

test('leaving the match removes that person\'s votes', () => {
  const { m } = setup();
  for (let i = 0; i < 4; i++) C.setRsvp(m, 'p' + i, 'in');
  C.castVote(m, 'p0', 'p1'); C.castVote(m, 'p2', 'p1');
  C.setRsvp(m, 'p1', 'out');
  assert.equal(C.tally(m).total, 0);
});

test('seasonStats: results, goals, mvp, owes', () => {
  const { st, m } = setup();
  m.cost = 100;
  for (let i = 0; i < 4; i++) C.setRsvp(m, 'p' + i, 'in');
  m.teams = { A: ['p0', 'p1'], B: ['p2', 'p3'] };
  C.setStat(m, 'p0', 'g', 2); C.setStat(m, 'p1', 'a', 1); C.setStat(m, 'p2', 'g', 1);
  m.score = { A: 2, B: 1 }; m.status = 'played'; m.mvp = 'p0';
  m.paid.p0 = true;
  const s = C.seasonStats(st);
  const by = Object.fromEntries(s.rows.map(r => [r.id, r]));
  assert.equal(by.p0.w, 1); assert.equal(by.p2.l, 1); assert.equal(by.p0.goals, 2); assert.equal(by.p1.assists, 1);
  assert.equal(by.p0.mvp, 1); assert.equal(by.p0.owes, 0); assert.equal(by.p1.owes, 2500);
  assert.equal(by.p5.played, 0); assert.equal(by.p0.pts, 3);
  assert.equal(by.p0.rate, 1);
});

test('normalize survives garbage and keeps valid data', () => {
  assert.deepEqual(C.normalize(null).players, []);
  const bad = { settings: { accent: 'red', perSide: 99, lang: 'fr' }, players: [{ name: '' }, null, { id: 'a', name: 'Ali', rating: 99, pos: 'XX' }, { id: 'a', name: 'dup' }],
    matches: [{ id: 'm', date: 'nope', rsvp: { a: 'in', zzz: 'in' }, order: ['zzz', 'a'], votes: { a: 'a' }, teams: { A: ['a', 'q'], B: [] } }] };
  const n = C.normalize(bad);
  assert.equal(n.players.length, 1);
  assert.equal(n.players[0].rating, 5);
  assert.equal(n.players[0].pos, 'ANY');
  assert.equal(n.settings.accent, '#1f7a46');
  assert.equal(n.settings.perSide, 7);
  assert.equal(n.settings.lang, 'auto');
  const m = n.matches[0];
  assert.deepEqual(m.order, ['a']);
  assert.deepEqual(m.teams.A, ['a']);
  assert.deepEqual(m.votes, {});
  assert.match(m.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(C.normalize(JSON.parse(JSON.stringify(n))), n);
});

test('addDays crosses month and year', () => {
  assert.equal(C.addDays('2026-12-31', 7), '2027-01-07');
  assert.equal(C.addDays('2028-02-26', 3), '2028-02-29');
});
