# SaltmineXcape

## Current State
Full retro arcade platformer with flat platforms, random layout, SFX, leaderboard, bear at top, touch/gamepad/keyboard controls. Canvas currently fills full browser viewport with touch controls overlapping the game canvas. Bear is fixed at top throwing hazards. Leaderboard shows in top-right corner. D-pad includes up/down buttons.

## Requested Changes (Diff)

### Add
- Green candle portal (stock market candlestick style: tall green body + wick top/bottom) as the level exit, fixed position on top platform right side
- Bear walking animation: bear paces left-right on top platform, stops to throw (existing throw animation), resumes walking
- Leaderboard as a full centered modal overlay on game over / victory

### Modify
- Layout restructure: fixed 320x480px game canvas, HUD strip ABOVE canvas (not inside/overlapping), dedicated touch controls zone BELOW canvas (not overlapping game)
- Touch D-pad: remove up/down buttons, keep only left/right. A (jump) bottom-right, B (axe) bottom-right. Layout in dedicated control strip below canvas
- Bear: now paces left-right on top platform continuously, stops briefly at throw moment, resumes after throw
- Leaderboard: replace top-right corner display with a full centered modal overlay

### Remove
- Up/down D-pad buttons
- HUD rendered inside the game canvas (move above)
- Controls overlapping game canvas

## Implementation Plan
1. Restructure React layout: flex column with [HUD bar] [game canvas 320x480] [controls strip ~110px]
2. Canvas clips to 320x480, game renders within those bounds
3. HUD moves to a styled bar above the canvas
4. Touch controls below canvas: left arrow, right arrow on left side; B and A buttons on right side
5. Bear logic: add walkDir, walkSpeed, walkX state to bear; every frame move bear left/right on top platform, reverse at edges; on throw trigger, stop walking, play throw animation, resume after
6. Draw green candle portal on top platform right side: tall green rect body + thin wick above and below, slight glow effect
7. Leaderboard: refactor from positioned div in corner to a centered full overlay modal with backdrop
