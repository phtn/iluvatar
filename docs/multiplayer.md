# Multiplayer / Presence

## Identity
- Clients authenticate anonymously by default.

## Players list
- Players are listed per biome.
- Presence is based on a heartbeat (`touchMyPlayer`).
- Players not seen recently fall out of the online list (unless configured otherwise).

## Shared world
- Loot nodes and stations are visible to all authenticated clients in the same biome.
