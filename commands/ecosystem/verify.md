---
description: Verify Ecosystem 3.0 installation in current project. Non-destructive health check.
---

# /ecosystem:verify

Check that the ecosystem installed in the current project is **complete and healthy**. Read-only — doesn't modify anything.

Useful after `/ecosystem:bootstrap` to confirm everything's in place, or periodically to catch file corruption / accidental deletes.

## Process

### Step 1: Core directories

Verify these exist:
- `.claude/` (ecosystem content)
- `.claude/commands/`, `.claude/skills/`, `.claude/agents/`, `.claude/hooks/`, `.claude/docs/`
- `.product/` (artifact workspace)

For each missing — report as ❌ Missing with suggestion (`/ecosystem:bootstrap --force` OR manual git clone).

### Step 2: Critical files

| File | Path | Required |
|---|---|---|
| Ecosystem README | `.claude/README.md` | 🔴 |
| Integrator SPEC | `.claude/docs/integrator-module/SPEC.md` | 🔴 |
| Product Module SPEC | `.claude/docs/product-module/SPEC.md` | 🔴 |
| Handoff SPEC | `.claude/docs/product-module/handoff-spec.md` | 🔴 |
| PMO map | `.claude/docs/pmo/pmo-map.md` | 🔴 |
| Artifacts catalog README | `.claude/docs/pmo/artifacts/README.md` | 🔴 |
| Project config | `.claude/product.yaml` | 🔴 |
| Claude settings | `.claude/settings.json` | 🟡 (can exist empty) |
| Project memory | `CLAUDE.md` (project root) | 🟡 (recommended) |
| Environment | `.env` | 🟡 (recommended for Deep mode) |
| Gitignore | `.gitignore` | 🟡 (recommended) |

Verify each. Report ❌ / 🟡 / ✓ per file.

### Step 3: Artifact catalog completeness

Count `.claude/docs/pmo/artifacts/*.md` — expect **25 files** (24 type files + README.md).

If count differs, list missing or unexpected files.

### Step 4: Commands available

Count per namespace:
- `.claude/commands/integrator/*.md` — expect 9 (research, map, gaps, status, journal, scan, add, remove, update)
- `.claude/commands/product/*.md` — may be 0 or more (Phase 2+; current baseline ~19)
- `.claude/commands/design/*.md` — may be 0 or more (Phase 6; current baseline 7)
- `.claude/commands/orchestrator/*.md` — expect 1+ (run; first increment — P2/P4/P6/P7 processes deferred)
- `.claude/commands/ecosystem/*.md` — expect 5 (bootstrap, verify, update, pending-actions, enable-d7-audit)

Report counts + note what's expected for current ROADMAP phase.

> **Note (DEC-DEV-0082):** these per-namespace counts are a **baseline snapshot as of the
> current ecosystem version**, not a hard contract — new commands land between cuts. A mismatch
> may mean drift in **this list** (it wasn't refreshed when a command was added) as easily as a
> defective install. Investigate which before raising a ❌; an *extra* command vs. this baseline
> is almost never a fault.

### Step 5: Config consistency

Read `.claude/product.yaml` and check:
- `version: 1`
- `project_name:` not empty
- `validation_tier:` is valid (`pilot | mvp | full`)
- `ecosystem_version:` present

If `product.yaml` says `ecosystem_version: 1.0` but `.claude/CHANGELOG.md` shows `[2.0.0]` — flag as version drift, suggest `/ecosystem:update` to sync the ecosystem zone to latest.

### Step 6: `.env` keys check (if exists)

If `.env` exists:
- Check which keys are filled vs empty:
  - `BRAVE_API_KEY` — filled / empty / placeholder?
  - `FIRECRAWL_API_KEY` — same
  - `EXA_API_KEY` — same
  - etc.
- **Never print the key values** — just status (filled/empty).

If all keys empty → note: "Discovery Deep mode will fall back to WebFetch/WebSearch."

### Step 7: Integrator state

Read `.claude/integrator/active-tools.yaml` if exists:
- Count installed tools
- Check `.claude/integrator/pmo-mapping.yaml` for coverage entries

If doesn't exist → normal for fresh bootstrap (Integrator state is created lazily on first `/integrator:add`).

### Step 8: Git state

Check if project is a git repo:
- If yes — note current branch, untracked files count
- If no — note: "Not a git repo. Consider `git init` for version control."

### Step 8.5: LESSON-* gate self-check (DEC-DEV-0062)

So an unenforced-but-believed-enforced gate cannot pass silently. Read `.claude/settings.json` hooks and check:

- `lesson-gate.js` is registered under **`Stop`** (matcher `""`).
- `lesson-presence-gate.js` is registered under **`PreToolUse`** (matcher `Write|Edit|Bash|NotebookEdit`) and **`UserPromptSubmit`**.
- Both hook files exist at `.claude/hooks/product/`.
- `LESSON_GATE_MODE` env: if set to `warn` or `off`, the **non-deferrability guarantee is downgraded** — surface this **loudly** (not a silent pass).

Report:
- ✓ if both hooks registered for their events and mode is strict-default (unset).
- 🟡 if registered but `LESSON_GATE_MODE=warn|off` — note "LESSON gate is advisory only; open lessons will NOT block session close."
- ❌ if `lesson-gate.js` is missing from `Stop` while the file exists — note "**existing installs are UNPROTECTED until `/ecosystem:update` re-registers hooks.**" Suggest `/ecosystem:update`.

(Per "Strict Stop, warn PreToolUse" ship default: PreToolUse in warn mode is **expected**, not a defect — it nags rather than denies until the S-LE live smoke confirms the deny contract. Flag only the Stop prong being non-strict, or hooks missing entirely.)

### Step 9: Summary report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ecosystem 3.0 — Installation Verification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: <name from product.yaml>
Ecosystem version: <from product.yaml vs CHANGELOG.md>
Installed: <installed_at from product.yaml>
Validation tier: <pilot | mvp | full>

CORE INSTALLATION
  ✓ .claude/         present with N subdirectories
  ✓ .product/        19 subdirectories (skeleton correct)
  ✓ CLAUDE.md        present
  ✓ .env             4 of 5 recommended keys configured
  ✓ .gitignore       ecosystem entries present

SPECS
  ✓ Product Module SPEC       (lines: 900)
  ✓ Design Module SPEC        (lines: 780)
  ✓ Integrator Module SPEC    (lines: 1200)
  ✓ Handoff SPEC              (lines: 945)

ARTIFACTS CATALOG
  ✓ 24 type files + README    (incl. LESSON-*, AM)

LESSON-* GATE (DEC-DEV-0062)
  ✓ lesson-gate.js registered (Stop, strict)
  ✓ lesson-presence-gate.js registered (PreToolUse+UPS, warn)

COMMANDS
  ✓ integrator/:   9           (research, map, gaps, status, journal, scan, add, remove, update)
  ✓ product/:      19          (Phase 2+ — init, feature, da-review, validate, ...)
  ✓ design/:       7           (Phase 6 — start, iterate, map, system, export, migrate, status)
  ✓ orchestrator/: 1           (run — first increment; P2/P4/P6/P7 deferred)
  ✓ ecosystem/:    5           (bootstrap, verify, update, pending-actions, enable-d7-audit)

MCP STACK
  ✓ Sequential Thinking   installed
  ✓ Firecrawl             installed
  ✓ Brave Search          installed
  ✗ Memory MCP            NOT installed — recommend /integrator:add memory-mcp
  ✗ Exa AI                NOT installed — optional

INTEGRATOR STATE
  Active tools: 3
  Contracts: 0
  Last journal: N days ago

GIT
  Branch: main
  Uncommitted: 0 files

OVERALL STATUS: ✓ Healthy

NEXT ACTIONS
  - (optional) Install Memory MCP: /integrator:add memory-mcp
  - Ready to begin: /product:init
  - Or review roadmap: cat .claude/ROADMAP.md
```

### Step 10: On issues

If **any 🔴 Critical check fails:**
- List failures explicitly
- Recommend remediation:
  - Missing `.claude/` → re-run `/ecosystem:bootstrap`
  - Missing critical SPECs → manual git clone or re-bootstrap
  - Corrupt `product.yaml` → re-create from scratch (ask user for values)
- DO NOT attempt auto-fix without explicit user approval.

If **only 🟡 Warnings:**
- List and suggest fixes
- Don't block user — they may have legitimate reasons

## What `/ecosystem:verify` is NOT

- Not a linter for product artifacts (use `/product:validate` for that)
- Not a contract verifier (use `/integrator:verify` for that)
- Not an update trigger (use `/ecosystem:update` to sync to latest)
- Not destructive — never modifies files

## Integration

- Runs automatically as Step 11 of `/ecosystem:bootstrap` (called once for verification)
- Can be run manually any time to catch state drift
- Future: will be part of periodic `ScheduleWakeup` check (post-v1)
