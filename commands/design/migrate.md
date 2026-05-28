---
description: Migrate MK design_tool between Stitch ↔ HTML (v1.0 per DEC-DEV-0052 C3 cut; Claude Design path → v1.1). Hard approve gate per-MK (Q1). Lossy regeneration via brief + MK metadata + DS snapshot; previous_tools[] audit trail; rollback on regen failure.
argument-hint: "<MK-id|--all> --to <stitch|html> [--reason \"<text>\"]"
---

# /design:migrate

User invoked: `/design:migrate $ARGUMENTS`

## Process

Switches `design_tool` для one or many MK artifacts. Migration is **lossy** — visual representation re-created в target tool через brief + saved MK metadata; element-level tweaks lost per SPEC §16.2. v1.1 hooks (`ir_snapshot_path`, `ir_export.enabled`) prepare ground для lossless IR — noop в v1.0.

### Step 1: Parse arguments

- **`<MK-id>` matches `^MK-\d{3}$`** — single MK target
- **`--all`** — batch mode (iterates через all active MK с individual approve per Q1 — НЕТ batch-bypass)
- **`--to <target>`** — required; accepted values: `stitch`, `html`
- **`--to claude-design`** — **REJECTED в v1.0** (per Q6/C3): respond:
  > Claude Design migration: v1.1+ (deferred per DEC-DEV-0052 cut C3).
  > Tracker: `dev/v1_1_backlog.md` «Design Module — `/design:migrate` Stitch ↔ Claude Design path (C3 cut)».
  > Workaround v1.0: manual workflow per `skills/design/claude-design-workflow.md` stub.
- **`--reason "<text>"`** — optional reason для `previous_tools[].reason`; если omitted prompts user inline
- **Empty / invalid** → show usage:
  ```
  Usage:
    /design:migrate MK-001 --to html              # single MK Stitch → HTML
    /design:migrate MK-003 --to stitch            # single MK HTML → Stitch
    /design:migrate --all --to html               # batch с per-MK approve gate
    /design:migrate MK-001 --to html --reason "Stitch quota exhausted"
  ```

### Step 2: Verify prerequisites

- For each MK targeted:
  - `.product/mockups/<MK-id>-*.md` exists
  - `MK.status: active` (refuse если `draft` / `review` / `deprecated`)
  - `MK.design_tool != <target>` (refuse: «already on <target>»)
- `<target>` валиден per enum (только stitch / html в v1.0)
- For `--to stitch`: Stitch MCP registered (else suggest `/integrator:add stitch-mcp` first)
- For `--to html`: always available

### Step 3: Pre-flight summary

For each MK targeted:

```
Migration target preview:
  MK-NNN — <title>
    Current: <design_tool> (project URL: <url или —>)
    Target:  <target>
    Iteration: <count>
    Linked SC: <ids>
    DS dependencies: <count tokens used>

Migration consequences (lossy v1.0):
  • Visual representation re-created в target tool через brief + MK metadata
  • Element-level tweaks (color shift, spacing fine-tune) НЕ migrate — будут regenerated
  • Tool-specific features (Stitch animations, etc.) lost — only saved Design Decisions Log preserves
  • previous_tools[] audit entry written before regen
  • Source-tool URL stays в previous_tools[].url но visual может стать orphan (known limitation v1)
```

### Step 4: Hard approve gate per-MK (Q1 — DEC-DEV-0052)

**Critical: per-MK granularity. `--all` iterates с individual approve. NO batch-bypass.**

For each MK in target set:

```
STOP. Lossy regeneration via brief — visual tweaks потеряются.
Approve migration для MK-NNN? [Y/N/defer]

  [Y]      Approve — proceed с migration для MK-NNN
  [N]      Reject — skip этот MK; continue к next (если --all) или exit
  [defer]  Save deferred decision к journal; skip; continue
  [details] Expand consequences / DS impacts / iteration history — re-prompt gate

Your choice?
```

**Silence is NOT consent.** Wait for explicit user response. AI MUST NOT auto-chain.

If [Y] → proceed Step 5 для этой MK.
If [N] → skip MK; log decision к `.product/.decisions/journal.md` («Migration MK-NNN → <target> rejected by user»).
If [defer] → log deferred decision; skip.
If [details] → expand context (DS tokens affected, iteration count, last-iteration timestamp); re-prompt gate.

### Step 5: Execute migration per approved MK

**A8 atomic sequence** (write previous_tools[] FIRST, regen SECOND):

```
1. Read MK frontmatter; capture current state:
   {current_tool: stitch, current_url: <url>, iterations: <count>}

2. Append previous_tools[] entry (write FIRST):
   previous_tools:
     - tool: <current_tool>
       url: "<current_url>"
       switched_at: <ISO timestamp>
       reason: "<from --reason flag OR prompted inline>"
       iterations_at_switch: <iteration count>

3. Update frontmatter:
   tool_switched_at: <ISO>
   (design_tool / tool_project_url не yet — wait для regen success)

4. Write MK frontmatter changes; commit-able state.

5. Regenerate в target tool:
   - Load skill per target:
     - target=stitch → skills/design/stitch-workflow.md (Pattern A: full re-generation as initial)
     - target=html → skills/design/html-fallback.md (single-page generation)
   - Construct brief from MK metadata: Screen Inventory + Component State Matrix + DS snapshot + Accessibility Notes + Design Decisions Log (для context — what already decided)
   - Execute generation; capture new URL / file path

6. ROLLBACK ON FAILURE:
   IF regen fails (MCP error, timeout, generation returned empty):
     - REVERT: delete last previous_tools[] entry just added
     - REVERT: clear tool_switched_at = null (or prior value if previous switch existed)
     - design_tool / tool_project_url stay UNCHANGED (old tool intact)
     - Surface error к user: «Migration MK-NNN failed: <reason>. Rolled back; MK stays на <current_tool>.»
     - LOG к journal

7. ON SUCCESS:
   - Update frontmatter:
     design_tool: <target>
     tool_project_url: "<new url или file path>"
   - Append к MK Design Decisions Log:
     `<date> (migration iter <N+1>): Migrated from <old_tool> к <target_tool>. Reason: <reason>. URL <old> → <new>.`
   - Increment MK.iteration += 1 (per migration = significant iteration per SPEC §3.6 Approve gate 🟠 Strategic)
   - Hook `design-artifact-validate.js` (sub-phase G) fires PostToolUse on MK write — re-validates per Q8 quiet-draft logic (MK.status=active — surfaces findings)

8. Save decision journal entry:
   - Source: design
   - MK-NNN migration approved
   - Old / new tool + URLs
   - Iteration counter at switch
```

### Step 6: Batch (--all) progress

При `--all`, iterate через all active MK:

```
For each MK active в .product/mockups/:
  Fire Step 3 preview
  Fire Step 4 hard gate (per-MK — NEVER batch-skip)
  IF approved → execute Step 5
  Aggregate result: {migrated, skipped, deferred, failed}

After all processed:
  Surface summary:
    Migrated:  <N> MKs (list)
    Skipped:   <M> MKs (rejected by user)
    Deferred:  <K> MKs (defer choice — see journal)
    Failed:    <L> MKs (rolled back — see journal для error details)
```

### Step 7: Post-migration verify

For each migrated MK:
- Run `skills/design/design-validation.md` quick subset (V-MK-08 token coverage + V-MK-05 accessibility)
- Surface findings inline (non-blocking — already migrated)

### Step 8: Idempotency check

Если user runs `/design:migrate MK-NNN --to <target>` again where `MK.design_tool == <target>` already:
- Refuse: «MK-NNN already on <target>. Migration is no-op.»
- Do NOT re-fire hard gate (gate spam = anti-pattern).

## Important constraints

- **Hard approve gate per-MK is invariant.** No `--force` flag bypasses Q1. Pattern mirrors DEC-DEV-0047 §7.6 `/integrator:research` Step 7.
- **`--to claude-design` rejected explicitly.** v1.0 schema enum includes claude-design но command logic refuses. Будет unlocked в v1.1 (см. v1_1_backlog C3 entry).
- **A8 atomicity:** `previous_tools[]` written before regen; rollback removes last entry если regen fails. design_tool / tool_project_url stay unchanged until regen succeeds.
- **Lossy nature explicit.** Migration не preserves visual tweaks; brief + DS + Design Decisions Log = best regeneration substrate.
- **Iteration counter += 1 per migration.** Migration считается significant iteration (🟠 Strategic) per SPEC §3.6.
- **No automatic DS adjustments на migration.** Если new tool generates новый tokens — те queue normally через `design-system-rules.md` next session (не inline).

## Error handling

| Error | Action |
|---|---|
| `<MK-id>` not found | List active MKs |
| `--to <target>` not in {stitch, html} | Reject; show valid enum (v1.0 limitation noted) |
| `--to claude-design` | Reject с C3 v1_1_backlog reference |
| MK.status != active | Refuse: «MK <status> — migration applies only к active» |
| MK.design_tool == target | No-op idempotency message |
| Stitch MCP unavailable for --to stitch | Suggest `/integrator:add stitch-mcp`; abort |
| Regeneration fails / timeout | A8 rollback; surface error; offer retry OR `--to html` fallback |
| User Ctrl-C during regen (mid-write previous_tools[]) | Manual recovery: inspect frontmatter; remove orphan previous_tools[] entry if regen never ran |
| Conflicting concurrent migration same MK | A9-analog: detect via session_state; refuse one |

## Related

- Process: `.claude/docs/design-module/SPEC.md §3.6` (`/design:migrate` matrix v1.1 расширенный — v1.0 narrower per C3)
- Lossy regeneration principles: SPEC §16.2
- Schema: `.claude/docs/pmo/artifacts/MK.md` `previous_tools[]` + `tool_switched_at` + `ir_snapshot_path`
- Hard gate pattern: `commands/integrator/research.md` Step 7 (DEC-DEV-0047 §7.6) — mirror invariants
- Companion skills (regeneration backends):
  - `skills/design/stitch-workflow.md` Pattern A (full re-generation)
  - `skills/design/html-fallback.md` (single-page)
- Companion command: `/design:start FM-NNN --continue` — alternative when migration overkill (resume в same tool)
- v1.1+ unlock candidates:
  - Stitch ↔ Claude Design path (gated by C1 `claude-design-workflow.md` full skill)
  - IR-based lossless migration (gated by OQ-DM-07; v2)
