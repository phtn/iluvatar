# Troubleshooting

## Missing env var: NEXT_PUBLIC_CONVEX_URL
- Add it to `.env.local`.
- Restart `bun run dev`.

## “Not authenticated”
- The app signs in anonymously automatically, but network/Convex issues can interrupt it.
- Refresh the page.

## “Player not found” / can’t craft / can’t see inventory
- You must click **Join** in the World tab to create your player.

## “Recipe locked”
- Find and harvest the relevant cache nodes in the world.

## “Station not placed” / “Too far from station”
- Place the station (when unlocked) and move closer to it.

## Inventory says you’re missing items you think you have
- Items are keyed by `defId` slugs. Verify the exact stack name in Inventory.
