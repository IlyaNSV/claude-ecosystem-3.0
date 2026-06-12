#!/usr/bin/env node
/**
 * app-map-html.js — generate the self-contained App Map USER FLOW walker.
 * Output: .product/app-map.html — single file, zero external deps (inline CSS + viewer JS +
 * base64 PNG thumbnails). Drift-safe: built from scan() + NM flows (app-map-flow) + committed
 * PNGs (app-map-assets) + the CJM §5 table of app-map.md. Never hand-edited.
 *
 * Usage: node app-map-html.js [--root .] [--out .product/app-map.html] [--assets .product/app-map-assets]
 * Exit: 0 ok, 2 error.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { scan } = require('./app-map-scan.js');
const { extractFlow } = require('./app-map-flow.js');

function findRoot(start) {
  let d = path.resolve(start);
  while (d !== path.parse(d).root) { if (fs.existsSync(path.join(d, '.claude')) && fs.existsSync(path.join(d, '.product'))) return d; d = path.dirname(d); }
  return null;
}
function nmFileFor(mockupsDir, nmId) {
  if (!fs.existsSync(mockupsDir)) return null;
  const f = fs.readdirSync(mockupsDir).find((x) => x === nmId + '.md' || (x.startsWith(nmId + '-') && x.endsWith('.md')));
  return f ? path.join(mockupsDir, f) : null;
}
// Canonical thumbnails (committed, OD-independent): .product/mockups/assets/<fm>/SI-N.png
// (canonical layout — same dir as SI-N.html). Falls back to legacy app-map-assets/<FM>-<SI>.png.
function imgDataUri(root, legacyDir, feature, si) {
  const canonical = path.join(root, '.product', 'mockups', 'assets', feature.toLowerCase().replace(/-/g, ''), si + '.png');
  const legacy = path.join(legacyDir, feature + '-' + si + '.png');
  const p = fs.existsSync(canonical) ? canonical : (fs.existsSync(legacy) ? legacy : null);
  if (!p) return null;
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
}
// parse the §5 "CJM & Pain" markdown table: | Стадия | Модули | Эмоция | Боль |
function parseCjm(amContent) {
  const sec = /#{1,4}[^\n]*CJM[\s\S]*?(?=\n#{1,4}\s|<!--\s*AM:GEN:END|$)/i.exec(amContent);
  if (!sec) return [];
  const rows = [];
  sec[0].split(/\r?\n/).forEach((line) => {
    if (!/^\s*\|/.test(line)) return;
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 4) return;
    if (/^-+$/.test(c[0]) || /^\s*Стадия\s*$/i.test(c[0])) return;
    rows.push({ stage: c[0], modules: c[1], emotion: c[2], pain: c[3] });
  });
  return rows;
}

function main() {
  const argv = process.argv;
  let root = null, out = null, assets = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--out') out = argv[++i];
    else if (argv[i] === '--assets') assets = argv[++i];
  }
  root = root ? path.resolve(root) : findRoot(process.cwd());
  if (!root) { process.stderr.write('ERROR: no project root\n'); process.exit(2); }
  const mockupsDir = path.join(root, '.product', 'mockups');
  const assetsDir = assets ? path.resolve(assets) : path.join(root, '.product', 'app-map-assets');
  const outPath = out ? path.resolve(out) : path.join(root, '.product', 'app-map.html');
  const amPath = path.join(root, '.product', 'app-map.md');
  const amContent = fs.existsSync(amPath) ? fs.readFileSync(amPath, 'utf-8') : '';

  const s = scan(root);
  const titleM = /^title:\s*"?(.+?)"?\s*$/m.exec(amContent);
  const title = titleM ? titleM[1] : 'App Map';

  const features = [];
  s.modules.forEach((m) => {
    if (!m.nm_present) return;
    const nmId = m.nm[0];
    const nmFile = nmFileFor(mockupsDir, nmId);
    if (!nmFile) return;
    const flow = extractFlow(fs.readFileSync(nmFile, 'utf-8'));
    flow.screens.forEach((sc) => { sc.img = imgDataUri(root, assetsDir, m.id, sc.id); });
    features.push({ id: m.id, title: m.short || m.title, role: m.nm_present ? 'live' : 'planned',
      screens: flow.screens, edges: flow.edges, externals: flow.externals });
  });

  const DATA = {
    title: title,
    generated: new Date().toISOString().slice(0, 10),
    modules: s.modules.map((m) => ({ id: m.id, short: m.short, title: m.title, nm: m.nm, nm_present: m.nm_present })),
    features: features,
    cjm: parseCjm(amContent),
  };

  const viewerJs = fs.readFileSync(path.join(__dirname, 'app-map-viewer.js'), 'utf-8');
  const html = buildHtml(DATA, viewerJs);
  fs.writeFileSync(outPath, html);

  const px = features.reduce((a, f) => a + f.screens.filter((x) => x.img).length, 0);
  process.stdout.write(JSON.stringify({
    out: outPath.replace(/\\/g, '/'), bytes: fs.statSync(outPath).size,
    features: features.map((f) => ({ id: f.id, screens: f.screens.length, with_png: f.screens.filter((x) => x.img).length, edges: f.edges.length })),
    screens_with_pixels: px, cjm_stages: DATA.cjm.length,
  }, null, 2) + '\n');
  process.exit(0);
}

function buildHtml(DATA, viewerJs) {
  const css = CSS; // eslint-disable-line no-use-before-define -- const hoisting safe: main() runs after module load
  const json = JSON.stringify(DATA);
  return '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1"/>'
    + '<title>' + (DATA.title || 'App Map').replace(/</g, '&lt;') + '</title>'
    + '<style>' + css + '</style></head><body>'
    + '<header><h1 id="title"></h1><div id="sub" class="sub"></div></header>'
    + '<section id="cjm" class="band"></section>'
    + '<section id="modules" class="band"></section>'
    + '<nav id="tabs" class="tabs"></nav>'
    + '<main><div id="graph" class="graph"></div></main>'
    + '<div id="lb" class="lb"><div class="lb-box">'
    + '<button id="lb-close" class="lb-close" title="Esc">✕</button>'
    + '<div class="lb-head"><button id="lb-prev" class="nav">◀ Prev</button><div id="lb-stage" class="lb-stage"></div><button id="lb-next-btn" class="nav">Next ▶</button></div>'
    + '<div class="lb-body"><div id="lb-img" class="lb-img"></div><div class="lb-side"><h3 id="lb-title"></h3><div id="lb-next"></div></div></div>'
    + '</div></div>'
    + '<script>const DATA=' + json + ';</script>'
    + '<script>' + viewerJs + '</script></body></html>';
}

const CSS = [
  '*{box-sizing:border-box}body{margin:0;font:14px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1c2433;background:#f4f6fb}',
  'header{padding:18px 24px 6px}h1{margin:0;font-size:22px;color:#0b3aa6}.sub{color:#6b7488;font-size:12px;margin-top:2px}',
  '.band{padding:10px 24px;border-bottom:1px solid #e6eaf2}.band-h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#8a93a8;margin-bottom:8px}',
  '.band-row{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap}',
  '.stage{background:#fff6e5;border:1px solid #e8c878;border-radius:10px;padding:8px 12px;min-width:120px;max-width:200px}.stage .emo{font-size:20px}.stage b{display:block;color:#7a5800}.stage .mods{font-size:11px;color:#9a7b2e}.stage .pain{font-size:11px;color:#8a6a2a;margin-top:4px;font-style:italic}',
  '.band-row .arr{align-self:center;color:#d99a00;font-size:18px}',
  '.mod{background:#dbe1ff;border:2px solid #2f59c6;border-radius:10px;padding:8px 12px;min-width:120px}.mod.planned{background:#f3f3f3;border:2px dashed #9aa0ae;color:#6b6f7d}.mod b{color:#0b3aa6}.mod.planned b{color:#6b6f7d}.mod .mt{font-size:12px}.mod .role{font-size:11px;color:#7a8198;margin-top:3px}',
  '.tabs{display:flex;gap:8px;padding:12px 24px 0;flex-wrap:wrap}.tab{cursor:pointer;border:1px solid #cdd5e6;background:#fff;border-radius:8px 8px 0 0;padding:8px 14px;font:inherit;color:#384;color:#33415c}.tab.on{border-bottom-color:#fff;background:#fff;font-weight:600;color:#0b3aa6;box-shadow:0 -2px 0 #2f59c6 inset}.tab .px{background:#1f8a4d;color:#fff;border-radius:4px;padding:1px 5px;font-size:10px}.tab .st{background:#9aa0ae;color:#fff;border-radius:4px;padding:1px 5px;font-size:10px}',
  'main{padding:0 24px 40px}.graph{position:relative;overflow:auto;border:1px solid #e6eaf2;border-top:none;background:#fff;background-image:radial-gradient(#eef1f7 1px,transparent 1px);background-size:22px 22px;min-height:420px}',
  '.canvas{position:relative}.arrows{position:absolute;left:0;top:0;pointer-events:none}.edge{fill:none;stroke:#7a8aa8;stroke-width:1.6}.edge.ext{stroke:#b08400;stroke-dasharray:5 4}',
  '.edge-label{position:absolute;transform:translate(-50%,-50%);background:#fff;border:1px solid #dde3ef;border-radius:6px;padding:1px 6px;font-size:11px;color:#46506a;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.edge-label.ext{border-color:#e8c878;color:#8a6a2a}.edge-label .g{color:#9aa0ae}',
  '.card{position:absolute;background:#fff;border:1px solid #cdd5e6;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(20,40,90,.08);cursor:pointer;transition:box-shadow .12s,transform .12s}.card.screen:hover{box-shadow:0 6px 18px rgba(20,40,90,.18);transform:translateY(-2px);border-color:#2f59c6}',
  '.card .thumb{width:100%;height:110px;object-fit:cover;object-position:top;display:block;background:#eef1f7}.card .thumb.ph{display:flex;flex-direction:column;align-items:center;justify-content:center;color:#9aa0ae;font-size:12px;text-align:center}.card .cap{padding:5px 8px;font-size:12px;border-top:1px solid #eef1f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card .cap b{color:#0b3aa6}',
  '.card.ext{background:#fffdf5;border:1px dashed #e8c878;cursor:default;display:flex;align-items:center;justify-content:center}.card.ext .extbody{color:#8a6a2a;text-align:center;padding:8px;font-size:13px}',
  '.empty{padding:40px;color:#8a93a8}',
  '.lb{position:fixed;inset:0;background:rgba(16,24,44,.62);display:none;align-items:center;justify-content:center;z-index:50}.lb.on{display:flex}.lb-box{background:#fff;border-radius:12px;width:min(1100px,94vw);height:min(86vh,860px);display:flex;flex-direction:column;overflow:hidden;position:relative}',
  '.lb-close{position:absolute;right:10px;top:8px;border:none;background:#eef1f7;border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:15px;z-index:2}',
  '.lb-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #e6eaf2}.lb-head .nav{cursor:pointer;border:1px solid #cdd5e6;background:#fff;border-radius:8px;padding:6px 14px;font:inherit}.lb-head .nav:hover{background:#f0f3fa}.lb-stage{color:#46506a;font-size:13px}.lb-stage b{color:#0b3aa6}',
  '.lb-body{flex:1;display:flex;min-height:0}.lb-img{flex:1;background:#0f1830;display:flex;align-items:center;justify-content:center;overflow:auto}.lb-img img{max-width:100%;max-height:100%;object-fit:contain;display:block}.bigph{color:#b9c2d8;text-align:center;font-size:15px}.bigph span{font-size:12px;color:#8a93a8}',
  '.lb-side{width:320px;border-left:1px solid #e6eaf2;padding:14px 16px;overflow:auto}.lb-side h3{margin:0 0 10px;color:#0b3aa6;font-size:15px}.lb-side h4{margin:6px 0;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#8a93a8}.lb-side ul{margin:0;padding-left:16px}.lb-side li{margin-bottom:8px}.lb-side .g{color:#9aa0ae}.muted{color:#9aa0ae;font-style:italic}',
].join('\n');

if (require.main === module) main();
module.exports = { parseCjm };
