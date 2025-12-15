import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

const craftJobStatus = v.union(
  v.literal("inProgress"),
  v.literal("done"),
  v.literal("cancelled"),
);

export default defineSchema({
  ...authTables,

  stationDefs: defineTable({
    id: v.string(),
    label: v.string(),
    tier: v.number(),
  }).index("by_stationId", ["id"]),

  recipeDefs: defineTable({
    id: v.string(),
    label: v.string(),
    tier: v.number(),
    stationId: v.string(),
    durationMs: v.number(),
    inputs: v.array(
      v.object({
        kind: inventoryKind,
        defId: v.string(),
        stage: v.optional(materialLifecycleStage),
        qty: v.number(),
      }),
    ),
    outputs: v.array(
      v.object({
        kind: inventoryKind,
        defId: v.string(),
        stage: v.optional(materialLifecycleStage),
        qty: v.number(),
      }),
    ),
  })
    .index("by_recipeId", ["id"])
    .index("by_tier", ["tier"])
    .index("by_stationId", ["stationId"]),

  players: defineTable({
    userId: v.id("users"),
    name: v.string(),
    craftingTier: v.number(),
    biomeId: v.string(),
    position: v.object({
      x: v.number(),
      y: v.number(),
      z: v.optional(v.number()),
    }),
    lastSeenTime: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_biomeId", ["biomeId"]),

  inventoryStacks: defineTable({
    playerId: v.id("players"),
    kind: inventoryKind,
    defId: v.string(),
    stage: v.optional(materialLifecycleStage),
    qty: v.number(),
    updatedTime: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_player_kind_defId", ["playerId", "kind", "defId"]),

  playerUnlocks: defineTable({
    playerId: v.id("players"),
    kind: v.union(
      v.literal("recipe"),
      v.literal("station"),
      v.literal("biome"),
      v.literal("lore"),
      v.literal("tech"),
    ),
    defId: v.string(),
    unlockedTime: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_player_kind_defId", ["playerId", "kind", "defId"]),

  worldLootNodes: defineTable({
    lootSourceId: v.string(),
    biomeId: v.string(),
    position: v.object({
      x: v.number(),
      y: v.number(),
      z: v.optional(v.number()),
    }),
    depletion: v.object({
      isDepleted: v.boolean(),
      depletedTime: v.optional(v.number()),
      respawnTime: v.optional(v.number()),
    }),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_biomeId", ["biomeId"])
    .index("by_lootSourceId", ["lootSourceId"])
    .index("by_depletion_isDepleted", ["depletion.isDepleted"]),

  worldEvents: defineTable({
    eventId: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    isActive: v.boolean(),
    modifiers: v.object({
      materialWeightMultipliers: v.optional(v.record(v.string(), v.number())),
      categoryWeightDeltas: v.optional(v.record(v.string(), v.number())),
      biomeAffinityMultipliers: v.optional(v.record(v.string(), v.number())),
    }),
  }).index("by_isActive", ["isActive"]),

  lootRollAudit: defineTable({
    playerId: v.id("players"),
    lootNodeId: v.optional(v.id("worldLootNodes")),
    biomeId: v.string(),
    craftingTier: v.number(),
    activeEventIds: v.array(v.string()),
    results: v.array(
      v.object({
        kind: inventoryKind,
        defId: v.string(),
        stage: v.optional(materialLifecycleStage),
        qty: v.number(),
      }),
    ),
    createdTime: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_createdTime", ["createdTime"]),

  craftJobs: defineTable({
    playerId: v.id("players"),
    recipeId: v.string(),
    stationId: v.string(),
    qty: v.number(),
    status: craftJobStatus,
    createdTime: v.number(),
    startTime: v.number(),
    endTime: v.number(),
    completedTime: v.optional(v.number()),
    inputs: v.array(
      v.object({
        kind: inventoryKind,
        defId: v.string(),
        stage: v.optional(materialLifecycleStage),
        qty: v.number(),
      }),
    ),
    outputs: v.array(
      v.object({
        kind: inventoryKind,
        defId: v.string(),
        stage: v.optional(materialLifecycleStage),
        qty: v.number(),
      }),
    ),
  })
    .index("by_playerId", ["playerId"])
    .index("by_player_status_endTime", ["playerId", "status", "endTime"])
    .index("by_player_recipe_status", ["playerId", "recipeId", "status"]),

  worldStations: defineTable({
    stationId: v.string(),
    biomeId: v.string(),
    position: v.object({
      x: v.number(),
      y: v.number(),
      z: v.optional(v.number()),
    }),
    createdBy: v.optional(v.id("users")),
    createdTime: v.number(),
  })
    .index("by_biomeId", ["biomeId"])
    .index("by_stationId", ["stationId"])
    .index("by_biome_stationId", ["biomeId", "stationId"]),
});


