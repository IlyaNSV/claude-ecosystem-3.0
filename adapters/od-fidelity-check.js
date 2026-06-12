#!/usr/bin/env node
/**
 * od-fidelity-check.js -- objective external correctness eval for a Stitch->open-design migration.
 * External objective correctness-eval for migrated mockups.
 *
 * Tri-location pattern (DEC-DEV-0040 Q1): canonical source = repo `adapters/od-fidelity-check.js`
 * (DEC-DEV-0067); instance copied to <project>/.claude/integrator/adapters/ at /integrator:add.
 *
 * WHY round-trip, not screenshot-the-UI:
 *   open-design renders an imported mockup as the raw HTML inside a sandboxed iframe, so its
 *   rendering == a browser rendering of that HTML. The objective question "did the migration
 *   preserve the design?" therefore reduces to: pull the HTML back OUT of the daemon and compare
 *   it to the source. This avoids screenshotting the token-gated SPA and is fully deterministic.
 *
 * LAYERS:
 *   1. Structural (PRIMARY GATE, deterministic, no deps):
 *        docker cp <container>:/app/.od/projects/<id>/index.html  -> roundtrip.html
 *        sha256(source) vs sha256(roundtrip). Identical => byte-lossless migration => PASS.
 *   2. Visual evidence (best-effort, requires Chrome):
 *        render source.html + roundtrip.html via headless Chrome -> 2 PNGs (saved for human review).
 *        Reports PNG byte-equality as a coarse signal. NOT a percentage pixel-diff -- odiff-bin
 *        (native, recommended by research DEC-INT-RESEARCH-0003) fails to install on Node 18/Windows;
 *        add Playwright+odiff OR pixelmatch+pngjs when a Node-24 / package.json toolchain exists.
 *
 * Usage:
 *   node od-fidelity-check.js --project-id <id> --source <source.html|.zip-extracted.html> \
 *       [--container open-design] [--out-dir <dir>] [--chrome <path>] [--no-render]
 *
 * Exit: 0 = PASS (structural identical), 1 = FAIL (structural differs), 2 = IO/tool error.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DEFAULT_CONTAINER = 'open-design';
const DEFAULT_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function parseArgs(argv) {
  const a = { projectId: null, source: null, container: DEFAULT_CONTAINER, outDir: null, chrome: DEFAULT_CHROME, render: true };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--project-id') a.projectId = argv[++i];
    else if (k === '--source') a.source = argv[++i];
    else if (k === '--container') a.container = argv[++i];
    else if (k === '--out-dir') a.outDir = argv[++i];
    else if (k === '--chrome') a.chrome = argv[++i];
    else if (k === '--no-render') a.render = false;
    else if (k === '-h' || k === '--help') a.help = true;
  }
  return a;
}

function renderToPng(chrome, htmlPath, pngPath) {
  // file:// URL from absolute path, forward slashes
  const abs = path.resolve(htmlPath).replace(/\\/g, '/');
  const url = 'file:///' + abs;
  execFileSync(chrome, [
    '--headless', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1440,2600',
    '--screenshot=' + pngPath,
    url,
  ], { stdio: 'ignore', timeout: 60000 });
  return fs.existsSync(pngPath);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.projectId || !args.source) {
    process.stderr.write('Usage: node od-fidelity-check.js --project-id <id> --source <source.html> [--container open-design] [--out-dir <dir>] [--no-render]\n');
    process.exit(args.help ? 0 : 2);
  }

  const outDir = args.outDir || fs.mkdtempSync(path.join(os.tmpdir(), 'od-fidelity-'));
  fs.mkdirSync(outDir, { recursive: true });
  const roundtripHtml = path.join(outDir, 'roundtrip.html');

  // Layer 1: pull stored HTML back out of the daemon container
  const containerPath = '/app/.od/projects/' + args.projectId + '/index.html';
  try {
    execFileSync('docker', ['cp', args.container + ':' + containerPath, roundtripHtml], { stdio: 'pipe', timeout: 30000 });
  } catch (e) {
    process.stderr.write('ERROR: docker cp failed (' + args.container + ':' + containerPath + '): ' + (e.stderr ? e.stderr.toString() : e.message) + '\n');
    process.exit(2);
  }

  const srcBuf = fs.readFileSync(args.source);
  const rtBuf = fs.readFileSync(roundtripHtml);
  const srcSha = sha256(srcBuf);
  const rtSha = sha256(rtBuf);
  const identical = srcSha === rtSha;

  const verdict = {
    tool: 'od-fidelity-check',
    contract: 'CNT-003',
    pmo_zone: 'D2-B04',
    project_id: args.projectId,
    structural: {
      identical,
      source_sha256: srcSha,
      roundtrip_sha256: rtSha,
      source_bytes: srcBuf.length,
      roundtrip_bytes: rtBuf.length,
      note: identical
        ? 'Byte-lossless: open-design stored the mockup HTML identical to source. Render is identical by construction.'
        : 'Stored HTML differs from source (open-design may have normalized/rewritten it). Inspect visual layer + diff.',
    },
    visual: null,
    passed: identical,
  };

  // Layer 2: visual evidence (best-effort)
  if (args.render) {
    const srcPng = path.join(outDir, 'source.png');
    const rtPng = path.join(outDir, 'roundtrip.png');
    try {
      const okS = renderToPng(args.chrome, args.source, srcPng);
      const okR = renderToPng(args.chrome, roundtripHtml, rtPng);
      let pngEqual = null;
      if (okS && okR) {
        pngEqual = sha256(fs.readFileSync(srcPng)) === sha256(fs.readFileSync(rtPng));
      }
      verdict.visual = {
        rendered: okS && okR,
        source_png: okS ? srcPng : null,
        roundtrip_png: okR ? rtPng : null,
        png_bytes_equal: pngEqual,
        note: 'Coarse signal (PNG byte-equality). For a true % pixel-diff add Playwright+odiff OR pixelmatch+pngjs (Node-24 toolchain). PNGs saved for human review.',
      };
    } catch (e) {
      verdict.visual = { rendered: false, error: e.message, note: 'Chrome render failed; structural gate still authoritative.' };
    }
  }

  process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
  process.stdout.write('\nout-dir: ' + outDir + '\n');
  process.exit(verdict.passed ? 0 : 1);
}

if (require.main === module) main();
module.exports = { sha256 };
