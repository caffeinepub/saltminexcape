# SaltmineXcape

## Current State
A retro arcade platformer on a 480x640 canvas. The game has James Salt character with multi-frame animations, Evil Crypto Bear on top platform, hazards (boulders, carts, barrels, doompost, chests, saltbags, candles), collectibles (water bottles, maturity bags, community bags, axe/gun pickups), particle effects (dust, sparks, coins, screen shake), portfolio ticker flash, salt meter, level color transitions, parallax cave background, and platform textures per level.

## Requested Changes (Diff)

### Add
1. James Salt sweat drops when running angry state
2. Running dust kick-up particles at James's feet
3. Bear taunt animation (arms waving) when James loses a life, rage red glow when throwing
4. Per-year level atmosphere: yr1-2 dust motes, yr3-4 water drips, yr5-6 lava glow/heat shimmer, yr7-8 hellscape ember/ash/red crystals
5. Collectible glows: community bag gold pulsing aura, maturity bag shimmer, water bottles cool blue halo
6. Screen effects: vignette darkens when salt>=80%, red flash overlay on damage, green flash overlay on portfolio boost
7. Power-up visuals: orange neon outline on James when axe active, blue neon outline when gun active, intense pulse when nearly expired
8. Hazard visual behaviors: chest crack-open on hit, salt bag white particle burst, doompost wobble

### Modify
- drawBackground: per-year atmosphere
- drawPlayer: sweat drops, power-up aura glow outlines
- drawBear: taunt state, rage glow
- drawHazard: chest crack, saltbag burst, doompost wobble
- HUD render: vignette, red flash, green flash overlays
- GameState: add bearTauntTimer, damageFlashTimer, portfolioFlashGreenTimer, ambientParticles

### Remove
Nothing

## Implementation Plan
1. Add state fields: bearTauntTimer, damageFlashTimer, portfolioFlashGreenTimer, ambientParticles
2. In loseLife(): set bearTauntTimer=60
3. In damage hit code: set damageFlashTimer=10
4. In portfolio boost events: set portfolioFlashGreenTimer=12
5. Update updateGame(): decrement timers, update ambient particles per level
6. Update drawBackground(): per-year atmosphere layers
7. Update drawBear(): taunt pose + rage glow
8. Update drawPlayer(): sweat drops, orange/blue neon outline for power-ups
9. Update drawHazard(): chest crack particles, saltbag white burst, doompost wobble
10. Render loop: vignette overlay when salt>=80%, red/green flash overlays
11. Collectible glows in draw calls: gold aura, shimmer, blue halo
