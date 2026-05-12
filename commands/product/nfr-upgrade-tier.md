---
description: Batch NFR review при product tier change (MVP→MMP / MMP→Growth / etc). Re-evaluates active NFRs per new tier sanity ranges; surfaces declined + pending FMs для re-Ask. Updates product.yaml.product_tier OR RM.current_phase + version bumps.
argument-hint: "<new-tier> [--dry-run]"
allowed-tools: Read, Glob, Grep, Edit, Write
---

# /product:nfr-upgrade-tier

User invoked: `/product:nfr-upgrade-tier $ARGUMENTS`

Batch review всех active NFRs + FMs с `nfr_status: declined|pending` при product tier upgrade. Loads skill `nfr-review.md` для per-FM logic + adds tier-level orchestration.

## Args

- `<new-tier>` — target tier: `mmp | growth | mature` (cannot downgrade — separate decision)
- `--dry-run` — preview changes без apply

Invalid args → show usage:
```
Usage:
  /product:nfr-upgrade-tier mmp              # upgrade MVP → MMP
  /product:nfr-upgrade-tier growth --dry-run # preview без apply
```

## Steps

### Step 1: Parse + validate args

- `<new-tier>` ∈ {mmp, growth, mature}
- Read current tier:
  - `RM.current_phase` если RM exists
  - Else `product.yaml.product_tier`
  - Else MVP default
- Validate: `<new-tier>` > current tier (cannot downgrade в этом workflow)

Если downgrade attempted — refuse:
```
Tier downgrade не supported в этом workflow.
Current tier: <current>; requested: <new-tier>.
Downgrade requires separate manual decision + DEV_JOURNAL entry.
```

### Step 2: Snapshot current state

- All active NFRs из `.product/nfr/` (glob)
- All FMs с `nfr_status ∈ {declined, pending}` (filter via grep frontmatter)
- Tier source: RM.current_phase OR product.yaml.product_tier

### Step 3: Re-validate active NFRs against new tier ranges

Per active NFR:
- Read `category` + `target_value`
- Get tier range из [`docs/pmo/artifacts/NFR.md §5`](../../docs/pmo/artifacts/NFR.md) для new tier × category
- Compare:
  - Within new range → no action, `sanity_check` remains `passed`
  - Out of new range → flag для review (warning, не auto-edit per DEC-DEV-0025 C.2)

### Step 4: Surface batch к user

```
Tier upgrade <current> → <new-tier>:

  Re-Ask candidates (FMs со nfr_status: declined|pending):
    - FM-002 (declined, rationale: "MVP defaults sufficient") — high_risk: false
    - FM-007 (pending) — high_risk: true

  Sanity range upgrades (active NFRs):
    - NFR-001 (uptime 95% MVP → 98% MMP typical) — current 95% out of new range
    - NFR-004 (inbox <3s MVP → <1.5s MMP) — current 3s out of new range
    - NFR-002 (auth bcrypt MVP → MMP "+ 2FA optional") — current OK in new range
  
  Tier upgrade plan tasks (from NFR body §Tier upgrade plan):
    - NFR-001: «Добавить health check endpoint с auto-alerting» (referenced)
    - NFR-004: «Add Redis caching для revisions list; virtual scrolling»

Apply batch review? [Y / per-item / cancel]
```

### Step 5: Apply (если [Y] или per-item confirmation)

**Per FM re-Ask (declined/pending list):**
- Invoke `/product:nfr-review FM-NNN` inline (или queue для user manual runs если много)
- Skill `nfr-review.md` handles methodology (Ask + Define если [Y])
- Each FM updates atomically (status + version)

**Per NFR out-of-range:**
- Read NFR body §Tier upgrade plan
- Surface к user choice:
  ```
  NFR-001 review (uptime 95% → MMP range 98%):
    
    Current target: ">=95% monthly uptime"
    MMP typical range: 98% (~14h/mo downtime allowed)
    
    NFR.body §Tier upgrade plan says:
      "Добавить health check endpoint с auto-alerting (уведомление в Telegram)
       Migrate на managed DB с auto-backups
       Рассмотреть second region для hot standby
       Target: <4h incident response (planned время для MMP)"
    
    Action:
      [U] Update target_value to ">=98% monthly uptime" (apply tier upgrade plan)
      [O] Keep current target as overridden (rationale required)
      [D] Defer NFR-001 to nfr_status: review_pending
  ```
- If [U]: update NFR.target_value + target_tier + version++; clear `sanity_check: overridden` if was set
- If [O]: set `sanity_check: overridden` + `override_rationale` (rationale required)
- If [D]: set NFR.status: draft + add к re-review queue (no destructive change)

### Step 6: Update tier

After all per-FM / per-NFR decisions applied:
- Update tier source:
  - If RM exists: `RM.current_phase = <new-tier>` + version++
  - Else: `product.yaml.product_tier = <new-tier>`
- Decision journal entry `DEC-NFR-UPGRADE-NNN`:
  ```yaml
  decision: tier_upgrade
  from_tier: mvp
  to_tier: mmp
  date: <today>
  fms_re_asked: [FM-002, FM-007]
  fms_results:
    FM-002: { from: declined, to: active, nfrs_added: [NFR-005, NFR-006] }
    FM-007: { from: pending, to: declined, rationale: "..." }
  nfrs_re_validated:
    NFR-001: { action: update, new_target: ">=98%" }
    NFR-002: { action: no_change, reason: "within new tier range" }
    NFR-004: { action: overridden, rationale: "Phase 2 implementation deferred" }
  ```

### Step 7: --dry-run mode

При `--dry-run`:
- Steps 1-4 executed normally
- Step 5: surface к user preview без apply («Would re-Ask N FMs, would re-validate M NFRs»)
- Step 6: skip apply; no journal entry; no tier change

### Step 8: Surface summary

```
Tier upgrade MVP → MMP applied:
  - product_tier updated (source: RM.current_phase)
  - 2 FMs re-Asked:
      FM-002: declined → active (2 new NFRs)
      FM-007: pending → declined (rationale provided)
  - 3 NFRs re-validated:
      NFR-001: target updated → ">=98%"
      NFR-002: no change (within new range)
      NFR-004: overridden (rationale: Phase 2 deferred)
  - Decision journal: DEC-NFR-UPGRADE-001
  
Next:
  /product:validate --rule V-16        # confirm all FMs pass V-16 в новом tier
  /product:status                       # see updated tier dashboard
```

## Anti-patterns

1. **Не downgrade.** Tier movement в этом workflow только up. Downgrade requires separate manual decision + DEV_JOURNAL entry.

2. **Не auto-edit NFR target_value без user choice.** Per Step 5 — surface options [U/O/D]. Automation rewriting business decisions = anti-pattern (per CLAUDE.md «Assistant-led, human-approved»).

3. **Не пропускать `--dry-run` при first upgrade.** Preview всегда полезен; recommend в conversation если user не used flag.

4. **Не атомарно обновлять product.yaml.product_tier перед batch completion.** Tier change должно быть последним шагом — иначе intermediate state «tier changed но NFRs не reviewed» surfaces к hooks как broken.

5. **Не блокировать tier upgrade если NFR upgrade plan empty.** Some NFRs могут не have explicit upgrade plan section — treat как «no plan, default action: ask user override OR update target manually».

## Related

- Skill: `.claude/skills/product/nfr-review.md` (per-FM F.5a methodology)
- Catalog: `.claude/docs/pmo/artifacts/NFR.md §5` (tier sanity ranges)
- Related commands:
  - `/product:nfr-review` — per-FM (single FM review)
  - `/product:validate --rule V-16` — post-upgrade verification
  - `/product:status` — see current tier
- Updates: `product.yaml.product_tier` OR `RM.current_phase`; FM frontmatter `nfr_status`/`nfr_decline_reason`/`nfr[]`/`version`; NFR frontmatter `target_value`/`target_tier`/`sanity_check`/`override_rationale`/`version`
