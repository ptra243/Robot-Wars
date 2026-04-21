# Scavenger cards (design + data)

**Faction:** `scavengers` in card JSON. Pool split by `**awakening_min`** (0 = run-start pool, 1 = first spirit milestone pool, etc.) per:

`../../MetabotArena/docs/roguelike_theme_adaptation_9053d44b.plan.md`

**Data paths**

- Awakening 0: `src/data/cards/scavengers/awakening0.json`
- Awakening 1: `src/data/cards/scavengers/awakening1.json`

**Junk threshold pillar (current data):** The seven legacy ids `slag_coat_t1`, `junk_flare_t1`, `heap_shield_t1`, `magnet_claw_t1`, `turbo_link_t1`, `scrap_derrick_t1`, and `induction_pit_t1` are **removed** from JSON. Eight printed-threshold scavenger cards (`junk_spigot_t1`, `junk_bulwark_t1`, `junk_ladder_t1`, `junk_gasket_t1`, `junk_coil_t1`, `junk_aegis_t1`, `junk_rivet_t1`, `junk_crown_t1`) ship in their place — see `docs/junk-threshold-design-ideas.md` and engine types in `src/core/types.ts` / `src/core/effects/runner.ts`. Those eight **do not** spend junk as a card cost (`SpendJunk` / `spend_junk`); they gate on junk held and may add to the pile. The awakening tables below still describe older names in places; treat them as historical unless updated.

---

## Design identity (plan)

- **Scavengers**: wide **junk** pile, **scrap** for **core**, **Bulk** keyword / **Turbo Link** play patterns (no global junk→bulk conversion — junk stacks until cards spend or convert it).
- **Playstyles** (authoring vocabulary — use these names in docs, not unused marketing labels):
  - **Junk spending** — spend junk now for tempo, defense, or utility.
  - **Junk hoarding** — grow the pile or reward a **tall** pile (thresholds, “for each,” scaling block).
  - **Bulk** — **keyword** that grants stacks; stacks mitigate incoming strike damage. **Turbo Link** (bulk → junk + bonus next).
  - **Core parts** — **core scrap**, spend **core**, **Scrap** verb hooks, **core / junk** gates on cards.
  - **General** — curve, charge, draw, or finishers that support many builds without being mainly one of the four.
- **Target for a full 10-card pool:** **2** cards aimed at **junk spending**, **2** at **junk hoarding**, **2** at **bulk**, **2** at **core parts**, **2** **general** — a **distribution target**, not a hard rule; some cards legitimately sit on a boundary.
- **Awakening 1:** several cards are intentionally **dual-playstyle** (bridge **core parts** + **bulk**, **hoarding** + **bulk**, etc.) — see § Awakening 1.
- **Draw mix** (when implemented): at spirit awakening 0, weight faction aw0 vs neutral; at ≥1, shift weights (see plan “Combat draw mix”).

### Core parts Strikes — Factory Reset pattern (design)

**Core Tap** (and other **CoreParts** finishers) follow one rhythm:

1. **If core ≥ 1:** **Spend 1 core**, deal the printed **Strike** damage (e.g. **8** on Core Tap). **Then** **Factory Reset** this queue slot to **Neutral Basic Strike** at the **same tier** as the print (`card_tier` → `neutral_basic_strike_t1`…`t3`). The new Basic Strike does **not** resolve in the same activation; **advanceQueue** moves on, and that Basic Strike fires when the queue **cycles back** to this slot.
2. **If core = 0:** **No** strike damage this play — **only** the Factory Reset (slot becomes Neutral Basic Strike at the same tier). Same “activates next cycle” behavior.

**Keyword:** **Factory Reset** on a card is still authored as `**FactoryReset`** where tier is chosen by **keyword value**; **tier-matched** transforms from prints use the `**TransformCurrentQueueSlot`** effect with `matchNeutralBasicTierToResolvingCard` — see `keywords.md` and `src/core/effects/runner.ts`.

---

## Awakening 0

Plan roster (10 cards): effect text, purpose, and playstyle in one table.


| #   | Name                 | Charge | Tags   | Effect (summary)                                                                                                                               | Primary purpose                                                                              | Playstyle (designed for) | Notes                                                                              |
| --- | -------------------- | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| 1   | **Salvage Strike**   | 1      | Strike | 3 damage, +1 junk                                                                                                                              | Cheap **Strike** that **adds junk**                                                          | **Junk hoarding**        | Feeds pile and future thresholds.                                                  |
| 2   | **Magnet Claw**      | 1      | —      | Persistent “draw next combat start”; in-combat resolves as Basic Strike overlay                                                                | **Between-fights draw** + in-queue **Basic Strike** overlay                                  | **General**              | Deck / queue consistency, not a pile archetype card.                               |
| 3   | **Slag Coat**        | 1      | Shield | 4 block; +2 if junk+core ≥ 2                                                                                                                   | **Shield** with **junk + core** threshold bonus                                              | **Junk hoarding**        | Defense scales with **pile + core** richness (threshold).                          |
| 4   | **Core Tap**         | 0      | Strike | If core ≥ 1: spend 1 core, **8** damage → **Factory Reset** to **Basic Strike** (same tier); if **0** core: **only** Factory Reset (no damage) | **Core** finisher → staple **Strike**; **0** core still **downgrades** the slot              | **Core parts**           | See § **Core parts Strikes — Factory Reset pattern**.                              |
| 5   | **Junk Loader**      | 0      | —      | +1 charge, +2 junk                                                                                                                             | **Ramp**: **charge + junk**, no Strike tag                                                   | **Bulk**                 | Feeds **junk** for tall-pile / bulk payoffs.                                       |
| 6   | **Junk Flare**       | 1      | Strike | 4 damage; +3 if junk+core ≥ 3                                                                                                                  | **Strike** with **junk + core** scaling damage                                               | **Core parts**           | Mixed **junk + core** gate on damage (also rewards hoarding).                      |
| 7   | **Strip Mine**       | 2      | —      | Spend 2 junk; shred −3 next enemy hit                                                                                                          | **Spend junk** for **shred** on next enemy hit                                               | **Junk spending**        |                                                                                    |
| 8   | **Field Diode**      | 1      | —      | +1 charge; may spend 1 junk for +1 bonus charge                                                                                                | **Charge** engine; optional **−junk** for **bonus charge** (full design)                     | **General**              | Faction **curve**; optional spend touches **junk spending** without being primary. |
| 9   | **Core Refactoring** | 2      | —      | Take **5** damage; gain **2** refined scrap; **Overclock**; **Factory Reset** (same tier as print)                                             | **High cost / high risk** route to **core** + tempo; **downgrades** slot to **Basic Strike** | **Core parts**           | Replaces **Junk Strike** in data.                                                  |
| 10  | **Heap Shield**      | 2      | Shield | 5 block; spend junk +1 block per junk                                                                                                          | **Shield** with **spend junk** for **+block per junk**                                       | **Junk spending**        |                                                                                    |


**In JSON:** **Present:** full aw0 roster including **Magnet Claw** (Strike 2) and **Strip Mine** (junk spend + next-enemy-Strike mitigation). See `docs/TODO/implementation-vs-design.md` for engine hooks.

**Threshold / optional fields:** Slag Coat, Junk Flare, Field Diode, Heap Shield use compiled scalars — see `TODO/implementation-vs-design.md` for parity notes.

**Distribution vs 2 / 2 / 2 / 2 / 2 target** (count **primary** playstyle only):


| Playstyle     | Count | Cards                                  |
| ------------- | ----- | -------------------------------------- |
| Junk spending | 2     | Strip Mine, Heap Shield                |
| Junk hoarding | 2     | Salvage Strike, Slag Coat              |
| Bulk          | 1     | Junk Loader                            |
| Core parts    | 3     | Core Tap, Junk Flare, Core Refactoring |
| General       | 2     | Magnet Claw, Field Diode               |


**Does this roster hit the target?** **Partly.** **Spending**, **hoarding**, and **general** match **2** each. **Core parts** runs **one over** (three cards care about **core** or **junk+core** thresholds). **Bulk** runs **one under**: only **Junk Loader** is primarily **bulk**; **Turbo Link** and heavier **bulk** text live in **aw1**. Salvage Strike still **feeds** the bulk pipeline but is labeled **hoarding** here.

**Purpose overlap / conflicts**

- **Salvage Strike** vs **Junk Flare** — both charge-1 Strikes; one **feeds junk**, the other **spikes damage** on **junk + core**. Complementary lanes.
- **Junk Loader** vs **Field Diode** — both add **charge**; Loader is **junk + bulk fuel**, Diode is **curve**. Distinct.
- **Slag Coat** vs **Heap Shield** — threshold / pile **vs** spend-junk **Shield**; different costs and fantasies.
- **Core Tap** vs **Core Refactoring** — both **core**; Tap **spends** for a big **Strike**; Refactoring **hurts you** and costs **2 charge** for **refined scrap** + **Overclock** + **Factory Reset**.
- **Strip Mine** is the only **shred** utility spend in aw0.

**Watchouts**

- **Field Diode** as primary **charge** (per plan): other prints should not obsolete it as pure **+charge** without tradeoff — **Junk Loader** pays with **no combat tag** and heavy **junk**.
- **Magnet Claw** is rules-heavy; surface **draw** and **between-combat** value clearly.

**Implementation snapshot**

- **Missing JSON:** **Magnet Claw**, **Strip Mine** — drops one **general** slot and one **junk spending** slot from playable aw0.
- **Simplified stats** blunt **hoarding** / **core parts** thresholds until conditionals ship — see `TODO/implementation-vs-design.md`.

---

## Awakening 1

Plan intent: mix **higher charge costs (2–3)** with **new mechanics**; avoid straight number-only bumps except where intentional. **Several** cards should sit on **two** playstyles (see table **Secondary** column). **Deep Core Tap** is superseded by **Core Sacrifice** (below).

**Core Sacrifice** (replaces **Deep Core Tap** in design)

- **Name:** **Core Sacrifice** (`deep_core_tap_`* in data may be **renamed** when implemented.)
- **0 charge**, **Strike**.
- **On play:** **Sacrifice all core** (spend your entire **core** pool for this resolution).
- **Gain +1 bulk stack per core** sacrificed (tune if “all at once” spikes too hard).
- **After** resolution, **Factory Reset** → **Neutral Basic Strike** (same tier / merge policy as **Core Tap**).
- **If core = 0:** resolve using **Neutral Basic Strike** profile for this play (same philosophy as **Core Tap** — no whiff).
- **Playstyles:** **Core parts** + **Bulk** (primary / secondary in one card).

Plan roster (10 cards) in one table.


| #   | Name                | Charge | Tags   | Effect (summary)                                                                                                                                        | Primary purpose                                                            | Playstyle (designed for) | Secondary playstyle | Notes                                           |
| --- | ------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ | ------------------- | ----------------------------------------------- |
| 1   | **Junk Generator**  | 0      | —      | Continuous 3 (tier merge tightens N)                                                                                                                    | **Engine**: periodic **junk + charge** via **Continuous**, queue thinning  | **Junk hoarding**        | **Bulk**            | Passive **junk** for long fights / pile height. |
| 2   | **Core Sacrifice**  | 0      | Strike | Sacrifice **all** core → **+1 bulk** each; then **Basic Strike** transform; 0 core → resolve as Basic Strike                                            | **All-in core** → **bulk**, then staple **Strike**                         | **Core parts**           | **Bulk**            | Replaces old **Deep Core Tap** dual 12/20 mode. |
| 3   | **Induction Pit**   | 2      | Strike | 2 dmg; sacrifice junk; enemy −1 charge conditional                                                                                                      | **Sacrifice junk**, small hit, **enemy −charge** / conditional **+charge** | **Junk spending**        | **General**         | Tempo / deny; not mainly hoard.                 |
| 4   | **Core Rebirth**    | 2      | —      | +1 refined scrap; **replace** **1 / 2 / 3** random **Neutral Basic Strikes** (by **merge** tier t1/t2/t3) with **CoreParts** cards (same tier per slot) | **Core** **upgrade** path from staples                                     | **Core parts**           | **General**         | Merge **t1→t2→t3** in data.                     |
| 5   | **Junk Recycle**    | 1      | —      | Spend 3 junk → heal 6                                                                                                                                   | **Spend junk** for **heal**                                                | **Junk spending**        | **General**         | Sustain fork vs pure hoard.                     |
| 6   | **Turbo Link**      | 2      | —      | Bulk → junk; bonus next card once                                                                                                                       | **Bulk → junk** + **one** bonus next resolution                            | **Bulk**                 | **Junk hoarding**   | Faction-defining **bulk** card.                 |
| 7   | **Gutter Offering** | 1      | —      | Lose 3 HP (floor 1) → +3 junk                                                                                                                           | **Risk**: **HP → junk**                                                    | **Junk hoarding**        | **General**         | Volatile pile growth.                           |
| 8   | **Needle Driver**   | 3      | Strike | 10 damage, Pierce                                                                                                                                       | **High-charge Pierce** finisher                                            | **General**              | —                   | Curve / answer; **Pierce** fits many decks.     |
| 9   | **Salvage Mantle**  | 2      | Shield | 4 + floor(junk/4) block                                                                                                                                 | **Shield** scales with **junk count** (no spend)                           | **Junk hoarding**        | **General**         | Tall-pile defense.                              |
| 10  | **Scrap Derrick**   | 3      | Strike | Spend 2 junk → 14 damage                                                                                                                                | **Spend junk** for large **Strike**                                        | **Junk spending**        | **General**         | Finisher.                                       |


**In JSON:** **Present:** Junk Generator (t1/t2 merge), **Core Sacrifice** (`deep_core_tap_t1`), Turbo Link, Needle Driver, Scrap Derrick, **Core Rebirth** (t1–t3), **Induction Pit**, **Junk Recycle**, **Gutter Offering**, **Salvage Mantle**.

**Partial vs plan:** **Core Sacrifice** is implemented (`BranchIfCoreGte` + `SpendAllCoreGainBulk` + strike + transform). **0 refined scrap** path may still need a full Basic Strike hit (see `TODO/implementation-vs-design.md`).

**Distribution vs 2 / 2 / 2 / 2 / 2 target** (count **primary** playstyle only):


| Playstyle     | Count | Cards                                                 |
| ------------- | ----- | ----------------------------------------------------- |
| Junk spending | 3     | Induction Pit, Junk Recycle, Scrap Derrick            |
| Junk hoarding | 3     | Junk Generator, Gutter Offering, Salvage Mantle       |
| Bulk          | 2     | Turbo Link, Core Sacrifice (primary or secondary)     |
| Core parts    | 2     | Core Sacrifice, Core Rebirth                          |
| General       | 1     | Needle Driver (only **primary**; several secondaries) |


**Does this roster hit the target?** **Not evenly** on **primary** tags alone. **Dual-playstyle** cards (**Core Sacrifice**, **Junk Generator**, **Turbo Link**, **Core Rebirth**, etc.) **cover** **bulk** + **core** without needing **10** primaries. If you want a strict **2 / 2 / 2 / 2 / 2** on **primary** only, **re-tag** or **adjust** the roster.

**Purpose overlap / conflicts**

- **Core Sacrifice** vs **Core Tap (aw0)** — same **core → Basic Strike** philosophy; Sacrifice adds **all-core → bulk**.
- **Three junk spenders** (Pit, Recycle, Derrick) — different jobs (**deny/sustain/finisher**); still **overlaps** the **2× spending** budget if you enforce it strictly.
- **Three hoarding cards** (Generator, Gutter, Mantle) — engine vs **risk** vs **scaling Shield**; distinct, but **hoarding-heavy** vs target.
- **Needle Driver** vs **Scrap Derrick** — both **charge 3** Strikes; **Pierce** vs **junk** payment.
- **Turbo Link** vs **Overclock (neutral)** — same **bonus-next** timing; keep **bulk → junk** primary in copy/UI.

**Watchouts**

- **Core Rebirth** vs spirit passives that grant **core on Scrap** — **dedupe** rewards so Scrap stays readable.

**Implementation snapshot**

- Aw1 JSON includes **Induction Pit** (junk + Strike + enemy −charge), **Junk Recycle**, **Gutter Offering** (HP-to-floor + junk), **Salvage Mantle** (block + floor(junk/4)), plus finishers and engines listed above.

---

## Iteration checklist

- Add missing aw0/aw1 cards from plan.
- Extend `CardDef` or combat scripts for conditional effects (pile thresholds, optional junk, etc.).
- **Core:** **Core Tap** + **Core Sacrifice** — **Basic Strike** resolve / **transform**; **Sacrifice** = **all core** → **bulk** + transform (see § **Core parts Strikes** and **Core Sacrifice**).
- Rename `deep_core_tap_`* → `**core_sacrifice_`*** when data matches **Core Sacrifice** design.
- Keep merge IDs (`merge_to`) consistent with salvage-yard UX.