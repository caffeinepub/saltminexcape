# SaltmineXcape

## Current State
The game references specific cryptocurrencies (ICP, Kaspa) throughout all text, HUD, and mechanics. Portfolio value is calculated as `ICP_PRICES[level] * icpModifier * 10000`. Blue bottles are branded as "Kaspa Kool-Aid". There are no maturity bag pickups or community grant bags. Candles (red) are physical hazards that hurt James. Score is tracked separately from portfolio value.

## Requested Changes (Diff)

### Add
- **Maturity bags**: Temporary flashing pickups spawned periodically on platforms. Disappear after ~8 seconds if not collected. Give 4–10% of current portfolio value on collect. Show floating text: "Maturity collected +$X".
- **Community grant bag**: Very rare larger money bag pickup (spawned randomly, ~5% chance per maturity bag spawn). Gives flat $30,000. Floating text: "Community grant collected +$30,000".
- **FloatingText system**: Array of `{x, y, text, timer, color}` objects that render and fade out above collection point.
- **Green candle hazard type**: Thrown by bear, contacts James -> boosts portfolioMultiplier (+8-12%), NO physical damage.
- **Red candle hazard type** (rename existing candle): contacts James -> reduces portfolioMultiplier (-6-10%), NO physical damage.

### Modify
- **Portfolio system**: `portfolioValue` replaces `score` as primary metric. Starts at $10,000 after crash (shown in intro). Multiplied by `portfolioMultiplier` (starts at 1.0, modified by candles/chests). Displayed as `$X,XXX` in HUD. Leaderboard sorts/displays by portfolioValue.
- **levels.ts**: Remove ICP_PRICES. Add PORTFOLIO_MULTIPLIERS (base multipliers per level: 1.0–2.0 representing natural portfolio recovery). The portfolio value displayed = `portfolioValue * portfolioMultiplier`.
- **Hazard types**: Add `greenCandle` and `redCandle` types to Hazard union. Bear throws greenCandle ~15% of time and redCandle ~20% of time. Remove old `candle` type (split into two). Green candle gets phase-through behavior ~30% (still dangerous to dodge). Red candle keeps existing phase-through ~50%.
- **Candle hit behavior**: Both candle types ONLY affect portfolioMultiplier on contact with James — no salt meter increase, no hitTimer, no life loss.
- **Water bottles** (replace Kool-Aid): Same mechanic (required to collect all, reduces salt meter). Rename `koolaids` -> `waterBottles`. Draw as clear/blue plain water bottle with "H2O" label. Update flavor text to reference hypernatraemia.
- **Bottle HUD icon**: Update to plain water bottle icon (same rendering but relabeled "H2O", white/light blue color).
- **HUD**: Remove ICP price panel. Rename "PORTFOLIO" panel to be primary/larger. Show `$portfolioValue.toLocaleString()` as main value. Keep salt meter, lives, year, axe/gun timer, water bottle counter.
- **All intro slides**: 
  - Page 1 (Story): Remove "10,000 ICP". Say "James Salt holds a large crypto portfolio. Portfolio value: $100,000. He has diamond hands. James had conviction."
  - Page 2 (Crash): "THE MARKET CRASHES 90%" → "CRYPTO: -90%" → "Portfolio: $100,000 → $10,000" → "THE EVIL CRYPTO BEAR APPEARS!"
  - Page 3 (Banishment): Same tone, remove "ICP portal", say "escape portal"
  - Page 4 (Briefing): Remove Kaspa Kool-Aid. Replace with: "In the Salt Mines, dehydration is no joke. / Doctors call it hypernatraemia. / James calls it 'being too salty.' / Collect ALL water bottles on each level. / Your sodium levels demand it. / Miss even one? / The Crypto Bear keeps your soul. / (And your life. Literally.)"
- **Year complete screen**: Remove "ICP PRICE RISES TO $X". Show portfolio growth instead: "PORTFOLIO VALUE: $X" with encouraging text.
- **Victory screen**: Remove ICP-specific text. Show final portfolio recovery story.
- **Game over screen**: Same tone, update to remove ICP mentions.
- **Chest interaction**: Replace `icpModifier` with `portfolioMultiplier`. Same logic.
- **initLevel**: Initialize `waterBottles` instead of `koolaids`. Add maturity bag timer. Start `portfolioValue` at 10000 on new game, persist across levels.
- **leaderboard**: Sort and display by portfolioValue (shown as `$X,XXX` format).
- **Bottle warning timer message**: Change to "Collect all water bottles first!"
- **Score += X lines**: Convert all score increments to portfolio value increments.

### Remove
- All references to "ICP", "Kaspa", "Kool-Aid", "KAS" label in bottle sprite
- `ICP_PRICES` array from levels.ts
- Old `candle` hazard type (replaced by `greenCandle` and `redCandle`)

## Implementation Plan
1. Update `levels.ts`: Remove ICP_PRICES, export PORTFOLIO_MULTIPLIERS array [1.0, 1.1, 1.2, 1.35, 1.5, 1.65, 1.85, 2.0]
2. Update `GameState`: rename `koolaids` to `waterBottles`, replace `score` with `portfolioValue`, rename `icpModifier` to `portfolioMultiplier`, add `maturityBags`, `communityBags`, `floatingTexts`
3. Add new interfaces: `WaterBottle`, `MaturityBag`, `CommunityBag`, `FloatingText`
4. Update `initLevel`: init waterBottles, maturityBags, communityBags, floatingTexts. portfolioValue set to 10000 on game start (not reset per level)
5. Update `updateGame`: 
   - Maturity bag spawn logic (periodic timer, place on random platform)
   - Community grant bag spawn (rare, alongside maturity bags)
   - Maturity/community bag collection (add to portfolioValue, create floatingText)
   - Candle hit logic: greenCandle boosts portfolioMultiplier, redCandle reduces it, no physical damage
   - FloatingText update (decrement timer, remove expired)
   - WaterBottle collection (same as koolaid, remove salt)
   - Convert all score increments to portfolioValue increments
6. Update `drawKoolAid` -> `drawWaterBottle`: plain clear/blue bottle, "H2O" label, white/light blue color
7. Add `drawMaturityBag` and `drawCommunityBag` functions (pixel art money bags)
8. Add `drawFloatingText` function (renders floating text above collection point)
9. Update `drawHazard`: add `greenCandle` (green flame, green body) and `redCandle` (existing candle drawing)
10. Update `_drawHUD`: remove ICP price panel, expand portfolio panel, update bottle icon to water bottle
11. Update all screen text: INTRO_PAGES, drawYearCompleteScreen, drawVictoryScreen, drawGameOverScreen
12. Update leaderboard display to show $ values
13. Update all `gs.score +=` to `gs.portfolioValue +=`
