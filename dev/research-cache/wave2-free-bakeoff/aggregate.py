#!/usr/bin/env python3
"""
Wave 2 free-bakeoff aggregator (E1 close-out, 2026-07-03).

Merges the per_query rows of the three batches (pilot 7 + batchB 8 + batchC 9 = 24,
all status=='ok', no overlap, all 24 frozen-set queries covered) into a single
score-card: overall win-rate, P1..P6 metric means per arm, per-bucket breakdown,
swap-order agreement rate, and the two confound checks (answer length, citation count).

Deterministic; re-run with:  py -3 aggregate.py   (from this directory)

Arms:
  B0 = naive-free      (WebSearch+WebFetch, single-pass, no methodology)
  B1 = disciplined-free (Pillar-D anti-hype + Pillar-B usefulness gate on the SAME free infra)
Judge rubric (integers 1-5, anchors 1/3/5), from the workflow JUDGE_SCHEMA:
  P1 Topical-Relevance · P2 Decision-Utility · P3 Faithfulness/grounding (source-checked live)
  P4 Citation-support · P5 Corroboration · P6 Directness
Each row's b0/b1 scores are the mean of the two order-swapped blind judges (avg2 in-workflow);
winner is agreement-gated (clean = both judges agree; lean = one tie one decisive; UNSTABLE = opposite decisive).
"""
import json, io, os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
FILES = [
    ('pilot',  'pilot-wghv110q9.jsonl'),      # 2026-07-01, 7 ok (Q04,Q08,Q11,Q13,Q21,Q22,Q23)
    ('batchB', 'batchB-wowa53e4s.jsonl'),      # 2026-07-01, 8 ok (Q01,Q05,Q09,Q14,Q17,Q18,Q19,Q20)
    ('batchC', 'batchC-final-wmafk1q15.json'), # 2026-07-03, 9 ok (Q02,Q03,Q06,Q07,Q10,Q12,Q15,Q16,Q24)
]
METRICS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
METRIC_NAMES = {
    'P1': 'Topical-Relevance', 'P2': 'Decision-Utility', 'P3': 'Faithfulness/grounding',
    'P4': 'Citation-support', 'P5': 'Corroboration', 'P6': 'Directness',
}


def load_rows():
    rows = []
    for batch, fn in FILES:
        obj = json.load(io.open(os.path.join(RAW, fn), 'r', encoding='utf-8'))
        for r in obj['result']['per_query']:
            if r.get('status') != 'ok':
                continue
            r = dict(r)
            r['batch'] = batch
            rows.append(r)
    return rows


def mean(xs):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs), 3) if xs else None


def tally(rows, pred):
    return sum(1 for r in rows if pred(r))


def winrate(rows):
    return {
        'n': len(rows),
        'b1_clean': tally(rows, lambda r: r['winner'] == 'b1'),
        'lean_b1':  tally(rows, lambda r: r['winner'] == 'lean-b1'),
        'tie':      tally(rows, lambda r: r['winner'] == 'tie'),
        'lean_b0':  tally(rows, lambda r: r['winner'] == 'lean-b0'),
        'b0_clean': tally(rows, lambda r: r['winner'] == 'b0'),
        'unstable': tally(rows, lambda r: r['winner'] == 'UNSTABLE'),
    }


def b1_pct_of_decided(wr):
    decided = wr['b1_clean'] + wr['b0_clean']
    return round(100.0 * wr['b1_clean'] / decided, 1) if decided else None


def metric_means(rows, arm):
    o = {k: mean([r[arm][k] for r in rows]) for k in METRICS}
    o['overall'] = mean([r[arm + '_overall'] for r in rows])
    return o


def report():
    rows = load_rows()
    assert len(rows) == 24, f'expected 24 ok rows, got {len(rows)}'
    ids = sorted(r['id'] for r in rows)
    assert ids == ['Q%02d' % i for i in range(1, 25)], 'coverage gap: ' + str(ids)

    out = {}
    wr = winrate(rows)
    out['overall'] = {
        'winrate': wr,
        'b1_pct_of_decided': b1_pct_of_decided(wr),
        'b1_win_or_lean': wr['b1_clean'] + wr['lean_b1'],
        'means': {'b0': metric_means(rows, 'b0'), 'b1': metric_means(rows, 'b1')},
    }

    # --- per batch (replication signal) ---
    out['per_batch'] = {}
    for batch, _ in FILES:
        g = [r for r in rows if r['batch'] == batch]
        wrb = winrate(g)
        out['per_batch'][batch] = {
            'winrate': wrb, 'b1_pct_of_decided': b1_pct_of_decided(wrb),
            'b0_overall': mean([r['b0_overall'] for r in g]),
            'b1_overall': mean([r['b1_overall'] for r in g]),
        }

    # --- per bucket (6 x 4) ---
    out['per_bucket'] = {}
    for b in sorted(set(r['bucket'] for r in rows)):
        g = [r for r in rows if r['bucket'] == b]
        wrb = winrate(g)
        out['per_bucket'][b] = {
            'winrate': wrb, 'b1_pct_of_decided': b1_pct_of_decided(wrb),
            'b0_overall': mean([r['b0_overall'] for r in g]),
            'b1_overall': mean([r['b1_overall'] for r in g]),
        }

    # --- swap-order agreement (w1 == w2): judging stability, no position-bias flips ---
    agree = tally(rows, lambda r: r['w1'] == r['w2'])
    out['swap_agreement'] = {
        'agree': agree, 'n': len(rows), 'rate_pct': round(100.0 * agree / len(rows), 1),
        'disagreements': [r['id'] for r in rows if r['w1'] != r['w2']],
        'unstable_opposite_decisive': wr['unstable'],  # 0 == no verdict flipped direction under swap
    }

    # --- per-metric B1 advantage (find the largest gap) ---
    b0m, b1m = out['overall']['means']['b0'], out['overall']['means']['b1']
    gaps = sorted(((k, round(b1m[k] - b0m[k], 3)) for k in METRICS), key=lambda kv: -kv[1])
    out['metric_gaps'] = {'ranked': gaps, 'names': METRIC_NAMES,
                          'b0': b0m, 'b1': b1m}

    # --- confound (a): answer length ---
    # Judge-reported lengths drift in unit across batches (pilot hundreds vs batchB/C thousands),
    # so cross-row length MEANS are not unit-stable. The unit-SAFE test is within-row:
    # of decided rows, in how many did the LONGER answer win, and are there counter-examples
    # (a B1 win where B1 was the SHORTER answer)?
    def longer_arm(r):
        lb0, lb1 = r['cov']['len_b0'], r['cov']['len_b1']
        return 'b1' if lb1 > lb0 else 'b0' if lb0 > lb1 else 'equal'
    decided = [r for r in rows if r['winner'] in ('b1', 'b0')]
    b1_wins = [r for r in rows if r['winner'] == 'b1']
    out['confound_length'] = {
        'mean_len_b0_UNIT_UNSTABLE': mean([r['cov']['len_b0'] for r in rows]),
        'mean_len_b1_UNIT_UNSTABLE': mean([r['cov']['len_b1'] for r in rows]),
        'rows_b1_longer': tally(rows, lambda r: longer_arm(r) == 'b1'),
        'rows_b0_longer': tally(rows, lambda r: longer_arm(r) == 'b0'),
        'decided_won_by_longer': tally(decided, lambda r: longer_arm(r) == r['winner']),
        'decided_won_by_shorter': tally(decided, lambda r: longer_arm(r) != r['winner'] and longer_arm(r) != 'equal'),
        'decided_n': len(decided),
        # counter-examples to the length prior = B1 wins where B1 was the shorter answer:
        'b1_wins_while_shorter': [r['id'] for r in b1_wins if r['cov']['len_b1'] < r['cov']['len_b0']],
    }

    # --- confound (b): citation count ---
    # If B1 "wins by citing more", B1 should always out-cite B0. Batch-C is the counter-evidence:
    # B1 wins there with FEWER mean citations.
    def cite_block(g):
        return {'mean_cites_b0': mean([r['cov']['cites_b0'] for r in g]),
                'mean_cites_b1': mean([r['cov']['cites_b1'] for r in g]),
                'b1_wins_with_fewer_or_equal_cites':
                    [r['id'] for r in g if r['winner'] == 'b1' and r['cov']['cites_b1'] <= r['cov']['cites_b0']]}
    out['confound_citations'] = {
        'overall': cite_block(rows),
        'batchC': cite_block([r for r in rows if r['batch'] == 'batchC']),
    }

    # --- sensitivity: drop Q21 (B0 degenerate 4-token answer -> b0_overall 1.0, judge discount flag) ---
    no21 = [r for r in rows if r['id'] != 'Q21']
    out['sensitivity_drop_Q21'] = {
        'b0_overall': mean([r['b0_overall'] for r in no21]),
        'b1_overall': mean([r['b1_overall'] for r in no21]),
        'winrate': winrate(no21),
    }
    return rows, out


def fmt_row_table(rows):
    lines = [f"{'id':5} {'bucket':15} {'batch':7} {'winner':9} {'b0ov':6} {'b1ov':6} {'d':6}"]
    order = {'b1': 0, 'lean-b1': 1, 'tie': 2, 'lean-b0': 3, 'b0': 4, 'UNSTABLE': 5}
    for r in sorted(rows, key=lambda r: (r['id'],)):
        d = round(r['b1_overall'] - r['b0_overall'], 2)
        lines.append(f"{r['id']:5} {r['bucket']:15} {r['batch']:7} {r['winner']:9} "
                     f"{r['b0_overall']:<6} {r['b1_overall']:<6} {d:+.2f}")
    return '\n'.join(lines)


if __name__ == '__main__':
    rows, out = report()
    print('=== Wave 2 free-bakeoff — per-query (n=24) ===')
    print(fmt_row_table(rows))
    print()
    print('=== AGGREGATE ===')
    print(json.dumps(out, indent=2, ensure_ascii=False))
