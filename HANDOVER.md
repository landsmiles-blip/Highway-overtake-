# Handover: Gate Highway, moving to another computer

For the next Claude Code session and for Mumathai. Written 2026-11-09. **This session continues the work. It does not start again.** If this file and the ledger disagree, the ledger's latest letter is newer.

## Set up the new computer

Same accounts on the new machine, Windows: Claude account, and GitHub `landsmiles-blip`.

1. Install Git, Node, Chrome and Claude Code. ffmpeg is needed only for audio work.
2. Get the code:
   ```
   git clone -b claude/task-1-letter-002 https://github.com/landsmiles-blip/Highway-overtake-.git gate-highway
   cd gate-highway
   git remote add upstream https://github.com/slickboy414-prog/Highway-overtake-.git
   git remote set-url --push upstream DISABLED_never_push_to_owner
   ```
3. From Google Drive (`landandsmiles@gmail.com`), folder **Gate Highway handover**, download everything into the `gate-highway` folder. `.gitignore` keeps those files out of the public repo.
4. Connect Playgama, then in Claude Code type `/mcp`, choose it, and approve in the browser:
   ```
   claude mcp add --transport http playgama-developer-console https://developer.playgama.com/api/mcp
   ```
5. Tools for testing, outside the repo: `npm i playwright-core`, then set `NODE_PATH` to that `node_modules`. If Chrome is not at the default path, set `CHROME_PATH`.
6. **This chat, from USB, optional:** copy `61a6dd2d-5237-4e31-bb1b-2e06036669ad.jsonl` to `%USERPROFILE%\.claude\projects\<folder path with :, \ and spaces as dashes>\`, for example `C--Users-NAME-gate-highway`, then run `claude --resume`. **Never tested across computers, and it may not work if the folder path differs.** If it does not work, nothing is lost: keep the file and let the new session search it. Copy `memory\` into the same project folder.
7. Start Claude Code in the folder and paste:
   > Read HANDOVER.md, then the review ledger since rev 16 at https://claude.ai/artifact/VTVthmD15cyqMvrwmuR21k . We continue Gate Highway. Do not start again. Tell me what you understand before changing anything.

## Where the work stands

- **Build:** `gate-highway-prototype.html` on the fork, branch `claude/task-1-letter-002`, PR #1. Run it: [phone link](https://landsmiles-blip.github.io/Highway-overtake-/gate-highway-prototype.html). Add `?fps=1` for a frame counter, `?bench=1` for the benchmark.
- **On Playgama:** nothing. The Add Game form was left unsent.
- **In the build:** symbols instead of numbers on gates, power bar, faster game (35%), busy traffic, smaller car, three different doors per line, bump instead of wreck on levels 1 and 2, one new thing per level, Mumathai's two tracks and CC0 effects, Bridge SDK 2.4.1, saved progress, auto quality drop, covers, and a ship build that strips test hooks.
- **Package:** `node tools/ship/build.js <version>` makes `dist/` and a zip. Sandbox needs that zip, the three covers in `assets/covers/`, and the form with a category.

## Before Sandbox (Mumathai's decision, 2026-11-09)

Both must be true: **(1) Mumathai plays it and approves. (2) The chat session reviews Letter 005 and 006, and real issues are fixed.** Sandbox is a public link with no moderation, so do not upload before that, and confirm with Mumathai first.

Mumathai did not tick the repo owner's yes as a condition for Sandbox. It remains an unresolved risk: the repo has no licence file, and the owner has not answered about this game. Raise it again before any public release. Do not decide it for them.

## Next, in order

1. Mumathai has **not** played this build yet, and is testing today. Take that report first: speed, traffic, symbols, sound.
2. Benchmark again on the phone, for the new draw count. Before it was 29.5 fps as built. See `sim/results/phone-benchmark.md`.
3. Read the chat session's reply in the ledger. Argue with it where it is wrong. Fix what holds up.
4. Sound: I cannot hear. Mumathai judges. Swap anything cheap. Sources are in `assets/audio/SOURCES.md`, and `tools/audio/build.js` rebuilds, using `audio-sources.zip` from Drive.
5. After `/mcp` approval, or in Chrome where Mumathai is signed in: run Playgama's QA tool. Check that Bridge's call to `api.playgama.com` (seen on the live link in mock mode) does not break the no-outside-calls rule on the platform.
6. When both conditions hold and Mumathai says go: add the game, upload, publish to Sandbox, read the player data.
7. **Then stop and interview Mumathai about the garage** (rule 7). Not started.

## Open facts, honestly

- **Bots are not players.** Win rates use guessed skills, 60 to 80 runs a level. The last small change to `LEVEL_NEEDS` was not re-run across the full curve.
- `checks.js` failed once on the final build with a timeout and a level 20 hit, while the PC was busy. Unchanged rerun passed. Cause not found.
- Frame rate on the real phone after merging: not measured. Auto quality has never run on a real phone.
- Merged cars lost wheel spin, and glass and metal shine. Looked fine in stills.
- Not verified: the 3-second rule and the 2-to-1-minute level cut, both unfound. CrazyLabs page not opened, because it blocked me. The research report in the chat session was never readable from here.
- Sound effects other than the engine are chosen by measurement only.
- Bridge config is `{}`. Playgama's build check has not seen it.

## Mumathai's rules

1. Never proceed on contradicting instructions. Stop and confirm. Must never be broken.
2. The game must fit any device frame, always: 390x844, 844x390, 320x568, 820x1180, 1440x900, 600x600, 1920x600.
3. Every decision written down with its reasoning and evidence.
4. Plain, simple English. No filler, no flattery.
5. Push back when a premise is wrong.
6. Treat AI research as unverified until checked against primary sources.
7. Interview before building. Ask, do not assume.
8. Never call Mumathai "Mwalimu".
9. Capture things as they are said.
10. Never repeat a step, instruction or prompt already given. Point back to it.

**Working style:** on technical choices, recommend one and say why, because Mumathai has said they lack the knowledge to choose. Report often and simply. Do not over-complicate: Mumathai had to pull this back from process to a simple game. **Do not push or upload after being told not to.**

## Safety rules for this repo

- **Never push to `main` or to the owner's repo.** Push with `git push origin claude/task-1-letter-002`. Every push changes the phone link.
- **Never search `gate-highway-prototype.html` without a line filter.** Line 335 is 603 KB of Three.js and line 13 is 90 KB of fonts. Game code starts at line 338. Search past line 337 only. `checks.js` fails if these lines move.
- Never change an economy number without running it in the real game: `tools/playtest/fast.js`.
- One test browser at a time on a small PC: three got a run stopped for low memory.
- The Sonniss licence bars distributing raw sounds, and this repo is public, so use CC0 sources.

## Tools

| Script | Use |
|---|---|
| `tools/playtest/checks.js <dir>` | Rules, all 7 frames, line 335. Look at the pictures too |
| `tools/playtest/fast.js <out> <runs> <levels\|all> <bots>` | Real game code, fast. Win, crash and wall rates |
| `tools/playtest/metrics.js`, `sweep.js`, `ablate.js`, `clocktest.js`, `shots.js`, `myplay.js` | Cars on screen and draws, try a constant, one-at-a-time, speed at low fps, pictures, play by frames |
| `sim/tune-needs.js`, `sim/gate-sim.js`, `sim/final.js` | Need tuning, my early model (too kind early), chat session's model (no traffic) |
| `tools/ship/build.js`, `tools/ship/covers.js` | Package, covers |

Results are in `sim/results/` and `sim/README.md`. The full reasoning is in the ledger, Letters 001 to 006.

## Update 2026-11-10: where the work paused (read this first; the ledger is newer if they disagree)

Ledger: Letters 007 to 010, then Letter 010's addendum. Rules 11 and 12 are in the ledger and in `01-rules.md` (that file is in Google Drive, not in git).

**Built, committed and pushed to `origin claude/task-1-letter-002` on 2026-11-13 (Mumathai's green light):** change 5 (level 1 opens as the wreck), change 1 (x2 label on the hub),
change 2 (pause button top right on screens 1.4 wide or more), change 4 (test tools: `fast.js` is now served over local HTTP so Bridge loads, any page error fails a run,
the ship build scans every shipped file for URLs, `checks.js` checks the car stays clear of the buttons). Pictures and numbers are in the ledger addendum.

**Not done: change 3, the difficulty curve.** The game still has the old `LEVEL_NEEDS`. Rounds 1, 2 and 3 all failed the pass rule (round 3 on 2026-11-12: level 3 ratio, level 18 off target,
level 20 rising). Cause and proposed fix are in the ledger (Letter 010, addendum 2) and in `sim/results/cc-curve-NOTES.md`; every step's real output is in `PROGRESS.md`. No extra round is left:
a new method (smooth growth curve for levels 16-20, 400 runs, damped last iteration) needs Mumathai and the chat session to agree. Fallback: keep today's curve and read real Sandbox data.

**Open, needs all three to agree (Rule 11):** the `checks.js` level-20 bus check fails about 1 run in 6 because the unsteered test car sometimes crashes before halfway
(`tools/playtest/cc-level20-diag.js`). The fix is one line in the test. Briefed in the ledger, not applied.

**This computer:** Chrome is at `C:\Program Files\Google\Chrome\Application\chrome.exe` (the tools default to the x86 path), so set `CHROME_PATH`. Test tools live in `C:\Users\BDE\gh-test-tools`
(`NODE_PATH`). RAM is 7.7 GB: two long runs were stopped by the system, so close Chrome and other apps first. `checks.js` opens visible Chrome windows: do not close them while it runs.
`wip-backup.patch` in this folder is not from Claude Code; do not commit it. Commit with explicit file paths, never `git add -A`. Git identity is the noreply address.

**Push:** pushed on 2026-11-13 to `origin claude/task-1-letter-002` only (never `main`, never the owner's repo). The phone link now shows this build. Push again only when Mumathai says so, and only what passed.
