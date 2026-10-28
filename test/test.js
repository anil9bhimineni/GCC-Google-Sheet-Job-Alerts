// Offline tests: runs Code.gs in Node with fake Google services and fake job boards.
// Usage: node test/test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

/* ---------- fake spreadsheet ---------- */
class Sheet {
  constructor(name) { this.name = name; this.d = []; this.hidden = false; }
  getName() { return this.name; }
  getLastRow() { let n = this.d.length; while (n && this.d[n - 1].every((v) => v === '' || v == null)) n--; return n; }
  cell(r, c) { return (this.d[r - 1] || [])[c - 1] ?? ''; }
  put(r, c, v) { while (this.d.length < r) this.d.push([]); const row = this.d[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
  getRange(r, c, nr, nc) {
    const sh = this;
    if (typeof r === 'string') { // only 'A:A' style and 'A1' style used by the script
      if (/^[A-Z]:[A-Z]$/.test(r)) { const col = r.charCodeAt(0) - 64; return { getValues: () => Array.from({ length: Math.max(sh.d.length, 1) }, (_, i) => [sh.cell(i + 1, col)]) }; }
      return { setValue() {}, setDataValidation() { return this; } };
    }
    nr = nr || 1; nc = nc || 1;
    return {
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => sh.cell(r + i, c + j))),
      setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => sh.put(r + i, c + j, x))),
      setValue: (x) => sh.put(r, c, x),
    };
  }
  insertRowBefore(r) { this.d.splice(r - 1, 0, []); }
  insertRowsBefore(r, n) { this.d.splice(r - 1, 0, ...Array.from({ length: n }, () => [])); }
  deleteRows(r, n) { this.d.splice(r - 1, n); }
  clearContents() { this.d = []; }
  hideSheet() { this.hidden = true; }
}
const sheets = {};
const ss = {
  getSheetByName: (n) => sheets[n] || null,
  insertSheet: (n) => (sheets[n] = new Sheet(n)),
  getSpreadsheetTimeZone: () => 'Asia/Kolkata',
  toast: () => {},
};

/* ---------- fake internet ---------- */
const boards = {
  atlassian: { name: 'Atlassian', jobs: [{ id: 1, title: 'Senior Product Manager', location: { name: 'Bengaluru, India' }, absolute_url: 'https://x/1', content: '&lt;p&gt;Own the roadmap&lt;/p&gt;' }] },
};
const telegram = { sent: [], fail: '' };
let fetchCount = 0;
const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) });
function fakeFetch(url, opt) {
  fetchCount++;
  let m;
  if ((m = url.match(/greenhouse\.io\/v1\/boards\/([^/?]+)\/jobs/))) return boards[m[1]] ? resp(200, { jobs: boards[m[1]].jobs }) : resp(404, '');
  if ((m = url.match(/greenhouse\.io\/v1\/boards\/([^/?]+)$/))) return boards[m[1]] ? resp(200, { name: boards[m[1]].name }) : resp(404, '');
  if ((m = url.match(/api\.lever\.co\/v0\/postings\/([^/?]+)/))) return m[1] === 'meesho' ? resp(200, [{ id: 'L1', text: 'Product Owner - Payments', categories: { location: 'Bangalore' }, workplaceType: 'hybrid', hostedUrl: 'https://l/1', descriptionPlain: 'x' }]) : resp(404, '');
  if (/ashbyhq/.test(url)) return resp(404, '');
  if (/myworkdayjobs\.com\/wday\/cxs\/astrazeneca\/Careers\/jobs/.test(url)) return resp(200, { jobPostings: [{ title: 'Associate Director, Product Owner', locationsText: 'Chennai, India', externalPath: '/job/Chennai/PO_R-1' }] });
  if (/api\.telegram\.org\/bot[^/]+\/sendMessage/.test(url)) { if (telegram.fail) return resp(401, { ok: false, description: telegram.fail }); telegram.sent.push(JSON.parse(opt.payload).text); return resp(200, { ok: true }); }
  if (/api\.telegram\.org\/bot[^/]+\/getUpdates/.test(url)) return resp(200, { ok: true, result: [{ message: { chat: { id: 987654321 }, text: 'hi' } }] });
  return resp(404, '');
}
const alerts = [];
const ctx = {
  console,
  SpreadsheetApp: { getActive: () => ss, getUi: () => ({ alert: (...a) => alerts.push(a.join(' ')), ButtonSet: { OK: 1 } }) },
  UrlFetchApp: { fetch: fakeFetch, fetchAll: (reqs) => reqs.map((r) => fakeFetch(r.url, r)) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  Utilities: { formatDate: (d) => new Date(d).toISOString().slice(0, 16) },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => {} }), everyHours: () => ({ create: () => {} }) }) }) },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8') + '\n;this.X={run_,makeFilter_,slugs_,parseWorkday_,findChatId,settings_,T,CC};', ctx);
const X = ctx.X;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };

/* ---------- set up tabs like buildTemplate does ---------- */
const se = ss.insertSheet(X.T.SETTINGS);
se.getRange(1, 1, 10, 2).setValues([['Setting', 'Your value'], ['Telegram bot token', '123:abc'], ['Telegram chat ID', ''], ['Roles you want', 'Product Manager, Product Owner'], ['Skip titles containing', 'intern, sales'], ['Locations', 'India, Bengaluru, Bangalore, Remote'], ['Check every (minutes)', 30], ['Also match job descriptions', 'Yes'], ['', ''], ['Last run', '']]);
const co = ss.insertSheet(X.T.COMPANIES);
co.getRange(1, 1, 5, 2).setValues([['Company', 'Workday'], ['Atlassian', ''], ['Meesho', ''], ['Nowhere Ltd', ''], ['AstraZeneca', 'https://astrazeneca.wd3.myworkdayjobs.com/en-US/Careers']]);
ss.insertSheet(X.T.ALERTS).getRange(1, 1, 1, 6).setValues([['Found', 'Company', 'Job title', 'Location', 'Link', 'Matched in']]); ss.insertSheet(X.T.LOG);

t('filter: roles, skip words, locations', () => {
  const f = X.makeFilter_({ roles: ['Product Manager', 'Business Analyst'], skip: ['intern'], locations: ['Bengaluru', 'Remote'], matchDescription: true });
  assert.ok(f.title('Senior Product Manager, AI'));
  assert.ok(!f.title('Product Marketing Manager'));
  assert.ok(f.titleSkipped('Product Manager Intern'));
  assert.ok(f.location('Bengaluru, Karnataka') && f.location('3 Locations') && !f.location('London'));
  assert.ok(X.makeFilter_({ roles: ['PM'], skip: [], locations: [], matchDescription: true }).location('Anywhere'));
  assert.ok(f.description('You will work as a business analyst on…'));
  assert.ok(!X.makeFilter_({ roles: ['Business Analyst'], skip: [], locations: [], matchDescription: false }).description('business analyst'));
});

t('slugs and Workday links', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(X.slugs_('Thermo Fisher Scientific'))), ['thermofisherscientific', 'thermo-fisher-scientific', 'thermo']);
  assert.strictEqual(X.parseWorkday_('https://astrazeneca.wd3.myworkdayjobs.com/en-US/Careers/job/x').site, 'Careers');
  assert.strictEqual(X.parseWorkday_('https://example.com/careers'), null);
});

t('find chat ID fills Settings', () => {
  X.findChatId();
  assert.strictEqual(String(se.cell(3, 2)), '987654321');
});

t('first run: finds boards, records existing jobs, sends nothing', () => {
  X.run_(false);
  const status = [2, 3, 4, 5].map((r) => co.cell(r, X.CC.STATUS));
  assert.ok(/Greenhouse/.test(status[0]) && /Lever/.test(status[1]) && /Not found/.test(status[2]) && /Workday/.test(status[3]), status.join(' | '));
  assert.strictEqual(telegram.sent.length, 0);
  assert.strictEqual(sheets[X.T.ALERTS].getLastRow(), 1);
  assert.ok(/0 new/.test(se.cell(10, 2)), se.cell(10, 2));
});

t('second run: only NEW matching jobs are alerted', () => {
  boards.atlassian.jobs.push({ id: 2, title: 'Product Owner', location: { name: 'Remote - India' }, absolute_url: 'https://x/2', content: '' });
  boards.atlassian.jobs.push({ id: 3, title: 'Sales Manager', location: { name: 'Bengaluru' }, absolute_url: 'https://x/3', content: 'product manager' });
  boards.atlassian.jobs.push({ id: 4, title: 'Product Manager', location: { name: 'London' }, absolute_url: 'https://x/4', content: '' });
  boards.atlassian.jobs.push({ id: 5, title: 'Strategy Lead', location: { name: 'Bengaluru' }, absolute_url: 'https://x/5', content: 'As a product manager you will…' });
  X.run_(false);
  assert.strictEqual(telegram.sent.length, 1);
  assert.ok(/2 new jobs/.test(telegram.sent[0]) && /Product Owner — Atlassian/.test(telegram.sent[0]) && /Strategy Lead.*matched in description/.test(telegram.sent[0]), telegram.sent[0]);
  assert.strictEqual(sheets[X.T.ALERTS].getLastRow(), 3);
});

t('third run: nothing new → no message; open-job count shown', () => {
  X.run_(false);
  assert.strictEqual(telegram.sent.length, 1);
  assert.strictEqual(co.cell(2, X.CC.OPEN), 5);
});

t('Telegram errors are shown in Settings → Last run', () => {
  telegram.fail = 'Unauthorized';
  boards.atlassian.jobs.push({ id: 6, title: 'Group Product Manager', location: { name: 'Bengaluru' }, absolute_url: 'https://x/6', content: '' });
  X.run_(false);
  assert.ok(/Unauthorized/.test(se.cell(10, 2)), se.cell(10, 2));
});

console.log(n + ' tests passed (' + fetchCount + ' fake web requests)');
