---
description: Migrate MK design_tool between Stitch ↔ HTML (v1.0 per DEC-DEV-0052 C3 cut; Claude Design path → v1.1), or import an MK's visual HTML into the open-design viewer (--to open-design, v1.5). Hard approve gate per-MK (Q1). Regeneration targets are lossy (brief + MK metadata + DS snapshot); open-design is a lossless visual import (no metadata, no regeneration). previous_tools[] audit trail; rollback on failure.
argument-hint: "<MK-id|--all> --to <stitch|html|open-design> [--reason \"<text>\"]"
---

# /design:migrate

User invoked: `/design:migrate $ARGUMENTS`

## Process

Switches `design_tool` для one or many MK artifacts. Migration is **lossy** — visual representation re-created в target tool через brief + saved MK metadata; element-level tweaks lost per SPEC §16.2. v1.1 hooks (`ir_snapshot_path`, `ir_export.enabled`) prepare ground для lossless IR — noop в v1.0.

### Step 1: Parse arguments

- **`<MK-id>` matches `^MK-\d{3}$`** — single MK target
- **`--all`** — batch mode (iterates через all active MK с individual approve per Q1 — НЕТ batch-bypass)
- **`--to <target>`** — required; accepted values: `stitch`, `html`, `open-design`
- **`--to open-design`** — **VIEWER-IMPORT target (v1.5)** — NOT a regeneration. Imports the MK's existing visual HTML into the open-design Dockerized viewer via the CNT-003 adapter. No brief, no screen generation, no metadata migration, NO iteration bump. Canon stays in MK/NM. Runs the open-design execution branch (Step 5-OD) with its own gate/preview framing. Requires the shared daemon (see Step 2).
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
    /design:migrate MK-001 --to open-design       # import MK visual HTML into open-design viewer
    /design:migrate --all --to html               # batch с per-MK approve gate
    /design:migrate MK-001 --to html --reason "Stitch quota exhausted"
  ```

### Step 2: Verify prerequisites

- For each MK targeted:
  - `.product/mockups/<MK-id>-*.md` exists
  - `MK.status: active` (refuse если `draft` / `review` / `deprecated`)
  - `MK.design_tool != <target>` (refuse: «already on <target>»)
- `<target>` валиден per enum (stitch / html / open-design)
- For `--to stitch`: Stitch MCP registered (else suggest `/integrator:add stitch-mcp` first)
- For `--to html`: always available
- For `--to open-design`:
  - `external_viewers.open-design` declared (uncommented) in `.claude/design.yaml` AND token resolvable AND daemon reachable (`curl -s -m 5 -H "Authorization: Bearer <token>" http://127.0.0.1:7456/api/health` → 200). Else suggest `/integrator:add open-design` (thin wire) + BOOTSTRAP «open-design shared daemon»; abort (no MK mutation). Mirrors the Stitch-MCP prereq.
  - The MK must have a visual HTML artifact to import (an `SI-*.html` from a prior session export, or a Stitch `htmlCode` ZIP). If absent — abort with a hint to render/export the MK first.
  - **`MK.design_tool != open-design`** idempotency (refuse re-import; see Step 8).

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

**For `--to open-design` (viewer import — NOT regeneration), use this preview instead:**

```
Viewer-import target preview:
  MK-NNN — <title>
    Current: <design_tool> (project URL: <url или —>)
    Target:  open-design (Dockerized viewer @ http://127.0.0.1:7456)
    Source HTML: <SI-*.html or Stitch htmlCode ZIP path>

Import semantics (lossless visual, no metadata):
  • Existing visual HTML is imported as-is into the open-design viewer — NO regeneration.
  • NO MK metadata migrates (screen IDs, SC/BR, DS tokens, state matrix) — canon stays in MK/NM.
  • design_tool → open-design records it as the viewed tool; tool_project_url → daemon project URL.
  • previous_tools[] audit entry written before import.
  • Iteration counter is NOT incremented (import is not a regeneration).
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

**For `--to open-design`, the gate prompt reframes (no lossy regeneration):**

```
STOP. Visual-only import into open-design viewer — no regeneration, no metadata migration.
MK remains the source of truth (canon in MK/NM).
Approve import для MK-NNN? [Y/N/defer]
```

Same [Y/N/defer/details] semantics; per-MK granularity invariant holds (the gate ALWAYS fires).

**Silence is NOT consent.** Wait for explicit user response. AI MUST NOT auto-chain.

If [Y] → proceed Step 5 (open-design → Step 5-OD branch) для этой MK.
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

### Step 5-OD: Execute import per approved MK (`--to open-design`)

**Viewer import — dispatches to `skills/design/open-design-viewer.md`. NOT a regeneration.** A8 atomic order preserved (previous_tools[] FIRST), but no brief, no screen generation, no iteration bump.

```
1. Read MK frontmatter; capture {current_tool, current_url, iterations}.
   Locate the MK's visual HTML artifact (SI-*.html export or Stitch htmlCode ZIP).

2. Append previous_tools[] entry (write FIRST):
   previous_tools:
     - tool: <current_tool>
       url: "<current_url>"
       switched_at: <ISO timestamp>
       reason: "<from --reason flag OR prompted inline>"
       iterations_at_switch: <iteration count>

3. Update frontmatter: tool_switched_at: <ISO>
   (design_tool / tool_project_url NOT yet — wait for import success)

4. Write MK frontmatter changes.

5. Import via open-design-viewer skill:
   - Skill resolves token + daemon URL, preflights /api/health, then runs the CNT-003 adapter:
       node .claude/integrator/adapters/stitch-to-opendesign.js --import <SI-*.html | htmlCode.zip>
   - Parse adapter JSON: project_id, entry_file, files_imported.

6. ROLLBACK ON FAILURE (adapter exit ≠ 0 — daemon unreachable=3, validation=1):
   - REVERT: delete last previous_tools[] entry just added
   - REVERT: clear tool_switched_at (or restore prior value)
   - design_tool / tool_project_url stay UNCHANGED (MK never mutated past previous_tools[])
   - Surface adapter error verbatim; if exit 3 → point to BOOTSTRAP «open-design shared daemon»
   - LOG to journal

7. ON SUCCESS (HTTP 200 + project_id):
   - Update frontmatter:
     design_tool: open-design
     tool_project_url: "http://127.0.0.1:7456/p/<project_id>"
   - Append to MK Design Decisions Log:
     `<date> (viewer import): Imported visual HTML into open-design viewer (project <project_id>).
      Visual only — no metadata, no regeneration; canon stays in MK/NM. Reason: <reason>.`
   - DO NOT increment MK.iteration (import is not a regeneration — invariant)
   - Hook design-artifact-validate.js fires PostToolUse on MK write (re-validates per Q8)

8. Save decision journal entry (Source: design; MK-NNN imported into open-design; project_id; no iteration change).
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
- **For `--to open-design`:** instead of design-validation, confirm the daemon persisted the project — `GET /api/projects/<project_id>/files` (with Bearer) returns `entryFile` + imported files. Non-blocking (import already succeeded).

### Step 8: Idempotency check

Если user runs `/design:migrate MK-NNN --to <target>` again where `MK.design_tool == <target>` already:
- Refuse: «MK-NNN already on <target>. Migration is no-op.»
- Do NOT re-fire hard gate (gate spam = anti-pattern).

## Important constraints

- **Hard approve gate per-MK is invariant.** No `--force` flag bypasses Q1. Pattern mirrors DEC-DEV-0047 §7.6 `/integrator:research` Step 7.
- **`--to claude-design` rejected explicitly.** v1.0 schema enum includes claude-design но command logic refuses. Будет unlocked в v1.1 (см. v1_1_backlog C3 entry).
- **A8 atomicity:** `previous_tools[]` written before regen; rollback removes last entry если regen fails. design_tool / tool_project_url stay unchanged until regen succeeds.
- **Lossy nature explicit.** Migration не preserves visual tweaks; brief + DS + Design Decisions Log = best regeneration substrate.
- **Iteration counter += 1 per migration** — for **regeneration** targets (stitch/html) only. **`--to open-design` does NOT bump iteration** (visual import, not a regeneration — invariant per the viewer-only model).
- **`--to open-design` is viewer-only.** No metadata migrates; canon stays in MK/NM. open-design is a supporting viewer, not a generator and not a source of truth.
- **No automatic DS adjustments на migration.** Если new tool generates новый tokens — те queue normally через `design-system-rules.md` next session (не inline).

## Error handling

| Error | Action |
|---|---|
| `<MK-id>` not found | List active MKs |
| `--to <target>` not in {stitch, html, open-design} | Reject; show valid enum |
| `--to claude-design` | Reject с C3 v1_1_backlog reference |
| `--to open-design`: daemon unreachable / token missing | Abort before MK mutation; suggest `/integrator:add open-design` + BOOTSTRAP «open-design shared daemon» |
| `--to open-design`: no visual HTML artifact for MK | Abort; hint to render/export the MK first |
| `--to open-design`: adapter import fails (exit 1 C-0x / exit 3 transport) | A8 rollback; surface adapter output verbatim; exit 3 → BOOTSTRAP |
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
  - `skills/design/open-design-viewer.md` (viewer import — `--to open-design`; CNT-003 adapter; visual-only, no metadata)
- Companion command: `/design:start FM-NNN --continue` — alternative when migration overkill (resume в same tool)
- v1.1+ unlock candidates:
  - Stitch ↔ Claude Design path (gated by C1 `claude-design-workflow.md` full skill)
  - IR-based lossless migration (gated by OQ-DM-07; v2)
