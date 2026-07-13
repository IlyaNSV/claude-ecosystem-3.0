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

**Expected command counts are DERIVED, not hardcoded (G33):** the generated command catalog
`.claude/docs/guide/02-commands.md` is auto-synced from the same `commands/**` frontmatter at
every cut (`gen-command-catalog.cjs`, drift-gated by `gen:catalog:check` in the repo's verify) —
it IS the per-version expectation. For each namespace (`ecosystem`, `integrator`, `product`,
`design`, `orchestrator`): count `/{namespace}:` command rows in the catalog vs `*.md` files in
`.claude/commands/<namespace>/` and report both numbers. A mismatch = the deploy and the catalog
came from different versions (re-run `/ecosystem:update`) or files were locally added/removed.

If the catalog file is absent (pre-guide-layer install) — report raw per-namespace counts
without expectations and note the missing catalog.

Runtime dirs (not commands, no catalog row — keep the structural minimums):
- `.claude/product/processes/*.mjs` — expect 3+ (complete-feature DEC-DEV-0142; consilium DEC-DEV-0145; batch-enrich-feature-set DEC-DEV-0150)
- `.claude/orchestrator/charters/*.json` — expect 1+ (feature-production-line — Process Fabric; engine `.claude/orchestrator/lib/fabric-engine.cjs` + co-located `autonomy-policy.cjs`, DEC-DEV-0153/0154)

**Skills (lazy-loaded methodology) — DERIVED the same way, and by NAME (DEF-CTX-5 closed):** the
generated skill catalog `.claude/docs/guide/08-skills.md` is auto-synced from the same `skills/**`
frontmatter at every cut (`gen-skill-catalog.cjs`, drift-gated by `gen:skills:check` in the repo's
verify). It is **item-granular** — it carries skill *names*, not just a count. For each module
(`ecosystem`, `product`, `design`, `integrator`, `orchestrator`): compare the `` `<module>/<name>` ``
rows of the catalog against `.claude/skills/<module>/*.md` and report both numbers **plus any
catalog name that has no file on disk**. A missing *name* is the partial/aborted-sync class
(DEC-DEV-0088) that a bare count can never see — a delivery that dropped one skill and added
another passes any count check. *Extra* local skills are fine: the ecosystem never removes them.

If the catalog file is absent (pre-guide-layer install) — report raw per-module counts without
expectations and note the missing catalog.

> **Note (DEC-DEV-0082, revised by G33 fix):** the old hand-maintained per-namespace number list
> lived here in parallel with the generated catalog and silently drifted (e.g. «~22» product
> commands). It is gone — the catalog is the single expectation source. An *extra* local command
> vs the catalog is almost never a fault; a *missing* one usually is.

> **Note (skills — DEF-CTX-5, closed):** skills used to be the exception — no generator, so this
> step held a hand-written floor («expect 63+»), machine-kept honest by `check-inventory-sync.cjs`.
> A floor cannot see a **count-preserving swap** (delete one skill, add another — i.e. any *rename*),
> and it can never answer «is `problem-discovery.md` still installed?». The floor and its
> `check-inventory-sync` class are gone; skills are now on the same derived, item-granular contract
> as commands.

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
| `consilium-synth.cjs` | `consilium.mjs` | decision-prep jury transports the shared deterministic synthesis (`--panel`) | DEC-DEV-0145 |
| `PREPARE-ONLY` | `consilium.mjs` | prepare-only rail (jury recommends, owner ratifies — PA never closed) | DEC-DEV-0145 |
| `CHECKPOINT-FIRST` | `batch-enrich-feature-set.mjs` | B2 rail — resumable manifest written before the first enrichment touch (урок E1) | DEC-DEV-0150 |
| `.batch-enrich/` | `batch-enrich-feature-set.mjs` | checkpoint dir layout (deterministic slug, per-FM state files) landed | DEC-DEV-0150 |

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

COMMANDS (deployed vs generated catalog 02-commands.md — Step 4 / G33)
  ✓ integrator/:   <n> = catalog <n>
  ✓ product/:      <n> = catalog <n>
  ✓ design/:       <n> = catalog <n>
  ✓ orchestrator/: <n> = catalog <n>
  ✓ ecosystem/:    <n> = catalog <n>
  ✓ product/processes: 3+       (complete-feature DEC-DEV-0142; consilium DEC-DEV-0145; batch-enrich-feature-set DEC-DEV-0150)

SKILLS (deployed vs generated catalog 08-skills.md — Step 4; by NAME, not just count)
  ✓ skills/ecosystem/:    <n> = catalog <n>
  ✓ skills/product/:      <n> = catalog <n>
  ✓ skills/design/:       <n> = catalog <n>
  ✓ skills/integrator/:   <n> = catalog <n>
  ✓ skills/orchestrator/: <n> = catalog <n>
  ✓ all catalog names present on disk   (a missing name = partial sync — DEC-DEV-0088 class)

ORCHESTRATOR CONTRACT (delivery spot-check — DEC-DEV-0101/0102/0104)
  ✓ validators_incomplete + committed_under_non_ready   (validate-feature-impl.mjs)
  ✓ conflicts.concat                                    (feature-to-tdd-impl.mjs)

PRODUCT WAVE-RUNNER CONTRACT (delivery spot-check — DEC-DEV-0142/0145/0150)
  ✓ delegated_unverified + gap-classifier.cjs           (complete-feature.mjs)
  ✓ consilium-synth.cjs + PREPARE-ONLY                  (consilium.mjs)
  ✓ CHECKPOINT-FIRST + .batch-enrich/                   (batch-enrich-feature-set.mjs)

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
