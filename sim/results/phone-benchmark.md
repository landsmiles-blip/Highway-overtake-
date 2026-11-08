# Benchmark results from Mumathai's devices

From `?bench=1`, run by Mumathai on 2026-11-08. Screenshots are in the private Drive folder. Differences of about 3 fps are noise.

**Phone:** Mali-G52 MC2, Android 10, Chrome 156, screen 360x707 at ratio 2. First load 1,238 and 2,395 ms.

| Setting | fps, build 93ab076 (21:12) | fps, build fc0dee9 (22:55, more cars) |
|---|---|---|
| As built | 35.2 | 29.5 |
| Pixel ratio 1 | 34.3 | 35.9 |
| No shadows | 39.7 | 38.8 |
| No smoothing | 32.1 | 32.1 |
| Cheap materials | 32.5 | 33.2 |
| Half scenery | 32.3 | 28.4 |
| Ratio 1, no shadows, no smoothing | 39.6 | 41.3 |
| All cheap | 42.3 | 40.7 |
| Draws, as built | 764 | 868 |

**Reading:** halving scenery gains nothing. Shadows cost most. Everything cheap stops near 41 fps. Merging cars and roadside parts followed: about 270 draws in build 09f676b. **That build is not measured on the phone yet.**

**PC:** AMD Radeon R7, 1366x641 at ratio 1, as built 44.9, no shadows 51.9, all cheap 46.6. Two rows read 0 because that tab was in the background: ignore them.
