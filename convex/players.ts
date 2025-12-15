import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ensureCraftingDefaults } from "./craftingDefaults";

const ONLINE_WINDOW_MS = 45_000;
const WORLD_MIN = 0;
const WORLD_MAX = 100;

export const getMyPlayer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    return await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

export const createPlayer = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) throw new Error("Player already exists for this user");

    const now = Date.now();
    const defaults = await ensureCraftingDefaults(ctx);
    const spawn = {
      x: Math.floor(10 + Math.random() * 80),
      y: Math.floor(10 + Math.random() * 80),
    };
    const playerId = await ctx.db.insert("players", {
      userId,
      name: args.name,
      craftingTier: 0,
      biomeId: "forest",
      position: { x: spawn.x, y: spawn.y },
      lastSeenTime: now,
    });

    // Starter unlocks (Phase 1). Keep at least one recipe locked so "lore cache"
    // progression has something meaningful to grant.
    for (const stationId of defaults.stationIds) {
      await ctx.db.insert("playerUnlocks", {
        playerId,
        kind: "station",
        defId: stationId,
        unlockedTime: now,
      });
    }
    const starterRecipeIds = new Set<string>([
      "twist_fiber_cord",
      "make_bark_tinder",
      // Intentionally do NOT unlock:
      // - craft_crude_torch
      // - mix_resin_sealant
    ]);
    for (const recipeId of defaults.recipeIds) {
      if (!starterRecipeIds.has(recipeId)) continue;
      await ctx.db.insert("playerUnlocks", {
        playerId,
        kind: "recipe",
        defId: recipeId,
        unlockedTime: now,
      });
    }

    return playerId;
  },
});

export const listPlayersByBiome = query({
  args: {
    biomeId: v.string(),
    now: v.optional(v.number()),
    includeStale: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    void userId;

    const now = args.now ?? Date.now();
    const players = await ctx.db
      .query("players")
      .withIndex("by_biomeId", (q) => q.eq("biomeId", args.biomeId))
      .collect();

    const filtered = args.includeStale
      ? players
      : players.filter((p) => now - p.lastSeenTime <= ONLINE_WINDOW_MS);

    return filtered.map((p) => ({
      _id: p._id,
      name: p.name,
      biomeId: p.biomeId,
      position: p.position,
      lastSeenTime: p.lastSeenTime,
    }));
  },
});

export const touchMyPlayer = mutation({
  args: {
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!player) return null;

    const now = args.now ?? Date.now();
    await ctx.db.patch(player._id, { lastSeenTime: now });
    return player._id;
  },
});

export const moveMyPlayer = mutation({
  args: {
    dx: v.number(),
    dy: v.number(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!player) throw new Error("Player not found");

    const clamp = (n: number) => Math.max(WORLD_MIN, Math.min(WORLD_MAX, n));
    const next = {
      x: clamp(player.position.x + args.dx),
      y: clamp(player.position.y + args.dy),
      z: player.position.z,
    };

    const now = args.now ?? Date.now();
    await ctx.db.patch(player._id, {
      position: next,
      lastSeenTime: now,
    });

    return { position: next };
  },
});


