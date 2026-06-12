#!/usr/bin/env node
/**
 * app-map-thumbs.js — render screen PNG thumbnails for the App Map USER FLOW.
 *
 * Pipeline (reuses the od-fidelity-check approach): map SI-N → Open Design project UUID via
 * GET /api/projects (proxy :7457, tokenless) → `docker cp <container>:/app/.od/projects/<uuid>/
 * index.html` → headless Chrome --screenshot → .product/app-map-assets/<FEATURE>-<SI>.png.
 *
 * SI→project mapping (v1): match OD project by name === "SI-N" OR sourceFileName === "SI-N.zip"
 * (local imports). Dedup by latest createdAt. Unmapped SI (e.g. tool-generated project names that
 * don't carry the SI id) → reported, no PNG; the HTML generator falls back to a placeholder card.
 * Preferred OD-independent path: --html-dir (render committed SI-N.html directly).
 *
 * Usage: node app-map-thumbs.js --feature FM-002 --screens SI-1,SI-2,SI-3,SI-4 \
 *          [--container open-design] [--proxy http://127.0.0.1:7457] [--root .] \
 *          [--chrome "<path>"] [--out .product/app-map-assets]
 * Exit: 0 ok (даже если часть unmapped), 2 transport/tool error.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const DEFAULT_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function args(argv) {
  const a = { feature: null, screens: [], container: 'open-design', proxy: 'http://127.0.0.1:7457',
    root: '.', chrome: DEFAULT_CHROME, out: null, htmlDir: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--feature') a.feature = argv[++i];
    else if (k === '--screens') a.screens = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--container') a.container = argv[++i];
    else if (k === '--proxy') a.proxy = argv[++i];
    else if (k === '--root') a.root = argv[++i];
    else if (k === '--chrome') a.chrome = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--html-dir') a.htmlDir = argv[++i];   // render from committed SI-N.html (no OD)
  }
  return a;
}

function renderPng(chrome, htmlPath, pngPath) {
  const url = 'file:///' + path.resolve(htmlPath).replace(/\\/g, '/');
  execFileSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=1280,832', '--screenshot=' + pngPath, url],
    { stdio: 'ignore', timeout: 60000 });
  return fs.existsSync(pngPath);
}

function getProjects(proxy) {
  return new Promise((resolve, reject) => {
    http.get(proxy + '/api/projects', (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve((JSON.parse(d).projects) || []); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function pickProject(projects, si) {
  // si like "SI-2" → match name "SI-2" or sourceFileName "SI-2.zip"; latest createdAt wins
  const cands = projects.filter((p) => {
    const n = (p.name || '').trim();
    const src = (p.metadata && p.metadata.sourceFileName) || '';
    return n === si || src === si + '.zip' || n === si.replace('-', '');
  });
  if (!cands.length) return null;
  cands.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return cands[0];
}

async function main() {
  const a = args(process.argv);
  if (!a.feature || !a.screens.length) {
    process.stderr.write('Usage: node app-map-thumbs.js --feature FM-002 --screens SI-1,SI-2,...\n');
    process.exit(2);
  }

  // --- mode: render from committed HTML dir (no Open Design, fully reproducible) ---
  if (a.htmlDir) {
    const hd = path.resolve(a.htmlDir);
    const outD = a.out ? path.resolve(a.out) : hd;            // default: PNG next to SI-N.html (canonical layout)
    fs.mkdirSync(outD, { recursive: true });
    const rep = { feature: a.feature, mode: 'html-dir', src: hd.replace(/\\/g, '/'), rendered: [], missing: [], out_dir: outD.replace(/\\/g, '/') };
    for (const si of a.screens) {
      const html = path.join(hd, si + '.html');
      if (!fs.existsSync(html)) { rep.missing.push(si + ' (no html)'); continue; }
      const png = path.join(outD, si + '.png');
      try { renderPng(a.chrome, html, png); if (fs.existsSync(png)) rep.rendered.push({ si, png: png.replace(/\\/g, '/'), bytes: fs.statSync(png).size }); else rep.missing.push(si + ' (no png)'); }
      catch (e) { rep.missing.push(si + ' (render fail: ' + e.message + ')'); }
    }
    process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
    process.exit(0);
  }

  const root = path.resolve(a.root);
  const outDir = a.out ? path.resolve(a.out) : path.join(root, '.product', 'app-map-assets');
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'am-thumbs-'));

  let projects;
  try { projects = await getProjects(a.proxy); }
  catch (e) { process.stderr.write('ERROR: Open Design not reachable at ' + a.proxy + ' (' + e.message + '). Start: docker start open-design od-proxy\n'); process.exit(2); }

  const report = { feature: a.feature, mapped: {}, rendered: [], unmapped: [], out_dir: outDir.replace(/\\/g, '/') };

  for (const si of a.screens) {
    const proj = pickProject(projects, si);
    if (!proj) { report.unmapped.push(si); continue; }
    report.mapped[si] = proj.id;
    const htmlTmp = path.join(tmp, si + '.html');
    const png = path.join(outDir, a.feature + '-' + si + '.png');
    try {
      execFileSync('docker', ['cp', a.container + ':/app/.od/projects/' + proj.id + '/index.html', htmlTmp],
        { stdio: 'pipe', timeout: 30000 });
    } catch (e) { report.unmapped.push(si + ' (docker cp failed)'); continue; }
    try {
      const url = 'file:///' + path.resolve(htmlTmp).replace(/\\/g, '/');
      execFileSync(a.chrome, ['--headless', '--disable-gpu', '--hide-scrollbars',
        '--force-device-scale-factor=1', '--window-size=1280,832', '--screenshot=' + png, url],
        { stdio: 'ignore', timeout: 60000 });
      if (fs.existsSync(png)) report.rendered.push({ si, png: png.replace(/\\/g, '/'), bytes: fs.statSync(png).size });
      else report.unmapped.push(si + ' (no png produced)');
    } catch (e) { report.unmapped.push(si + ' (chrome render failed: ' + e.message + ')'); }
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(0);
}

main();
