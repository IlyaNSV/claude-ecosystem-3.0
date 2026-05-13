---
description: Generate universal handoff для FM-NNN — 13-section markdown с embedded artifact excerpts + SHA-256 hashes для drift detection. Two modes — --mode draft (3-blocker DoR, status partial) и --mode production (8-blocker DoR, status ready). --regenerate force version++. --with-da-review invokes pre-gen DA. Output: .product/handoffs/FM-NNN-handoff.md.
argument-hint: "<FM-id> [--mode draft|production] [--regenerate] [--with-da-review]"
allowed-tools: Read, Glob, Grep, Edit, Write, SlashCommand, Bash(node:*), Bash(mkdir:*), Bash(date:*)
---

# /product:handoff

User invoked: `/product:handoff $ARGUMENTS`

Generates universal handoff для FM-NNN. Loads skill `handoff-generator.md`.

## Args

- `<FM-id>` — required (e.g., `FM-001`)
- `--mode draft | production` — default `production`
- `--regenerate` — force regeneration version++ даже без drift (Ambiguity 14)
- `--with-da-review` — invoke `/product:da-review FM-<NNN>` перед generation (DEC-DEV-0026 hybrid; Phase 4.H shipped — real SlashCommand invocation, critical pending findings block handoff)
- **RL-NNN bundle handoff:** deferred к v1.1+; Phase 4 ships FM-NNN scope only

Invalid args → show usage:
```
Usage:
  /product:handoff FM-001                              # default production mode
  /product:handoff FM-001 --mode draft                 # relaxed DoR (3 blockers)
  /product:handoff FM-001 --regenerate                 # force version++
  /product:handoff FM-001 --with-da-review             # invoke DA pre-gen
  /product:handoff FM-001 --mode production --regenerate --with-da-review
```

## Steps

1. **Parse args** from `$ARGUMENTS`.

2. **Verify prerequisites:**
   - FM-id matches `^FM-\d{3}$`
   - `.product/features/<FM-id>-*.md` exists (glob)
   - Project bootstrapped (`.claude/product.yaml` + `.product/` exist)
   
   Иначе refuse с suggestion (`/ecosystem:bootstrap` если no project; list available FMs если FM-id wrong).

3. **Load skill** `.claude/skills/product/handoff-generator.md` per methodology.

4. **Execute** per skill instructions:
   - Step 1-2: parse + load FM frontmatter
   - Step 3: drift detection (если handoff file exists)
   - Step 4: `--with-da-review` flag handling (Phase 4.H shipped: SlashCommand → `/product:da-review FM-<NNN>`, critical pending findings block handoff) или soft DoR warning (>7 days old DA)
   - Step 5: DoR validation per mode (V-H-* checks)
   - Step 6: `approve_overrides[]` handling (D2 modification)
   - Step 7: Compute artifact hashes via `hooks/product/lib/hash.js`
   - Step 8: Generate body — 13 sections; NFR section three cases per FM.nfr_status
   - Step 9: Assemble frontmatter
   - Step 10: Write `.product/handoffs/FM-<NNN>-handoff.md` (если status != blocked)
   - Step 11: Surface result inline

5. **Surface inline** per skill Step 11 (status ready / partial / draft / blocked variants).

## Hash computation invocation

Skill uses `hooks/product/lib/hash.js` через Bash node:
```bash
node -e "const h=require('.claude/hooks/product/lib/hash.js'); console.log(h.computeArtifactHash('<path>'));"
```

Single utility = source of truth для cross-platform hash (per DEC-DEV-0025 C.1 + DEC-DEV-0030):
- Body markdown без frontmatter
- LF normalized (strip CR)
- SHA-256 → `sha256:<hex64>`

Sub-phase F (`product-handoff-gate.js` PostToolUse non-blocking hook) использует тот же module.

## Anti-patterns

1. **Не bypass DoR через manual editor.** Если `/product:handoff` reports `blocked` — fix underlying issues, не manually edit handoff file. `approve_overrides[]` в FM frontmatter — formal mechanism для temporary blocker bypass (D2).

2. **Не edit hash values manually.** `artifact_hashes` derived field — re-generated each handoff invocation. Manual edits create false negatives в drift detection.

3. **`--mode draft` для всех handoffs — anti-pattern.** Per handoff-spec.md «DoR mode misuse»: draft предназначен для PoC. Routine production handoffs use `--mode production`.

4. **Hash drift ignored — silent stale handoff.** Per V-H-04: drift → `status: stale`. Receivers must check status field перед consuming.

5. **`--with-da-review` bypass via manual edit.** Phase 4.H shipped skill `product-da-review.md` + real SlashCommand invocation + critical-pending gate. Pre-flight safe-guard (existence check для skill file per b8f16bc B3) теперь natural'но passes — skill exists; flow proceeds к real DA invocation. Не bypass через editing handoff frontmatter manually; критические DA findings блокируют generation by design. Resolve через `/product:da-review FM-NNN` interactive [Act/Defer/Dismiss/Skip] до re-invoke handoff.

## Related

- Skill: `.claude/skills/product/handoff-generator.md`
- Hash utility: `.claude/hooks/product/lib/hash.js`
- Spec: `.claude/docs/product-module/handoff-spec.md` (full handoff format reference)
- DoR validation: V-H-01..V-H-11 (см. `skills/product/validation-runner.md` V-H-* matrix и `docs/pmo/validation.md §5.2`)
- Phase 4 cross-refs:
  - sub-phase C: `validation-runner.md` V-H-* matrix shared
  - sub-phase D: handoff §11 NFR consumes `FM.nfr_status` + NFR artifacts
  - sub-phase F: `product-handoff-gate.js` PostToolUse non-blocking re-uses `lib/hash.js` для V-H-04 drift detection
  - sub-phase H (shipped): `--with-da-review` invokes `/product:da-review` через SlashCommand; consumes `.product/.da-findings/FM-<NNN>-<timestamp>.md` с `source: auto-pre-handoff`; critical pending findings refuse continue
- Receiver chain: handoff → adapter (Integrator Phase 5+) → external tool (cc-sdd, Kiro, etc.)
