---
description: "On-demand validation of .product/ artifacts. Runs V-01..V-16 + V-H-01..V-H-11 catalog per tier in product.yaml. Filtering --rule, --scope, --tier. --deep for severity uplift. Output: markdown report inline + JSON file."
argument-hint: "[--rule V-NN] [--scope <glob>] [--tier blocking|warning|info] [--deep] [--report-format json|markdown|both]"
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(node:*), Bash(date:*)
---

# /product:validate

User invoked: `/product:validate $ARGUMENTS`

Загружает skill `validation-runner.md` и executes validation rules across `.product/`. Surface report с findings, severity breakdown, suggested fixes.

## Process

### Step 1: Parse arguments

Parse `$ARGUMENTS`:

- `--rule V-NN` — single rule filter (e.g., `--rule V-11`, `--rule V-H-04`)
- `--scope <glob>` — artifact filter (e.g., `--scope "BR-*"`, `--scope "FM-001"`)
- `--tier <blocking|warning|info>` — severity threshold; default per `.claude/product.yaml.validation_tier`
- `--deep` — severity uplift: all rules treated 🔴; effective tier = `full`
- `--report-format <json|markdown|both>` — default both
- No args → full validation per current tier

Invalid args → show usage:

```
Usage:
  /product:validate                              # full per current tier
  /product:validate --rule V-11                  # single rule
  /product:validate --scope "BR-*"               # artifact subset
  /product:validate --deep                       # strict pre-release
  /product:validate --tier blocking              # severity threshold
  /product:validate --report-format json         # JSON only
```

### Step 2: Check prerequisites

- `.claude/product.yaml` exists (project bootstrapped)
- `.product/` directory exists

Если нет — refuse с suggestion `/ecosystem:bootstrap`.

### Step 3: Load skill

Load `.claude/skills/product/validation-runner.md` per methodology.

### Step 4: Execute per skill instructions

1. Read `product.yaml.validation_tier` (или override per `--deep`)
2. Glob `.product/**/*.md` artifacts, parse frontmatter
3. Read `.product/.pending/validation-pending.yaml` если exists
4. Per applicable rule (filtered by `--rule`, effective tier, `--scope`):
   - Apply check method per skill rule catalog
   - Collect findings: `{rule, severity, artifact, message, suggested_fix}`
5. V-11 auto-fix inline (rare; Edit missing reverse refs)
6. Auto-purge stale pending entries (per DEC-DEV-0023 F5 pattern)
7. Generate report per skill output format spec

### Step 5: Write report

Ensure directory:
```bash
mkdir -p .product/.reports
```

Write per `--report-format`:
- `markdown` (default) → `.product/.reports/validate-<YYYYMMDD-HHMM>.md` + surface inline в conversation
- `json` → `.product/.reports/validate-<YYYYMMDD-HHMM>.json` only
- `both` (default) → both files; markdown surfaced inline

Timestamp format: `date +%Y%m%d-%H%M` (local timezone).

### Step 6: Surface inline summary

После file write:

```
Validation complete (tier: <effective>, deep: <true|false>):
  🔴 Blocking: <N>
  🟡 Warning: <N>
  🔵 Info: <N>

Auto-fixed: <N> V-11 bi-dir refs
Pending purged: <N> stale entries from validation-pending.yaml

Report: .product/.reports/validate-<YYYYMMDD-HHMM>.md
        .product/.reports/validate-<YYYYMMDD-HHMM>.json

Top blocking:
  V-01 : FM-007 has no active SC
         → /product:feature FM-007

Next actions:
  /product:validate --rule V-01      # focus single blocking
  /product:validate --deep           # strict pre-release pass
  /product:cleanup --dry-run         # V-15 orphan detection preview (Phase 4.G; default = orphan-only, --pending-hygiene для full sweep)
```

При **0 findings**: «✅ Validation clean (tier: <effective>). N rules evaluated.»

## Anti-patterns

1. **Не запускать после каждого save.** Inline check — это `artifact-validate.js` hook. `/product:validate` — on-demand для periodic / pre-release.

2. **Игнорировать `--deep` перед критическими событиями.** Pre-handoff, pre-release: `--deep` обязателен — strict severity uplift catches «warnings которые становятся blocking когда ставки выше».

3. **Не пушить report files в git.** `.product/.reports/` gitignored per `.gitignore.template`.

4. **V-MK-* explicit request без Design module.** Skill returns graceful note (Phase 6 conditional). Не treat как failure.

5. **Не интерпретировать V-11 auto-fixed как clean pass.** Auto-fix reported separately в summary; underlying issue (missed bi-dir ref) — signal что artifact author skipped V-11 self-check.

## Output writing protocol

Report files живут в `.product/.reports/`. Directory:
- Gitignored per `gitignore.template`
- Auto-created при первом запуске (`mkdir -p`)
- Не cleaned automatically — user может archive / delete по своей discretion

Если `.product/.reports/` grows large (>50 reports), surface к user: «Reports directory has N files; consider cleanup if not needed для audit».

## Related

- Skill: `.claude/skills/product/validation-runner.md` (implementation methodology, rule catalog)
- Catalog spec: `.claude/docs/pmo/validation.md` (human-readable, 25 rules)
- Inline hook (Phase 2): `.claude/hooks/product/artifact-validate.js`
- Pending state: `.product/.pending/validation-pending.yaml`
- Related commands:
  - `/product:cleanup` (Phase 4.G shipped) — V-15 orphan detection (default) + `--pending-hygiene` для cascade/validation/da pending sweep
  - `/product:handoff` (Phase 4.E) — DoR consumes V-H-* subset (re-uses hash utility)
  - `/product:status` — counts pending findings (high-level dashboard)
  - `/product:cascade --pending` — cascade-pending review
