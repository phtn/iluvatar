import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const inventoryKind = v.union(
  v.literal("material"),
  v.literal("component"),
  v.literal("item"),
  v.literal("currency"),
);

const materialLifecycleStage = v.union(
  v.literal("raw"),
  v.literal("refined"),
  v.literal("formed"),
  v.literal("component"),
  v.literal("finalItem"),
);

export const listInventory = query({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");
    if (player.userId !== userId) throw new Error("Forbidden");

    return await ctx.db
      .query("inventoryStacks")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .collect();
  },
});

export const grantItems = mutation({
  args: {
    playerId: v.id("players"),
    items: v.array(
      v.object({
        kind: inventoryKind,
        defId: v.string(),
        stage: v.optional(materialLifecycleStage),
        qty: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");
    if (player.userId !== userId) throw new Error("Forbidden");

    const now = Date.now();
    for (const item of args.items) {
      if (item.qty <= 0) continue;
      const existing = await ctx.db
        .query("inventoryStacks")
        .withIndex("by_player_kind_defId", (q) =>
          q.eq("playerId", args.playerId).eq("kind", item.kind).eq("defId", item.defId),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          qty: existing.qty + item.qty,
          updatedTime: now,
        });
      } else {
        await ctx.db.insert("inventoryStacks", {
          playerId: args.playerId,
          kind: item.kind,
          defId: item.defId,
          stage: item.stage,
          qty: item.qty,
          updatedTime: now,
        });
      }
    }
  },
});

export const consumeItems = mutation({
  args: {
    playerId: v.id("players"),
    items: v.array(
      v.object({
        kind: inventoryKind,
        defId: v.string(),
        qty: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");
    if (player.userId !== userId) throw new Error("Forbidden");

    const now = Date.now();
    for (const item of args.items) {
      if (item.qty <= 0) continue;
      const existing = await ctx.db
        .query("inventoryStacks")
        .withIndex("by_player_kind_defId", (q) =>
          q.eq("playerId", args.playerId).eq("kind", item.kind).eq("defId", item.defId),
        )
        .first();
      if (!existing || existing.qty < item.qty) {
        throw new Error(`Insufficient quantity for ${item.kind}:${item.defId}`);
      }
      const newQty = existing.qty - item.qty;
      if (newQty <= 0) {
        await ctx.db.delete(existing._id);
      } else {
        await ctx.db.patch(existing._id, {
          qty: newQty,
          updatedTime: now,
        });
      }
    }
  },
});


