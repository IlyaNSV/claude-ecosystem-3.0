#!/usr/bin/env node
/**
 * scan-host-roles.cjs — санитария 3.6 + сырьё для M1.
 *
 * 1) Классифицирует ХОСТ-сессии по СОДЕРЖАНИЮ (а не по mtime — файлы живут неделями из-за --resume):
 *    conductor-run  — сессия вела прогон (диспатч cond-сессий / harvest / ledger)
 *    ecosystem-dev  — работа над самой экосистемой
 *    other
 * 2) Выгружает ДОСЛОВНЫЕ промпты владельца (user-сообщения, не meta, не tool_result) в owner_prompts.jsonl —
 *    первичный источник интенций для M1 (ledger — вторичный).
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const HOME = process.env.USERPROFILE || process.env.HOME;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'DATASET');
const DIRS = [
  path.join(HOME, '.claude', 'projects', 'C--Users-pw201-WebstormProjects-claude-ecosystem-3-0'),
  path.join(HOME, '.claude', 'projects', 'C--Users-pw201-WebstormProjects-ce3-wt-global-loop'),
];

const MARKERS = {
  cond_dispatch: /tmux new -d -s cond-s|prompt-s\d+\.txt|cond-s\d+/i,
  harvest: /vm-harvests|SUMMARY-COND-|harvest/i,
  ledger: /ASSIST_LOG/,
  pilot: /my-first-test/,
  vm_ssh: /vm-claude-factory|cc-dev@127\.0\.0\.1/,
};

const isOwnerPrompt = (o) => {
  if (o.type !== 'user' || o.isMeta) return false;
  const c = o.message && o.message.content;
  if (typeof c !== 'string') return false;
  const t = c.trim();
  if (!t) return false;
  if (t.startsWith('<local-command') || t.startsWith('Caveat:')) return false;
  if (t.startsWith('<command-name>') || t.startsWith('<system-reminder>')) return false;
  if (t.startsWith('[Request interrupted')) return false;
  return true;
};

(async () => {
  const rows = [];
  const promptsFd = fs.createWriteStream(path.join(OUT, 'owner_prompts.jsonl'));
  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
      const full = path.join(dir, f);
      const counts = Object.fromEntries(Object.keys(MARKERS).map((k) => [k, 0]));
      let sid = '', firstTs = '', lastTs = '', prompts = 0, firstPrompt = '';
      const rl = readline.createInterface({ input: fs.createReadStream(full), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line.trim()) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.sessionId && !sid) sid = o.sessionId;
        if (o.timestamp) { if (!firstTs) firstTs = o.timestamp; lastTs = o.timestamp; }
        for (const [k, re] of Object.entries(MARKERS)) if (re.test(line)) counts[k]++;
        if (isOwnerPrompt(o)) {
          prompts++;
          const text = o.message.content;
          if (!firstPrompt) firstPrompt = text.slice(0, 160).replace(/\s+/g, ' ');
          promptsFd.write(JSON.stringify({
            session_id: o.sessionId || sid, ts: o.timestamp || '', source_file: f,
            len: text.length, text,
          }) + '\n');
        }
      }
      const runScore = counts.cond_dispatch + counts.harvest + counts.ledger;
      const role = counts.cond_dispatch > 5 && counts.pilot > 5 ? 'conductor-run'
        : runScore > 20 ? 'conductor-adjacent'
          : 'ecosystem-dev';
      rows.push({
        session_id: sid, source_file: f, role, first_ts: firstTs, last_ts: lastTs,
        owner_prompts: prompts, ...counts, first_prompt: firstPrompt,
      });
    }
  }
  promptsFd.end();
  const HDR = ['session_id', 'source_file', 'role', 'first_ts', 'last_ts', 'owner_prompts', ...Object.keys(MARKERS), 'first_prompt'];
  const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  fs.writeFileSync(path.join(OUT, 'host_roles.csv'), [HDR.join(','), ...rows.sort((a, b) => (a.first_ts < b.first_ts ? -1 : 1)).map((r) => HDR.map((h) => esc(r[h])).join(','))].join('\n') + '\n');

  const byRole = {};
  for (const r of rows) byRole[r.role] = (byRole[r.role] || 0) + 1;
  console.log('роли хост-сессий:', byRole);
  console.log('\nconductor-run / conductor-adjacent (по содержанию, не по mtime):');
  for (const r of rows.filter((x) => x.role !== 'ecosystem-dev')) {
    console.log(`  ${r.first_ts?.slice(0, 16)} → ${r.last_ts?.slice(0, 16)} | ${r.source_file.slice(0, 8)} | ${r.role} | prompts=${r.owner_prompts} cond=${r.cond_dispatch} harv=${r.harvest} ledger=${r.ledger}`);
  }
  const totalPrompts = rows.reduce((a, r) => a + r.owner_prompts, 0);
  console.log(`\nowner_prompts.jsonl: ${totalPrompts} владельческих сообщений выгружено`);
})();
