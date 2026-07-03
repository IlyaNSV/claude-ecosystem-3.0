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
- `.claude/commands/product/*.md` — may be 0 or more (Phase 2+; current baseline ~20)
- `.claude/commands/design/*.md` — may be 0 or more (Phase 6; current baseline 7)
- `.claude/commands/orchestrator/*.md` — expect 1+ (run — dispatches processes P2–P7; only deploy/rollback deferred)
- `.claude/commands/ecosystem/*.md` — expect 7 (bootstrap, verify, update, pending-actions, enable-d7-audit, meta-feedback, research)
- `.claude/product/processes/*.mjs` — expect 1 (complete-feature — the completeness-loop Workflow wave-runner; new top-level runtime dir mirroring `.claude/orchestrator/processes/`, DEC-DEV-0142)

Report counts + note what's expected for current ROADMAP phase.

> **Note (DEC-DEV-0082):** these per-namespace counts are a **baseline snapshot as of the
> current ecosystem version**, not a hard contract — new commands land between cuts. A mismatch
> may mean drift in **this list** (it wasn't refreshed when a command was added) as easily as a
> defective install. Investigate which before raising a ❌; an *extra* command vs. this baseline
> is almost never a fault.

### Step 4.5: Orchestrator gate-contract freshness (delivery spot-check)

Step 5 (version drift) catches *"you never updated"*. This catches the subtler *"the update ran
but a file didn't actually land"* — a **partial / aborted sync** (the DEC-DEV-0088 class, where an
aborted `/ecosystem:update` left later namespaces stale even though `ecosystem_version` re-stamped).
Counting command *files* (Step 4) can't see it; the file is present but its **contents** are old.

Spot-check that the installed Orchestrator gate carries its current **return-contract markers** —
search each installed `.mjs` for the marker string (e.g. `grep -F`):

| Marker (string in the installed file) | File (`.claude/orchestrator/processes/`) | Proves landed | Since |
|---|---|---|---|
| `validators_incomplete` | `validate-feature-impl.mjs` | FB-LR-15 loud validator-drop degrade | DEC-DEV-0101 |
| `committed_under_non_ready` | `validate-feature-impl.mjs` | FB-LR-16 non-READY commit disclosure | DEC-DEV-0102 |
| `conflicts.concat` | `feature-to-tdd-impl.mjs` | FB-LR-19 P5 surfaces the nested P6 conflicts | DEC-DEV-0104 |

Report ✓ present / ❌ absent per marker.

> **Caveat (same discipline as Step 4, DEC-DEV-0082):** this marker list is a **baseline snapshot of
> the current gate contract**, not a hard schema. An **absent** marker most likely means a stale or
> **partial** `/ecosystem:update` → re-run it (and check the update didn't abort midway). But if the
> gate contract legitimately evolved and **this list** wasn't refreshed, that's list-drift, not a bad
> install — investigate which before raising ❌. This is a **delivery presence** check, NOT a
> behavioral one: that the gate *behaves* correctly is validated by a **live Orchestrator run** graded
> post-hoc, never here. (The non-drifting version — markers generated from the `.mjs` return objects
> rather than hand-listed — is a deferred follow-up.)

### Step 4.6: Product wave-runner contract freshness (delivery spot-check)

Same rationale as Step 4.5, applied to the new top-level `.claude/product/processes/` runtime
dir (the completeness-loop Workflow wave-runner, DEC-DEV-0142) — a partial/aborted sync could
leave it present (Step 4 count passes) but stale (contents pre-date the wiring).

| Marker (string in the installed file) | File (`.claude/product/processes/`) | Proves landed | Since |
|---|---|---|---|
| `delegated_unverified` | `complete-feature.mjs` | rail-5 completion report surfaces unverified delegation | DEC-DEV-0142 |
| `gap-classifier.cjs` | `complete-feature.mjs` | deterministic CLASSIFY wiring (`hooks/product/lib/gap-classifier.cjs`) landed | DEC-DEV-0142 |

Report ✓ present / ❌ absent per marker.

> **Caveat (same discipline as Step 4.5, DEC-DEV-0082):** this marker list is a **baseline
> snapshot of the current wave-runner contract**, not a hard schema. An absent marker most
> likely means a stale or partial `/ecosystem:update` → re-run it. But if the contract
> legitimately evolved and **this list** wasn't refreshed, that's list-drift, not a bad install
> — investigate which before raising ❌. Delivery presence only — behavior is validated by a
> **live completeness-loop run** graded post-hoc, never here.

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
  ✓ product/:      20          (Phase 2+ — init, feature, da-review, validate, complete, ...)
  ✓ design/:       7           (Phase 6 — start, iterate, map, system, export, migrate, status)
  ✓ orchestrator/: 1           (run — first increment; P2/P4/P6/P7 deferred)
  ✓ ecosystem/:    7           (bootstrap, verify, update, pending-actions, enable-d7-audit, meta-feedback, research)
  ✓ product/processes: 1       (complete-feature — completeness-loop wave-runner; DEC-DEV-0142)

ORCHESTRATOR CONTRACT (delivery spot-check — DEC-DEV-0101/0102/0104)
  ✓ validators_incomplete + committed_under_non_ready   (validate-feature-impl.mjs)
  ✓ conflicts.concat                                    (feature-to-tdd-impl.mjs)

PRODUCT WAVE-RUNNER CONTRACT (delivery spot-check — DEC-DEV-0142)
  ✓ delegated_unverified + gap-classifier.cjs           (complete-feature.mjs)

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
