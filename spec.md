# SaltmineXcape - Graphics Overhaul

## Current State
Full canvas-drawn retro platformer game in Game.tsx (~4400 lines). All rendering is done via canvas 2D drawing functions. The game has basic pixel-art style sprites for James Salt, the Evil Crypto Bear, hazards, platforms, and HUD. There are some existing particle effects (steam from salt meter) and basic platform textures.

## Requested Changes (Diff)

### Add
- Multi-frame walk cycle for James Salt (3-4 frames of leg/arm animation for side profile run state)
- Distinct tumble/fall death animation for James (spin + fall when dying state)
- Evil Crypto Bear: proper 2-3 frame walk cycle with alternating legs, wind-up throw animation with arm windmill, idle breathing bob
- Platform textures: mine-themed wooden plank look with wood grain, depth shading, shadow underneath each platform
- Background layers: richer parallax cave with stalactites, glowing ore veins, mine scaffolding posts, torchlight flicker effect
- Hazard polish: rocks with visible spin animation, candles with pulsing glow halos, mine carts with spinning wheels
- Portal (green candle door): pulsing glow, animated flame particles at top
- HUD polish: retro pixel-styled borders/frame around HUD strip, portfolio value ticker animation on changes, salt meter gradient fill (green→yellow→red)
- Particle effects: dust cloud on landing, spark burst on axe hit, coin scatter on portfolio pickups, screen shake on taking damage
- Level color transitions: more dramatic palette shifts per level, screen wipe/flash effect on level change

### Modify
- drawBackground() - add parallax layers, stalactites, ore veins, scaffolding, torchlight
- drawPlayer() - enhance walk cycle frames, add dying spin/fall animation
- drawBear() - add walk cycle frames, idle bob, better throw wind-up
- drawHazard() - add glow effects, spinning animations for boulders
- drawPlatform() - add wood grain texture, drop shadow, depth edge
- drawHUD() - add pixel border frame, gradient salt meter, portfolio change ticker
- Portal drawing - add pulsing glow + flame particles
- Level transition effect - add screen wipe/flash on level change

### Remove
- Nothing removed, only enhanced

## Implementation Plan
1. Enhance drawBackground() with parallax cave layers: far-back dark gradient, mid stalactites drawn as downward triangles at fixed positions per level color scheme, ore vein glowing streaks, scaffolding vertical beams with horizontal planks, flickering torch effects
2. Improve platform rendering: add wood grain lines, beveled top edge, drop shadow below, optional nail dots
3. Enhance James Salt walk cycle: use frame counter to drive more expressive leg/arm alternation in run state, add subtle body bob, improve jumping pose arm position
4. Add death animation: in dying state, rotate James and move him downward with increasing speed
5. Improve Evil Crypto Bear: add leg stride animation using sin wave, idle breathing (body scale bob), better throw wind-up (arm circles)
6. Enhance hazard visuals: add glow shadow to candles, ensure boulder rotation is visible, cart wheels rotate
7. Improve portal: add pulsing outer glow, draw flame-like upward particles at candle top
8. Polish HUD: draw pixel art border around HUD area, add gradient fill to salt thermometer (green at low, yellow at mid, red at high), add floating +/- number when portfolio changes
9. Add particle system: GameState gets dustParticles[], sparkParticles[], coinParticles[] arrays; emit on land, axe hit, pickup; apply screen shake offset on hit
10. Enhance level transition: increase levelTransitionAlpha flash brightness, add horizontal wipe bars
