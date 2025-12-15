# Crafting

## Overview
Crafting is recipe-based with a **queue**:
1. Pick a station
2. Start a craft
3. Wait for it to finish
4. Claim outputs (auto-claim also runs periodically)

## Stations in Crafting
- The Crafting tab shows a **station picker**.
- Recipes are filtered by the selected station.
- The app remembers your last selected station.

## Recipe states
Each recipe can be:
- **Unlocked** or **Locked**
- **Craftable** (you have items + correct tier + correct station + you’re close enough to a placed station when required)

Common lock reasons:
- Locked recipe (unlock via caches)
- Station locked (unlock the station)
- Station not placed (place the station in the world)
- Too far from station (move closer)
- Crafting tier too low

## Queue
- Queue shows active crafts and time remaining.
- You can claim completed jobs from the Queue tab.

## Current starter recipes
Campfire:
- `twist_fiber_cord`
- `make_bark_tinder`
- `craft_crude_torch` (unlocked via `lore_cache`)
- `mix_resin_sealant` (unlocked via `lore_cache`)

Basic workbench:
- `carve_wooden_shaft` (unlocked via `workbench_blueprint_cache`)
