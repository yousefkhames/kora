// Real browser click-through. Usage: node tests/e2e.js [--shots]
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('node:assert/strict');
const SHOTS = process.argv.includes('--shots');
const ROOT = path.join(__dirname, '..', 'docs');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

let step = 0;
const log = (m) => console.log(`  ✓ ${++step}. ${m}`);

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(base, ['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());
  const T = (sel) => page.$eval(sel, e => e.textContent.trim());
  const text = () => page.$eval('#app', e => e.innerText);
  const click = async (sel) => { await page.waitForSelector(sel, { visible: true }); await page.$eval(sel, e => e.scrollIntoView({ block: 'center' })); await page.click(sel); };
  const act = (name, sel) => click(`[data-act="${name}"]${sel || ''}`);
  const nav = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await new Promise(r => setTimeout(r, 80)); };
  const shot = async (name) => { if (SHOTS) { await page.evaluate(() => { const t = document.getElementById('toast'); t.hidden = true; t.style.display = 'none'; window.scrollTo(0, 0); }); await new Promise(r => setTimeout(r, 200)); await page.screenshot({ path: path.join(__dirname, '..', 'assets', name + '.png') }); } };
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__kora.state)));
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  try {
    // 1. fresh start, English
    await page.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('seen')) { sessionStorage.setItem('seen', '1'); localStorage.clear(); } });
    await page.goto(base, { waitUntil: 'load' });
    await nav('#/settings'); await act('set', '[data-k="lang"][data-v="en"]'); await nav('#/');
    assert.match(await text(), /No matches yet/); log('empty state shows in English');
    assert.equal(await page.evaluate(() => document.documentElement.dir), 'ltr');

    // 2. demo data
    await act('demo');
    assert.match(await text(), /Upcoming/); assert.match(await text(), /Played/);
    let s = await state();
    assert.equal(s.players.length, 14); assert.equal(s.matches.length, 4);
    assert.equal((await page.$$('.matchcard')).length, 4); log('demo squad loads: 14 players, 4 matches');
    assert.ok((await overflow()) <= 0, 'no horizontal overflow'); await shot('matches-en');

    // 3. attendance
    await click('.matchcard[href*="/att"]');
    await page.waitForSelector('.seg');
    assert.match(await text(), /10\/12 in/); log('upcoming match shows 10/12 in (9 players + 1 guest)');
    const firstOut = await page.$('button.in[aria-pressed="false"]');
    await firstOut.click();
    assert.match(await text(), /11\/12 in/); log('tapping In adds a player (11/12)');
    await click('button.in[aria-pressed="true"]'); // toggles off first confirmed
    assert.match(await text(), /10\/12 in/); log('tapping In again removes the player');
    // fill the pitch and overflow into waitlist via guests
    for (let i = 0; i < 3; i++) {
      await act('guest-add'); await page.type('#modal input[name=name]', 'G' + i); await click('#modal button[type=submit]');
    }
    assert.match(await text(), /12\/12 in/); assert.match(await text(), /1 on the waitlist/); assert.match(await text(), /Waitlist #1/); log('13th sign-up goes to the waitlist');
    await click('[data-act="guest-del"]'); // removes first guest, waitlisted promoted
    assert.doesNotMatch(await text(), /on the waitlist/); log('removing a guest promotes the waitlist');
    await click('[data-act="copy-invite"]');
    await page.evaluate(() => { window.open = (u) => { window.__opened = u; return {}; }; });
    await page.$eval('[data-act="wa-invite"]', e => e.click()); // the copy toast can overlap the button at the bottom
    await page.waitForFunction(() => /^https:\/\/wa\.me\/\?text=/.test(window.__opened || '') && /football/.test(decodeURIComponent(window.__opened)));
    log('Send on WhatsApp opens wa.me with the invite text');
    await page.waitForFunction(() => window.__lastCopied && /football/.test(window.__lastCopied));
    const inv = await page.evaluate(() => window.__lastCopied);
    assert.match(inv, /Thursday Warriors/); assert.match(inv, /12 spots/); log('invite message is copied with the group name');
    await shot('attendance-en');

    // 4. lineup
    const mid = (await state()).matches.find(m => m.status !== 'played').id;
    await nav(`#/m/${mid}/lineup`);
    await page.waitForSelector('.pitchwrap svg');
    const nc = (await page.$$('.pitchwrap svg circle[r="17"]')).length; assert.equal(nc, 12); log('pitch diagram renders players');
    const before = (await state()).matches.find(m => m.id === mid).teams;
    await act('teams-reshuffle');
    const after = (await state()).matches.find(m => m.id === mid).teams;
    assert.equal(after.A.length + after.B.length, 12);
    const diff = Math.abs(after.A.length - after.B.length); assert.ok(diff <= 1); log('reshuffle keeps 12 players balanced in count');
    const mv = after.A[0];
    await click(`[data-act="team-move"][data-id="${mv}"]`);
    const moved = (await state()).matches.find(m => m.id === mid).teams;
    assert.ok(moved.B.includes(mv) && !moved.A.includes(mv)); log('moving a player to the other team works');
    await click('[data-act="copy-lineup"]');
    await page.waitForFunction(() => /White/.test(window.__lastCopied || ''));
    log('lineup message copied'); await shot('lineup-en');

    // 5. cost
    await nav(`#/m/${mid}/cost`);
    await page.waitForSelector('#cost');
    let tx = await text(); assert.match(tx, /740 EGP/); assert.match(tx, /Per player\s*\n?\s*65 EGP/); log('cost split: 740 total, 12 players, rounded up to 65 each');
    await page.$eval('#cost', e => { e.value = '1000'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    tx = await text(); assert.match(tx, /1,040 EGP/); assert.match(tx, /90 EGP/); log('editing the pitch cost recalculates (1,040 / 12 = 86.67 -> 90)');
    assert.match(tx, /Surplus after rounding: 40 EGP/);
    await page.type('form[data-form=extra] input[name=label]', 'Referee');
    await page.type('form[data-form=extra] input[name=amount]', '60');
    await click('form[data-form=extra] button'); tx = await text();
    assert.match(tx, /1,100 EGP/); assert.match(tx, /Referee/); log('adding an extra updates the total');
    await click('[data-act="paid"]'); await click('[data-act="paid"][aria-pressed="false"]');
    tx = await text(); assert.match(tx, /Collected 190 EGP of 1,140 EGP/); log('marking two players paid updates collected');
    await click('[data-act="copy-pay"]');
    await page.waitForFunction(() => /Still to pay/.test(window.__lastCopied || '')); log('payment reminder copies the unpaid names');
    await shot('cost-en');

    // 6. result + MVP on the upcoming match
    await nav(`#/m/${mid}/result`);
    await page.waitForSelector('[data-chg=scoreA]');
    await page.$eval('[data-chg=scoreA]', e => { e.value = '4'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.$eval('[data-chg=scoreB]', e => { e.value = '2'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('[data-act="stat"][data-k="g"][data-d="1"]');
    assert.match(await text(), /Goal tally \(1-0\) differs from the score/); log('goal tally mismatch is flagged');
    await act('save-result');
    assert.equal((await state()).matches.find(m => m.id === mid).status, 'played'); log('result saved, match marked played');
    const ids = (await state()).matches.find(m => m.id === mid).order.slice(0, 12);
    await page.select('#voter', ids[0]);
    const cands = await page.$$eval('.votegrid button', b => b.length); assert.equal(cands, 11); log('voter cannot vote for themselves (11 candidates)');
    await click(`[data-act="pick-vote"][data-id="${ids[1]}"]`);
    await page.select('#voter', ids[2]); await click(`[data-act="pick-vote"][data-id="${ids[1]}"]`);
    await page.select('#voter', ids[3]); await click(`[data-act="pick-vote"][data-id="${ids[4]}"]`);
    assert.match(await text(), /3 of 12 voted/);
    assert.doesNotMatch(await text(), /MVP\n.*🏆/); log('three secret votes cast, no results shown yet');
    await page.select('#voter', ids[3]); await click(`[data-act="pick-vote"][data-id="${ids[1]}"]`);
    await act('close-vote');
    assert.match(await text(), /🏆/); assert.equal((await state()).matches.find(m => m.id === mid).mvp, ids[1]); log('closing voting reveals the winner (changed vote counted once)');
    await shot('mvp-en');

    // 7. table
    await nav('#/table');
    await page.waitForSelector('table.tbl');
    const rows = await page.$$eval('table.tbl tbody tr', r => r.length); assert.ok(rows >= 12); log(`season table has ${rows} players`);
    await click('[data-act="sort"][data-k="goals"]');
    const first = await page.$eval('table.tbl tbody tr td', e => e.textContent);
    assert.match(first, /^1\./); log('table sorts by goals'); await shot('table-en');

    // 8. players
    await nav('#/players');
    await act('player-add'); await page.type('#modal input[name=name]', 'Nabil'); await page.select('#modal select[name=pos]', 'GK'); await click('#modal button[type=submit]');
    assert.match(await text(), /Nabil/); assert.equal((await state()).players.length, 15); log('player added');
    await page.evaluate(() => [...document.querySelectorAll('[data-act="player-edit"]')].pop().click());
    await page.waitForSelector('[data-act="player-del"]'); await click('[data-act="player-del"]'); await click('[data-act="modal-yes"]');
    assert.equal((await state()).players.length, 14); log('player removed (no history, so fully deleted)');

    // 9. new match + copy to next week + delete
    await nav('#/'); await act('match-new', '.btn');
    await page.waitForSelector('#modal input[name=date]');
    await page.$eval('#modal input[name=date]', e => { e.value = '2030-01-10'; });
    await page.$eval('#modal input[name=venue]', e => { e.focus(); e.value = 'Test Pitch'; }); await click('#modal button[type=submit]');
    await page.waitForSelector('.seg, .card');
    assert.match(await page.evaluate(() => location.hash), /#\/m\/.+\/att/); log('new match created and opened');
    await act('match-dup');
    assert.equal((await state()).matches.some(m => m.date === '2030-01-17' && m.venue === 'Test Pitch'), true); log('copy to next week gives the same venue, +7 days');
    await act('match-del'); await act('modal-yes'); assert.equal((await state()).matches.length, 5); log('delete match asks for confirmation');

    // 10. persistence
    await page.reload({ waitUntil: 'load' });
    assert.equal((await state()).matches.length, 5); log('data survives a reload (localStorage)');

    // 11. settings: Arabic + RTL, accent, group, export/import
    await nav('#/settings');
    await act('set', '[data-k="lang"][data-v="ar"]');
    assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl'); assert.match(await text(), /الإعدادات/); log('Arabic switches the UI to RTL');
    assert.ok((await overflow()) <= 0);
    await page.$eval('#groupName', e => { e.value = 'شلة الجمعة'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.match(await T('.brand b'), /شلة الجمعة/); log('group name shows in header');
    await act('set', '[data-k="accent"][data-v="#0b6e99"]');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()), '#0b6e99'); log('accent colour applies');
    await nav('#/'); assert.match(await text(), /القادمة/); assert.ok((await overflow()) <= 0);
    await nav(`#/m/${mid}/lineup`); await page.waitForSelector('.pitchwrap svg');
    assert.ok((await overflow()) <= 0);
    await nav('#/table'); assert.match(await text(), /ترتيب الموسم/); assert.ok((await overflow()) <= 0); log('Arabic pages have no horizontal overflow');

    // export -> reset -> import
    const exported = await page.evaluate(() => JSON.stringify(window.__kora.state));
    fs.writeFileSync('/tmp/kora-backup.json', exported);
    await nav('#/settings'); await act('reset'); await act('modal-yes');
    assert.equal((await state()).matches.length, 0); log('erase everything works after confirmation');
    const input = await page.$('#importFile'); await input.uploadFile('/tmp/kora-backup.json');
    await page.waitForSelector('[data-act="modal-yes"]'); await act('modal-yes');
    assert.equal((await state()).matches.length, 5); assert.equal((await state()).settings.groupName, 'شلة الجمعة'); log('importing the backup restores everything');
    fs.writeFileSync('/tmp/bad.json', '{"hello":1}');
    await (await page.$('#importFile')).uploadFile('/tmp/bad.json');
    await page.waitForFunction(() => /not a Kora|مش نسخة كورة/.test(document.getElementById('toast').textContent)); log('a wrong file is rejected without touching data');
    assert.equal((await state()).matches.length, 5);

    // 12. XSS safety
    await nav('#/settings'); await act('set', '[data-k="lang"][data-v="en"]'); await nav('#/players');
    await act('player-add'); await page.type('#modal input[name=name]', '<img src=x onerror=window.__xss=1>'); await click('#modal button[type=submit]');
    await new Promise(r => setTimeout(r, 200));
    assert.equal(await page.evaluate(() => window.__xss), undefined); log('player names are escaped (no script injection)');

    // desktop screenshot
    if (SHOTS) {
      await page.evaluate(() => { localStorage.clear(); }); await page.reload();
      await nav('#/settings'); await act('set', '[data-k="lang"][data-v="en"]'); await nav('#/'); await act('demo');
      await page.setViewport({ width: 1100, height: 800, deviceScaleFactor: 1.5 }); await shot('desktop-en');
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.evaluate(() => { localStorage.clear(); }); await page.reload();
      await nav('#/settings'); await act('set', '[data-k="lang"][data-v="ar"]'); await nav('#/'); await act('demo'); await shot('matches-ar');
      const amid = (await state()).matches.find(m => m.status !== 'played').id;
      await nav(`#/m/${amid}/lineup`); await page.waitForSelector('.pitchwrap svg'); await shot('lineup-ar');
      await nav(`#/m/${amid}/att`); await shot('attendance-ar');
      await nav('#/settings'); await act('set', '[data-k="lang"][data-v="en"]'); await act('set', '[data-k="theme"][data-v="dark"]');
      await nav(`#/m/${amid}/cost`); await nav('#/table'); await nav('#/settings'); await shot('settings-dark');
    }
    const sw = await page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active)); assert.ok(sw); log('service worker active (offline fallback)');
    assert.deepEqual(errors, [], 'browser console errors: ' + errors.join('\n'));
    log('no console or page errors');
    console.log(`\nE2E passed (${step} checks)`);
  } catch (e) {
    console.error('\nE2E FAILED:', e.message);
    await page.screenshot({ path: '/tmp/e2e-fail.png' }).catch(() => {});
    console.error('errors:', errors); console.error('hash:', await page.evaluate(() => location.hash + ' modalHidden=' + document.getElementById('modal').hidden).catch(()=>'?'));
    process.exitCode = 1;
  } finally { await browser.close(); server.close(); }
})();
