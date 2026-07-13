---
description: How the Integrator EQUIPS a deploy-capability (D3-05/06) for a fabric pilot — authors systemd unit templates (@app/api|web|worker running node dist/main.js under WORKER_AUTOSTART), a releases/<ts>+current symlink layout, a prisma migrate deploy step, and a healthcheck spec (reusing the P7 failure taxonomy) plus a CNT deploy-capability contract. Equips only; the Orchestrator deploy-to-stage process EXECUTES (§8.3). Used by the deployer subagent.
---

# Deployment Provisioning — Skill for Integrator

**Equip** a deploy-capability for a fabric pilot under PMO zones **D3-05** (Environment Provisioning) and **D3-06** (Deployment & Release Execution). "Equip" = author the deploy **setup** (systemd unit templates, a releases/`<ts>`+`current` layout, a migrate step, a healthcheck spec) **plus** the machine-readable **CNT deploy-capability contract** that hands that setup to the Orchestrator. The equipped capability is **consumed** by `deploy-to-stage` (Orchestrator process, Epic E sub-phase E.B) — which is the thing that actually executes the deploy.

> **Reuse existing PMO zones — do NOT invent an ID.** D3-05/D3-06 already exist in `docs/pmo/pmo-map.md`; per DEC-DEV-0040 (phantom-ID prohibition) never coin `D3-deploy` or similar. If you think a zone is missing, note it and surface — do not fabricate.

This skill is the D-2 half of the Epic E boundary (`dev/gates/EPIC_E_READINESS.md`): **Integrator оснащает** (deploy-skill + CNT contract + role-agent `deployer`); **Orchestrator `deploy-to-stage` исполняет.** Provisioning is requested through the §6 capability channel (DEC-DEV-0060 — role A: Integrator equips the "hands" + "head", Orchestrator runs the scenario).

## The §8.3 line (read first)

This skill authors deploy-**setup**: template files + a contract. **It NEVER runs `systemctl`, `ssh`, `pnpm build`, `prisma migrate`, and NEVER flips the `current` symlink or (re)starts a service.** The instant a step would **mutate the running system**, it stops being Integrator's and becomes `deploy-to-stage`'s (E.B).

**One-line test for every step:** *"Am I producing a file / manifest, or changing a live service?"* Producing a file → mine. Changing a live service → not mine (Orchestrator's).

This is `docs/integrator-module/SPEC.md` §8.3 verbatim — the two load-bearing rows:

| Действие | Integrator | Orchestrator | Product |
|---|---|---|---|
| Завести role-агента + предметный skill под зону (DEC-DEV-0060) | ✅ (capability) | ❌ (запрашивает) | ❌ |
| Исполнить инфра-шаг (deploy/provision БД) оснащённой capability | ❌ | ✅ | ❌ |

Merging equip and execute "to be convenient" is the #1 failure mode of this work and a direct §8.3 violation.

## When invoked

Loaded by the **`deployer` subagent** (`agents/integrator/deployer.md`) — isolated context. The deployer is spawned when the Orchestrator's §6 capability self-check (`docs/orchestrator-module/SPEC.md` §6, DEC-DEV-0060) requests a `role-agent`/`skill` for a deploy zone (D3-05/06) and that capability is **not yet instantiated** in the project (OD7 await→resume: BLOCK = "no capability" → park → provision → resume).

The exact command-trigger for provisioning (a thin `/integrator:provision`, an inline main-session spawn, or a `--capability` mode of `/integrator:add`) is an **owner-gate decision** — not part of this capability's shipment. The skill + agent + embedded CNT are sufficient for the capability to *exist and be spawnable*; the trigger is wired at/after E.B.

## Spike facts this skill is built on

Pinned from the VM-reality spike (`dev/gates/EPIC_E_READINESS.md` §Суб-фазы, DEC-DEV-0195). The deployer parameterizes the templates from these — do not re-derive them, and do not assume the one runtime-check.

- **Deployable = pnpm monorepo**, Node v22, root build `pnpm -r build`.
- **`@app/api`** (NestJS): `nest build` → `node dist/main.js`.
- **`@app/web`** (Next.js): `next build` → `next start` (or `node .next/standalone/server.js` if the app is built in standalone mode).
- **`@app/worker`** (tsc): `node dist/main.js`; BullMQ, **gated by `WORKER_AUTOSTART=1`** (the unit carries the gate; the Orchestrator decides whether to enable/start it).
- Infra already **healthy** in the pilot's docker-compose: Postgres 16 (`mft-postgres`), Redis 7 (`mft-redis`); `.env` present (`DATABASE_URL` / `REDIS_URL` / `POSTGRES_*` / `BCRYPT_COST` + external API keys).
- Process manager = **systemd units** (there is **no pm2** on the VM; systemd 255 + docker present). Deploy is **local inside the VM** (D-1) — not remote-ssh-push, not k8s.
- App-service compose entries are inert stubs (need Dockerfiles + Prisma schema owned by pilot tasks 1.3+) — containerizing the app is the pilot's scope, **not** a blocker for this capability.

⚠ **Runtime check, NOT assumed — prisma schema.** The spike did **not** confirm a Prisma schema exists in `packages/db`. The deployer **verifies at provision time** (read-only Glob/Read for `packages/db/**/schema.prisma`). If present → emit the migrate step normally. If absent → emit the migrate step as **conditional** (`status: unverified`) with a note, and do not hard-block (the pilot's own containerization/Prisma is out of Epic E scope). Never claim the schema is there without having read it.

## What the deployer authors

Four equipment pieces, each a **parameterized template** (authored, not materialized onto the target).

### 1. systemd unit templates — one per service

Written as `<service>.service.template` with placeholders `{{RELEASE_DIR}}`, `{{ENV_FILE}}`, `{{PORT}}`, `{{NODE_BIN}}`. Shapes:

- **`app-api.service.template`** — `ExecStart={{NODE_BIN}} dist/main.js`, `WorkingDirectory={{RELEASE_DIR}}/apps/api`, `EnvironmentFile={{ENV_FILE}}`, `After=network-online.target docker.service`, `Restart=on-failure`.
- **`app-web.service.template`** — `ExecStart=pnpm --filter @app/web start` (or `{{NODE_BIN}} .next/standalone/server.js` if the app is standalone-built), same `EnvironmentFile` / `After`.
- **`app-worker.service.template`** — `ExecStart={{NODE_BIN}} dist/main.js`, `WorkingDirectory={{RELEASE_DIR}}/apps/worker`, **`Environment=WORKER_AUTOSTART=1`**, `EnvironmentFile={{ENV_FILE}}`. Add a note: the gate is authored INTO the template; **enabling/starting** this unit is the Orchestrator's `systemctl` call, not the deployer's.

**State clearly in the emitted manifest:** these are `.service` **templates**. The deployer never writes to `/etc/systemd/`, never runs `systemctl daemon-reload` / `enable` / `start`.

### 2. releases layout spec (Capistrano-style, D-4)

Authored as `deploy-manifest.yaml` describing the on-target directory shape:

```
<deploy-root>/
  releases/<ts>/     # one build (pnpm -r build output + .env symlink from shared/)
  current -> releases/<ts>   # atomic deploy = flip this symlink (E.B executes)
  shared/            # persistent across releases: .env, logs, uploads (symlinked into each release)
```

Idempotency token = the release-dir **timestamp** (per A-1..A-9). The deployer authors the **procedure** as an ordered step-list in the manifest — `build → migrate → flip → (re)start`, with `rollback = flip current to the prior releases/<ts> + restart` — but it **does NOT run any of it**. The step-list is data the consumer reads, not commands the deployer issues.

### 3. prisma migrate deploy step

Authored into the manifest as a build-time step: `pnpm --filter @app/db prisma migrate deploy` (resolve the actual db-package name at provision time — read `pnpm-workspace.yaml` / the package's `package.json`; do not hardcode `@app/db` if the pilot names it differently). Marked `conditional_on: packages/db schema present`. If the runtime check finds no schema → emit with `status: unverified` + a note (see the runtime-check warning above).

### 4. healthcheck spec — authored, NOT built

**Reuse, do not reinvent.** The healthcheck machinery already exists and is unit-tested: `orchestrator/lib/runtime-readiness.cjs` `smokePlan({ healthCheck })` (campaign §8.1: "healthcheck надо построить" is a **myth** — it exists; only a CLI wiring seam is dead, and that is E.E's job, not this skill's).

The deployer emits a healthcheck **spec** that the Orchestrator's post-deploy nog (E.E) consumes:

```yaml
healthcheck:
  url: "http://localhost:{{PORT}}/health"
  boot_window_sec: 30
  expect: "2xx"
  failure_taxonomy: runtime-readiness.cjs::smokePlan.failure_classes   # reuse, do not redefine
```

Map post-flip failures onto the **P7 failure taxonomy** (`runtime-readiness.cjs` `smokePlan().failure_classes`, 5 classes — capture-don't-fix, D-5):

| class | signal |
|---|---|
| `env-not-loaded` | 500 on first request; config/secret undefined at runtime |
| `missing-migration` | boot fails on a DB schema/relation error |
| `port-in-use` | EADDRINUSE on listen |
| `missing-runtime-secret` | boot fails resolving an external client |
| `dependency-not-up` | connection refused to DB/cache on boot |

The deploy-setup's post-conditions reference these classes; they do **not** attempt to fix a failure (that is diagnosis for the Orchestrator/PA, per D-5 capture-don't-fix).

## Per env-tier differences (D-3)

- **dev** = pilot dev-checkout — **no deploy authored**. Dev runs from checkout; the deployer emits a manifest with `tier: dev, action: none`.
- **staging** = the real v1 target — a deployed instance on the VM (deploy-root + port + systemd services). Full setup authored. Secrets = **dev-tier** (A-1..A-9: "Секреты staging v1 = dev-tier").
- **prod-stub** = **authored shape, marked human-gated floor** (owner decision, `dev/gates/EPIC_E_READINESS.md` — "Prod = stub под floor"). Emit the prod manifest with `tier: prod, status: stub, gate: floor`; do NOT wire a real prod host and do NOT provision real secrets — real-secret provisioning stays under floor (`provision_real_secret` ∈ DEFAULT_FLOOR).

## Authoring the CNT deploy-capability contract

The deployer instantiates the CNT pair from the embedded template below into `.claude/integrator/contracts/CNT-NNN.{yaml,md}` — assign the **next free NNN** (check `.claude/integrator/contracts/` first, per `contract-design.md` Step 6 / anti-pattern 3). `producer: deployer`, `consumer: deploy-to-stage`. Register the CNT in the pilot's `active-tools.yaml` + `pmo-mapping.yaml` under **D3-05/D3-06** (pilot-side; VM-gated until the VM is restored).

Per the DEC-DEV-0012 convention (every artifact-authoring skill carries an explicit template + anti-pattern warnings — precedent: `contract-design.md` Step 8, `note-promote.md` Step 3), the **full CNT template is embedded inline here** so the deployer never re-derives the schema or drifts field names.

> **Where the reference CNT lives — and why here, not `adapters/`.** This template ships **embedded in this skill**, NOT as a standalone repo file. Three independent grounds: (1) `adapters/README.md` explicitly excludes contracts from `adapters/` ("Адаптеры между внешними инструментами (D2-Tech → D3) — это контракты Integrator, живут в `<project>/.claude/integrator/contracts/`"), and every `adapters/` file must be an executable `.js` with a `--verify-only --fixture` mode — a deploy-capability contract has **no transform script**, so it does not fit; (2) zero `CNT-*.{yaml,md}` files exist anywhere in the repo — the invariant is *CNT instances are pilot-only*; (3) DEC-DEV-0012 — the CNT-authoring skill embeds the CNT template, same pattern as `contract-design.md`, no new file-type location.

### CNT-NNN.yaml — canonical template (B.1 field names — use verbatim)

Field names map onto `docs/integrator-module/SPEC.md` §5.1 exactly. **Do not "improve" them** — the field-drift prohibition (B.1) is enforced by convention and the anti-patterns below.

```yaml
contract:
  id: CNT-NNN                     # pilot assigns next free integer (check .claude/integrator/contracts/)
  name: "Deploy-setup → Orchestrator deploy-to-stage"
  producer: deployer              # role-agent — Integrator EQUIPS
  consumer: deploy-to-stage       # Orchestrator process (E.B) — EXECUTES
  created: YYYY-MM-DD
  last_verified: YYYY-MM-DD        # stays UNSET until deploy-to-stage exists + a live VM verify (E.D)
  status: draft                    # draft — the consumer does not exist yet (owner-gate); flips to active
                                   # ONLY after a live verify on the VM

data_flow:
  from:
    artifact: deploy-setup
    location: .claude/integrator/deploy/<capability-slug>/   # systemd unit templates + deploy-manifest.yaml
    format: yaml + systemd-unit-templates
  to:
    artifact: deploy-execution-input
    location: orchestrator/processes/deploy-to-stage.mjs      # consumer (E.B)
    format: deploy-manifest (yaml)

transformation:
  type: manual                     # NOT adapter_script — no artifact-shape transform; deployer AUTHORS, Orchestrator EXECUTES
  script: null
  adapter_description: |
    No transform script. The deployer equips a deploy-setup: systemd unit templates
    (@app/api|web|worker; worker gated on WORKER_AUTOSTART=1), a releases/<ts>+current
    symlink layout, a prisma migrate deploy step, and a healthcheck spec referencing the
    P7 failure taxonomy (runtime-readiness.cjs). deploy-to-stage CONSUMES the manifest to
    build → migrate → flip → (re)start. §8.3: producer equips, consumer executes.

validation:
  pre:                             # deployer asserts BEFORE capability=ready (read-only)
    - check: "build entrypoints resolved (@app/api|web|worker → node dist/main.js | next start)"
    - check: "prisma schema presence verified in packages/db (or explicitly noted absent — runtime)"
    - check: "env-tier declared (dev|staging|prod-stub); prod-stub marked human-gated (floor)"
    - check: "@app/worker unit template carries the WORKER_AUTOSTART=1 gate"
  post:                            # deploy-to-stage asserts AFTER executing (E.B — informational here)
    - check: "current symlink points at the new releases/<ts>"
    - check: "systemd services active; healthcheck returns 2xx within boot window"
    - check: "prisma migrate deploy applied to target DB"

failure_modes:
  - symptom: "deploy-to-stage has no manifest to consume"
    likely_cause: "capability not provisioned (deployer never ran / CNT status=draft)"
    action: "spawn the deployer subagent to provision deploy-setup, then retry"
  - symptom: "post-flip healthcheck fails (env-not-loaded / missing-migration — P7 taxonomy)"
    likely_cause: "deploy-setup omitted prisma migrate deploy OR .env not wired into the systemd unit"
    action: "staging auto-rollback (symlink swap, owner decision) + PA escalation; re-provision setup"
  - symptom: "prod_deploy requested but no real prod host"
    likely_cause: "prod is a stub under floor (owner decision)"
    action: "human-gate; prod stays a floor-locked stub until a real prod host exists"
  - symptom: "consumer parses manifest as empty / mangled on Windows pilot"
    likely_cause: "CRLF line endings not normalized (campaign §8.2 pt 7)"
    action: "consumer MUST .replace(/\\r\\n/g,'\\n') before parsing — see capability-probe.cjs extractManifest"
```

### CNT-NNN.md — companion (emitted alongside)

Narrate, per `contract-design.md` Step 6:

- **Why this contract exists** — the D3-05/D3-06 zones need an authored deploy-setup; without it `deploy-to-stage` has nothing to execute.
- **`producer=deployer` / `consumer=deploy-to-stage` IS the machine-record of §8.3** — a field-by-field note making this explicit (the split is the boundary, not decoration).
- **Edge cases** (from A-1..A-9): rollback without a prior release, missing `.env`, partial deploy, deploy-lock from a parallel run, healthcheck retry policy.
- **Failure-mode runbook** — symptom → diagnosis → action, mirroring `failure_modes` above.

### Schema-fit caveat (flag to the E.B builder)

The CNT schema was designed for artifact-**transform** contracts (handoff → spec-init). A capability contract intentionally stretches two fields: `transformation.type: manual` (no script), and `producer`/`consumer` being a role-agent/process rather than tools. This is the cleanest machine-record of the equip/execute split. **Do NOT "fix" it by inventing new fields** (B.1 field-drift prohibition).

## Provision-time verification (read-only)

Before marking the capability ready, the deployer asserts (all read-only — Glob/Read only, no boot):

- build entrypoints resolve (`@app/api|web|worker` → `node dist/main.js` | `next start`) — from `package.json` / `pnpm-workspace.yaml`;
- prisma schema present in `packages/db` (or explicitly noted absent — the runtime check);
- env-tier declared (`dev|staging|prod-stub`); prod-stub marked human-gated (floor);
- the `@app/worker` unit template carries `WORKER_AUTOSTART=1`.

**No live boot here.** The live P7 boot (`bootSmoke:true`) is E.D and is VM-gated.

## EOL tolerance

The `deploy-manifest.yaml` + `CNT-NNN.yaml` the deployer emits will materialize **CRLF** on a Windows pilot (`.md`/`.yaml` are not LF-pinned by `.gitattributes` under `core.autocrlf=true`; campaign §8.2 pt 7 / G36 precedent). **Any consumer/parser** (the E.B `deploy-to-stage` process, any capability-probe-style reader) MUST normalize `\r\n`→`\n` or anchor with `/^---\r?\n/` + `split(/\r?\n/)`. The established pattern in the repo is `orchestrator/lib/capability-probe.cjs` `extractManifest` — `String(...).replace(/\r\n/g, '\n')`. State this as a **contract handed to the E.B builder** in the CNT `failure_modes` (last entry above).

## Anti-patterns

1. **Running `systemctl` / `ssh` / `pnpm build` / `prisma migrate` / a symlink-flip from this capability.** §8.3 violation — the #1 failure mode of E.A. This skill authors files and a contract; it changes no live service.
2. **Inventing a new pmo-map ID** instead of reusing D3-05/D3-06 (DEC-DEV-0040 phantom-ID prohibition).
3. **Materializing `.service` files into `/etc/systemd/`** (or anywhere on the target). Templates are authored; installing them is E.B.
4. **Marking prod as anything but a floor-gated stub** — no real prod host, no real secrets (owner decision; `prod_deploy` / `provision_real_secret` ∈ floor).
5. **Bare-`\n` YAML that greens on Linux and reds `verify` on Windows** (G36 precedent) — emit EOL-tolerant, and require the same of consumers.
6. **CNT field-name drift (B.1).** Use the canonical schema verbatim: `contract.id` (not `contract_id`), `data_flow.from/to` (not `source/target`), `transformation.type` (not `adapter_type`), `failure_modes[].symptom/likely_cause/action` (not `error/cause/fix`).
7. **Marking the CNT `active` before a live verify exists.** The consumer (`deploy-to-stage`) does not exist until E.B and cannot be verified until the VM is restored (E.D). Ship `draft`.

## Cross-reference

- `docs/integrator-module/SPEC.md` §5 (contract schema) + §8.3 (equip/execute boundary).
- `dev/gates/EPIC_E_READINESS.md` — owner decisions, spike fact-list, D-1..D-9 resolutions.
- `orchestrator/lib/runtime-readiness.cjs` — `smokePlan` + P7 `failure_classes` (reuse; do not reinvent healthcheck).
- `orchestrator/lib/capability-probe.cjs` `extractManifest` — the EOL-tolerant parse pattern.
- `docs/orchestrator-module/SPEC.md` §6 — capability channel (DEC-DEV-0060).
- `skills/integrator/contract-design.md` — the CNT-authoring precedent (Step 8 template, B.1 anti-patterns).
