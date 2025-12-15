# Stations

## What stations do
Stations gate recipe groups and introduce proximity gameplay.

## Station unlocks
- Stations must be unlocked via progression before you can place/use them.

### Implemented stations
- `campfire` (starter)
- `basic_workbench` (unlocked via `workbench_blueprint_cache`)

## Placement
- If you’ve unlocked the Basic Workbench and none is placed, the World UI will show a **Build a Basic Workbench** panel.
- Placing consumes resources (currently: `scrap_wood` + `rusted_nails`) and places the station at your position.

## Proximity requirement
For non-campfire stations:
- The station must be **placed in the world**
- You must be **close enough** to craft recipes that require it

## Active station
- Click a station marker on the map and use **Use for crafting**.
- The Crafting tab will prefer that station next time.
