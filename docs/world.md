# World

## Biome
- Current implementation uses `forest` as the main biome.

## Map
- The world is a simple 2D map (0–100 on X/Y).
- Your position is shown and updates as you move.

## Loot nodes
- Loot nodes are shown as small markers.
- You can only harvest if:
  - You’re in the same biome as the node
  - You’re within range (currently a short radius)
  - The node is not depleted

### Depletion and respawn
- Harvesting depletes a node.
- Nodes respawn after a short cooldown (currently ~60 seconds).

### Loot sources implemented
- `fallen_branch`
- `boulder`
- `abandoned_crate`
- `lore_cache` (progression cache)
- `workbench_blueprint_cache` (station progression cache)

## Stations on the map
- Stations are rendered as distinct markers.
- You can click a station marker to open its details panel.
- From the station details, you can mark it as your **active crafting station**.

## Dev-only helpers
In development builds (`NODE_ENV !== 'production'`), the World UI exposes spawn buttons for faster testing.
