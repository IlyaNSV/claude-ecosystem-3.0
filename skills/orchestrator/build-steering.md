---
description: Orchestrator P3 step — ensure cc-sdd steering (.kiro/steering/{product,tech,structure}.md) exists and is stack-pinned before the batch, by DELEGATING to cc-sdd's own kiro-steering skill rather than re-authoring steering. Load during /orchestrator:run batch-features-to-cc-sdd before invoking kiro-spec-batch.
---

# build-steering — ensure shared foundation via kiro-steering (P3)

cc-sdd authors every spec against `.kiro/steering/` (product / tech / structure). It
ships its own maintainer skill, **`kiro-steering`** (bootstrap from codebase, or sync;
"user customizations are sacred, updates additive"). The Orchestrator does **not**
re-implement steering — it **delegates to kiro-steering** and adds only the two things
cc-sdd's skill cannot know on its own: the Product framing from `.product/`, and that
the tech stack is decided and pinned.

> Cost discipline (DEC-DEV-0076): `kiro-steering` already does the bootstrap/sync work
> well. Re-authoring steering by hand duplicated it. This step is now a thin wrapper.

## Method

1. **Invoke `kiro-steering`** (it self-detects bootstrap vs sync from `.kiro/steering/`
   state) to produce/refresh `product.md`, `tech.md`, `structure.md`.
2. **Inject Product framing** — ensure `product.md` reflects `.product/` (segments,
   value props, the BG), not just what kiro-steering inferred from the codebase. The
   Product Module is the authority on the *why*; supplement kiro-steering's
   code-derived view with it.
3. **Pin the stack in `tech.md`** — confirm the decided stack appears with **explicit
   versions** + a compatibility matrix (this is what the `orchestrator-init`
   env-readiness-probe checks against). If the stack is NOT decided (no P2 output, no
   user input), STOP — that is the one irreducible human gate (RUN 01); do not let
   kiro-steering infer a stack silently from an empty/greenfield repo.
4. **roadmap.md is NOT built here** — the `## Specs (dependency order)` section is the
   bridge's output (`build-briefs-from-handoff`), derived from handoffs.

## Output

`.kiro/steering/{product,tech,structure}.md` present and stack-pinned, with a one-line
echo of the stack + versions into the run summary (so the cross-spec review inside
kiro-spec-batch and the later P5 inherit one foundation).

## Anti-patterns

1. **Re-authoring steering by hand.** Delegate to `kiro-steering`; only supplement
   Product framing + stack pinning. (The cost lesson of DEC-DEV-0076.)
2. **Letting a stack be inferred silently.** An undecided stack is a human gate, not a
   default. Pin it or stop.
3. **Unpinned versions.** "Node + Postgres" without versions defeats the
   env-readiness-probe and invites EBADENGINE-class breakage (RUN 01 #1/#2/#4).
4. **Building roadmap "## Specs" here.** That belongs to the handoff bridge, not
   steering.
