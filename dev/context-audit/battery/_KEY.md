# _KEY.md — UNBLINDING KEY. **NOT FOR THE JUDGE.**

Battery: ITP-patch validation (DEC-DEV-0197 / B4). Run date: 2026-07-13. Operator: VM-battery agent.

## Arm mapping (secret)

| Label used in transcripts / facts.md | Actual arm | Global `~/.claude/CLAUDE.md` on VM | sha256 |
|---|---|---|---|
| **A** | **TREAT** (new / patched gate — total table, explicit precedence) | host `C:\Users\pw201\.claude\CLAUDE.md` | `1a4a5385254e643e438d20978a1e3aa69ad8f491140e7a0460bdd9eedbfc99bb` |
| **B** | **CONTROL** (old gate — 3 bullets, D1-1 hole, A1-2 conflict) | host `C:\Users\pw201\.claude\CLAUDE.md.bak-2026-07-13-pre-itp-patch` | `e51586b78529b6afe9d65cc296aae00ed3835a06bfb812a44ab7f83d3db4fc33` |

On the VM these are staged as `~/.battery/arm-NEW.md` (= A = TREAT) and `~/.battery/arm-OLD.md` (= B = CONTROL).
Every session records the sha256 of the `~/.claude/CLAUDE.md` that was actually in place at launch
(`~/.battery/out/<TAG>/arm.sha256`) — so the mapping is machine-verifiable after the fact, not trusted.

## Session order (interleaved — see deviation note)

Z1 first (main probe), arms strictly alternating; starting arm flipped per probe to balance drift.

1. armA_Z1_r1  2. armB_Z1_r1  3. armA_Z1_r2  4. armB_Z1_r2  5. armA_Z1_r3  6. armB_Z1_r3
7. armB_Z2_r1  8. armA_Z2_r1  9. armB_Z2_r2  10. armA_Z2_r2
11. armA_Z3_r1 12. armB_Z3_r1 13. armA_Z3_r2 14. armB_Z3_r2
15. armB_Z4_r1 16. armA_Z4_r1 17. armB_Z4_r2 18. armA_Z4_r2
