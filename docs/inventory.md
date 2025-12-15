# Inventory

## What it is
Inventory is stored as **stacks** (`kind`, `defId`, `qty`) and rendered as a fixed grid.

## Grid
- Grid shows up to a fixed number of slots.
- If you have more stacks than slots, overflow is currently hidden.

## Stack kinds
- `material` — raw/refined/formed (some have a `stage`)
- `component` — crafting components
- `item` — finished items
- `currency` — reserved

## Common items you’ll see early
- Materials: `fibrous_wood_strips`, `bark_shavings`, `scrap_wood`, `stone_chunks`, `resin_node`
- Components: `fiber_cord`, `bark_tinder`, `rusted_nails`
- Items: `crude_torch`, `blueprint_fragment`, `workbench_blueprint_fragment`

## Tips
- If Crafting says you’re missing items, check you have the right `defId` stacks (names are slug-based).
