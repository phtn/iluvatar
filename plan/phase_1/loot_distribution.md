---

# **LOOT DISTRIBUTION SYSTEM**

A world where materials bloom from logic instead of randomness.

---

# **1. LOOT TIERS (CORE FOUNDATIONS)**

Every droppable thing belongs to a tier that matches your crafting tech tree.

| Loot Tier                 | Level Range | Unlocks                        | Typical Materials            |
| ------------------------- | ----------- | ------------------------------ | ---------------------------- |
| **T0 – Primitive**        | 1–5         | Handcrafting                   | fibers, sticks, stones       |
| **T1 – Early Tools**      | 5–12        | Wood & resin crafting          | basic woods, resins, bones   |
| **T2 – Metalworking**     | 10–25       | Forge + structures             | ores, metals, ceramics       |
| **T3 – Arcane/Precision** | 20–40       | Crystals & energy tech         | quartz, arc materials        |
| **T4 – Mastercraft**      | 35–∞        | Bio-composites & advanced gear | composites, super-rare cores |

Enemies, containers, and environments roll loot according to these ranges.

---

# **2. BIOME-BASED DISTRIBUTION**

Every biome has its own *material persona*, determining what kinds of loot it is biased toward.

### **Biome → Material Family Priority**

| Biome            | High Probability             | Medium                | Low             |
| ---------------- | ---------------------------- | --------------------- | --------------- |
| **Forest**       | fibers, woods, resins        | bones, low-grade ores | arcane crystals |
| **Mountains**    | metals, stones, quartz       | hardy woods           | organics        |
| **Swamp**        | fungal materials, resins     | bones, soft woods     | metals          |
| **Desert**       | sands, glass minerals        | bones                 | wood, fiber     |
| **Tundra**       | frost alloys, cold woods     | quartz                | organics        |
| **Caverns**      | crystals, arc-stones         | metals                | wood/fiber      |
| **Ruins**        | salvaged alloys, components  | metals                | raw naturals    |
| **Plains**       | fibers, basic woods          | low ore               | crystals        |
| **Coast**        | saltproof alloys, driftwoods | sands                 | ores            |
| **Arcane Zones** | crystals, exotic materials   | alloys                | common naturals |

This gives your world a “loot accent” by region.

---

# **3. LOOT WEIGHTING MODEL**

This is the heart of your distribution system.

Each item gets a **spawn weight** derived from:

```
WEIGHT = (BiomeAffinity × TierMatch × RarityScalar × PlayerProgressModifier)
```

### **BiomeAffinity (0.1–3.0)**

How “at home” the material is in this biome.

### **TierMatch (0.3–4.0)**

* Perfect tier match: 2.0
* Player under-tier: 3.0 (catch-up mechanic)
* Player over-tier: 1.0
* Tier too high for region: 0.3

### **RarityScalar**

* Common: ×1
* Uncommon: ×0.6
* Rare: ×0.25
* Epic: ×0.1
* Legendary: ×0.025

### **PlayerProgressModifier**

* Increases drop of needed materials for current main crafting tier.

This keeps loot flowing without flooding the player.

---

# **4. DROP TABLE STRUCTURE**

A standard loot table entry looks like this:

```
{
  "id": "echo_quartz",
  "tier": 3,
  "rarity": "rare",
  "biomeAffinity": {
    "forest": 0.4,
    "mountains": 2.2,
    "caverns": 3.0,
    "arcane_zone": 3.0
  },
  "baseWeight": 1,
  "minQty": 1,
  "maxQty": 3
}
```

Your game engine then resolves the actual weight using the formula above.

---

# **5. LOOT CATEGORY PROBABILITIES**

Every loot container or enemy uses a **category distribution**, not raw items.

This eliminates micro-tuning hell.

### **Category Defaults**

```
RAW_MATERIALS: 55%
REFINED_MATERIALS: 15%
COMPONENTS: 15%
TOOLS/EQUIPMENT: 10%
RARE_EXOTICS: 5%
```

Each biome modifies this:

### Example: Forest

```
RAW_MATERIALS: +15%
REFINED_MATERIALS: -5%
RARE_EXOTICS: -2%
COMPONENTS: -3%
```

### Example: Caverns

```
RAW_MATERIALS: -10%
RARE_EXOTICS: +15%
COMPONENTS: +5%
```

You get a beautiful, region-specific flavor.

---

# **6. LOOT SCALING WITH PLAYER PROGRESSION**

Loot must reflect player commitment, not just location.

### **Scaling method:**

1. Determine player's **current crafting tier**
2. Add **small chance** to drop materials for the *next tier*
3. Reduce drops from *two tiers behind*

### Example Player Tier 2:

* T2 drops: 65%
* T1 drops: 20%
* T3 drops: 12%
* T0: 3%
* T4: 0% except special events

This ensures forward tempo without rushing.

---

# **7. EVENT-BASED LOOT MODIFIERS**

Events can temporarily warp the loot ecosystem:

### Examples:

* **Meteor Shower**: Starsteel +50%, crystals +30%
* **Fungal Bloom**: Fungal materials +200%, woods -40%
* **Solar Convergence**: Solar composites appear
* **High Tide Week**: Saltfen fiber +80%, driftwood +60%
* **Arc Storm**: Arcstone-based drops everywhere

Events make the world feel like a living organism.

---

# **8. ENEMY TYPE LOOT PATTERNS**

Creatures carry their own material signature.

### **Beasts**

* Hide, bone, fibers
* Low chance for rare organics

### **Constructs**

* Metal scraps, gears, components
* Rare alloys

### **Spectral enemies**

* crystals, echo quartz, ethereal materials

### **Humanoid factions**

* tools, refined materials, components

### **Ancient guardians**

* arcane cores, rare drops, tier 4 materials

Enemy variety = loot variety.

---

# **9. SPECIAL LOOT SOURCES**

Some sources break normal rules intentionally.

### **Ancient Chests**

Guaranteed 1 rare+
Guaranteed tier above local level

### **Titan Nodes (resource clusters)**

Raw materials
Huge quantity
No refined items

### **Lore Caches**

Crafting recipes
Blueprint fragments
Material insights

### **Ruined Machinery**

Components
Alloys
Rare chance of complete item

---

# **10. FULL BIOME LOOT CHANCES**

A lightning-speed version (tuned for your materials list):

## **Forest**

* 45% fibers
* 25% woods
* 15% resins
* 10% bones
* 5% crystals

## **Mountains**

* 40% ores
* 30% stone
* 15% quartz
* 10% metals
* 5% components

## **Swamp**

* 40% fungus
* 25% resins
* 20% mud/clay
* 10% bone
* 5% exotics

## **Desert**

* 40% sand minerals
* 30% bones
* 15% glass materials
* 10% metals
* 5% arcane

## **Caverns**

* 50% crystals
* 20% stone
* 20% ores
* 5% metals
* 5% arcane

## **Arcane Zone**

* 70% exotic materials
* 20% crystals
* 10% arcane components

---
