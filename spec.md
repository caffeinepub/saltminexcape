# SaltmineXcape

## Current State
- Game.tsx (~5594 lines) contains all game logic, rendering, and UI
- Salt Meter only changes on hazard hits (+15-35) and water bottle pickups (-30); it passively DECAYS at -0.3/frame (never passively fills)
- Weapon pickup outline: when James holds axe or gun, a `strokeRect` box is drawn around his entire body (lines 1343-1366) — visible glowing square bug
- Gun power-up: NO gun sprite drawn on James's body. Only the now-to-be-removed box outline indicated the gun was held
- James has a 4-frame walk cycle, overhead axe attack animation, death tumble. No visual difference between idle-with-gun vs idle-without
- Power-up states: hasAxe/axeTimer (600f), hasGun/gunTimer (500f)
- Graphics: multi-frame animations, parallax cave bg, hazard sprites, portal, collectibles all drawn in canvas

## Requested Changes (Diff)

### Add
- **Salt Meter passive fill**: Salt Meter ticks up automatically over time each level (rate increases with year number). This is now also a level timer pressure mechanic.
- **Speed slowdown from salt**: At >70% salt, James's horizontal speed is reduced. At >85%, barely shuffling. Jump height remains full at all salt levels.
- **Gun sprite on James**: When hasGun is true, draw a visible gun in James's hand as part of his sprite — held at side while walking/idle, raised when firing.
- **James Salt visual overhaul**: More expressive face, better proportions, cleaner dark skin tone, baseball cap detail, grey T-shirt, dark pants, boots. Improved walk cycle. Attack animation more dramatic.

### Modify
- **Remove weapon square**: Delete the `ctx.strokeRect(-3, -3, p.w + 6, p.h + 6)` box drawn around James when holding axe or gun (lines 1343-1366). Replace with a subtle glow applied to the character body fills instead (shadowBlur on body, not a rectangle outline).
- **Salt Meter passive rate**: Replace the current passive DECAY (-0.3/frame) with a passive FILL (+rate/frame), where rate = 0.08 + (level-1) * 0.015 (approx 8s to fill on year 1, ~5s on year 8). Salt still increases from hazard hits. Salt still decreases from water bottle pickups (-30 each).

### Remove
- **strokeRect weapon boxes**: Both the axe strokeRect (lines 1343-1354) and gun strokeRect (lines 1355-1366) removed entirely.
- **Passive salt decay**: Remove the line `gs.saltMeter = Math.max(0, gs.saltMeter - 0.3)` since salt now fills passively instead of draining.

## Implementation Plan

1. **Fix weapon box bug**: In `drawPlayer`, remove the two `ctx.strokeRect` calls (one for axe, one for gun). Keep the shadow glow concept but apply `ctx.shadowBlur` directly to the character body/torso fill calls when a weapon is active, rather than using a rectangle outline.

2. **Add gun sprite to James**: In `drawPlayer`, when `hasGun` is true:
   - In run/idle states: draw a small pixel-art gun in his right hand (barrel pointing right if facing right, left if facing left)
   - In a new "firing" pose or when B is pressed with gun: draw gun raised/extended
   - Gun is teal/grey colored, small (about 12x6 pixels scaled with James)

3. **Salt Meter passive fill** (replace decay with fill):
   - Remove: `gs.saltMeter = Math.max(0, gs.saltMeter - 0.3)`
   - Add: `gs.saltMeter = Math.min(100, gs.saltMeter + (0.08 + (gs.level - 1) * 0.015))`
   - Keep all existing hazard-hit increases
   - Keep water bottle decrease (-30)
   - When salt hits 100, trigger death (lose a life, restart level) same as existing death logic

4. **Speed slowdown from salt**:
   - In the player movement update, before applying horizontal velocity, check saltMeter:
     - saltMeter > 85: multiply speed by 0.25
     - saltMeter > 70: multiply speed by 0.55
     - saltMeter <= 70: full speed
   - Jump velocity (`vy`) is NOT affected by salt level
   - Optionally add a visual shuffling effect in the walk animation at high salt (wider stance, slower frame advance)

5. **James Salt visual improvements**: Enhance the `drawPlayer` function:
   - More defined face with visible eyes (white sclera, dark pupils), slight sweat drop when salt > 50%
   - Better body proportions (slightly taller, cleaner limb drawing)
   - At high salt (>70%), draw visible sweat beads and labored posture (slight forward lean)
   - Walk cycle: frame advance slows proportionally with salt slowdown for visual consistency
