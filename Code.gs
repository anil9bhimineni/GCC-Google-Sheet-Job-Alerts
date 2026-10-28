/**
 * CAREER PAGE JOB ALERTS — Google Sheet edition
 * Checks the careers pages of the companies you list (Greenhouse, Lever, Ashby, Workday) every
 * 30 minutes and sends new jobs that match your roles and locations to your Telegram.
 * Runs on Google's servers from this spreadsheet: nothing to install, works when your computer is off.
 *
 * Tabs:  Start here · Settings · Companies · Alerts · Log      Menu:  Job Alerts
 * MIT License · https://github.com/anil9bhimineni/career-page-job-alerts-sheet
 */

const APP = 'Job Alerts';
const T = { START: 'Start here', SETTINGS: 'Settings', COMPANIES: 'Companies', ALERTS: 'Alerts', LOG: 'Log', SEEN: '_seen' };
// Companies tab columns (1-based)
const CC = { NAME: 1, WORKDAY: 2, STATUS: 3, OPEN: 4, CHECKED: 5, BOARD: 6, PRIMED: 7 };
const LIMIT = { detectPerRun: 25, runMs: 270000, keepDays: 60, recheckDays: 7, fetchBatch: 40 };

/* =============================== settings =============================== */

function settings_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(T.SETTINGS);
  const raw = {};
  sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 2).getValues().forEach(([k, v]) => { if (k) raw[String(k).trim().toLowerCase()] = v; });
  const get = (k, d) => { const v = raw[k.toLowerCase()]; return v === '' || v == null ? d : v; };
  const list = (s) => String(s || '').split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);
  return {
    token: String(get('Telegram bot token', '')).trim(),
    chatId: String(get('Telegram chat ID', '')).trim(),
    roles: list(get('Roles you want', '')),
    skip: list(get('Skip titles containing', '')),
    locations: list(get('Locations', '')),
    minutes: Number(get('Check every (minutes)', 30)) === 60 ? 60 : 30,
    matchDescription: !/^no/i.test(String(get('Also match job descriptions', 'Yes'))),
  };
}

const esc_ = (s) => s.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
const phraseRx_ = (list) => (list.length ? new RegExp('\\b(' + list.map((p) => esc_(p).replace(/\s+/g, '\\s+')).join('|') + ')\\b', 'i') : null);

/** Build the job filter from Settings (pure: easy to test). */
function makeFilter_(cfg) {
  const roleRx = phraseRx_(cfg.roles);
  const skipRx = cfg.skip.length ? new RegExp(cfg.skip.map((w) => esc_(w).replace(/\s+/g, '\\s+')).join('|'), 'i') : null;
  const locRx = cfg.locations.length ? new RegExp(cfg.locations.map((l) => esc_(l).replace(/\s+/g, '\\s+')).join('|') + '|\\d+\\s+locations', 'i') : null;
  return {
    location: (loc) => !locRx || locRx.test(String(loc || '')),
    titleSkipped: (t) => !!(skipRx && skipRx.test(String(t || ''))),
    title: (t) => !!(roleRx && roleRx.test(String(t || ''))),
    description: (d) => !!(roleRx && cfg.matchDescription && roleRx.test(String(d || ''))),
  };
}

/* =============================== helpers =============================== */

const strip_ = (h) => String(h || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

function slugs_(name) {
  const b = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, '').replace(/&/g, 'and').replace(/'/g, '').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(india|inc|corp|corporation|group|technologies|technology|pvt|ltd|limited|online services|labs|the|company)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const v = [b.replace(/ /g, ''), b.replace(/ /g, '-'), b.split(' ')[0]];
  return [...new Set(v.filter((s) => s && s.length > 1))];
}

function parseWorkday_(url) {
  const m = String(url || '').trim().match(/^https:\/\/([^.]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)/);
  return m ? { tenant: m[1], wd: m[2], site: m[3], host: 'https://' + m[1] + '.' + m[2] + '.myworkdayjobs.com' } : null;
}

/** Fetch many URLs in parallel; returns parsed JSON (or null) per request. */
function fetchAllJson_(reqs) {
  const out = [];
  for (let i = 0; i < reqs.length; i += LIMIT.fetchBatch) {
    const batch = reqs.slice(i, i + LIMIT.fetchBatch).map((r) => Object.assign({ muteHttpExceptions: true, followRedirects: true }, r));
    let res = [];
    try { res = UrlFetchApp.fetchAll(batch); } catch (e) { res = batch.map(() => null); }
    res.forEach((r) => {
      try { out.push(r && r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null); } catch (e) { out.push(null); }
    });
  }
  return out;
}

function log_(msg) {
  const sh = SpreadsheetApp.getActive().getSheetByName(T.LOG);
  if (!sh) return;
  sh.insertRowBefore(2);
  sh.getRange(2, 1, 1, 2).setValues([[new Date(), String(msg).slice(0, 1000)]]);
  if (sh.getLastRow() > 300) sh.deleteRows(301, sh.getLastRow() - 300);
}
function setStatus_(text) {
  const sh = SpreadsheetApp.getActive().getSheetByName(T.SETTINGS);
  const r = sh.getRange('A:A').getValues().findIndex(([v]) => v === 'Last run');
  if (r >= 0) sh.getRange(r + 1, 2).setValue(text);
}

/* =============================== telegram =============================== */

function telegram_(cfg, text) {
  if (!cfg.token || !cfg.chatId) return 'Telegram bot token or chat ID is empty (Settings tab)';
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ chat_id: cfg.chatId, text, disable_web_page_preview: true }),
  });
  if (res.getResponseCode() === 200) return '';
  let d = res.getContentText();
  try { d = JSON.parse(d).description || d; } catch (e) { /* keep */ }
  return 'Telegram: ' + d;
}

/** Splits a long list of jobs into Telegram-sized messages. Returns '' or the first error. */
function sendJobs_(cfg, jobs) {
  const lines = jobs.map((j) => '• ' + j.title + ' — ' + j.company + (j.location ? ' (' + j.location + ')' : '') + (j.why ? ' [' + j.why + ']' : '') + '\n' + j.url);
  let msg = '🆕 ' + jobs.length + ' new job' + (jobs.length === 1 ? '' : 's') + '\n\n';
  let err = '';
  lines.forEach((l) => {
    if ((msg + l).length > 3800) { err = err || telegram_(cfg, msg); msg = ''; }
    msg += l + '\n\n';
  });
  if (msg.trim()) err = err || telegram_(cfg, msg);
  return err;
}

/* =============================== main run =============================== */

function scheduledRun() { run_(false); }
function runNow() { run_(true); }

function run_(manual) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) { if (manual) toast_('Already running. Try again in a minute.'); return; }
  const t0 = Date.now();
  try {
    const cfg = settings_();
    if (!cfg.roles.length) throw new Error('Fill in "Roles you want" on the Settings tab');
    const filter = makeFilter_(cfg);
    const ss = SpreadsheetApp.getActive();
    const csh = ss.getSheetByName(T.COMPANIES);
    const n = Math.max(csh.getLastRow() - 1, 0);
    const rows = n ? csh.getRange(2, 1, n, CC.PRIMED).getValues() : [];
    const now = Date.now();

    // 1) Find each company's job board (a few per run; 'not found' re-checked weekly)
    const needs = [];
    rows.forEach((r, i) => {
      if (!String(r[CC.NAME - 1]).trim() || parseWorkday_(r[CC.WORKDAY - 1])) return;
      let b = {}; try { b = JSON.parse(r[CC.BOARD - 1] || '{}'); } catch (e) { b = {}; }
      if (!b.type || (b.type === 'none' && now - (b.at || 0) > LIMIT.recheckDays * 864e5) || b.name !== String(r[CC.NAME - 1]).trim()) needs.push(i);
    });
    needs.slice(0, LIMIT.detectPerRun).forEach((i) => {
      const name = String(rows[i][CC.NAME - 1]).trim();
      rows[i][CC.BOARD - 1] = JSON.stringify(Object.assign(detect_(name), { name, at: now }));
      rows[i][CC.PRIMED - 1] = '';
    });

    // 2) Fetch every known board in parallel
    const feeds = [];
    rows.forEach((r, i) => {
      const name = String(r[CC.NAME - 1]).trim();
      if (!name) return;
      const wd = parseWorkday_(r[CC.WORKDAY - 1]);
      if (wd) { cfg.roles.slice(0, 5).forEach((q) => feeds.push({ i, name, kind: 'workday', wd, req: { url: wd.host + '/wday/cxs/' + wd.tenant + '/' + wd.site + '/jobs', method: 'post', contentType: 'application/json', payload: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: q }) } })); return; }
      let b = {}; try { b = JSON.parse(r[CC.BOARD - 1] || '{}'); } catch (e) { b = {}; }
      if (b.type === 'greenhouse') feeds.push({ i, name, kind: b.type, req: { url: 'https://boards-api.greenhouse.io/v1/boards/' + b.slug + '/jobs?content=true' } });
      if (b.type === 'lever') feeds.push({ i, name, kind: b.type, req: { url: 'https://api.lever.co/v0/postings/' + b.slug + '?mode=json' } });
      if (b.type === 'ashby') feeds.push({ i, name, kind: b.type, req: { url: 'https://api.ashbyhq.com/posting-api/job-board/' + b.slug } });
    });
    const results = fetchAllJson_(feeds.map((f) => f.req));
    const jobs = [];
    const counts = {};
    feeds.forEach((f, k) => {
      const r = results[k];
      if (!r) return;
      const add = (key, title, location, url, desc) => { jobs.push({ i: f.i, key, company: f.name, title: String(title || ''), location: String(location || '').trim(), url, desc }); (counts[f.i] = counts[f.i] || new Set()).add(key); };
      if (f.kind === 'greenhouse') (r.jobs || []).forEach((j) => add('gh:' + j.id, j.title, j.location && j.location.name, j.absolute_url, strip_(j.content)));
      if (f.kind === 'lever') (Array.isArray(r) ? r : []).forEach((j) => add('lv:' + j.id, j.text, ((j.categories && j.categories.location) || '') + ' ' + (j.workplaceType || ''), j.hostedUrl, (j.descriptionPlain || '') + ' ' + (j.lists || []).map((x) => strip_(x.content)).join(' ')));
      if (f.kind === 'ashby') (r.jobs || []).forEach((j) => add('ab:' + j.jobUrl, j.title, (j.location || '') + (j.isRemote ? ' Remote' : ''), j.jobUrl, j.descriptionPlain || strip_(j.descriptionHtml)));
      if (f.kind === 'workday') (r.jobPostings || []).forEach((j) => add('wd:' + f.wd.tenant + ':' + j.externalPath, j.title, j.locationsText, f.wd.host + '/' + f.wd.site + j.externalPath, ''));
    });

    // 3) Keep new, matching jobs (a company's first check only records what is already posted)
    const seen = seenLoad_();
    const fresh = [];
    const added = [];
    jobs.forEach((j) => {
      if (seen.has(j.key)) return;
      seen.add(j.key); added.push(j.key);
      if (!rows[j.i][CC.PRIMED - 1]) return;
      if (!filter.location(j.location) || filter.titleSkipped(j.title)) return;
      if (filter.title(j.title)) fresh.push(j);
      else if (filter.description(j.desc)) { j.why = 'matched in description'; fresh.push(j); }
    });
    seenAdd_(added);

    // 4) Update the Companies tab
    rows.forEach((r, i) => {
      if (!String(r[CC.NAME - 1]).trim()) return;
      const wd = parseWorkday_(r[CC.WORKDAY - 1]);
      let b = {}; try { b = JSON.parse(r[CC.BOARD - 1] || '{}'); } catch (e) { b = {}; }
      const fetched = feeds.some((f) => f.i === i && results[feeds.indexOf(f)]);
      r[CC.STATUS - 1] = wd ? (fetched ? '✅ Workday' : '⚠️ Workday link not working, check it')
        : b.type && b.type !== 'none' ? '✅ ' + b.type.charAt(0).toUpperCase() + b.type.slice(1)
        : b.type === 'none' ? '❌ Not found: add its Workday link in column B, or remove' : '⏳ Checking soon';
      r[CC.OPEN - 1] = fetched ? (counts[i] ? counts[i].size : 0) : '';
      if (fetched) { r[CC.CHECKED - 1] = new Date(); r[CC.PRIMED - 1] = 'yes'; }
    });
    if (n) csh.getRange(2, 1, n, CC.PRIMED).setValues(rows);

    // 5) Alerts tab + Telegram
    let err = '';
    if (fresh.length) {
      const ash = ss.getSheetByName(T.ALERTS);
      ash.insertRowsBefore(2, fresh.length);
      ash.getRange(2, 1, fresh.length, 6).setValues(fresh.map((j) => [new Date(), j.company, j.title, j.location, j.url, j.why || 'title']));
      err = sendJobs_(cfg, fresh);
    }
    const watching = rows.filter((r) => /^✅/.test(r[CC.STATUS - 1])).length;
    const summary = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'd MMM HH:mm') + ' · ' + fresh.length + ' new · watching ' + watching + ' of ' + rows.filter((r) => String(r[CC.NAME - 1]).trim()).length + ' companies' + (err ? ' · ⚠️ ' + err : '');
    setStatus_(summary);
    log_('Run: ' + jobs.length + ' jobs checked, ' + fresh.length + ' new' + (err ? ' — ' + err : '') + ' (' + Math.round((Date.now() - t0) / 1000) + 's)');
    if (manual) toast_(fresh.length + ' new job(s). ' + (err || 'See the Alerts and Companies tabs.'));
  } catch (e) {
    log_('Stopped: ' + e.message);
    setStatus_('⚠️ ' + e.message);
    if (manual) toast_(e.message);
  } finally {
    lock.releaseLock();
  }
}

/** Which public job board does this company use? */
function detect_(name) {
  const ss = slugs_(name);
  const first = (ss[0] || '').slice(0, 4);
  const reqs = [];
  ss.forEach((s) => {
    reqs.push({ kind: 'greenhouse', slug: s, url: 'https://boards-api.greenhouse.io/v1/boards/' + s });
    reqs.push({ kind: 'lever', slug: s, url: 'https://api.lever.co/v0/postings/' + s + '?mode=json&limit=1' });
    reqs.push({ kind: 'ashby', slug: s, url: 'https://api.ashbyhq.com/posting-api/job-board/' + s });
  });
  const res = fetchAllJson_(reqs.map((r) => ({ url: r.url })));
  for (let k = 0; k < reqs.length; k++) {
    const r = res[k];
    const q = reqs[k];
    if (q.kind === 'greenhouse' && r && r.name && String(r.name).toLowerCase().indexOf(first) >= 0) return { type: 'greenhouse', slug: q.slug };
    if (q.kind === 'lever' && Array.isArray(r) && r.length) return { type: 'lever', slug: q.slug };
    if (q.kind === 'ashby' && r && Array.isArray(r.jobs)) return { type: 'ashby', slug: q.slug };
  }
  return { type: 'none' };
}

/* =============================== memory of seen jobs =============================== */

function seenSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(T.SEEN);
  if (!sh) { sh = ss.insertSheet(T.SEEN); sh.hideSheet(); }
  return sh;
}
function seenLoad_() {
  const sh = seenSheet_();
  const n = sh.getLastRow();
  if (!n) return new Set();
  const vals = sh.getRange(1, 1, n, 2).getValues();
  const cutoff = Date.now() - LIMIT.keepDays * 864e5;
  const keep = vals.filter((r) => r[0] && new Date(r[1]).getTime() > cutoff);
  if (keep.length < vals.length) { // forget jobs older than 60 days
    sh.clearContents();
    if (keep.length) sh.getRange(1, 1, keep.length, 2).setValues(keep);
  }
  return new Set(keep.map((r) => String(r[0])));
}
function seenAdd_(keys) {
  if (!keys.length) return;
  const sh = seenSheet_();
  const now = new Date();
  sh.getRange(sh.getLastRow() + 1, 1, keys.length, 2).setValues(keys.map((k) => [k, now]));
}

/* =============================== menu & setup =============================== */

function onOpen() {
  if (!SpreadsheetApp.getActive().getSheetByName(T.SETTINGS)) buildTemplate();
  SpreadsheetApp.getUi().createMenu(APP)
    .addItem('1. Find my Telegram chat ID', 'findChatId')
    .addItem('2. Send a test message', 'testTelegram')
    .addItem('3. Start alerts', 'startAlerts')
    .addSeparator()
    .addItem('Check now', 'runNow')
    .addItem('Stop alerts', 'stopAlerts')
    .addToUi();
}

function toast_(m) { SpreadsheetApp.getActive().toast(m, APP, 8); }

/** Reads the latest message sent to the user's bot and fills in the chat ID. */
function findChatId() {
  const ui = SpreadsheetApp.getUi();
  const cfg = settings_();
  if (!cfg.token) { ui.alert('First paste your bot token into Settings → "Telegram bot token".'); return; }
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/getUpdates', { muteHttpExceptions: true });
  let j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) { j = {}; }
  if (!j.ok) { ui.alert('Telegram did not accept the bot token. Copy it again from @BotFather.\n\n' + (j.description || '')); return; }
  const msgs = (j.result || []).map((u) => u.message || u.edited_message || u.my_chat_member).filter(Boolean);
  const chat = msgs.length ? msgs[msgs.length - 1].chat : null;
  if (!chat) { ui.alert('No message found yet.\n\nOpen your bot in Telegram, press START (or send it "hi"), then choose this menu item again.'); return; }
  const sh = SpreadsheetApp.getActive().getSheetByName(T.SETTINGS);
  const r = sh.getRange('A:A').getValues().findIndex(([v]) => v === 'Telegram chat ID');
  sh.getRange(r + 1, 2).setValue(String(chat.id));
  ui.alert('Found it ✅  Your chat ID ' + chat.id + ' has been filled in.\n\nNext: Job Alerts → 2. Send a test message');
}

function testTelegram() {
  const err = telegram_(settings_(), '✅ Job Alerts is connected. New jobs will arrive here.');
  SpreadsheetApp.getUi().alert(err ? 'Not sent ❌\n\n' + err + '\n\nCheck the bot token and chat ID on the Settings tab.' : 'Sent ✅  Check Telegram.\n\nNext: Job Alerts → 3. Start alerts');
}

function startAlerts() {
  const cfg = settings_();
  const ui = SpreadsheetApp.getUi();
  const problems = [];
  if (!cfg.token || !cfg.chatId) problems.push('Telegram bot token and chat ID (Settings tab)');
  if (!cfg.roles.length) problems.push('Roles you want (Settings tab)');
  const csh = SpreadsheetApp.getActive().getSheetByName(T.COMPANIES);
  if (csh.getLastRow() < 2) problems.push('at least one company (Companies tab)');
  if (problems.length) { ui.alert('Please fill in first:\n\n• ' + problems.join('\n• ')); return; }
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  const tb = ScriptApp.newTrigger('scheduledRun').timeBased();
  (cfg.minutes === 60 ? tb.everyHours(1) : tb.everyMinutes(30)).create();
  log_('Alerts started: every ' + cfg.minutes + ' minutes.');
  ui.alert('Started ✅', 'Job Alerts now checks your companies every ' + cfg.minutes + ' minutes, even when your computer is off.\n\nThe first checks only record jobs that are already posted, so your first alerts arrive when NEW jobs appear (usually within a day). Watch progress on the Companies tab.', ui.ButtonSet.OK);
  run_(true);
}

function stopAlerts() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  log_('Alerts stopped.');
  SpreadsheetApp.getUi().alert('Stopped. Nothing will run until you choose Job Alerts → 3. Start alerts.');
}

/** Creates the tabs on a blank spreadsheet (runs automatically the first time it is opened). */
function buildTemplate() {
  const ss = SpreadsheetApp.getActive();
  const tab = (name) => ss.getSheetByName(name) || ss.insertSheet(name);
  const teal = '#2F6F73', yellow = '#FFF4CC';

  const st = tab(T.START);
  st.clear();
  const guide = [
    ['CAREER PAGE JOB ALERTS', ''],
    ['Get a Telegram message within 30 minutes of a matching job appearing on your favourite companies\' career pages. Runs on Google, free, even when your computer is off.', ''],
    ['', ''],
    ['STEP 1', 'In Telegram, open @BotFather → send /newbot → choose any name and a username ending in "bot". Copy the long TOKEN it sends you.'],
    ['STEP 2', 'Paste the token into the Settings tab → "Telegram bot token".'],
    ['STEP 3', 'In Telegram, open YOUR new bot (BotFather sends a link) and press START.'],
    ['STEP 4', 'Here, click the menu  Job Alerts → 1. Find my Telegram chat ID.  Google asks for permission the first time: Continue → choose your account → Advanced → Go to (unsafe) → Allow. Then click the menu item again.'],
    ['STEP 5', 'Settings tab: type the roles you want, words to skip, and your locations.'],
    ['STEP 6', 'Companies tab: replace the examples with your companies (one per row). Workday careers links go in column B (optional).'],
    ['STEP 7', 'Job Alerts → 2. Send a test message. Got it on Telegram? Then Job Alerts → 3. Start alerts. Done!'],
    ['', ''],
    ['GOOD TO KNOW', '• No alerts on the first day is normal: it first records the jobs already posted, then alerts you about NEW ones.\n• The Companies tab shows which companies are being watched (✅) and which need a Workday link (❌).\n• Every alert is also saved on the Alerts tab.\n• To pause: Job Alerts → Stop alerts.'],
  ];
  st.getRange(1, 1, guide.length, 2).setValues(guide);
  st.getRange('A1:B1').merge(); st.getRange('A2:B2').merge();
  st.getRange('A1').setFontSize(20).setFontWeight('bold').setFontColor(teal);
  st.getRange('A2').setWrap(true).setFontColor('#555555');
  st.getRange('A4:A12').setFontWeight('bold').setFontColor(teal).setVerticalAlignment('top');
  st.getRange('B4:B12').setWrap(true).setVerticalAlignment('top');
  st.setColumnWidth(1, 130); st.setColumnWidth(2, 720); st.setRowHeight(2, 42);

  const se = tab(T.SETTINGS);
  se.clear();
  const rows = [
    ['Setting', 'Your value', 'Help'],
    ['Telegram bot token', '', 'From @BotFather (Start here → Step 1). Looks like 123456789:ABCdef…'],
    ['Telegram chat ID', '', 'Filled in for you by Job Alerts → 1. Find my Telegram chat ID'],
    ['Roles you want', 'Product Manager, Product Owner, Business Analyst', 'Job titles you want, separated by commas'],
    ['Skip titles containing', 'intern, sales, engineer, developer, recruiter', 'Words that mean "not for me", separated by commas'],
    ['Locations', 'India, Bengaluru, Bangalore, Hyderabad, Pune, Remote', 'Separated by commas. Leave empty for anywhere'],
    ['Check every (minutes)', 30, '30 or 60. Use 60 if you watch more than 150 companies'],
    ['Also match job descriptions', 'Yes', 'Yes = also alert when the role is named in the job description, not just the title'],
    ['', '', ''],
    ['Last run', '', 'Updated automatically after every check'],
  ];
  se.getRange(1, 1, rows.length, 3).setValues(rows);
  se.getRange('A1:C1').setFontWeight('bold').setBackground('#EAF2F2');
  se.getRange('B2:B8').setBackground(yellow);
  se.getRange('A2:A10').setFontWeight('bold');
  se.getRange('C2:C10').setFontColor('#666666').setWrap(true);
  se.getRange('B7').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['30', '60'], true).build());
  se.getRange('B8').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).build());
  se.setColumnWidth(1, 230); se.setColumnWidth(2, 420); se.setColumnWidth(3, 460); se.setFrozenRows(1);

  const co = tab(T.COMPANIES);
  co.clear();
  co.getRange(1, 1, 1, 7).setValues([['Company', 'Workday careers link (optional)', 'Status (automatic)', 'Open jobs', 'Last checked', '_board', '_primed']]);
  const examples = ['Atlassian', 'Datadog', 'Snowflake', 'Zendesk', 'Toast', 'Wayfair', 'Rubrik', 'Databricks'];
  co.getRange(2, 1, examples.length, 1).setValues(examples.map((c) => [c]));
  co.getRange(2 + examples.length, 1, 1, 2).setValues([['AstraZeneca', 'https://astrazeneca.wd3.myworkdayjobs.com/Careers']]);
  co.getRange('A1:E1').setFontWeight('bold').setBackground('#EAF2F2');
  co.getRange('A1:B1').setBackground('#FFE8A3');
  co.setColumnWidth(1, 220); co.setColumnWidth(2, 380); co.setColumnWidth(3, 330); co.setColumnWidth(5, 140);
  co.getRange('E2:E1000').setNumberFormat('d mmm hh:mm');
  co.hideColumns(6, 2); co.setFrozenRows(1);

  const al = tab(T.ALERTS);
  al.clear();
  al.getRange(1, 1, 1, 6).setValues([['Found', 'Company', 'Job title', 'Location', 'Link', 'Matched in']]).setFontWeight('bold').setBackground('#EAF2F2');
  al.getRange('A2:A5000').setNumberFormat('d mmm hh:mm');
  al.setColumnWidth(3, 340); al.setColumnWidth(5, 360); al.setFrozenRows(1);

  const lg = tab(T.LOG);
  lg.clear();
  lg.getRange(1, 1, 1, 2).setValues([['When', 'What happened']]).setFontWeight('bold');
  lg.setColumnWidth(2, 700);

  const s1 = ss.getSheetByName('Sheet1'); if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  [T.START, T.SETTINGS, T.COMPANIES, T.ALERTS, T.LOG].forEach((name, i) => { ss.setActiveSheet(ss.getSheetByName(name)); ss.moveActiveSheet(i + 1); });
  ss.setActiveSheet(st);
}
