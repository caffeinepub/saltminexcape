# SaltmineXcape

## Current State
- Game.tsx is ~6814 lines, single file canvas game
- Canvas is 320x480 logical pixels, drawn at 1:1 (no DPR scaling)
- Main game loop uses `requestAnimationFrame` with no frame rate cap or Tesla/low-end detection
- James Salt sprite: PLAYER_W=24, PLAYER_H=36 pixels drawn with fillRect calls
- James has: idle/front-face, run (4-frame cycle), jump, attacking, dying states
- Cap brim faces forward (straight)
- Default walk expression is neutral/slightly angry based on salt meter
- No Tesla browser detection or lite rendering mode exists
- Per-frame rendering includes: parallax backgrounds, drip animations, ember particles, crystal glows, shadow blur effects, multiple layers of shading

## Requested Changes (Diff)

### Add
- **Tesla/low-end lite rendering mode**: Detect Tesla browser via `navigator.userAgent` containing `Tesla`. Also detect any slow Chromium via userAgent. When detected:
  - Cap frame rate to 30fps using `lastTime` delta throttle in the RAF loop
  - Reduce particle budgets (max particles halved)
  - Skip expensive shadow blur draw calls (`ctx.shadowBlur` calls)
  - Simplify background: skip drip animation, ember particles, crystal glow pulses, scaffolding detail
  - Skip motion trail on James
  - Canvas stays 320x480 (do not change game logic coords)
  - Add a subtle `LITE MODE` indicator in HUD when active
- **James Salt full sprite redesign**: Larger sprite (PLAYER_W=32, PLAYER_H=48), completely redrawn with better pixel art
  - Dark skin (#7B4A2D base, #5C3318 shadow, #9B6040 highlight)
  - Baseball cap tilted sideways (brim points upper-right, cap body tilts ~15-20deg visually via offset pixels)
  - Default expression: determined, focused — furrowed brow drawn with dark pixel above eye, set jaw line, not gritted teeth but firm
  - Walk cycle: 4 frames, arms swing counter to legs, body bobs, dust kick at feet
  - Jump: arms up and out, legs tucked slightly, wind lines
  - Attack (pickaxe): scrappy determined swing — lean forward in windup, slam hard on downswing, both arms involved
  - Death: throws hands up on first frame, spins off screen with increasing opacity fade (more dramatic than current)
  - Gun held visibly when gun power-up active: held at hip while walking, raised forward when firing
  - Bigger silhouette means more readable at small display sizes
  - Shading contrast: highlight (+20% brightness) on top-left surfaces, deep shadow on right/bottom edges
  - Cap: navy blue, sideways tilt with visible brim pixel overhang to one side, small button on top
  - T-shirt: light grey (#d4d4d4 base, #a8a8a8 shadow, #efefef highlight stripe)
  - Pants: dark navy (#1a1a3a, #2a2a5a highlight on knee)
  - Boots: dark brown (#2a1a0e, #3d2b1a highlight)

### Modify
- All existing collision and physics logic must use new PLAYER_W=32, PLAYER_H=48 dimensions — update spawn position, boundary checks, platform collision, and any hardcoded offsets that reference old 24x36 size
- `drawPlayer` function: completely rewrite the pixel art drawing for all states using new dimensions
- Weapon overlays (pickaxe, gun, dynamite, salt shaker, hard hat) must be repositioned to fit the new 32x48 sprite proportions
- RAF loop: add `liteMode` flag derived from userAgent check at component mount, pass to `renderGame` and `drawBackground` to skip expensive effects

### Remove
- Nothing removed from gameplay

## Implementation Plan
1. At component mount, detect Tesla/lite mode: `const liteMode = /Tesla|QtWebEngine/.test(navigator.userAgent)`
2. Pass `liteMode` boolean into `renderGame(ctx, gs, liteMode)` and all drawing functions that have expensive effects
3. In RAF loop: if liteMode, throttle to 30fps using timestamp delta (`if (now - lastFrameTime < 33) return`)
4. In `drawBackground`: wrap drip loops, ember particle loops, crystal pulse calls, and scaffold detail in `if (!liteMode)` guards
5. In `drawPlayer`: wrap motion trail in `if (!liteMode)` guard
6. In all draw functions: skip `ctx.shadowBlur` assignments when `liteMode` (set to 0 instead)
7. Update `PLAYER_W = 32` and `PLAYER_H = 48`
8. Update spawn `y` position: `CANVAS_H - 40 - PLAYER_H`
9. Rewrite `drawPlayer` for all states (run, idle/front, jump, attacking, dying) with new 32x48 pixel art
10. Rewrite weapon/power-up overlays at new proportions
11. Ensure all platform collision logic uses `p.w` and `p.h` (dynamic, not hardcoded) — audit for any magic numbers
12. Add `LITE MODE` text in HUD draw (small, top-right of HUD) when liteMode active
