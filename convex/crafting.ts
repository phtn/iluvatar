import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ensureCraftingDefaults } from "./craftingDefaults";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type InventoryKind = "material" | "component" | "item" | "currency";
type MaterialLifecycleStage = "raw" | "refined" | "formed" | "component" | "finalItem";
type CraftJobStatus = "inProgress" | "done" | "cancelled";

type StackGrant = Readonly<{
  kind: InventoryKind;
  defId: string;
  stage?: MaterialLifecycleStage;
  qty: number;
}>;

type RecipeLockReason =
  | "locked_recipe"
  | "locked_station"
  | "locked_tier"
  | "station_not_placed"
  | "station_too_far";

function scaleGrants(grants: readonly StackGrant[], qty: number): StackGrant[] {
  if (qty === 1) return [...grants];
  return grants.map((g) => ({ ...g, qty: g.qty * qty }));
}

async function requireMyPlayerId(ctx: MutationCtx): Promise<Id<"players">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const player = await ctx.db
    .query("players")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!player) throw new Error("Player not found");
  return player._id;
}

async function grantToInventory(
  ctx: MutationCtx,
  args: { playerId: Id<"players">; grants: readonly StackGrant[] },
) {
  const now = Date.now();
  for (const grant of args.grants) {
    if (grant.qty <= 0) continue;
    const existing = await ctx.db
      .query("inventoryStacks")
      .withIndex("by_player_kind_defId", (q) =>
        q.eq("playerId", args.playerId).eq("kind", grant.kind).eq("defId", grant.defId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { qty: existing.qty + grant.qty, updatedTime: now });
    } else {
      await ctx.db.insert("inventoryStacks", {
        playerId: args.playerId,
        kind: grant.kind,
        defId: grant.defId,
        stage: grant.stage,
        qty: grant.qty,
        updatedTime: now,
      });
    }
  }
}

async function consumeFromInventory(
  ctx: MutationCtx,
  args: { playerId: Id<"players">; items: readonly StackGrant[] },
) {
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
      await ctx.db.patch(existing._id, { qty: newQty, updatedTime: now });
    }
  }
}

function maxCraftable(
  inventoryByKey: Readonly<Record<string, number>>,
  inputs: readonly StackGrant[],
): number {
  if (inputs.length === 0) return 0;
  let m = Number.POSITIVE_INFINITY;
  for (const input of inputs) {
    const have = inventoryByKey[`${input.kind}:${input.defId}`] ?? 0;
    const possible = Math.floor(have / input.qty);
    m = Math.min(m, possible);
  }
  return Number.isFinite(m) ? m : 0;
}

function distanceSquared(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export const listMyRecipes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!player) return { player: null as null, recipes: [] as const };

    const unlocks = await ctx.db
      .query("playerUnlocks")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();
    const unlockedRecipeIds = new Set(
      unlocks.filter((u) => u.kind === "recipe").map((u) => u.defId),
    );
    const unlockedStationIds = new Set(
      unlocks.filter((u) => u.kind === "station").map((u) => u.defId),
    );

    const stacks = await ctx.db
      .query("inventoryStacks")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();

    const inventoryByKey: Record<string, number> = {};
    for (const s of stacks) {
      inventoryByKey[`${s.kind}:${s.defId}`] = s.qty;
    }

    const allRecipeDefs = await ctx.db.query("recipeDefs").collect();
    const worldStations = await ctx.db
      .query("worldStations")
      .withIndex("by_biomeId", (q) => q.eq("biomeId", player.biomeId))
      .collect();
    const recipes = allRecipeDefs.map((r) => {
      const isUnlocked = unlockedRecipeIds.has(r.id);
      const hasStation = unlockedStationIds.has(r.stationId);
      const canByTier = player.craftingTier >= r.tier;
      const maxQty = maxCraftable(inventoryByKey, r.inputs);
      const missing: StackGrant[] = [];
      for (const i of r.inputs) {
        const have = inventoryByKey[`${i.kind}:${i.defId}`] ?? 0;
        const need = i.qty;
        if (have >= need) continue;
        const stage = i.stage;
        missing.push({ kind: i.kind, defId: i.defId, stage, qty: need - have });
      }

      const lockReason = (() => {
        if (!isUnlocked) return "locked_recipe" as const;
        if (!hasStation) return "locked_station" as const;
        if (!canByTier) return "locked_tier" as const;
        if (r.stationId !== "campfire") {
          const placed = worldStations.filter((s) => s.stationId === r.stationId);
          if (placed.length === 0) return "station_not_placed" as const;
          const maxDist = 10;
          const inRange = placed.some(
            (s) => distanceSquared(s.position, player.position) <= maxDist * maxDist,
          );
          if (!inRange) return "station_too_far" as const;
        }
        return null;
      })();

      const hint = (() => {
        if (lockReason === "locked_recipe") return "Unlock via caches in the world.";
        if (lockReason === "locked_station") return "Unlock or find the required station.";
        if (lockReason === "locked_tier") return "Increase your crafting tier.";
        if (lockReason === "station_not_placed") return "Place or find this station in the world.";
        if (lockReason === "station_too_far") return "Move closer to the station on the map.";
        return null;
      })();

      return {
        id: r.id,
        label: r.label,
        tier: r.tier,
        stationId: r.stationId,
        durationMs: r.durationMs,
        unlocked: isUnlocked,
        lockReason: lockReason as RecipeLockReason | null,
        hint,
        craftable: lockReason === null && maxQty >= 1,
        maxQty,
        inputs: r.inputs,
        outputs: r.outputs,
        missing,
      };
    });

    return {
      player: { _id: player._id, name: player.name, craftingTier: player.craftingTier },
      recipes,
    };
  },
});

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const now = Date.now();
    const result = await ensureCraftingDefaults(ctx);

    // Also bootstrap existing players so they can always access Campfire crafting.
    // This is intentionally conservative: we only ensure the minimal starter unlocks.
    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!player) return { seeded: true as const, ...result, bootstrapped: false as const };

    const ensureUnlock = async (kind: "station" | "recipe", defId: string): Promise<boolean> => {
      const existing = await ctx.db
        .query("playerUnlocks")
        .withIndex("by_player_kind_defId", (q) =>
          q.eq("playerId", player._id).eq("kind", kind).eq("defId", defId),
        )
        .first();
      if (existing) return false;
      await ctx.db.insert("playerUnlocks", {
        playerId: player._id,
        kind,
        defId,
        unlockedTime: now,
      });
      return true;
    };

    const added: string[] = [];
    if (await ensureUnlock("station", "campfire")) added.push("station:campfire");
    if (await ensureUnlock("recipe", "twist_fiber_cord")) added.push("recipe:twist_fiber_cord");
    if (await ensureUnlock("recipe", "make_bark_tinder")) added.push("recipe:make_bark_tinder");

    return {
      seeded: true as const,
      ...result,
      bootstrapped: true as const,
      added,
    };
  },
});

export const listMyStations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!player) return { player: null as null, stations: [] as const };

    const unlocks = await ctx.db
      .query("playerUnlocks")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();
    const unlockedStationIds = new Set(
      unlocks.filter((u) => u.kind === "station").map((u) => u.defId),
    );

    const defs = await ctx.db.query("stationDefs").collect();
    const stations = defs
      .map((s) => ({
        id: s.id,
        label: s.label,
        tier: s.tier,
        unlocked: unlockedStationIds.has(s.id),
      }))
      .sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label));

    return {
      player: { _id: player._id, name: player.name },
      stations,
    };
  },
});

export const listMyQueue = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!player) return { player: null as null, jobs: [] as const };

    const jobs = await ctx.db
      .query("craftJobs")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();

    const sorted = [...jobs].sort((a, b) => b.createdTime - a.createdTime);
    return {
      player: { _id: player._id, name: player.name },
      jobs: sorted.map((j) => ({
        _id: j._id,
        recipeId: j.recipeId,
        stationId: j.stationId,
        qty: j.qty,
        status: j.status as CraftJobStatus,
        createdTime: j.createdTime,
        startTime: j.startTime,
        endTime: j.endTime,
        completedTime: j.completedTime,
        inputs: j.inputs,
        outputs: j.outputs,
      })),
    };
  },
});

export const startMyCraft = mutation({
  args: {
    recipeId: v.string(),
    qty: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!player) throw new Error("Player not found");

    const unlockedRecipe = await ctx.db
      .query("playerUnlocks")
      .withIndex("by_player_kind_defId", (q) =>
        q.eq("playerId", player._id).eq("kind", "recipe").eq("defId", args.recipeId),
      )
      .first();
    if (!unlockedRecipe) throw new Error("Recipe locked");

    const recipe = await ctx.db
      .query("recipeDefs")
      .withIndex("by_recipeId", (q) => q.eq("id", args.recipeId))
      .first();
    if (!recipe) throw new Error("Unknown recipe");

    const qty = Math.floor(args.qty ?? 1);
    if (qty <= 0) throw new Error("qty must be > 0");
    if (qty > 99) throw new Error("qty too large");

    if (player.craftingTier < recipe.tier) throw new Error("Crafting tier too low");

    const unlockedStation = await ctx.db
      .query("playerUnlocks")
      .withIndex("by_player_kind_defId", (q) =>
        q.eq("playerId", player._id).eq("kind", "station").eq("defId", recipe.stationId),
      )
      .first();
    if (!unlockedStation) throw new Error("Station locked");

    if (recipe.stationId !== "campfire") {
      const placed = await ctx.db
        .query("worldStations")
        .withIndex("by_biome_stationId", (q) =>
          q.eq("biomeId", player.biomeId).eq("stationId", recipe.stationId),
        )
        .collect();
      if (placed.length === 0) throw new Error("Station not placed");
      const maxDist = 10;
      const inRange = placed.some(
        (s) => distanceSquared(s.position, player.position) <= maxDist * maxDist,
      );
      if (!inRange) throw new Error("Too far from station");
    }

    const now = Date.now();
    const inputs = scaleGrants(recipe.inputs, qty);
    const outputs = scaleGrants(recipe.outputs, qty);

    await consumeFromInventory(ctx, { playerId: player._id, items: inputs });

    const durationMs = recipe.durationMs * qty;
    const endTime = now + durationMs;

    const craftJobId = await ctx.db.insert("craftJobs", {
      playerId: player._id,
      recipeId: recipe.id,
      stationId: recipe.stationId,
      qty,
      status: "inProgress",
      createdTime: now,
      startTime: now,
      endTime,
      inputs,
      outputs,
    });

    return { craftJobId, endTime };
  },
});

export const claimMyCompletedCrafts = mutation({
  args: {
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const playerId = await requireMyPlayerId(ctx);
    const now = args.now ?? Date.now();

    const ready = await ctx.db
      .query("craftJobs")
      .withIndex("by_player_status_endTime", (q) =>
        q.eq("playerId", playerId).eq("status", "inProgress").lte("endTime", now),
      )
      .collect();

    let claimed = 0;
    let craftedTorch = false;
    for (const job of ready) {
      await grantToInventory(ctx, { playerId, grants: job.outputs });
      await ctx.db.patch(job._id, { status: "done", completedTime: now });
      if (job.outputs.some((o) => o.kind === "item" && o.defId === "crude_torch")) craftedTorch = true;
      claimed += 1;
    }

    if (craftedTorch) {
      const player = await ctx.db.get(playerId);
      if (player && player.craftingTier < 1) {
        await ctx.db.patch(playerId, { craftingTier: 1 });
      }
    }

    return { claimed };
  },
});

