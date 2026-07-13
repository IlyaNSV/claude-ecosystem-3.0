---
description: Equip a deploy-capability (D3-05/06) for a fabric pilot — spawns the deployer subagent to author systemd unit templates, a releases/<ts>+current layout, a prisma migrate step, a healthcheck spec, and a DRAFT CNT deploy-capability contract, then persists them under an approve gate. Equips only; never executes the deploy (§8.3).
argument-hint: "<capability>  (deploy-staging | deploy-prod-stub)"
---

# /integrator:provision

User invoked: `/integrator:provision $ARGUMENTS`

**Equip** a deploy-capability (`deploy-staging` | `deploy-prod-stub`) for a fabric pilot under PMO zones **D3-05** (Environment Provisioning) and **D3-06** (Deployment & Release Execution). This is a **modifying** command (SPEC §3.2 group): it spawns the `deployer` subagent to *author* the deploy-setup + a CNT contract, then — behind an **approve gate** — persists them into the Integrator zone. This command is the owner-blessed **channel-trigger** for the `deployer` capability built in Epic E.A (DEC-DEV-0194, campaign B1b).

> **§8.3 boundary — read first.** This command **EQUIPS, it does NOT execute a deploy.** It persists template files + a contract; it never runs `systemctl` / `ssh` / `pnpm build` / `prisma migrate`, and never flips the `current` symlink or (re)starts a service. The real deploy is the Orchestrator's `deploy-to-stage` process (Epic E.B), which *consumes* the manifest this command persists. Merging equip and execute "to be convenient" is a direct §8.3 violation (`docs/integrator-module/SPEC.md §8.3`). One-line test for every step here: *"Am I persisting a file, or changing a live service?"* Persisting a file → mine. Changing a live service → not mine.

## Process

Methodology: load `.claude/skills/integrator/deployment-provisioning.md` — it carries the spike fact-list, the four equipment pieces, the per-tier differences, and the embedded CNT template. The `deployer` subagent loads it too; this command orchestrates the spawn + persistence.

### Step 0: Session-context marker (DEC-DEV-0047 / patch 1.3.3)

Before any other step, write `.claude/integrator/.session-context.json` so `hooks/integrator/scope-guard.js` (PreToolUse) knows an Integrator command is active. Boilerplate spec: `skills/integrator/installation-protocol.md §10`. Cleanup at the Final step (and on every early-exit / cancel / error path).

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:provision","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

### Step 1: Parse capability + pre-flight

1. **Resolve the capability** from `$ARGUMENTS`:

   | Capability | Env-tier | Notes |
   |---|---|---|
   | `deploy-staging` | `staging` | the real v1 target — a deployed instance on the VM |
   | `deploy-prod-stub` | `prod-stub` | authored shape only, marked **human-gated floor** (owner decision) |

   - Empty / unrecognized capability → ask which of the two before mutating anything (do not author blind — sibling convention).
   - A bare `deploy-prod` / any prod variant → treat as `deploy-prod-stub` (prod is a stub under floor; there is no real prod host — owner decision). State this to the user.

2. **Lazy-init the Integrator state** (per DEC-INT-O08, if `.claude/integrator/` is absent):
   ```bash
   mkdir -p .claude/integrator/{contracts,adapters,tool-docs,backups,secrets,deploy}
   touch .claude/integrator/secrets/.gitkeep
   ```
   Ensure `.gitignore` excludes `.claude/integrator/secrets/` (per DEC-INT-O10); append + inform if missing.

3. **Resolve the pilot monorepo root** — the project root where `pnpm-workspace.yaml` lives (this command runs *inside* the pilot). Read-only confirm it is a pnpm monorepo (`pnpm-workspace.yaml` present). If it is not resolvable → ask one clarifying question; do not author blind.

4. **Build the dedup list** — enumerate existing contracts so the deployer assigns the next free `CNT-NNN`:
   ```bash
   ls .claude/integrator/contracts/CNT-*.yaml 2>/dev/null
   ```

5. **Idempotency check.** If a deploy-capability CNT for *this capability* already exists (`producer: deployer`, same env-tier, `status: draft`) → do **not** mint a duplicate. Offer to **re-provision** (refresh the existing deploy-setup + CNT in place) or stop. `active-tools.yaml`/the contracts dir are the state-of-truth; a discrepancy (CNT listed but files missing) → flag it, do not silently re-create.

### Step 2: Spawn the `deployer` subagent

Spawn `deployer` (`.claude/agents/integrator/deployer.md`) via the Agent tool with the brief in the exact format it expects ("Brief format you receive"). Populate from the spike fact-list (`dev/gates/EPIC_E_READINESS.md §Суб-фазы` / the skill) + the Step 1 resolution:

```
Capability: <deploy-staging | deploy-prod-stub from $ARGUMENTS>
Env-tier: <staging | prod-stub — derived in Step 1>
Pilot monorepo root: <resolved project root>
Services in scope: [@app/api, @app/web, @app/worker]
Deploy-root on target: ~/deploy/<project-name>     # staging dir on the VM (authored shape only for prod-stub)
Worker gate: WORKER_AUTOSTART=1
Existing contracts (dedup): <CNT-NNN list from Step 1.4>
PMO zone(s): [D3-05, D3-06]
```

The `deployer` operates in isolated context, has **only `Read, Grep, Glob`** (no `Bash`/`Write` — the §8.3 boundary is structural), and **returns blocks** — it writes nothing itself. It verifies build entrypoints + prisma-schema presence read-only.

### Step 3: Receive the deployer's blocks

The subagent returns three-to-four blocks (see `agents/integrator/deployer.md` "Output format"):

- **Block 1 — deploy-setup:** `<service>.service.template` per service (`{{RELEASE_DIR}}`/`{{ENV_FILE}}`/`{{PORT}}`/`{{NODE_BIN}}` placeholders; worker unit carries `WORKER_AUTOSTART=1`) + `deploy-manifest.yaml` (releases/`<ts>`+`current` layout, ordered `build → migrate → flip → (re)start` step-list, migrate step, healthcheck spec).
- **Block 2 — CNT contract pair:** `CNT-NNN.yaml` + `CNT-NNN.md`, `producer: deployer` / `consumer: deploy-to-stage`, **`status: draft`**.
- **Block 3 — provision-verification report:** prisma schema present (path) | **absent — noted**; build entrypoints resolved per service; env-tier declared (prod-stub marked floor); worker gate present. PASS / absent-noted per item, no live boot.
- **Block 4 — status report:** files to write + where, the `pmo-mapping.yaml` update needed, open questions.

**Trust the block structure, but spot-check the mandatory fields** did not drift: `CNT.contract.id` is set and free (dedup), `status: draft` (never `active`), `transformation.type: manual` (no adapter script), and the worker template carries the `WORKER_AUTOSTART=1` gate. If a field drifted (B.1) → do not persist; ask the deployer to re-emit.

**prisma-absent → note-and-proceed (owner decision).** If Block 3 reports the schema absent, the migrate step is emitted `conditional_on` / `status: unverified`. Surface it in the proposal (Step 4) and **proceed** — do **not** hard-block. Containerizing the app + Prisma is the pilot's own scope, not a blocker for this capability.

### Step 4: Approve gate (mutating command — hard boundary)

Present the proposal to the user, then the gate. This is a hard boundary per SPEC §3.2 + the anti-sycophancy rail (campaign §8.2 pt 4): **without an explicit `Y`, mutate nothing.**

Proposal (render before the gate):

1. **Capability + env-tier** — and, for `deploy-prod-stub`, the explicit "authored shape only, human-gated floor — no real host, no real secrets" note.
2. **Files to persist** (from Block 4) — the deploy-setup paths under `.claude/integrator/deploy/<capability-slug>/` + the `CNT-NNN.{yaml,md}` pair.
3. **CNT summary** — `id`, `producer: deployer → consumer: deploy-to-stage`, `status: draft`, the D3-05/D3-06 mapping.
4. **Provision-verification** (Block 3) — including any **prisma-absent** or unresolved-entrypoint caveat verbatim.
5. **§8.3 reminder** — "this persists setup only; the deploy itself is `deploy-to-stage` (E.B). CNT stays `draft` until a live VM verify (E.D) flips it to `active`."

```
Approve provisioning? [Y / E / N]
  Y — persist the deploy-setup + the draft CNT (Step 5)
  E — expand & edit: show the full manifest / CNT / templates; optionally adjust
      params (env-tier, deploy-root, service scope) and re-spawn the deployer; then re-prompt
  N — cancel; nothing is written beyond the .claude/integrator/ lazy-init
```

- `N` → record a cancelled journal entry (`entered/cancelled`, precedent SPEC §7.5); clean up the marker (Final); stop. **No file mutation** beyond lazy-init.
- `E` → expand any section; if the user changes params, re-run Step 2 with the adjusted brief; re-prompt the gate.
- `Y` → proceed to Step 5.

Silence is **not** consent — if the user does not answer, wait.

### Step 5: Persist (on `Y` only)

Author/persist exactly what the deployer returned — the caller writes the files; the deployer only produced them (author/persist split):

1. **deploy-setup** (Block 1) → write each file to the path Block 4 names, under `.claude/integrator/deploy/<capability-slug>/` (the `.service.template` files + `deploy-manifest.yaml`).
2. **CNT pair** (Block 2) → write `CNT-NNN.yaml` + `CNT-NNN.md` to `.claude/integrator/contracts/`. **Confirm `status: draft`** before writing (never persist `active` — the consumer `deploy-to-stage` does not exist until E.B and cannot be verified until the VM is restored at E.D).
3. **pmo-mapping.yaml** → apply the update Block 4 specifies: under **D3-05** and **D3-06**, append `CNT-NNN` to `contracts[]` (canonical pmo-map IDs only — never invent `D3-deploy` or similar, DEC-DEV-0040). If the deployer's Block 4 calls for an `active-tools.yaml` capability entry (`producer: deployer`), apply that too; otherwise the pmo-mapping coverage + the CNT pair are the record.
4. Persist the emitted `.yaml`/`.md` **verbatim** — they will materialize CRLF on a Windows pilot, which is by contract: the E.B consumer normalizes `\r\n`→`\n` (the CNT's last `failure_mode` carries this handoff; skill "EOL tolerance"). Do not strip or reflow.

Everything written lives **inside the Integrator zone**. This command never writes `.product/`, `.kiro/`, or `docs/pmo/` (scope-guard backs this), and never touches a live service.

### Final: Journal entry + cleanup

Append a curated entry to `.claude/integrator/project-journal.md` (the `journal-hook` also auto-logs the raw `pmo-mapping.yaml` / `contracts/` writes; this is the human-readable record). **Journal both outcomes** — a persisted capability *and* a cancelled proposal (`entered/cancelled`):

```markdown
## DEC-INT-NNNN — Provisioned deploy-capability: <capability>

**Date:** YYYY-MM-DD
**Trigger:** /integrator:provision <args>
**Tag:** #capability-provision #deploy #pmo-D3-05 #pmo-D3-06

### Context
<why: Orchestrator §6 capability channel requested a deploy zone (D3-05/06) not yet instantiated>

### Provisioned
- Env-tier: <staging | prod-stub (floor-gated)>
- Deploy-setup: .claude/integrator/deploy/<slug>/ (systemd templates + deploy-manifest.yaml)
- CNT-NNN: deployer → deploy-to-stage (status: draft)

### Provision-verification
- Build entrypoints: <resolved | unresolved per service>
- Prisma schema: <present @path | absent — migrate step conditional/unverified>
- Worker gate WORKER_AUTOSTART=1: <present>

### Boundary
§8.3: this EQUIPS the deploy-setup; execution is Orchestrator `deploy-to-stage` (E.B).
CNT stays draft until a live VM verify (E.D) flips it to active.

### Lessons
<if any surfaced — e.g. entrypoint drift, prisma layout, env-tier caveats>
```

Then remove the marker (on every exit path — success, `N`, error):

```bash
rm -f .claude/integrator/.session-context.json
```

Summarize to the user:

```
✅ Deploy-capability equipped: <capability> (env-tier <tier>)
📁 Deploy-setup: .claude/integrator/deploy/<slug>/
🔗 CNT-NNN: deployer → deploy-to-stage  (status: draft)
🗺  PMO: D3-05 / D3-06 mapped
⏳ Not deployed — execution is /orchestrator (deploy-to-stage, E.B). CNT flips to active
   only after a live VM verify (E.D).
📝 Journal: DEC-INT-NNNN
```

## Important constraints

- **§8.3 — equip, never execute.** No `systemctl` / `ssh` / `pnpm build` / `prisma migrate` / symlink-flip / service (re)start. This command persists files + a contract only. The deploy is `deploy-to-stage` (E.B).
- **Approve gate is a hard boundary.** No file mutation outside the `.claude/integrator/` lazy-init before an explicit `Y`.
- **CNT ships `draft`.** Never persist `status: active` — the consumer does not exist until E.B; the flip to `active` waits for a live VM verify (E.D, owner-gated).
- **prod is a floor-locked stub.** `deploy-prod-stub` authors shape only — no real host, no real secrets (`prod_deploy` / `provision_real_secret` ∈ DEFAULT_FLOOR).
- **prisma-absent → note-and-proceed**, not a hard block (owner decision).
- **Canonical PMO IDs only** — reuse D3-05 / D3-06; never coin a phantom ID (DEC-DEV-0040).
- **Field-naming discipline (B.1).** The CNT schema is `docs/integrator-module/SPEC.md §5.1` verbatim (`contract.id`, `data_flow.from/to`, `transformation.type`, `failure_modes[].symptom/likely_cause/action`). Do not "improve" field names.
- **Scope-guarded zone.** Never write `.product/`, `.kiro/`, or `docs/pmo/`. Persistence lives entirely in the Integrator zone.
- **Always clean up the session marker** on every exit path — a stale marker trips `scope-guard` false-positives until its 1h TTL.

## Error handling

| Step | Failure | Action |
|---|---|---|
| 1 | No / unrecognized capability | Ask which of `deploy-staging` \| `deploy-prod-stub`; mutate nothing |
| 1 | pnpm monorepo root not resolvable | Ask one clarifying question; do not author blind |
| 2 | Deployer times out / returns no blocks | Surface the error; offer retry; no state change |
| 3 | CNT field drift (B.1) / `status: active` emitted | Do not persist; ask the deployer to re-emit `draft` with canonical fields |
| 3 | Prisma schema absent | Note-and-proceed (migrate step `unverified`); surface in the proposal — **not** a block |
| 4 | User answers `N` | Mutate nothing; journal `entered/cancelled`; clean up the marker |
| 5 | `pmo-mapping.yaml` write error | Surface the error; leave the CNT/deploy-setup consistent or roll back the partial write; do not leave state half-modified silently |
| 5 | Idempotent re-run (CNT already draft for this capability) | Refresh in place; do not mint a duplicate CNT-NNN |

## What `/integrator:provision` is NOT

- **Not a deploy.** It equips the setup; `deploy-to-stage` (Orchestrator, E.B) executes it. §8.3.
- **Not `/integrator:add`.** `add` installs an external npm/mcp/git/docker tool; `provision` equips a *capability* (deploy-setup + contract) with no package install.
- **Not a live verify.** No boot, no healthcheck run here — the live P7 boot (`bootSmoke:true`) is E.D, VM-gated. This command's verification is read-only (entrypoints + schema presence).
