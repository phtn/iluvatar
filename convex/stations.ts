import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function distanceSquared(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export const listStationsByBiome = query({
  args: {
    biomeId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    void userId;

    return await ctx.db
      .query("worldStations")
      .withIndex("by_biomeId", (q) => q.eq("biomeId", args.biomeId))
      .collect();
  },
});

export const spawnStation = mutation({
  args: {
    biomeId: v.string(),
    stationId: v.string(),
    position: v.object({
      x: v.number(),
      y: v.number(),
      z: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("worldStations", {
      biomeId: args.biomeId,
      stationId: args.stationId,
      position: args.position,
      createdBy: userId,
      createdTime: now,
    });
  },
});

export const placeMyWorkbench = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('Not authenticated');

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!player) throw new Error("Player not found");

    const unlocked = await ctx.db
      .query("playerUnlocks")
      .withIndex("by_player_kind_defId", (q) =>
        q.eq("playerId", player._id).eq("kind", "station").eq("defId", "basic_workbench"),
      )
      .first();
    if (!unlocked) throw new Error("Workbench station locked");

    // Require resources to place.
    const requirements = [
      { kind: "material" as const, defId: "scrap_wood", qty: 6 },
      { kind: "component" as const, defId: "rusted_nails", qty: 4 },
    ];

    const now = Date.now();
    for (const req of requirements) {
      const existing = await ctx.db
        .query("inventoryStacks")
        .withIndex("by_player_kind_defId", (q) =>
          q.eq("playerId", player._id).eq("kind", req.kind).eq("defId", req.defId),
        )
        .first();
      if (!existing || existing.qty < req.qty) {
        throw new Error(`Missing ${req.qty}× ${req.defId}`);
      }
    }

    for (const req of requirements) {
      const existing = await ctx.db
        .query("inventoryStacks")
        .withIndex("by_player_kind_defId", (q) =>
          q.eq("playerId", player._id).eq("kind", req.kind).eq("defId", req.defId),
        )
        .first();
      if (!existing) continue;
      const newQty = existing.qty - req.qty;
      if (newQty <= 0) {
        await ctx.db.delete(existing._id);
      } else {
        await ctx.db.patch(existing._id, { qty: newQty, updatedTime: now });
      }
    }

    // Avoid duplicate stations piled up at the same position.
    const maxDist = 3;
    const existingNearby = await ctx.db
      .query("worldStations")
      .withIndex("by_biome_stationId", (q) =>
        q.eq("biomeId", player.biomeId).eq("stationId", "basic_workbench"),
      )
      .collect();
    for (const s of existingNearby) {
      if (distanceSquared(s.position, player.position) <= maxDist * maxDist) {
        throw new Error("A workbench is already placed nearby");
      }
    }

    const stationDocId = await ctx.db.insert("worldStations", {
      biomeId: player.biomeId,
      stationId: "basic_workbench",
      position: player.position,
      createdBy: userId,
      createdTime: now,
    });

    return { stationDocId };
  },
});

