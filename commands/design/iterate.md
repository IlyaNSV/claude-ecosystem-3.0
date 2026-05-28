---
description: D.3 continuation на existing active MK. Iteration counter ++; tool dispatch per MK.design_tool; deadlock guard (Q7) inherited from design-session.md.
argument-hint: "<MK-id> [--from-feedback \"<text>\"]"
---

# /design:iterate

User invoked: `/design:iterate $ARGUMENTS`

## Process

Resumes D.3 iterative refinement на existing MK without going через full P2.5 lifecycle (D.1-D.6). Use when MK уже active но needs patch-level changes (e.g., post-pilot user feedback, accessibility tweak, copy change).

Loads `.claude/skills/design/design-session.md` (entering at D.3 only).

### Step 1: Parse arguments

- **`<MK-id>` matches `^MK-\d{3}$`** — required
- **`--from-feedback "<text>"`** — optional initial change request (else prompt user inline)
- **Empty / invalid** → show usage:
  ```
  Usage:
    /design:iterate MK-001                                # interactive D.3 loop
    /design:iterate MK-001 --from-feedback "Login button too narrow on mobile"
  ```

### Step 2: Verify prerequisites

- `.product/mockups/<MK-id>-*.md` exists
- `MK.status: active` OR `MK.status: review` (refuse если draft / deprecated)
  - draft → user должен сначала finish D.5 approve через `/design:start FM-NNN --continue`
  - deprecated → refuse: «MK deprecated; create new MK via /design:start FM-NNN»
- Linked FM resolvable (`MK.feature` → existing FM file)
- Design tool dispatchable per `MK.design_tool` (если Stitch — MCP available; если html — always; если claude-design в v1.0 → surface warning «v1.0 stub; manual workflow only»)

### Step 3: Initialize iteration session state

Create / update `.product/.design-sessions/<FM-id>-progress.yaml`:

```yaml
session_id: "<ISO>-iterate-MK-<NNN>"
type: design-session
mode: iterate
fm_id: <FM-id from MK.feature>
mk_id: <MK-id>
started_at: <ISO>
current_step: D.3
current_iteration: <MK.iteration + 1>  # resume counting from MK iteration
design_tool: <MK.design_tool>
tool_project_url: <MK.tool_project_url>
```

(If existing `current.yaml` для same FM/MK detected — A9 concurrent session menu fires per `design-session.md`.)

### Step 4: Delegate к design-session skill (D.3 entry point only)

Load `.claude/skills/design/design-session.md` с context:
- Mode: iterate (not full P2.5 — skip D.1/D.2)
- Entry step: D.3 (jump straight)
- Initial change request: `<--from-feedback>` если supplied, else prompt

Skill applies standard D.3 loop:
- Iteration classification (small / medium / large / fundamental)
- Per-iteration tool dispatch
- Q7 deadlock guard fires at iter ≥7 (inherited; counter может уже be high if MK had history)
- Stitch quota guard per A5
- Final 🟠 Strategic approve gate at user «accept as final»

### Step 5: Post-iteration update

After user approves final iteration:
- Update MK frontmatter:
  - `iteration: <new count>`
  - `updated: <today YYYY-MM-DD>`
  - `version: <bump>`
- Append к MK Design Decisions Log:
  `<date> (iteration <N>): <user feedback summary> — <change applied>`
- Hook `design-artifact-validate.js` fires PostToolUse (sub-phase G — surface findings per Q8 quiet-draft logic; status=active → exit 1 on blocking)
- Update FM frontmatter `updated: <today>` (cascade — FM aware of MK change)

### Step 6: Completion

```
✅ Iteration applied для MK-NNN.

Total iterations: <N>
Latest change: <summary>
Design tool: <tool> (URL: <url>)

What's next:
  • /design:export FM-NNN — verify §10 sanity after iteration
  • /product:handoff FM-NNN — handoff hash bumps if iteration touched body
  • /design:iterate MK-NNN --from-feedback "..." — another iteration
```

## Important constraints

- **No D.1 / D.2 entry.** /design:iterate ENTERS at D.3 only. Если user needs brief revision OR fundamental redesign → use `/design:start FM-NNN --continue` (full flow с radical rethink option).
- **Iteration counter persistent.** New iterations append к MK.iteration; не reset. Counter is permanent audit.
- **Deadlock guard fires если cumulative iter ≥7.** Q7 menu invariant applies even when iterations span multiple `/design:iterate` invocations.
- **No `--to` migration here.** Migration through `/design:migrate <MK-id> --to <target>` — separate command с different approve gate UX (Q1 per-MK).
- **DS impact possible.** Iteration may surface new tokens; `design-system-rules.md` skill triggered if so. DS pending queue updated.

## Error handling

| Error | Action |
|---|---|
| `<MK-id>` not found | List active MKs (in .product/mockups/) |
| MK.status = draft | Refuse; suggest `/design:start FM-NNN --continue` |
| MK.status = deprecated | Refuse; suggest fresh `/design:start FM-NNN` |
| MK.design_tool unavailable | Surface к user; offer `/design:migrate` чтобы switch first |
| User aborts mid-iteration | Save partial state; re-run `/design:iterate` resumes via design-session.md A9 menu |
| Q7 deadlock fires | 4-choice menu в design-session.md handles |

## Related

- Process: `.claude/docs/design-module/SPEC.md §3.2` (`/design:iterate` brief), §7.3 (D.3 Iterative Refinement)
- Parent skill: `design-session.md` (D.3 only entry mode)
- Sibling commands:
  - `/design:start FM-NNN --continue` — full P2.5 flow с radical rethink option
  - `/design:migrate <MK-id> --to <target>` — tool switching (separate semantics — lossy regen, Q1 gate)
- Hooks: `hooks/design/design-artifact-validate.js` fires on MK write
- Cross-module impact: `/product:handoff FM-NNN` will detect MK hash drift if iteration touched body — suggests regenerate
