# SaltmineXcape

## Current State
- Game is fully playable with keyboard, touch, and gamepad controls
- Salt meter fills passively at `0.08 + (level-1) * 0.015` per frame
- Water bottles reduce salt meter by 30 when collected; no effect on fill rate
- Reaching the exit portal without all bottles calls `loseLife()` (dies, restarts)
- Bear walks on top platform and throws hazards, no stun mechanic
- Music volume slider exists alongside SFX controls
- No combo system, streak bonus, close call bonus, dodge streak, near-miss feedback, bear rage escalation, or year-end bonus
- Floating text system exists but only used for portfolio events
- No `bearStunTimer`, `bearRageCount`, `convictionCombo`, `hodlerStreak`, `dodgeStreak` fields in GameState

## Requested Changes (Diff)

### Add
- **Bear stun mechanic**: pickaxe swing or bullet hit on bear triggers stun (~2 seconds / ~120 frames), bear freezes+flashes, stops throwing, drops a random pickup (maturity bag or water bottle) at its position. Floating text: `"BEAR STUNNED!"` (white)
- **Bear rage escalation**: each stun increments `bearRageCount`; after recovery, throw interval decreases and throw speed increases per rage level. Show `"BEAR IS ENRAGED! 🔥"` floating text when rage escalates (red)
- **Combo system**: collecting pickups (water bottles, maturity bags, community bags) in quick succession (<90 frames apart) builds `convictionCombo` counter. While combo >= 2, portfolio gains are multiplied. Floating text: `"CONVICTION x2!"`, `"CONVICTION x3!"` etc. (gold)
- **HODLer streak bonus**: completing a level without dying adds to `hodlerStreak`. On level completion, award `hodlerStreak * 500` portfolio bonus. Show `"HODLER BONUS! +$X"` (gold). Death resets streak to 0
- **Close call bonus**: reaching portal with salt meter >= 80% awards `$500 + saltMeter * 50` portfolio bonus. Show `"SALTY SURVIVOR! +$X"` (gold)
- **Hazard dodge streak**: track `dodgeStreak` - increments when hazard passes within 40px of James without hitting; resets on hit. Every 5 dodges, give brief 1.5x speed boost (90 frames) + show `"CONVICTION!"` (white flash text)
- **Near-miss feedback**: when any hazard passes within 35px without hitting (and not in hit invincibility), show `"CLOSE!"` (red) floating text near James (rate-limited so it doesn't spam)
- **Year end bonus**: on level complete, calculate bonus based on current salt meter: `Math.floor((100 - saltMeter) * 100)` portfolio boost. Show `"HEALTH BONUS! +$X"` (gold) floating text
- **Bear drop pickup on stun**: spawn a maturity bag (70% chance) or water bottle (30% chance) at bear's x position on the top platform when stunned
- New GameState fields: `bearStunTimer`, `bearRageCount`, `convictionCombo`, `comboTimer`, `hodlerStreak`, `dodgeStreak`, `nearMissTimer`, `dodgeBoostTimer`, `levelDeaths` (deaths this level for streak tracking)

### Modify
- **Salt fill rate**: reduce base rate from `0.08` to `0.064` (20% slower). Per-level scaling stays the same
- **Bottle fill rate reduction**: each water bottle collected permanently reduces this level's passive salt fill rate by `1/totalBottles * baseRate`. Track as `saltFillReduction` reset on `initLevel`. So collecting all bottles on a level halves the passive fill rate
- **Portal behavior**: when bottles outstanding, do NOT call `loseLife()`. Instead set `bottleWarningTimer = 180` and show the existing warning message. Do nothing else - just block the portal until all bottles collected
- **Remove music volume slider**: keep music mute button, remove the separate volume slider for music. SFX volume slider and SFX mute button stay
- **Bullet hit detection**: extend bullet collision check to also hit the bear (bear bounding box: `bearX, bearY-42, 42, 42`). On bullet hit, trigger bear stun
- **Axe attack**: extend range check for axe smash to also check bear proximity. If bear is within 80px of James during axe swing (attackTimer active), trigger bear stun
- **Floating text rendering**: enhance existing floating text system to support scale-in animation (scale from 1.5 to 1.0 over first 15 frames) and color-specific glow (gold texts glow yellow, red texts glow red, white texts glow white)
- **`initLevel`**: reset `saltFillReduction = 0`, `convictionCombo = 0`, `comboTimer = 0`, `dodgeStreak = 0`, `dodgeBoostTimer = 0`, `levelDeaths = 0`, `nearMissTimer = 0`
- **`loseLife`**: increment `levelDeaths`, reset `hodlerStreak` to 0

### Remove
- Music volume slider from HUD (the `<input type="range">` for music, if any - check if it still exists separately from SFX slider)
- `loseLife()` call when reaching portal without bottles (replaced with just the warning)

## Implementation Plan
1. Add new GameState fields: `bearStunTimer`, `bearRageCount`, `convictionCombo`, `comboTimer`, `hodlerStreak`, `dodgeStreak`, `nearMissTimer`, `dodgeBoostTimer`, `levelDeaths`, `saltFillReduction`
2. Update `initLevel` to reset new fields and initialize `saltFillReduction = 0`
3. Update `loseLife` to track `levelDeaths` and reset `hodlerStreak`
4. In `updateGame`:
   a. Change passive salt fill from `0.08` to `0.064`
   b. Apply `saltFillReduction` to the fill rate: `0.064 - saltFillReduction`
   c. When water bottle collected: add `(0.064 + (level-1)*0.015) / totalBottles` to `saltFillReduction`
   d. Fix portal: remove `loseLife` call, just set `bottleWarningTimer`
   e. Add bear stun logic: decrement `bearStunTimer`, skip bear walk/throw when stunned, flash bear
   f. Add bullet/axe vs bear hit detection
   g. Add bear stun drop (spawn pickup)
   h. Add combo tracking on pickup collection
   i. Add dodge streak tracking
   j. Add near-miss detection (rate-limited via `nearMissTimer`)
   k. Add dodge boost speed modifier
   l. On level complete: apply close-call bonus, health bonus, hodler bonus
5. Enhance floating text render with scale-in animation and glow
6. Update bear rendering: flash white when stunned (`bearStunTimer > 0 && frame % 4 < 2`)
7. Remove music volume slider from JSX (HUD strip)
8. Initialize new fields in `gsRef.current` initial state and `resetGame`
