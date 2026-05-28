---
description: D.6 export verify — assemble UI-contract block from MK/DS/NM ready для handoff §10. Standalone sanity check; /product:handoff fills §10 directly from artifacts (no command call from handoff per Q10 carry-forward).
argument-hint: "<FM-id>"
---

# /design:export

User invoked: `/design:export $ARGUMENTS`

## Process

D.6 Export verify — composes preview of UI-contract block from active MK / DS / NM для FM-NNN. **Standalone sanity check** — `/product:handoff FM-NNN` does NOT invoke этот command (Q10 carry-forward resolution per DEC-DEV-0052 sub-phase G): handoff §10 assembled directly by `handoff-generator.md` skill reading MK/DS/NM artifacts.

**Use cases:**
- Verify handoff §10 will assemble correctly before invoking `/product:handoff`
- Debug DS subset selection (only used tokens, не full DS)
- Demonstrate UI-contract bundle к external stakeholder без full handoff generation

### Step 1: Parse arguments

- **`<FM-id>` matches `^FM-\d{3}$`** — required
- **Empty / invalid** → show usage:
  ```
  Usage:
    /design:export FM-001         # preview UI-contract block для FM-001
  ```

### Step 2: Verify prerequisites

- `.product/features/<FM-id>-*.md` exists
- `FM.has_ui: true`
- ≥1 MK linked to FM (via FM.mockups[] OR MK.feature = FM-id) с `status: active`
  - If 0 → refuse: «No active MK для FM-NNN. Run /design:start FM-NNN first.»
- DS exists (`.product/design-system.md`)
- NM linked (optional — may not exist for simple single-screen flows; warn if absent)

### Step 3: Assemble UI-contract block

```
1. Load all active MK для FM-NNN (filter MK.feature == FM-id AND MK.status == active)
2. Load DS (`.product/design-system.md`)
3. Load NM (filter NM.feature == FM-id) — may be 0 or more
4. Compute DS subset:
   - Parse все MK bodies для tokens (regex /DS\.\w+\.\w+/g)
   - Filter DS entries — keep только referenced tokens
   - Filter DS components — keep components referenced via MK Component State Matrix (component names + tokens used)
5. Run `skills/design/design-validation.md` quick subset (V-MK-01 + V-MK-08 critical only) — surface findings inline (informational; не blocks export display)
6. Compose block в format per handoff-spec.md §10:

   ```markdown
   ## 10. UI Specification

   > Generated from MK/DS/NM artifacts active for FM-NNN at <ISO timestamp>.

   ### 10.1 Mockup Packages

   <For each MK:>
     #### MK-NNN — <title>
     - design_tool: <tool>
     - tool_project_url: <url>
     - iterations: <count>
     - previous_tools: <count> migrations (см. MK frontmatter for trail)

     <MK body — все 7 sections embedded>

   ### 10.2 Design System (subset)

   #### Tokens (used by MK артефактами этой фичи)
     <DS tokens subset table>

   #### Components (referenced by MK)
     <DS components subset>

   ### 10.3 Navigation Maps
     <NM-NNN body embedded — каждый NM с body>
   ```
```

### Step 4: Display + persistence

Write composed block к `.product/.design-sessions/<FM-id>-export-preview.md` (temporary; gitignored zone). Display полный block inline к user.

Format:
- Markdown rendered (handoff-spec §10 compliant)
- Total length surfaced (для context budget awareness — handoff §10 может be large)
- Validation findings appended at bottom (informational):

```
✅ Export preview ready для FM-NNN.

Saved: .product/.design-sessions/FM-NNN-export-preview.md
Total length: <N> lines / ~<KB>kB

Validation (sanity):
  V-MK-01: pass | <N findings>
  V-MK-08: pass | <N findings>

What's next:
  /product:handoff FM-NNN    — full handoff with §10 auto-populated (this preview не reused — handoff regenerates from source artifacts directly)
  /product:handoff FM-NNN --regenerate  — force regenerate if MK iteration drift detected

Note: /product:handoff does NOT depend on этот command (Q10 carry-forward resolution).
       Этот command — standalone sanity check / debug aid.
```

### Step 5: Idempotency

Re-running `/design:export FM-NNN` regenerates preview from current artifact state. Old preview overwritten (temp file). No state contamination.

## Important constraints

- **No mutation of MK / DS / NM.** Read-only export verify; никаких modifications artifacts.
- **Q10 boundary clear:** `/product:handoff` reads MK/DS/NM directly through `handoff-generator.md` skill — НЕ invokes `/design:export`. Этот command — standalone verify / debug. Resolution rationale: avoid command-call overhead; handoff has full access к artifact files anyway. Documented в sub-phase G commit + design-session.md D.6 step.
- **DS subset preview accurate.** Tokens / components filtered to referenced-only — preview matches handoff §10 будет contain.
- **Validation informational.** Findings surfaced for awareness, не block export display. Real blocking happens at D.5 approve gate в design-session.md skill OR `/product:handoff` DoR check.
- **Preview file gitignored.** `.product/.design-sessions/` ignored per `.gitignore.template`; preview не accidentally committed.

## Error handling

| Error | Action |
|---|---|
| `<FM-id>` not found | List available FMs |
| FM.has_ui != true | Refuse: «FM-NNN.has_ui=false — no UI export» |
| No active MK | Refuse; suggest `/design:start FM-NNN` |
| DS missing | Surface warning; proceed с tokens table marked «No DS — populate via /design:start» |
| NM missing | Surface warning «No NM — single-screen flow assumed»; proceed |
| MK body unparseable | Skip that MK с error message; continue с другие active MKs |
| Disk write fails | Surface error; still display inline (preview не require persistence) |

## Related

- Process: `.claude/docs/design-module/SPEC.md §3.4` (`/design:export` brief), §7.6 (D.6 Export for handoff)
- Q10 carry-forward resolution: see design-session.md D.6 step + sub-phase G commit message (handoff fills §10 directly)
- handoff §10 format: `.claude/docs/product-module/handoff-spec.md` §10 «UI Specification»
- Sibling skills: `design-session.md` (D.6 references этот command для verify hint), `design-validation.md` (V-MK-01/08 quick subset reused)
- Companion commands:
  - `/product:handoff FM-NNN` — full handoff generation; §10 auto-populated from same source artifacts (independent of этот command)
  - `/design:status --fm <FM-id>` — narrow dashboard для design state visibility
