// Deterministic headless smoke for the SHARED MAP SHELL on the command/artifact
// map (docs/guide/ecosystem-map.html). Sibling of procmap.smoke.mjs — that one
// covers the process map; this one covers the OTHER map now that the in-app
// UTF-8 doc-panel + switch-view navbar moved into the vendored map-shell.{js,css}
// (DEC-DEV-0132, doc-UX batch C3).
//
// Gates DETERMINISTICALLY: no JS errors · window.MapShell present · switch-view
// nav links to the process map · clicking a footer `.doclink` (a .md link that
// used to open as cp1251 «кракозябры») opens the in-app panel and the decoded
// body has intact Cyrillic. The screenshot is an artifact to READ, never the gate.
//
// SKIPS cleanly (exit 0) without a browser or puppeteer-core, so `npm run verify`
// never breaks for lack of a browser (same contract as procmap.smoke.mjs).
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const HTML = path.join(ROOT, 'docs', 'guide', 'ecosystem-map.html');

function findBrowser() {
  const fromEnv = [process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_PATH].filter(Boolean);
  const guesses = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const p of [...fromEnv, ...guesses]) {
    try { if (p && fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return null;
}

function skip(msg) { console.log('[skip] mapshell.smoke — ' + msg); process.exit(0); }

if (!fs.existsSync(HTML)) skip('generated map missing — run `npm run gen:map`: ' + HTML);
const exe = findBrowser();
if (!exe) skip('no Chrome/Edge found (set PUPPETEER_EXECUTABLE_PATH to enable)');

let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; }
catch { skip('puppeteer-core not installed'); }

const checks = [];
const ok = (cond, msg) => checks.push({ ok: !!cond, msg });

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--allow-file-access-from-files', '--no-sandbox', '--window-size=1680,1050', '--hide-scrollbars'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1050, deviceScaleFactor: 1 });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') jsErrors.push('console.error ' + m.text()); });

  const url = 'file:///' + HTML.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.waitForFunction(() => !!window.MapShell, { timeout: 15000 });

  // ── shared shell: API present + switch-view nav to the process map ──
  const shell = await page.evaluate(() => ({
    hasShell: !!window.MapShell && typeof window.MapShell.openDoc === 'function',
    navToProc: !!document.querySelector('.shell-nav a.shell-viewlink[href="ecosystem-processes.html"]'),
    current: !!document.querySelector('.shell-nav .shell-viewlink.is-current'),
  }));
  ok(shell.hasShell, 'shared shell (window.MapShell) loaded');
  ok(shell.navToProc, 'switch-view nav links to the process map (ecosystem-processes.html)');
  ok(shell.current, 'switch-view nav marks the current view (map)');

  // ── C1/C3: clicking a footer .md doclink opens the in-app panel with intact UTF-8 (no «кракозябры»).
  //    This is the fix for ecosystem-map's previously-mojibake command-source / SPEC / footer links. ──
  const doc = await page.evaluate(async () => {
    const link = document.querySelector('footer a.doclink[href="../pmo/processes.md"]')
      || document.querySelector('footer a.doclink');
    if (!link) return { clicked: false };
    link.click();  // exercises the shell's CAPTURE-phase delegation (real click, not a direct API call)
    const started = Date.now();
    return await new Promise((resolve) => {
      const poll = () => {
        const modal = document.getElementById('docModal');
        const open = !!modal && modal.classList.contains('open');
        const body = document.getElementById('docBody');
        const txt = (body && body.textContent || '').trim();
        if (open && txt && txt !== 'Загрузка…' && !/^Не удалось/.test(txt)) {
          resolve({ clicked: true, open, ok: true, sample: txt.replace(/\s+/g, ' ').slice(0, 160) });
        } else if (Date.now() - started > 8000) {
          resolve({ clicked: true, open, ok: false, sample: txt.slice(0, 160) });
        } else setTimeout(poll, 100);
      };
      poll();
    });
  });
  ok(doc.clicked, 'footer .md doclink present to intercept');
  ok(doc.open && doc.ok, `doclink opens the in-app preview (${doc.ok ? 'loaded' : 'FAILED: ' + (doc.sample || '')})`);
  const cyrillicOk = /Назначение|Версия|методолог/i.test(doc.sample || '');
  ok(cyrillicOk, `doc preview decodes UTF-8 (Cyrillic intact, no кракозябры): "${(doc.sample || '').slice(0, 56)}"`);

  // ── artifact screenshot (for human/agent eyes; NOT the gate) ──
  try {
    const shot = path.join(os.tmpdir(), 'mapshell-smoke.png');
    await page.screenshot({ path: shot });
    console.log('  screenshot: ' + shot);
  } catch { /* non-fatal */ }

  ok(jsErrors.length === 0, `no JS errors (got ${jsErrors.length}${jsErrors.length ? ': ' + jsErrors[0] : ''})`);

  for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.msg}`);
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) { console.error(`\nmapshell.smoke: ${failed.length} FAILED`); process.exitCode = 1; }
  else console.log(`\nmapshell.smoke: ✓ ${checks.length} checks passed`);
} finally {
  await browser.close();
}
