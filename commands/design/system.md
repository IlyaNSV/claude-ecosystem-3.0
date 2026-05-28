---
description: Design System management — review pending DS proposals OR force re-extract from specific MK. Mass-rename workflow surfaces preview + IDE find-replace guidance (atomic — v1.1+).
argument-hint: "[--review] [--update-from <MK-id>]"
---

# /design:system

User invoked: `/design:system $ARGUMENTS`

## Process

Manage `.product/design-system.md` (DS singleton). Two modes:

- **`--review`** — process pending DS proposals (queued by `design-system-rules.md` skill during D.5)
- **`--update-from <MK-id>`** — force re-extract from specific MK (corrective workflow)
- **No args** — show DS dashboard summary (delegate к `/design:status` partial output for DS section)

### Step 1: Parse arguments

```
IF --review AND --update-from BOTH present → reject; pick one
IF --update-from supplied without value → reject; show usage
ELSE proceed по mode
```

Usage:
```
/design:system                              # DS dashboard summary
/design:system --review                     # process .product/.pending/ds-pending.yaml
/design:system --update-from MK-003         # re-extract tokens/components from MK-003
```

### Step 2: Verify prerequisites

- `.product/design-system.md` exists (else surface: «No DS. First /design:start FM-NNN creates DS skeleton.»)
- For `--review`: `.product/.pending/ds-pending.yaml` exists (else: «No pending proposals»; exit cleanly)
- For `--update-from <MK-id>`: MK file exists и status в {active, review}

### Step 3: `--review` mode

Load `.product/.pending/ds-pending.yaml`. Group by category (color / typography / spacing / etc.) и type (token / component / pattern).

Surface batch summary:

```
DS pending proposals (from <N> MK extractions):

NEW TOKENS:
  Colors (<count>):
    [1] DS.color.<name> = <value>   — usage: «<context>», source: MK-NNN
    [2] DS.color.<name> = <value>   — usage: «<context>», source: MK-MMM
  Typography (<count>):
    ...
  Spacing (<count>):
    ...

NEW COMPONENTS:
  ...

SYNONYM CANDIDATES:
  [N] DS.color.brand-blue (#3B83F8) ~~ existing DS.color.primary (#3B82F6) [Δ=2 hex digits]
      Options для resolution: use existing | add new | mass-rename existing → proposed

Options:
  [accept-all] Approve all proposals (tokens, components, patterns) — DS appended
  [reject-all] Discard все proposals — clear pending queue
  [per-item]   Walk через each — individual accept / reject / synonym-merge
  [exit]       Leave pending queue intact; review later
```

**Per-item walk:**

For each proposal:

```
Proposal DSP-<NNN>:
  Category: <category>
  Type: <token | component | pattern>
  Name: <DS.x.y>
  Value: <value>
  Usage context: «<excerpt из source MK>»
  Source: MK-NNN
  Synonym warning: <DS.x.y exists at <value> [Δ=N]> (if any)

Options:
  [accept]  Add to DS as proposed
  [rename]  Accept with different name — prompts replacement name
  [merge <existing-id>]  Use existing token instead — DS не gains entry; MK reference rewrites (см. Step 5)
  [reject]  Drop proposal; flag MK для manual fix
  [defer]   Keep in pending; come back later
  [skip]    Move к next без decision
```

After processing all:
- Write accepted proposals к DS body (token tables / Component Library Index / Pattern Library)
- Bump `DS.frontmatter.token_count`, `component_count`, `pattern_count`, `version`, `updated`, `last_extraction_at`
- Update `.product/.pending/ds-pending.yaml`: remove processed entries; keep deferred / skipped

### Step 4: `--update-from <MK-id>` mode

Force re-scan of single MK (corrective workflow):

```
Scenarios where useful:
  • MK created без auto-DS extraction (legacy)
  • MK modified outside /design:iterate (manual edit) — DS missed updates
  • DS proposals дропнули case [reject-all] — но MK still needs entries
```

Algorithm:
1. Load MK; parse Component State Matrix + Interaction Spec
2. Re-run `skills/design/design-system-rules.md` Step 2 (token extraction) against MK
3. Same proposal UX as `--review` per item (accept / rename / merge / reject)
4. На completion:
   - DS updated with accepted entries
   - MK Design Decisions Log gets entry: «<date>: DS sync re-run via /design:system --update-from»

### Step 5: Merge-mode rewrite cascade

Если user picks `[merge <existing-id>]` для proposal (e.g., new token treated as alias of existing):
- Find все references к proposal's name in source MK (e.g., если proposal would have been DS.color.brand-blue, but user chose merge с DS.color.primary)
- Surface preview: «N occurrences в MK-NNN — rewrite к existing token? [Y/N]»
- If Y → in-place rewrite в MK body; bump MK.version
- If N → keep MK as-is; user does manual cleanup later

### Step 6: Mass-rename workflow (manual в v1.0 per design-system-rules.md Step 5)

Если user proposes к rename existing token (e.g., propose: «rename DS.color.primary → DS.color.brand-blue»):

Surface preview:

```
Mass-rename DS.<old> → DS.<new>:
  Affected files:
    - .product/mockups/MK-001-login.md (3 occurrences)
    - .product/mockups/MK-003-revisions.md (1 occurrence)
    - .product/design-system.md (5 occurrences: token entry + deprecation entry + Component Library refs)
  Total: 9 changes across 3 files.

v1.0 ships MANUAL mass-rename. Suggested workflow:
  (a) Use IDE find-replace для «DS.<old>» → «DS.<new>» across .product/
  (b) После replace: run /product:cascade (V-11 verifies bi-dir refs)
  (c) Run /product:validate (V-08 terminology check, V-MK-08 token coverage)
  (d) Manual review old token alt_terms section в DS body (this command can populate placeholder)

Atomic /design:ds-rename — deferred к v1.1+ (см. dev/v1_1_backlog.md «Atomic mass-rename»).

Options:
  [populate-skeleton]  Write Deprecated tokens entry в DS body now (skeleton; user fills migration after manual rename)
  [abort]              Cancel — keep DS unchanged
```

If `[populate-skeleton]`:
- Append к DS body Deprecated tokens section:
  | DS.<old> | DS.<new> | <today> | TODO: confirm full migration applied |
- Bump DS.version

User completes IDE find-replace + cascade-check + validate manually.

### Step 7: No-args dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Design System Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tokens:     <N> (colors: X, typography: Y, spacing: Z, ...)
Components: <M>
Patterns:   <K>
Deprecated: <D>
Version:    <V>
Last extraction: <YYYY-MM-DD>

Pending proposals (.product/.pending/ds-pending.yaml):
  Tokens proposed: <X>
  Components proposed: <Y>
  Patterns proposed: <Z>
  Synonyms flagged: <S>

What's next:
  /design:system --review                  — process pending
  /design:system --update-from <MK-id>     — re-extract from specific MK
```

## Important constraints

- **Hard gate analog при mass-rename.** Manual workflow в v1.0 — preview + IDE find-replace required; никаких auto-rename в `--review` flow. Atomicity = v1.1+.
- **DS pending queue persisted.** `.product/.pending/ds-pending.yaml` survives sessions. Deferred entries remain.
- **Deprecated tokens never deleted immediately.** Audit history; only purge after grace period + zero references confirmed.
- **Merge cascade is opt-in.** Default per-item walk does не auto-rewrite MK; user explicitly chooses `[merge]` for cascade.

## Error handling

| Error | Action |
|---|---|
| `.product/design-system.md` missing | Surface: «No DS. Run /design:start FM-NNN first.»; exit |
| Pending queue file missing | Treat as zero pending; show no-args dashboard with «no pending» |
| `--update-from <MK-id>` not found | List active MKs; abort |
| Pending file malformed YAML | Surface error; do NOT auto-rebuild; suggest manual fix OR backup + clear |
| User chose [merge <id>] but `<id>` не exists в DS | Re-prompt с valid options |
| Cascade rewrite в MK fails (file permissions) | Surface error; DS update aborted; pending queue intact |

## Related

- Process: `.claude/docs/design-module/SPEC.md §3.3` (`/design:system` brief)
- Parent skill: `design-system-rules.md` (extraction algorithm, mass-rename Step 5 manual workflow)
- Artifact spec: `.claude/docs/pmo/artifacts/DS.md`
- Validation: `.claude/docs/pmo/validation.md` V-MK-08 (token coverage check uses regex /DS\.\w+\.\w+/)
- Companion commands:
  - `/product:cascade` — V-11 bi-dir consistency after mass-rename
  - `/product:validate` — V-08 + V-MK-08 token consistency check
  - `/design:status` — partial DS summary inherits
- v1.1+ unlock: atomic `/design:ds-rename` (deferred per v1_1_backlog.md «Atomic mass-rename» entry)
