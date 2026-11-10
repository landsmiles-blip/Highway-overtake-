# Curve work in progress (Claude Code, 2026-11-10). Nothing here is applied to the game.

Change 3 of Letter 009: no level easier than the one before, level 3 not a giveaway, small steps.
The game file still has the OLD `LEVEL_NEEDS`. The tuned numbers exist only in a scratch copy.

Target (set before running; Supersonic publishes no number, only "start super easy, then steadily increase"):
the average bot's win rate falls in a straight line from level 2's measured value, with the same mean over levels 3-20 as
today (76.9 percent). Levels 1 and 2 are locked. Target % by level: 99 99 96 94 92 89 87 85 83 80 78 76 73 71 69 67 64 62 60 57.

Files here (all made with tools/playtest/fast.js or cc-tune-curve.js, average and casual bots, 200 runs per level unless noted):
- cc-curve-baseline-200runs.json   the game as it is (33 of 40 batches: casual levels 14-20 missing, run stopped for memory)
- cc-curve-tune-round1.json        tuner, 100 runs, 2 iterations. Not converged.
- cc-curve-remeasure-round1.json   round 1 numbers, new seeds. FAILED the pass rule.
- cc-curve-tune-round2.json        tuner, 200 runs, 2 iterations (starting from round 1).
- cc-curve-remeasure-round2.json   round 2 numbers, new seeds (36 of 40: casual levels 17-20 missing). Almost passes.
- cc-smash-*.json                  the smash experiment rerun (Letter 010)

Round 2 LEVEL_NEEDS (levels 1-2 unchanged):
[580,660,1470,1810,2190,2560,3020,3690,4600,5580,6530,7430,9870,11600,13800,21750,25580,26600,30950,44440]
Round 2, average bot, win % by level 3..20: 97 95 91 91 87 89 86 76 74 79 78 77 72 59 57 67 64 60 (mean 77.5, was 76.9).
Failures of the pass rule: level 16 (59 vs target 67) and 17 (57 vs 64) because the wall jumps 13,800 -> 21,750 at level 16;
level 18 (67) rises above level 17; level 3 mass/need 1.61 is above level 2's 1.48 (win rates equal, 97 and 97).

Pass rule (set before the runs): each average-bot level within 7 points of target; no level above the previous by more than 2 standard
errors; level 3 mass/need no higher than level 2's; casual drop per level reported against the 8-point limit (casual is reported, not tuned).

NEXT (one extra round is left): re-tune levels 3 and 16-20 only, because each level plays independently of the others:
  LOCK_LEVELS=1,2,4,5,6,7,8,9,10,11,12,13,14,15  TARGET_OVERRIDE='{"3":0.94}' \
  GH_PROTO=<scratch copy of the game that already has the round 2 numbers> \
  node tools/playtest/cc-tune-curve.js sim/results/cc-curve-baseline-200runs.json out.json 200 2 --apply
then re-measure only levels 3 and 16-20, both bots, on new seeds (a copy of fast.js with a different reseed offset). Levels 4-15 keep their round 2
measurement. If it passes: apply LEVEL_NEEDS to the game in ONE edit, run checks.js. If it fails: leave the game as it is and write the cause and fix in the ledger.
Casual bot (honest note): one wall number per level cannot make both bots smooth. Casual 90 -> 72-78 at level 3 and 75 -> 65 at level 5 are real cliffs
(level 5 was already 96 -> 75 before any change). Tuning targets the average bot only; the casual numbers are reported.
Memory: the machine has 7.7 GB; two long runs were stopped by the system. Close Chrome, ChatGPT and Edge first.
