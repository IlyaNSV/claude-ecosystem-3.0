#!/usr/bin/env node
/**
 * od-mcp-call.cjs — headless driver for the open-design `od mcp` stdio server.
 *
 * Speaks MCP (JSON-RPC over stdio) to the Dockerized open-design daemon by
 * spawning `docker exec -i <container> node apps/daemon/dist/cli.js mcp`.
 * Used by the Design Module open-design generator path (CNT-004-class contract)
 * so an agent can create projects + author/iterate artifacts without exporting ZIPs.
 *
 * Tri-location pattern (DEC-DEV-0040 Q1):
 *   - This file (repo `adapters/od-mcp-call.cjs`) is the canonical source (DEC-DEV-0067).
 *   - At /integrator:add open-design, copied to
 *     <project>/.claude/integrator/adapters/od-mcp-call.cjs; metadata populated there.
 *
 * Adapter metadata (filled in installed instance, not in repo reference):
 *   @contract: <CNT-NNN generate-path id, assigned per-project>
 *   @producer: design-module
 *   @consumer: open-design
 *   @target_tool: open-design
 *   @target_tool_version: <populated from tool profile at install>
 *   @contract_schema_version: 1
 *   @source_ref: <git-commit-hash>               // populated from repo HEAD at install
 *   @installed_at: <ISO-8601>                    // populated at install time
 *
 * WHY this exists: the in-session Claude Code MCP client only picks up a newly
 * registered server after a reconnect. This driver lets the CURRENT session
 * drive open-design immediately. It also keeps stdin open until every expected
 * response is received (the server otherwise exits on EOF before async
 * daemon round-trips flush — observed 2026-06-06).
 *
 * Auth: reads OD_API_TOKEN from env (forwarded into the container as both
 * OD_API_TOKEN and OD_TOOL_TOKEN — the mcp path accepts the API token).
 *
 * Usage:
 *   OD_API_TOKEN=... node od-mcp-call.cjs --calls calls.json
 *   echo '[{"name":"list_projects","arguments":{}}]' | OD_API_TOKEN=... node od-mcp-call.cjs --stdin
 *   OD_API_TOKEN=... node od-mcp-call.cjs --call list_projects '{}'
 *
 * Each call = {"name": <tool>, "arguments": <obj>}. Tool results are unwrapped:
 * the MCP text content is JSON-parsed when possible. Prints a JSON array of
 * {name, ok, result|error} to stdout. Exit 0 if all ok, 1 otherwise.
 *
 * Options:
 *   --container <name>   default: open-design
 *   --daemon-url <url>   default: http://127.0.0.1:7456
 *   --timeout <ms>       overall wait for all responses, default: 90000
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');

function parseArgs(argv) {
  const o = { container: 'open-design', daemonUrl: 'http://127.0.0.1:7456', timeout: 90000, calls: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--container') o.container = argv[++i];
    else if (a === '--daemon-url') o.daemonUrl = argv[++i];
    else if (a === '--timeout') o.timeout = parseInt(argv[++i], 10);
    else if (a === '--calls') o.calls = JSON.parse(fs.readFileSync(argv[++i], 'utf8'));
    else if (a === '--stdin') o.calls = JSON.parse(fs.readFileSync(0, 'utf8'));
    else if (a === '--call') { o.calls = o.calls || []; const name = argv[++i]; const args = argv[++i] || '{}'; o.calls.push({ name, arguments: JSON.parse(args) }); }
  }
  return o;
}

function unwrap(result) {
  // MCP tool result: { content: [{ type:'text', text:'...' }], ... }
  try {
    if (result && Array.isArray(result.content)) {
      const t = result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      try { return JSON.parse(t); } catch { return t; }
    }
  } catch { /* fall through */ }
  return result;
}

async function main() {
  const opt = parseArgs(process.argv);
  if (!opt.calls || !opt.calls.length) { console.error('No --calls / --call provided'); process.exit(2); }
  const tok = (process.env.OD_API_TOKEN || '').trim();
  if (!tok) { console.error('OD_API_TOKEN env required'); process.exit(2); }

  const child = spawn('docker', [
    'exec', '-i',
    '-e', `OD_DAEMON_URL=${opt.daemonUrl}`,
    '-e', `OD_API_TOKEN=${tok}`,
    '-e', `OD_TOOL_TOKEN=${tok}`,
    opt.container, 'node', 'apps/daemon/dist/cli.js', 'mcp'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  const responses = new Map();
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try { const msg = JSON.parse(line); if (msg.id !== undefined) responses.set(msg.id, msg); } catch { /* non-json log line */ }
    }
  });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');

  // Handshake
  send({ jsonrpc: '2.0', id: 'init', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'od-mcp-call', version: '1' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

  // Tool calls
  const ids = [];
  opt.calls.forEach((c, i) => {
    const id = `c${i}`;
    ids.push({ id, name: c.name });
    send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: c.name, arguments: c.arguments || {} } });
  });

  const deadline = Date.now() + opt.timeout;
  await new Promise((resolve) => {
    const tick = setInterval(() => {
      const haveAll = ids.every(x => responses.has(x.id));
      if (haveAll || Date.now() > deadline) { clearInterval(tick); resolve(); }
    }, 200);
  });

  try { child.stdin.end(); } catch {}
  try { child.kill(); } catch {}

  const out = ids.map(x => {
    const msg = responses.get(x.id);
    if (!msg) return { name: x.name, ok: false, error: 'no response (timeout)' };
    if (msg.error) return { name: x.name, ok: false, error: msg.error };
    return { name: x.name, ok: true, result: unwrap(msg.result) };
  });
  const allOk = out.every(r => r.ok);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  if (!allOk && stderr) process.stderr.write('\n[stderr]\n' + stderr.slice(0, 2000) + '\n');
  process.exit(allOk ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
