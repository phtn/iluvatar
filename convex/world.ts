import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type InventoryKind = "material" | "component" | "item" | "currency";
type MaterialLifecycleStage = "raw" | "refined" | "formed" | "component" | "finalItem";

type LootGrant = Readonly<{
  kind: InventoryKind;
  defId: string;
  stage?: MaterialLifecycleStage;
  qty: number;
}>;

type UnlockGrant = Readonly<{
  kind: "recipe" | "station";
  defId: string;
}>;

const WORLD_MIN = 0;
const WORLD_MAX = 100;

export const listLootNodesByBiome = query({
  args: {
    biomeId: v.string(),
    includeDepleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // World state is readable by any signed-in client (including anonymous),
    // but we still require an auth identity for multiplayer state.
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const nodes = await ctx.db
      .query("worldLootNodes")
      .withIndex("by_biomeId", (q) => q.eq("biomeId", args.biomeId))
      .collect();

    if (args.includeDepleted) return nodes;
    return nodes.filter((n) => !n.depletion.isDepleted);
  },
});

export const spawnLootNode = mutation({
  args: {
    biomeId: v.string(),
    lootSourceId: v.string(),
    position: v.object({
      x: v.number(),
      y: v.number(),
      z: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    return await ctx.db.insert("worldLootNodes", {
      biomeId: args.biomeId,
      lootSourceId: args.lootSourceId,
      position: args.position,
      depletion: { isDepleted: false },
      createdBy: userId,
    });
  },
});

export const markLootNodeDepleted = mutation({
  args: {
    lootNodeId: v.id("worldLootNodes"),
    respawnDelayMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const node = await ctx.db.get(args.lootNodeId);
    if (!node) throw new Error("Loot node not found");

    const now = Date.now();
    const respawnTime =
      args.respawnDelayMs !== undefined ? now + args.respawnDelayMs : undefined;
    await ctx.db.patch(args.lootNodeId, {
      depletion: {
        isDepleted: true,
        depletedTime: now,
        respawnTime,
      },
    });
  },
});

export const tickRespawns = mutation({
  args: {
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Intentionally does not require auth; can be run by a server cron later.
    const now = args.now ?? Date.now();
    const depleted = await ctx.db
      .query("worldLootNodes")
      .withIndex("by_depletion_isDepleted", (q) =>
        q.eq("depletion.isDepleted", true),
      )
      .collect();

    for (const node of depleted) {
      const respawnTime = node.depletion.respawnTime;
      if (respawnTime !== undefined && respawnTime <= now) {
        await ctx.db.patch(node._id, {
          depletion: {
            isDepleted: false,
          },
        });
      }
    }
  },
});

function randIntInclusive(min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function chance(p: number): boolean {
  return Math.random() < p;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function distanceSquared(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

async function seedLootNodesIfEmpty(
  ctx: MutationCtx,
  args: { biomeId: string; center: { x: number; y: number }; createdBy: Id<"users"> },
): Promise<boolean> {
  const existingAny = await ctx.db
    .query("worldLootNodes")
    .withIndex("by_biomeId", (q) => q.eq("biomeId", args.biomeId))
    .first();
  if (existingAny) return false;

  const jitter = () => Math.floor(-18 + Math.random() * 37);
  const jitterNear = () => Math.floor(-8 + Math.random() * 17);
  const around = () => ({
    x: clamp(args.center.x + jitter(), WORLD_MIN, WORLD_MAX),
    y: clamp(args.center.y + jitter(), WORLD_MIN, WORLD_MAX),
  });
  const near = () => ({
    x: clamp(args.center.x + jitterNear(), WORLD_MIN, WORLD_MAX),
    y: clamp(args.center.y + jitterNear(), WORLD_MIN, WORLD_MAX),
  });

  const seeds: Array<{ lootSourceId: string; count: number }> = [
    { lootSourceId: "fallen_branch", count: 10 },
    { lootSourceId: "boulder", count: 6 },
    { lootSourceId: "abandoned_crate", count: 4 },
  ];
  for (const seed of seeds) {
    for (let i = 0; i < seed.count; i += 1) {
      await ctx.db.insert("worldLootNodes", {
        biomeId: args.biomeId,
        lootSourceId: seed.lootSourceId,
        position: around(),
        depletion: { isDepleted: false },
        createdBy: args.createdBy,
      });
    }
  }

  // Progression caches: keep at least one within harvest distance of the player.
  for (let i = 0; i < 2; i += 1) {
    await ctx.db.insert("worldLootNodes", {
      biomeId: args.biomeId,
      lootSourceId: "lore_cache",
      position: near(),
      depletion: { isDepleted: false },
      createdBy: args.createdBy,
    });
  }
  await ctx.db.insert("worldLootNodes", {
    biomeId: args.biomeId,
    lootSourceId: "workbench_blueprint_cache",
    position: near(),
    depletion: { isDepleted: false },
    createdBy: args.createdBy,
  });

  return true;
}

function lootForSource(lootSourceId: string): readonly LootGrant[] {
  // Starter loot set based on the Phase 1 tables (see plan/phase_1/loot_table_*.md).
  // NOTE: We intentionally keep defId as stable, code-friendly slugs.
  switch (lootSourceId) {
    case "fallen_branch": {
      const loot: LootGrant[] = [
        { kind: "material", defId: "fibrous_wood_strips", stage: "raw", qty: randIntInclusive(2, 6) },
        { kind: "material", defId: "bark_shavings", stage: "raw", qty: randIntInclusive(3, 9) },
      ];
      if (chance(0.25)) loot.push({ kind: "material", defId: "resin_node", stage: "raw", qty: 1 });
      if (chance(0.06)) loot.push({ kind: "material", defId: "small_insect_nest_harmless", stage: "raw", qty: 1 });
      return loot;
    }
    case "boulder": {
      const loot: LootGrant[] = [
        { kind: "material", defId: "stone_chunks", stage: "raw", qty: randIntInclusive(3, 8) },
      ];
      if (chance(0.28)) loot.push({ kind: "material", defId: "mineral_powder", stage: "raw", qty: randIntInclusive(1, 3) });
      if (chance(0.07)) loot.push({ kind: "material", defId: "raw_quartz", stage: "raw", qty: 1 });
      if (chance(0.01)) loot.push({ kind: "material", defId: "encased_fossil_shard", stage: "raw", qty: 1 });
      return loot;
    }
    case "abandoned_crate": {
      const loot: LootGrant[] = [
        { kind: "material", defId: "scrap_wood", stage: "raw", qty: randIntInclusive(3, 10) },
        { kind: "component", defId: "rusted_nails", qty: randIntInclusive(2, 6) },
      ];
      if (chance(0.18)) loot.push({ kind: "item", defId: "preserved_supplies", qty: 1 });
      if (chance(0.04)) loot.push({ kind: "item", defId: "encryption_key_fragment", qty: 1 });
      return loot;
    }
    case "lore_cache": {
      // This is a progression node. It may contain a small token item, but the
      // primary reward is recipe unlocks handled in harvestLootNode.
      const loot: LootGrant[] = [{ kind: "item", defId: "blueprint_fragment", qty: 1 }];
      return loot;
    }
    case "workbench_blueprint_cache": {
      const loot: LootGrant[] = [{ kind: "item", defId: "workbench_blueprint_fragment", qty: 1 }];
      return loot;
    }
    default:
      return [{ kind: "material", defId: "stone_chunks", stage: "raw", qty: randIntInclusive(1, 2) }];
  }
}

async function grantToInventory(
  ctx: MutationCtx,
  args: { playerId: Id<"players">; grants: readonly LootGrant[] },
) {
  // Keep logic consistent with convex/inventory.ts without creating a hard dependency.
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

async function grantUnlock(
  ctx: MutationCtx,
  args: { playerId: Id<"players">; grant: UnlockGrant; now: number },
): Promise<boolean> {
  const existing = await ctx.db
    .query("playerUnlocks")
    .withIndex("by_player_kind_defId", (q) =>
      q.eq("playerId", args.playerId).eq("kind", args.grant.kind).eq("defId", args.grant.defId),
    )
    .first();
  if (existing) return false;
  await ctx.db.insert("playerUnlocks", {
    playerId: args.playerId,
    kind: args.grant.kind,
    defId: args.grant.defId,
    unlockedTime: args.now,
  });
  return true;
}

async function unlocksForLootSource(
  ctx: MutationCtx,
  args: { playerId: Id<"players">; lootSourceId: string; now: number },
): Promise<UnlockGrant[]> {
  if (args.lootSourceId !== "lore_cache") return [];

  // Simple deterministic progression: first cache unlocks Torch, second unlocks Resin Sealant.
  const want: UnlockGrant[] = [];

  const hasTorch = await ctx.db
    .query("playerUnlocks")
    .withIndex("by_player_kind_defId", (q) =>
      q.eq("playerId", args.playerId).eq("kind", "recipe").eq("defId", "craft_crude_torch"),
    )
    .first();
  if (!hasTorch) {
    want.push({ kind: "recipe", defId: "craft_crude_torch" });
    return want;
  }

  const hasSealant = await ctx.db
    .query("playerUnlocks")
    .withIndex("by_player_kind_defId", (q) =>
      q.eq("playerId", args.playerId).eq("kind", "recipe").eq("defId", "mix_resin_sealant"),
    )
    .first();
  if (!hasSealant) {
    want.push({ kind: "recipe", defId: "mix_resin_sealant" });
    return want;
  }

  // After the basics are unlocked, the cache can be mostly flavor.
  return [];
}

async function unlocksForWorkbenchCache(
  ctx: MutationCtx,
  args: { playerId: Id<"players">; now: number },
): Promise<UnlockGrant[]> {
  const want: UnlockGrant[] = [];

  const hasWorkbench = await ctx.db
    .query("playerUnlocks")
    .withIndex("by_player_kind_defId", (q) =>
      q.eq("playerId", args.playerId).eq("kind", "station").eq("defId", "basic_workbench"),
    )
    .first();
  if (!hasWorkbench) {
    want.push({ kind: "station", defId: "basic_workbench" });
    return want;
  }

  const hasShaft = await ctx.db
    .query("playerUnlocks")
    .withIndex("by_player_kind_defId", (q) =>
      q.eq("playerId", args.playerId).eq("kind", "recipe").eq("defId", "carve_wooden_shaft"),
    )
    .first();
  if (!hasShaft) {
    want.push({ kind: "recipe", defId: "carve_wooden_shaft" });
    return want;
  }

  return [];
}

export const harvestLootNode = mutation({
  args: {
    lootNodeId: v.id("worldLootNodes"),
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

    const node = await ctx.db.get(args.lootNodeId);
    if (!node) throw new Error("Loot node not found");
    if (node.depletion.isDepleted) throw new Error("Loot node is depleted");
    if (node.biomeId !== player.biomeId) throw new Error("Loot node is not in your biome");

    // Enforce simple proximity for now (prevents harvesting from across the map).
    const maxDist = 12;
    if (distanceSquared(player.position, node.position) > maxDist * maxDist) {
      throw new Error("Too far from loot node");
    }

    const now = args.now ?? Date.now();
    const grants = lootForSource(node.lootSourceId);

    await grantToInventory(ctx, { playerId: player._id, grants });

    const unlockGrants =
      node.lootSourceId === "workbench_blueprint_cache"
        ? await unlocksForWorkbenchCache(ctx, { playerId: player._id, now })
        : await unlocksForLootSource(ctx, {
            playerId: player._id,
            lootSourceId: node.lootSourceId,
            now,
          });
    const unlocked: UnlockGrant[] = [];
    for (const grant of unlockGrants) {
      const did = await grantUnlock(ctx, { playerId: player._id, grant, now });
      if (did) unlocked.push(grant);
    }

    // Mark depleted and schedule a short respawn so the loop is testable.
    await ctx.db.patch(node._id, {
      depletion: {
        isDepleted: true,
        depletedTime: now,
        respawnTime: now + 60_000,
      },
    });

    await ctx.db.insert("lootRollAudit", {
      playerId: player._id,
      lootNodeId: node._id,
      biomeId: player.biomeId,
      craftingTier: player.craftingTier,
      activeEventIds: [],
      results: grants.map((g) => ({
        kind: g.kind,
        defId: g.defId,
        stage: g.stage,
        qty: g.qty,
      })),
      createdTime: now,
    });

    return { grants, unlocked };
  },
});

export const ensureBiomeSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!player) throw new Error("Player not found");

    const did = await seedLootNodesIfEmpty(ctx, {
      biomeId: player.biomeId,
      center: { x: player.position.x, y: player.position.y },
      createdBy: userId,
    });
    return { seeded: did };
  },
});


