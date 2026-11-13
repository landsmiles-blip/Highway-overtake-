# PROGRESS: curve round 3 (levels 3 and 16-20)

Rule for this file: a box is ticked only after the real output is pasted under it. Not committed. Started 2026-11-11.
Orders (Mumathai): one extra tuning round for levels 3 and 16-20; re-measure on new seeds, both bots; pass rule met -> apply `LEVEL_NEEDS` in one edit, run `checks.js` and `fast.js`;
failed -> leave the game as it is and write the cause in the ledger. Do not touch the level-20 check. Do not push.

## S0 Gate: memory above 1.8 GB and no Chrome, Edge, Claude-desktop or ChatGPT/Codex left

- [x] **MET at 15:38** after Mumathai ended the tasks. Rescan output:

```
15:38
Available MB: 2103
Commit used: 9.8 of 21.4 GB
--- the big programs (blank = gone):
msedgewebview2  12 processes   409 MB
Claude           1 processes   369 MB        (this is Claude Code)
--- Claude desktop app processes (path contains AnthropicPBC):
0
--- top 8 programs now:
svchost 95 958 MB | Memory Compression 528 | msedgewebview2 409 | claude 369 | SnippingTool 362 | Taskmgr 188 | explorer 177 | SearchHost 161
--- node processes (other than mine): none
GATE (above 1800 MB and no big programs): MET
```

Earlier, NOT MET rescan at 15:34 (kept for the record):

```
Available MB: 1319
Commit used: 15.6 of 21.4 GB
--- the four big programs:
chrome          12 processes   426 MB
msedge           8 processes   202 MB
msedgewebview2  12 processes   360 MB
Claude           9 processes   904 MB        (8 are the Claude desktop app, 1 is Claude Code)
```

The ChatGPT/Codex app was gone by 15:34 (it was running at 15:30). Long runs have not been started.

## S1 PROGRESS.md

- [x] Created. (this file)

## S2 Rebuild scratch files (yesterday's were cleaned; scratch folder is `...\e1d748f5-b933-42a6-8f72-823d1a790f15\scratchpad`)

- [x] Scratch game = repo game with the round 2 `LEVEL_NEEDS`; `fast-seed3.js` = `fast.js` with reseed offset 1357913; `judge3.js`. Output:

```
scratch files written
--- needs line in the scratch game:
  const LEVEL_NEEDS  = [580,660,1470,1810,2190,2560,3020,3690,4600,5580,
                        6530,7430,9870,11600,13800,21750,25580,26600,30950,44440];
--- diff scratch vs repo game (must be only the LEVEL_NEEDS lines):
1525,1526c1525,1526
<   const LEVEL_NEEDS  = [580,660,1200,1600,2100,2450,3000,3700,4400,5200,
<                         6900,8800,11000,13800,16800,20500,25000,28500,33000,39000];
---
>   const LEVEL_NEEDS  = [580,660,1470,1810,2190,2560,3020,3690,4600,5580,
>                         6530,7430,9870,11600,13800,21750,25580,26600,30950,44440];
--- seed offset and paths in fast-seed3.js:
12:  ff.reseed(1357913 + level * 1000 + profile.length * 7 + profile.charCodeAt(0));
```

- [x] Judge self-test: run on yesterday's committed round 2 data with no new data, it reproduces yesterday's verdict (level 3 now judged against the declared 94 percent target):

```
15  13800  r2  |    69     61    72     3 |      1.29 |    n/a    34     4 | 
16  21750  r2  |    67     62    59    -8 |      0.86 |    n/a    21    13 | OFF TARGET >7; casual drop >8 (reported only)
17  25580  r2  |    64     61    57    -7 |      0.87 |    n/a   n/a   n/a | OFF TARGET >7
18  26600  r2  |    62     60    67     5 |      1.11 |    n/a   n/a   n/a | RISES >2SE
19  30950  r2  |    60     70    64     4 |      1.09 |    n/a   n/a   n/a | 
20  44440  r2  |    57     66    60     2 |      0.87 |    n/a   n/a   n/a | 

mean average win, levels 3-20: before 76.9, after 77.5
VERDICT: PASS RULE FAILED: level 3 mass/need 1.61 above level 2's 1.48; level 16 average 59% vs target 67%; level 17 average 57% vs target 64%; level 18 rises above level 17
```

## S3 Tune levels 3 and 16-20 (200 runs, 2 iterations, scratch game)

- [x] Done 15:38:58 to 15:49:29, exit 0. Command: `LOCK_LEVELS=1,2,4,5,6,7,8,9,10,11,12,13,14,15 TARGET_OVERRIDE='{"3":0.94}' GH_PROTO=<scratch game-r3.html> node tools/playtest/cc-tune-curve.js sim/results/cc-curve-baseline-200runs.json <out> 200 2 --apply`. Output:

```
started 15:38:58
target win % by level: 99 99 94 98 96 94 80 89 85 84 76 75 67 64 61 67 64 62 60 57
iteration 0: [580,660,1500,1810,2190,2560,3020,3690,4600,5580,6530,7430,9870,11600,13800,18430,24570,26180,35410,42950]
iteration 1: [580,660,1460,1810,2190,2560,3020,3690,4600,5580,6530,7430,9870,11600,13800,16680,26200,32400,37690,39200]
written to .../scratchpad/game-r3.html
finished 15:49:29 exit=0
--- scratch game LEVEL_NEEDS now:
  const LEVEL_NEEDS  = [580,660,1460,1810,2190,2560,3020,3690,4600,5580,
                        6530,7430,9870,11600,13800,16680,26200,32400,37690,39200];
--- changed vs round 2 (levels):
L3: 1470 -> 1460
L16: 21750 -> 16680
L17: 25580 -> 26200
L18: 26600 -> 32400
L19: 30950 -> 37690
L20: 44440 -> 39200
```

Note on the printed target line: levels 4-15 and 1-2 are locked, so their entries show the baseline measurement and are not used. The tuned levels use 94 (level 3, declared), 67, 64, 62, 60, 57.
(A one-line check I ran printed `false` for "levels 1-2 and 4-15 unchanged"; that expression was wrong. The list above is the real evidence: only L3 and L16-L20 changed.)

## S4 Re-measure levels 3, 16-20, both bots, 200 runs, new seeds

- [x] Done 08:27:40 to 08:41:40, exit 0, `errors` 0 in all 12 batches. Command: `GH_PROTO=<game-r3.html> node fast-seed3.js <out> 200 3,16,17,18,19,20 average,casual` (reseed offset 1357913, different from every earlier measurement). Output:

```
{"profile":"average","level":3,"runs":200,"win":0.96,"crash":0,"wallFail":0.04,"avgMass":2267,"need":1460,...,"errors":0}
{"profile":"average","level":16,"runs":200,"win":0.64,"crash":0.17,"wallFail":0.19,"avgMass":19037,"need":16680,...,"errors":0}
{"profile":"average","level":17,"runs":200,"win":0.59,"crash":0.115,"wallFail":0.295,"avgMass":24236,"need":26200,...,"errors":0}
{"profile":"average","level":18,"runs":200,"win":0.51,"crash":0.205,"wallFail":0.285,"avgMass":25541,"need":32400,...,"errors":0}
{"profile":"average","level":19,"runs":200,"win":0.535,"crash":0.19,"wallFail":0.275,"avgMass":31332,"need":37690,...,"errors":0}
{"profile":"average","level":20,"runs":200,"win":0.635,"crash":0.16,"wallFail":0.205,"avgMass":40920,"need":39200,...,"errors":0}
{"profile":"casual","level":3,"runs":200,"win":0.77,"crash":0,"wallFail":0.23,"avgMass":1905,"need":1460,...,"errors":0}
{"profile":"casual","level":16,"runs":200,"win":0.245,"crash":0.16,"wallFail":0.595,"avgMass":13467,"need":16680,...,"errors":0}
{"profile":"casual","level":17,"runs":200,"win":0.2,"crash":0.215,"wallFail":0.585,"avgMass":14773,"need":26200,...,"errors":0}
{"profile":"casual","level":18,"runs":200,"win":0.165,"crash":0.325,"wallFail":0.51,"avgMass":15835,"need":32400,...,"errors":0}
{"profile":"casual","level":19,"runs":200,"win":0.165,"crash":0.22,"wallFail":0.615,"avgMass":21611,"need":37690,...,"errors":0}
{"profile":"casual","level":20,"runs":200,"win":0.235,"crash":0.265,"wallFail":0.5,"avgMass":25921,"need":39200,...,"errors":0}
```

## S5 Judge against the pass rule

- [x] Done. `node judge3.js sim/results/cc-curve-baseline-200runs.json sim/results/cc-curve-remeasure-round2.json <remeasure3.json>` (levels 4-15 from yesterday's committed round 2 measurement; NEW = measured today). Output:

```
lv  need  src | avg: target before after diff | avg m/need | casual: before after drop | flags
 1    580  r2  |    99     99    98    -1 |      1.50 |     93    95   n/a | 
 2    660  r2  |    99     99    97    -2 |      1.48 |     90    94     1 | 
 3   1460  NEW |    94    100    96     2 |      1.55 |    100    77    17 | L3 m/n above L2; casual drop >8 (reported only)
 4   1810  r2  |    94     98    95     1 |      1.53 |     96    75     3 | 
 5   2190  r2  |    92     96    91    -1 |      1.48 |     75    65    10 | casual drop >8 (reported only)
 6   2560  r2  |    89     94    91     2 |      1.46 |     77    65     0 | 
 7   3020  r2  |    87     80    87    -0 |      1.42 |     54    55    10 | casual drop >8 (reported only)
 8   3690  r2  |    85     89    89     4 |      1.48 |     61    57    -3 | 
 9   4600  r2  |    83     85    86     3 |      1.43 |     60    51     7 | 
10   5580  r2  |    80     84    76    -5 |      1.31 |     69    46     4 | 
11   6530  r2  |    78     76    74    -4 |      1.30 |     41    36    11 | casual drop >8 (reported only)
12   7430  r2  |    76     75    79     3 |      1.33 |     35    40    -5 | 
13   9870  r2  |    73     67    78     4 |      1.33 |     34    41    -1 | 
14  11600  r2  |    71     64    77     5 |      1.34 |    n/a    38     3 | 
15  13800  r2  |    69     61    72     3 |      1.29 |    n/a    34     4 | 
16  16680  NEW |    67     62    64    -3 |      1.14 |    n/a    25     9 | casual drop >8 (reported only)
17  26200  NEW |    64     61    59    -5 |      0.93 |    n/a    20     4 | 
18  32400  NEW |    62     60    51   -11 |      0.79 |    n/a    17     4 | OFF TARGET >7
19  37690  NEW |    60     70    54    -6 |      0.83 |    n/a    17     0 | 
20  39200  NEW |    57     66    64     6 |      1.04 |    n/a    24    -7 | RISES >2SE

mean average win, levels 3-20: before 76.9, after 76.6
VERDICT: PASS RULE FAILED: level 3 mass/need 1.55 above level 2's 1.48; level 18 average 51% vs target 62%; level 20 rises above level 19
```

**Verdict: FAILED, three criteria.** Level 3 ratio (1.55 against 1.48); level 18 is 11 points under target (51 against 62); level 20 (64) rises above level 19 (54), just over 2 standard errors (difference 10 points, 2 SE = 9.8).
Passed: levels 4-17 and 19 each within 7 points of target, levels 16, 17, 19 no rise, overall mean 76.6 against 76.9 before (the game is neither harder nor easier overall).

## S6 Apply (only if S5 passes), then `checks.js` and `fast.js`; or S6b leave the game as it is and write the cause in the ledger

- [x] **S6a not run: S5 failed.** `checks.js` and `fast.js` were not run on a changed game because the game was not changed (ordered: run them only if the pass rule is met).
- [x] **S6b: game left as it is.** Output:

```
=== game file vs HEAD (0469a83)
(empty line above = no difference)
working blob: 58c6e7070d6b1b1a3cd8ac41848bcaa5f3df08be
HEAD blob:    58c6e7070d6b1b1a3cd8ac41848bcaa5f3df08be
  const LEVEL_NEEDS  = [580,660,1200,1600,2100,2450,3000,3700,4400,5200,
                        6900,8800,11000,13800,16800,20500,25000,28500,33000,39000];
HEAD 0469a83 | origin fd09e6b
```

- [x] **Cause, with evidence.** Same level, different wall number, round 2 against round 3, average bot, 200 runs each:

```
lv  need r2 -> r3 (change) | win r2 -> r3 | avg mass r2 -> r3
16 21750 -> 16680 (-23%) | 59 -> 64 | 18799 -> 19037 (1%)
17 25580 -> 26200 (2%) | 57 -> 59 | 22167 -> 24236 (9%)
18 26600 -> 32400 (22%) | 67 -> 51 | 29631 -> 25541 (-14%)
19 30950 -> 37690 (22%) | 64 -> 54 | 33833 -> 31332 (-7%)
20 44440 -> 39200 (-12%) | 60 -> 64 | 38659 -> 40920 (6%)
```

  1. **The tuner's model is wrong at the top.** `cc-tune-curve.js` (like `tune-needs.js` before it) sets each level's need from the mass distribution it measured at the OLD need.
     But traffic weight is `threatScale = need / 1100 * ...` (game line 1574), so raising the need also makes every car heavier, and the bot reaches less mass (level 18: need +22 percent, mass reached -14 percent; level 19: +22 and -7).
     The win rate therefore falls faster than the model expects (level 18: 67 to 51 for +22 percent), and the estimate overshoots.
  2. **The last iteration is not damped.** In `cc-tune-curve.js` (and `tune-needs.js`) the final iteration writes `next` in full, so one 200-run sample's noise goes straight into the shipped numbers.
  3. **Noise is about as large as the target step.** One level's win rate at 200 runs has a standard error of about 3.5 points; the target falls 2.3 points a level. Each need estimate carries about 7 percent error, which moves a level's win rate by 3 to 4 points by itself.
     So "no level above the previous by more than 2 standard errors" is hard to meet by luck at the top (level 20 rose 10 points, against 9.8 allowed).
  4. **Level 3's ratio (1.55 against 1.48)** is a small hump. Its win rate (96) is not above level 2's (97). The original problem was 2.03; it is now 1.55. The mass/need comparison has no noise allowance, so the rule is stricter than the data can resolve.

- [x] **Fix to propose** (needs all three to agree before it is built): (a) for levels 16-20, replace per-level quantile tuning with one smooth growth curve (need = need at level 15 times g to the power of the level gap), with one parameter g found by a 1-D search on the mean win rate of levels 16-20, so steps are small and monotone by construction;
  (b) measure with 400 runs at the top levels; (c) damp the last tuning iteration, or average the last two; (d) judge level 3's ratio with a standard-error allowance, or judge it by win rate (it is not easier than level 2 by win rate).
  Fallback, if Mumathai prefers: leave the curve as it is (today's game) and judge it with real player data from Sandbox, as Supersonic does.

## S7 Ledger addendum and memory update

- [x] Ledger: "Letter 010, addendum 2" posted at rev 28 (tool result: `verdict: allow, rev: 28`). Before posting, the ledger was read from rev 27: no reply from the chat session yet.
- [x] Round 3 result appended to `sim/results/cc-curve-NOTES.md`; evidence files `sim/results/cc-curve-remeasure-round3.json` and `cc-curve-tune-round3.json` saved. Memory note `gate-highway-pause-state` updated.

## Not done (kept up to date)

- **The curve (change 3) is not applied.** Round 3, the last extra round, failed the pass rule (S5). The game still has the old `LEVEL_NEEDS`. A new method needs all three to agree (proposed fix in the ledger, addendum 2).
- **`checks.js` and `fast.js` were not run** on a changed game, because the game did not change (ordered: only if the pass rule is met).
- **No push** (ordered; `origin` is still `fd09e6b`). **No commit** since `0469a83`: not asked. Uncommitted now: `PROGRESS.md`, the NOTES update, and the two round 3 evidence files.
- **The level-20 check in `checks.js` is not touched** (ordered; chat and Mumathai have not agreed; no reply in the ledger yet).
- Casual-bot baseline for levels 14-20 is missing (earlier runs stopped for memory); casual is reported, not tuned.
- Not checked today: the closed-page crashes of `checks.js` (cause unconfirmed), because `checks.js` was not run.
- Chat has not answered either question in addendum 1 (level-20 test fix; round 3 with level 3's target 94). Round 3 ran on Mumathai's order.
