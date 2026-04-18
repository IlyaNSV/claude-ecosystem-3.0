---
description: Read or modify Product Module configuration (.claude/product.yaml).
argument-hint: "[--show | --edit <key> <value>]"
---

# /product:config

User invoked: `/product:config $ARGUMENTS`

## Process

### Step 1: Parse arguments

- No args OR `--show` — display current config
- `--edit <key> <value>` — change specific setting, with validation
- `--reset <key>` — reset to default value
- `--validate` — check config against schema, report inconsistencies

### Step 2: Load config

Read `.claude/product.yaml` (project) + `~/.claude/product-config.yaml` (global defaults).

If project config missing — show global + offer to create project override.

### Step 3: Display (default mode)

```
═══════════════════════════════════════════════════════════
PRODUCT MODULE CONFIGURATION
═══════════════════════════════════════════════════════════

Project: <name>
Config file: .claude/product.yaml

── Discovery ──────────────────────────────────────────────
  default_discovery_mode: quick              (options: quick | deep)

── Validation (B1 modification) ───────────────────────────
  validation_tier: pilot                     (options: pilot | mvp | full)
    pilot  = only 🔴 Blocking rules inline
    mvp    = + 🟡 Warning rules
    full   = all 33 V-* rules

  draft_mode_quiet_hooks: true               (B2 — quiet hooks during draft)

── Auto-approve (A1 modification) ─────────────────────────
  auto_approve_confirmation_artifacts:
    enabled: true                            (🟢 Confirmation artifacts)
    requires_high_confidence: true           (if false: medium тоже auto)

── NFR (opt-in per DEC-NFR-F08) ───────────────────────────
  nfr_default_tier: mvp                      (options: mvp | mmp | growth | mature)

── Stale detection ────────────────────────────────────────
  stale_draft_days: 14                       (V-12 threshold)

── Language ───────────────────────────────────────────────
  language: ru                               (persona's dialogue language)
                                             tool-docs always english (DEC-INT-O13)
                                             handoff in project language

── Session recovery ───────────────────────────────────────
  session_lock_timeout_minutes: 60           (OQ-PM-03 concurrent session detection)

Changes → /product:config --edit <key> <value>
```

### Step 4: Edit mode

`/product:config --edit validation_tier mvp`:

1. Validate value against enum
2. Read current value
3. Show diff:
   ```
   validation_tier:
     current: pilot
     new:     mvp
   ```
4. Ask rationale (required for tier upgrade, optional for tier downgrade): `Reason for change?`
5. Apply to `.claude/product.yaml`
6. Journal entry in `.product/.decisions/journal.md` (or global if affects shared config):
   ```
   DEC-CFG-<NNN> — validation_tier: pilot → mvp
   Date: <timestamp>
   Reason: <user rationale>
   Effective: immediate
   ```
7. If tier change triggers re-evaluation of queued validation findings — show summary

### Step 5: Validate mode

`/product:config --validate`:

- Check config against schema (fields present, values in valid enum)
- Check consistency (e.g., `validation_tier: full` but `draft_mode_quiet_hooks: true` → warning that full tier expects all surfacing)
- Report issues as 🔴/🟡/🔵 list

## Important constraints

- **Human approve required** для edits — не silently change
- **Journal entry mandatory** для tier changes (B1), auto_approve toggle (A1), quiet_hooks toggle (B2)
- **Schema validation** перед write — не допускать invalid values
- **Atomic writes** — don't corrupt yaml on partial edit

## Related

- `.claude/product.yaml` schema — `docs/product-module/SPEC.md §3.4` + §14.1
- Global defaults — `~/.claude/product-config.yaml` (set up by `/ecosystem:bootstrap`)
