import type { MutationCtx } from "./_generated/server";

type InventoryKind = "material" | "component" | "item" | "currency";
type MaterialLifecycleStage = "raw" | "refined" | "formed" | "component" | "finalItem";

type StackGrant = Readonly<{
  kind: InventoryKind;
  defId: string;
  stage?: MaterialLifecycleStage;
  qty: number;
}>;

type StationDefSeed = Readonly<{
  id: string;
  label: string;
  tier: number;
}>;

type RecipeDefSeed = Readonly<{
  id: string;
  label: string;
  tier: number;
  stationId: string;
  durationMs: number;
  inputs: readonly StackGrant[];
  outputs: readonly StackGrant[];
}>;

const STATIONS: readonly StationDefSeed[] = [
  {
    id: "campfire",
    label: "Campfire",
    tier: 0,
  },
  {
    id: "basic_workbench",
    label: "Basic workbench",
    tier: 1,
  },
] as const;

// Phase 1 starter set (Forest, T0–T1), using stable, code-friendly slugs.
const RECIPES: readonly RecipeDefSeed[] = [
  {
    id: "twist_fiber_cord",
    label: "Twist fiber cord",
    tier: 0,
    stationId: "campfire",
    durationMs: 1200,
    inputs: [{ kind: "material", defId: "fibrous_wood_strips", stage: "raw", qty: 2 }],
    outputs: [{ kind: "component", defId: "fiber_cord", qty: 1 }],
  },
  {
    id: "make_bark_tinder",
    label: "Prepare bark tinder",
    tier: 0,
    stationId: "campfire",
    durationMs: 900,
    inputs: [{ kind: "material", defId: "bark_shavings", stage: "raw", qty: 3 }],
    outputs: [{ kind: "component", defId: "bark_tinder", qty: 1 }],
  },
  {
    id: "mix_resin_sealant",
    label: "Mix resin sealant",
    tier: 1,
    stationId: "campfire",
    durationMs: 2000,
    inputs: [
      { kind: "material", defId: "resin_node", stage: "raw", qty: 1 },
      { kind: "material", defId: "bark_shavings", stage: "raw", qty: 2 },
    ],
    outputs: [{ kind: "component", defId: "resin_sealant", qty: 1 }],
  },
  {
    id: "craft_crude_torch",
    label: "Craft crude torch",
    tier: 0,
    stationId: "campfire",
    durationMs: 2200,
    inputs: [
      { kind: "component", defId: "bark_tinder", qty: 1 },
      { kind: "component", defId: "fiber_cord", qty: 1 },
    ],
    outputs: [{ kind: "item", defId: "crude_torch", qty: 1 }],
  },
  {
    id: "carve_wooden_shaft",
    label: "Carve wooden shaft",
    tier: 1,
    stationId: "basic_workbench",
    durationMs: 2800,
    inputs: [
      { kind: "material", defId: "scrap_wood", stage: "raw", qty: 4 },
      { kind: "component", defId: "fiber_cord", qty: 1 },
    ],
    outputs: [{ kind: "component", defId: "wooden_shaft", qty: 1 }],
  },
] as const;

export async function ensureCraftingDefaults(ctx: MutationCtx): Promise<{
  stationIds: readonly string[];
  recipeIds: readonly string[];
}> {
  for (const s of STATIONS) {
    const existing = await ctx.db
      .query("stationDefs")
      .withIndex("by_stationId", (q) => q.eq("id", s.id))
      .first();
    if (existing) continue;
    await ctx.db.insert("stationDefs", s);
  }

  for (const r of RECIPES) {
    const existing = await ctx.db
      .query("recipeDefs")
      .withIndex("by_recipeId", (q) => q.eq("id", r.id))
      .first();
    if (existing) continue;
    await ctx.db.insert("recipeDefs", {
        id: r.id,
        label: r.label,
        tier: r.tier,
        stationId: r.stationId,
        durationMs: r.durationMs,
        inputs: r.inputs.map((i) => ({
          kind: i.kind,
          defId: i.defId,
          stage: i.stage,
          qty: i.qty,
        })),
        outputs: r.outputs.map((o) => ({
          kind: o.kind,
          defId: o.defId,
          stage: o.stage,
          qty: o.qty,
        })),
      });
  }

  return {
    stationIds: STATIONS.map((s) => s.id),
    recipeIds: RECIPES.map((r) => r.id),
  };
}

