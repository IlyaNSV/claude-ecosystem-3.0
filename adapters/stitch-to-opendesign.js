#!/usr/bin/env node
/**
 * stitch-to-opendesign.js — reference adapter: Stitch/Design-Module HTML export
 * → open-design daemon (Dockerized HTML viewer / migrate-target).
 *
 * Tri-location pattern (DEC-DEV-0040 Q1):
 *   - This file (repo `adapters/stitch-to-opendesign.js`) is the canonical source.
 *   - At /integrator:add open-design, this file is copied to
 *     <project>/.claude/integrator/adapters/stitch-to-opendesign.js and the
 *     metadata block below is populated with concrete values.
 *
 * Adapter metadata (filled in installed instance, not in repo reference):
 *   @contract: CNT-003
 *   @producer: design-module / stitch
 *   @consumer: open-design
 *   @target_tool: open-design
 *   @target_tool_version: <populated from tool profile at install>
 *   @contract_schema_version: 1                  // bumped when output shape changes
 *   @source_ref: <git-commit-hash>               // populated from repo HEAD at install
 *   @installed_at: <ISO-8601>                    // populated at install time
 *   @status: <draft at install; → active after Stage 6 verify>
 *
 * Modes:
 *   --verify-only --fixture <path>
 *       Dry-run: validate input is/can become a ZIP with >=1 .html entry.
 *       No daemon contact, no token resolution. Exits 0 + JSON on shape-valid input.
 *
 *   --import <path> [--daemon-url <url>] [--token <tok>]
 *       Live: POST to open-design daemon. Daemon must be running + token-gated.
 *       Exits 0 on HTTP 200/201, 3 on transport/HTTP error.
 *
 * Token precedence (machine-global shared daemon model — Layer 1):
 *   1. --token <tok>                                  (explicit CLI override)
 *   2. $OD_API_TOKEN                                  (env)
 *   3. ~/.claude/integrator/secrets/open-design.token (machine-global, all projects)
 *   4. ./.claude/integrator/secrets/open-design.token (per-project, CWD-relative)
 *   The daemon token-gates ALL /api/* (incl /api/health) because the Docker bridge
 *   makes host requests appear non-loopback. See BOOTSTRAP.md "open-design daemon".
 *
 * Exit codes: 0=ok, 1=validation fail, 2=parse/IO error, 3=live transport error.
 *
 * Design constraints: Node stdlib only; Node >= 14; cross-platform LF I/O.
 * Use http://127.0.0.1:7456 (not localhost) — avoids Windows IPv6 ::1 EACCES.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const http = require('http');

const CONTRACT_SCHEMA_VERSION = 1;
const DEFAULT_DAEMON_URL = 'http://127.0.0.1:7456';  // 127.0.0.1 (not localhost): avoids Windows IPv6 ::1 EACCES
const IMPORT_ROUTE = '/api/import/claude-design';
const VERIFY_ROUTE = '/api/projects';
const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024; // 50MB guard
const MAX_FILES_IN_ZIP = 5000;
// ---------- CRC-32 (stdlib-only, IEEE polynomial) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------- ZIP central-directory reader ----------

/**
 * Reads ZIP central directory entries.
 * Returns array of { filename, offset, compressedSize, uncompressedSize, method, encrypted }.
 * Supports standard ZIP (no ZIP64). Max 65535 entries.
 */
function readZipEntries(buf) {
  const EOCD_SIG = 0x06054b50;
  const CD_SIG = 0x02014b50;
  let eocdOffset = -1;
  const searchStart = Math.max(0, buf.length - 65535 - 22);
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) throw new Error("PARSE_ERROR: no EOCD signature -- not a valid ZIP");
  const cdCount = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdSize  = buf.readUInt32LE(eocdOffset + 12);
  if (cdOffset + cdSize > buf.length) throw new Error("PARSE_ERROR: central directory out of bounds");
  const entries = [];
  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(pos) !== CD_SIG) throw new Error("PARSE_ERROR: invalid CD sig at offset " + pos);
    const method  = buf.readUInt16LE(pos + 10);
    const flags   = buf.readUInt16LE(pos + 8);
    const encrypted = (flags & 0x1) !== 0;
    const compressedSize   = buf.readUInt32LE(pos + 20);
    const uncompressedSize = buf.readUInt32LE(pos + 24);
    const fnLen     = buf.readUInt16LE(pos + 28);
    const extraLen  = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const filename = buf.slice(pos + 46, pos + 46 + fnLen).toString("utf8");
    entries.push({ filename, offset: localHeaderOffset, compressedSize, uncompressedSize, method, encrypted });
    pos += 46 + fnLen + extraLen + commentLen;
  }
  return entries;
}

// ---------- ZIP builder (stdlib-only, stored/method-0) ----------

/**
 * Build a minimal ZIP containing one stored (method=0) file.
 * Returns a Buffer. No npm deps.
 */
function buildZipFromSingleFile(entryName, contentBuf) {
  const nameBytes = Buffer.from(entryName, "utf8");
  const namLen = nameBytes.length;
  const size = contentBuf.length;
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) >>> 0;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) >>> 0;
  const crc = crc32(contentBuf);
  // Local file header
  const lfh = Buffer.alloc(30 + namLen);
  lfh.writeUInt32LE(0x04034b50, 0); lfh.writeUInt16LE(20, 4); lfh.writeUInt16LE(0, 6);
  lfh.writeUInt16LE(0, 8);          // compression: store
  lfh.writeUInt16LE(dosTime, 10);   lfh.writeUInt16LE(dosDate, 12);
  lfh.writeUInt32LE(crc, 14);       lfh.writeUInt32LE(size, 18);  lfh.writeUInt32LE(size, 22);
  lfh.writeUInt16LE(namLen, 26);    lfh.writeUInt16LE(0, 28);
  nameBytes.copy(lfh, 30);
  const localOffset = 0;
  const cdOffset = lfh.length + size;
  // Central directory entry
  const cde = Buffer.alloc(46 + namLen);
  cde.writeUInt32LE(0x02014b50, 0); cde.writeUInt16LE(20, 4); cde.writeUInt16LE(20, 6);
  cde.writeUInt16LE(0, 8); cde.writeUInt16LE(0, 10); // stored
  cde.writeUInt16LE(dosTime, 12); cde.writeUInt16LE(dosDate, 14);
  cde.writeUInt32LE(crc, 16); cde.writeUInt32LE(size, 20); cde.writeUInt32LE(size, 24);
  cde.writeUInt16LE(namLen, 28); cde.writeUInt16LE(0, 30); cde.writeUInt16LE(0, 32);
  cde.writeUInt16LE(0, 34); cde.writeUInt16LE(0, 36); cde.writeUInt32LE(0, 38);
  cde.writeUInt32LE(localOffset, 42);
  nameBytes.copy(cde, 46);
  // EOCD
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cde.length, 12); eocd.writeUInt32LE(cdOffset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([lfh, contentBuf, cde, eocd]);
}
// ---------- Input normalization ----------

/**
 * Given a file path, return { zipBuf, originalFilename, wasWrapped }.
 * .zip  -> read as-is.
 * .html -> wrap in single-entry ZIP (index.html, stored). wasWrapped=true.
 */
function ensureZip(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);
  if (ext === ".zip") {
    const buf = fs.readFileSync(filePath);
    return { zipBuf: buf, originalFilename: basename, wasWrapped: false };
  }
  if (ext === ".html" || ext === ".htm") {
    const htmlContent = fs.readFileSync(filePath);
    const zipBuf = buildZipFromSingleFile("index.html", htmlContent);
    const zipName = basename.replace(/.html?$/i, "") + ".zip";
    return { zipBuf, originalFilename: zipName, wasWrapped: true };
  }
  throw new Error(
    "PARSE_ERROR: unsupported extension " + JSON.stringify(ext) +
    " -- provide .zip (Stitch htmlCode download or local mockup ZIP) or .html (local SI-*.html)"
  );
}

// ---------- ZIP payload validation (contract checks) ----------

/**
 * Validate zipBuf for open-design import compatibility.
 * Returns { passed, checks: [{id, level, status, detail?}], entries, htmlEntry }.
 *
 * Checks mirror daemon importClaudeDesignZip constraints:
 *   C-01: parseable ZIP (EOCD + central directory readable)
 *   C-02: file count <= MAX_FILES_IN_ZIP
 *   C-03: no encrypted entries
 *   C-04: no path traversal (absolute paths or ../)
 *   C-05: >=1 .html entry (daemon requires HTML entry)
 *   C-06: index.html preferred entry (warning if absent)
 *   C-07: design-canvas.jsx presence (info -- daemon normalizes scroll)
 */
function validateZipPayload(buf) {
  const ch = (id, level, pass, detail) =>
    pass ? { id, level, status: "pass" } : { id, level, status: "fail", detail };

  const checks = [];
  let entries = null;
  let htmlEntry = null;

  // C-01
  try {
    entries = readZipEntries(buf);
    checks.push(ch("C-01", "blocking", true));
  } catch (e) {
    checks.push(ch("C-01", "blocking", false, "ZIP parse error: " + e.message));
    return { passed: false, checks, entries: null, htmlEntry: null };
  }

  // C-02
  checks.push(ch("C-02", "blocking", entries.length <= MAX_FILES_IN_ZIP,
    "ZIP has " + entries.length + " entries; daemon limit " + MAX_FILES_IN_ZIP));

  // C-03
  const enc = entries.filter((e) => e.encrypted);
  checks.push(ch("C-03", "blocking", enc.length === 0,
    "encrypted entries (daemon rejects): " + enc.map((e) => e.filename).join(", ")));

  // C-04
  const trav = entries.filter((e) => e.filename.startsWith("/") || e.filename.includes("../"));
  checks.push(ch("C-04", "blocking", trav.length === 0,
    "path traversal entries (daemon safeJoin rejects): " + trav.map((e) => e.filename).join(", ")));

  // C-05
  const htmlEntries = entries.filter((e) => /.html$/i.test(e.filename) && !e.filename.endsWith("/"));
  checks.push(ch("C-05", "blocking", htmlEntries.length > 0,
    "ZIP has no .html files -- daemon importClaudeDesignZip requires >=1 .html entry"));

  if (htmlEntries.length > 0) {
    htmlEntry = htmlEntries.find((e) => e.filename === "index.html" || e.filename.endsWith("/index.html"))
      || htmlEntries[0];
    const prefersIndex = htmlEntry.filename === "index.html" || htmlEntry.filename.endsWith("/index.html");
    checks.push(ch("C-06", "warning", prefersIndex,
      "No root index.html; daemon uses first .html: " + htmlEntry.filename +
      ". Stitch get_screen ZIPs normally contain index.html."));
  }

  // C-07 (informational)
  const hasCanvas = entries.some((e) => e.filename === "design-canvas.jsx" || e.filename.endsWith("/design-canvas.jsx"));
  checks.push({
    id: "C-07", level: "info", status: "info",
    detail: hasCanvas
      ? "design-canvas.jsx detected -- daemon normalizes wheel/gesture scroll on import"
      : "no design-canvas.jsx -- plain HTML artifact (Stitch get_screen without canvas frame)",
  });

  const blockingFails = checks.filter((c) => c.level === "blocking" && c.status === "fail");
  return { passed: blockingFails.length === 0, checks, entries, htmlEntry };
}
// ---------- Multipart builder (stdlib-only) ----------

/**
 * Build a multipart/form-data body for POST /api/import/claude-design.
 * field name: "file"; filename must end ".zip" (daemon enforces this).
 * Returns { body: Buffer, boundary: string, contentType: string }.
 */
function buildMultipart(zipBuf, filename) {
  const safeFilename = filename.endsWith('.zip') ? filename : filename + '.zip';
  const boundary = '----ODAdapterBoundary' + Date.now().toString(16);
  const CRLF = '\r\n';
  const dispLine = 'Content-Disposition: form-data; name=' + JSON.stringify('file') + '; filename=' + JSON.stringify(safeFilename);
  const header = Buffer.from(
    '--' + boundary + CRLF +
    dispLine + CRLF +
    'Content-Type: application/zip' + CRLF +
    CRLF
  );
  const footer = Buffer.from(CRLF + '--' + boundary + '--' + CRLF);
  const body = Buffer.concat([header, zipBuf, footer]);
  return { body, boundary, contentType: 'multipart/form-data; boundary=' + boundary };
}

// ---------- Transformation shape ----------

/**
 * Produce the open-design import input shape descriptor.
 * In --verify-only mode this describes what WOULD be sent.
 */
function transformToOpenDesignInput(zipBuf, filename, entries, htmlEntry) {
  return {
    contract_schema_version: CONTRACT_SCHEMA_VERSION,
    target_tool: "open-design",
    import_endpoint: IMPORT_ROUTE,
    method: "POST",
    content_type: "multipart/form-data",
    field_name: "file",
    filename: filename.endsWith(".zip") ? filename : filename + ".zip",
    payload_summary: {
      zip_size_bytes: zipBuf.length,
      entry_count: entries ? entries.length : null,
      html_entry: htmlEntry ? htmlEntry.filename : null,
      has_design_canvas_jsx: entries
        ? entries.some((e) => e.filename === "design-canvas.jsx" || e.filename.endsWith("/design-canvas.jsx"))
        : null,
    },
    verification_endpoint: VERIFY_ROUTE + "/:id/files",
    verification_note: "After live import: GET /api/projects/<returned_id>/files -- expect entryFile=index.html + all ZIP contents",
  };
}

// ---------- Token resolution (machine-global shared daemon — Layer 1) ----------

/**
 * Read a token file, trimmed, or null if absent/unreadable.
 * Unreadable (permissions, race) is treated as absent — not fatal.
 */
function readTrimmedIfExists(p) {
  try { return fs.existsSync(p) ? (fs.readFileSync(p, 'utf8').trim() || null) : null; }
  catch (_) { return null; }
}

/**
 * Resolve the OD_API_TOKEN by precedence (see header). Returns { token, source }.
 * source ∈ { 'cli', 'env', 'home-secret', 'project-secret', 'none' } — surfaced
 * in the import report for debuggability; the token value itself is never logged.
 */
function resolveToken(cliToken) {
  if (cliToken && cliToken.length > 0) return { token: cliToken, source: 'cli' };
  if (process.env.OD_API_TOKEN && process.env.OD_API_TOKEN.length > 0)
    return { token: process.env.OD_API_TOKEN, source: 'env' };
  const homeTokenPath = path.join(os.homedir(), '.claude', 'integrator', 'secrets', 'open-design.token');
  const t3 = readTrimmedIfExists(homeTokenPath);
  if (t3) return { token: t3, source: 'home-secret' };
  const projTokenPath = path.join(process.cwd(), '.claude', 'integrator', 'secrets', 'open-design.token');
  const t4 = readTrimmedIfExists(projTokenPath);
  if (t4) return { token: t4, source: 'project-secret' };
  return { token: null, source: 'none' };  // no Bearer sent; daemon 401 if it requires auth
}

// ---------- Live import ----------

/**
 * POST multipart payload to the open-design daemon.
 * Returns Promise<{ status, projectId, entryFile, files }>.
 */
function postToOpenDesign(daemonUrl, multipart, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(IMPORT_ROUTE, daemonUrl);
    const options = {
      hostname: parsed.hostname,
      port: parseInt(parsed.port, 10) || 7456,
      path: parsed.pathname,
      method: "POST",
      headers: Object.assign({
        "Content-Type": multipart.contentType,
        "Content-Length": multipart.body.length,
      }, token ? { "Authorization": "Bearer " + token } : {}),  // OD_API_TOKEN — daemon token-gates non-loopback (Docker bridge) peers
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let data = null;
        try { data = JSON.parse(raw); } catch (_) { /* non-JSON */ }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            status: res.statusCode,
            projectId: data && (data.project ? data.project.id : data.id) || null,
            entryFile: (data && data.entryFile) || null,
            files: (data && data.files) || [],
            raw: data,
          });
        } else {
          reject(new Error("HTTP " + res.statusCode + ": " + ((data && data.error) || raw.slice(0, 200))));
        }
      });
    });
    req.on("error", (e) => reject(new Error("TRANSPORT_ERROR: " + e.message + " (daemon at " + daemonUrl + " unreachable)")));
    req.write(multipart.body);
    req.end();
  });
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { verifyOnly: false, fixture: null, importFile: null, daemonUrl: DEFAULT_DAEMON_URL, token: null, output: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verify-only') args.verifyOnly = true;
    else if (a === '--fixture') args.fixture = argv[++i];
    else if (a === '--import') args.importFile = argv[++i];
    else if (a === '--daemon-url') args.daemonUrl = argv[++i];
    else if (a === '--token') args.token = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else if (!args.fixture && !args.importFile && !a.startsWith('--')) {
      if (args.verifyOnly) args.fixture = a; else args.importFile = a;
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write([
    'stitch-to-opendesign.js -- Stitch/Design-Module HTML ZIP -> open-design daemon adapter',
    '',
    'Usage:',
    '  node stitch-to-opendesign.js --verify-only --fixture <input.zip|input.html>',
    '  node stitch-to-opendesign.js --import <input.zip|input.html> [--daemon-url http://127.0.0.1:7456]',
    '',
    'Input types:',
    '  .zip   Stitch htmlCode download (get_screen) or local mockup ZIP',
    '  .html  Local SI-*.html (e.g. .product/.design-sessions/fm002-html/SI-*.html)',
    '         Adapter wraps single .html into ZIP with entry index.html (stored).',
    '',
    'Modes:',
    '  --verify-only  Dry-run: validate ZIP + multipart shape. No daemon call, no token.',
    '                 Exit 0 + JSON with contract_validation.passed=true on success.',
    '  --import       Live: POST to daemon. Requires daemon at --daemon-url (default 127.0.0.1:7456).',
    '',
    'Token precedence (--import only): --token > $OD_API_TOKEN >',
    '  ~/.claude/integrator/secrets/open-design.token > ./.claude/integrator/secrets/open-design.token',
    '',
    'Exit codes: 0=ok, 1=validation fail, 2=IO/parse error, 3=live transport error',
    'contract_schema_version: ' + CONTRACT_SCHEMA_VERSION,
    '',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  const inputPath = args.verifyOnly ? args.fixture : args.importFile;
  if (!inputPath) {
    process.stderr.write('ERROR: provide --fixture <path> (--verify-only) or --import <path> (live)\n');
    printHelp();
    process.exit(2);
  }

  // Read + normalize to ZIP
  let zipBuf, originalFilename, wasWrapped;
  try {
    ({ zipBuf, originalFilename, wasWrapped } = ensureZip(inputPath));
  } catch (e) {
    process.stderr.write('ERROR: ' + e.message + '\n');
    process.exit(2);
  }

  if (zipBuf.length > MAX_ZIP_SIZE_BYTES) {
    process.stderr.write('ERROR: input exceeds ' + (MAX_ZIP_SIZE_BYTES / 1024 / 1024) + 'MB guard\n');
    process.exit(1);
  }

  const { passed, checks, entries, htmlEntry } = validateZipPayload(zipBuf);
  const multipart = buildMultipart(zipBuf, originalFilename);
  const openDesignInput = transformToOpenDesignInput(zipBuf, originalFilename, entries, htmlEntry);

  // --verify-only: no daemon contact, no token resolution
  if (args.verifyOnly) {
    const report = {
      mode: 'dry-run',
      contract_schema_version: CONTRACT_SCHEMA_VERSION,
      contract_id: 'CNT-003',
      pmo_zone: 'D2-B04',
      input_file: path.resolve(inputPath),
      was_wrapped: wasWrapped,
      wrap_note: wasWrapped
        ? 'Input was .html -- wrapped into single-entry ZIP (index.html, stored method)'
        : null,
      contract_validation: {
        passed: passed,
        mode: 'dry-run',
        note: 'daemon not contacted; payload-shape only',
        checks: checks,
      },
      open_design_input: passed ? openDesignInput : null,
      multipart_shape: passed ? {
        field_name: 'file',
        filename: originalFilename.endsWith('.zip') ? originalFilename : originalFilename + '.zip',
        content_type: multipart.contentType,
        body_size_bytes: multipart.body.length,
        note: 'Content-Disposition: form-data; name=file; filename=<>.zip per daemon route validation',
      } : null,
    };
    const json = JSON.stringify(report, null, 2);
    if (args.output) fs.writeFileSync(args.output, json, 'utf8');
    else process.stdout.write(json + '\n');
    process.exit(passed ? 0 : 1);
  }

  // --import: live
  if (!passed) {
    const blockFails = checks.filter((c) => c.level === 'blocking' && c.status === 'fail');
    process.stderr.write('ERROR: contract validation failed:\n');
    blockFails.forEach((f) => process.stderr.write('  ' + f.id + ': ' + f.detail + '\n'));
    process.exit(1);
  }

  // Resolve token by precedence (CLI > env > ~/.claude > ./.claude)
  const { token, source: tokenSource } = resolveToken(args.token);

  let importResult;
  try {
    importResult = await postToOpenDesign(args.daemonUrl, multipart, token);
  } catch (e) {
    process.stderr.write('ERROR: ' + e.message + '\n');
    process.exit(3);
  }

  const report = {
    mode: 'live-import',
    contract_schema_version: CONTRACT_SCHEMA_VERSION,
    contract_id: 'CNT-003',
    input_file: path.resolve(inputPath),
    was_wrapped: wasWrapped,
    daemon_url: args.daemonUrl,
    token_source: tokenSource,
    http_status: importResult.status,
    project_id: importResult.projectId,
    entry_file: importResult.entryFile,
    files_imported: importResult.files,
    contract_validation: { passed: passed, mode: 'live', checks: checks },
    open_design_input: openDesignInput,
    verify_command: importResult.projectId
      ? 'curl ' + args.daemonUrl + '/api/projects/' + importResult.projectId + '/files'
      : null,
  };

  const json = JSON.stringify(report, null, 2);
  if (args.output) fs.writeFileSync(args.output, json, 'utf8');
  else process.stdout.write(json + '\n');
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => { process.stderr.write('FATAL: ' + e.message + '\n'); process.exit(2); });
}

module.exports = {
  CONTRACT_SCHEMA_VERSION,
  readZipEntries,
  validateZipPayload,
  ensureZip,
  buildZipFromSingleFile,
  buildMultipart,
  transformToOpenDesignInput,
  resolveToken,
  crc32,
};
