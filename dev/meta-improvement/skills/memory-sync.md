---
description: D7 skill — sync Memory MCP entries with current ecosystem state. Step 5 of phase-closure.md formalized as standalone procedure. Manual run; automation triggers documented.
---

# Memory Sync Skill (D7)

> **Status:** Stage 4 (2026-04-28). Formalizes phase-closure.md Step 5 in standalone procedure.
>
> **Why this exists:** Phase 3 closure caught Memory MCP 8 days stale («Phase 3 ready to start» vs actually closed). Reference model component #5 (Memory & continuity) gap. Manual sync sufficient Stage 4; promotion к automated trigger когда manual proves heavy.
>
> **Invocation:**
> - Inline (current session): «Прогони memory-sync skill» OR «Step 5 phase-closure»
> - Fresh session (recommended for multi-month drift): paste prompt from Invocation section ниже

## When to invoke

✅ **Triggers:**
- **Phase closure Step 5** (primary) — every phase boundary
- **Long break return** (1+ week away from project) — memory likely drifted
- **AI cites stale data** (utterance contradicts current state) — point check
- **After major refactor** (architectural decision changes module structure)

❌ **NOT applicable:**
- Mid-phase routine work (memory updates daily not needed)
- Per-commit (overkill)

## Inputs (substrate to load)

1. **Memory MCP files** (target of sync):
   ```bash
   ls ~/.claude/projects/<project-slug>/memory/
   ```
   Where project-slug = absolute path с slashes replaced by dashes.

   For Ecosystem 3.0 dev:
   ```
   ~/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/memory/
   ```

2. **Authoritative sources** (compare against):
   - `DEV_JOURNAL.md` — last 5 entries (cross-session decision memory)
   - `CHANGELOG.md` — `[<latest version>]` section
   - `ROADMAP.md` § «Где мы сейчас»
   - `CLAUDE.md` — root project instructions
   - `git log -10 --oneline` — recent activity

## Steps

### Step 1: Inventory memory entries

```bash
ls ~/.claude/projects/<slug>/memory/
```

Expected entries (Ecosystem 3.0 как пример):
- `MEMORY.md` — index file (table of contents)
- `user_role.md` — user identity / preferences
- `project_<X>_status.md` — current implementation status
- `project_<X>_architecture.md` — module / artifact / process summary
- `feedback_<methodology>.md` — methodology agreements
- `reference_<domain>.md` — quick references (e.g., DEV_JOURNAL pointer)

### Step 2: Per entry — verify against current state

For each memory file:

1. **Read memory file** (Read tool)
2. **Read corresponding authoritative source(s)** (DEV_JOURNAL latest, ROADMAP, CHANGELOG)
3. **Compare claims:**
   - Does memory's «status» match current phase status?
   - Does memory's architecture summary include latest modules / artifacts?
   - Does memory's methodology agreements include recent additions (e.g., D7 procedures)?
4. **Identify drift:**
   - Stale claim (factually wrong now)
   - Missing claim (new entity / convention not reflected)
   - Outdated descriptions

### Step 3: Update stale memory inline

Per identified drift, edit memory file (Edit или Write tool):
- Update factual claims к current state
- Add new entries (modules / conventions / patterns)
- Update `description:` frontmatter if scope changed
- Optionally annotate «Updated: <YYYY-MM-DD>» if convention used

### Step 4: Update MEMORY.md index

If memory file structure changed (added/removed entries) — update `MEMORY.md` index:
- Updated descriptions
- Added entries (new line-items)
- Removed entries (если archived elsewhere)

### Step 5: Verify post-sync

Quick sanity:
- All memory files current within 1 phase
- Status memory reflects «Phase N closed, Phase N+1 next»
- No claims contradict latest DEV_JOURNAL

## Outputs

- N memory files updated inline (Edit tool diffs — preserved через filesystem)
- DEC-DEV-NNNN entry references «Memory sync — N files updated в Step 5»
- Future Claude sessions load current substrate

## Anti-patterns

### Over-sync

❌ **Per-commit memory update** — overhead без benefit; memory is for cross-session context, не per-edit log
❌ **Updating freeform context inflated** — memory files should stay tight (descriptions ~5-10 sentences each); добавлять каждую details = bloat

### Under-sync

❌ **Skipping memory sync entirely** — DEC-DEV-0018 caught 8-day drift («Phase 3 ready» vs actually closed) — accumulated rot
❌ **Status memory only, не architecture/methodology memory** — architecture changes (new modules) reflect там
❌ **Editing memory без verifying against authoritative sources** — re-stating outdated claims

### Misapplication

❌ **Memory sync as substitute для DEV_JOURNAL entry** — DEV_JOURNAL = decision history; memory = current snapshot. Both needed; serve different purposes
❌ **Treating memory as authoritative** — CLAUDE.md «Memory может устаревать. Всегда верифицируй по git log / DEV_JOURNAL / CHANGELOG перед actионом»

## Time budget

~10 min для 5 memory files (Phase 3 closure Step 5 measured).

If consistently >15 min/closure → escalation trigger к automated approach (per CONVENTIONS §3 mechanism hierarchy).

## Promotion triggers (Stage 5+)

Skill currently manual. Promote когда:

- **Auto-detection of stale claims** — if 3+ closures show same class drift (e.g., status memory always 1+ week stale), consider hook on DEV_JOURNAL.md write that surfaces «consider updating Memory MCP»
- **Bidirectional sync** — currently one-way (read sources → update memory). If forward direction useful (memory ← canonical state), formalize.
- **Integration с DEV_JOURNAL closing entry** — auto-extract memory updates from closure DEC-DEV entry. Defer until 5+ closures show pattern.

## Fresh-session invocation

For multi-month drift или long break return:

```
Я фрэш-сессия для Memory MCP sync. Project: Ecosystem 3.0.

Substrate:
1. ls ~/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/memory/
2. Read DEV_JOURNAL.md last 5 entries (cross-session decision history)
3. Read ROADMAP.md § «Где мы сейчас» (current phase status)
4. Read CHANGELOG.md latest version section
5. git log -10 --oneline

Затем для каждого memory file:
- Read memory entry
- Compare claims против authoritative sources (steps 2-5 substrate)
- Update stale claims via Edit
- Annotate updated date если convention уже используется

Anti-bias guard: don't preserve stale claims «for continuity» — sync = update к current state. Future sessions load updated memory.

Report list of updated files + class of drift caught (e.g., «status 8 days stale», «architecture missing D7 module», «methodology missing D7 procedures»).
```

## Examples (instances)

### Instance 1: DEC-DEV-0018 Step 5 (Phase 3 closure, 2026-04-28)

**Drift caught:**
- `project_ecosystem_status.md` — 8 days stale («Phase 3 ready to start» vs actually closed); missing D7 Stage 1+2 work; missing Phase 3 closure findings
- `project_ecosystem_architecture.md` — missing D7 Meta-Improvement Module; missing Phase 3 architectural patterns (A1 auto-approve, adaptive-depth DA, stderr orchestration, per-FM session state)
- `MEMORY.md` index — descriptions outdated

**Updates applied:**
- 3 memory files rewritten inline
- Time budget: ~10 min (matches expected)
- DEC-DEV-0018 lesson #5: «Memory MCP stale was substantial (8 days) but ~10 min update sufficient Stage 2 manual; not heavy enough к escalate skill yet»

## Related

- [`dev/meta-improvement/checklists/phase-closure.md`](../checklists/phase-closure.md) Step 5 — primary invocation context
- [`dev/meta-improvement/CONVENTIONS.md`](../CONVENTIONS.md) §6 — Memory MCP sync convention; promotion trigger Stage 5+
- [`CLAUDE.md`](../../../CLAUDE.md) «Memory» section — disclaimer «Memory может устаревать. Всегда верифицируй»
