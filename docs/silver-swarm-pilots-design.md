# Silver Swarm: Queen, Doppelganger, and a third archetype (design plan)

**Status:** design exploration — not implemented in combat / `RunState` yet.

**Open todos**

- Decide rotate = destroyed?, Doppelganger energy trigger, and multi-tag card classification for imprints
- Draft 8–12 card names with costs, tiers, and exact Persistent / EOT wording
- Tune drone bases + Self-Destruct vs forge basic-strike sim (rounds 1–12 damage/block)
- When implementing: add `FighterState` drone/focus + `onRoundEnd` or post-activation EOT + trait branches

---

## Shared chassis (Defect-like)

**Terminology:** Call the three slots **Focus** (max 3 by default) — each occupied slot holds **one drone**. Drones are **not** cards in hand; they are persistent battlefield objects (like orbs) that **rotate** when new drones are summoned into a full row (oldest drops — your “rotated out” trigger).

**Drone types (baseline behavior — see pilots below):**


| Drone            | Default intent                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strike drone** | Contributes **strike damage at end of your turn** (after queue resolution for that activation, or at a defined pipeline step — must match how you implement “end of turn”). |
| **Shield drone** | Grants **block** at the same moment.                                                                                                                                        |
| **Energy drone** | Grants **+1 charge** at the same moment.                                                                                                                                    |


**Numbers to author later:** Base contribution per drone should scale with **potency** on Queen; Doppelganger may ignore EOT scaling in favor of copy mechanics (below).

**Why this fits the codebase today:** `[FighterState](../src/core/types.ts)` has no drone/focus fields yet; `[TRAIT_REGISTRY](../src/core/traits.ts)` hooks are `onCombatStart`, `onStall`, `onCardResolved` — the file itself lists **future** `onRoundStart` / `onRoundEnd`. EOT drones need a **round-boundary hook** (or a single “after player activation resolves” step in `[src/core/combat](../src/core/combat)`) so Queen’s drones fire predictably.

```mermaid
flowchart LR
  subgraph shared [Shared chassis]
    Focus[Focus slots max 3]
    Drones[Drones in slots]
    Potency[Potency scales EOT]
  end
  Focus --> Drones
  Drones --> Potency
```



---

## Pilot A — **Queen** (summon + amplify)

**Fantasy:** Swarm commander — **fill Focus**, **amplify** end-of-turn pressure, convert potency into **more drone throughput** (not only generic potency scaling).

**Suggested base trait (always on):**

- **Focus 3** at combat start.
- When you **summon** a drone (any card effect that puts a drone into a Focus slot), gain **+1 strike potency and +1 shield potency** *or* a smaller fixed **+1 potency** — pick one knob so Queen’s potency isn’t strictly identical to neutral Servo Tune-Up (your instinct is right: potency cards need **extra** upside).

**Awakening hooks (examples, not final copy):**

- **Aw0:** First time each combat your Focus **fills completely**, deal **direct** damage / apply **Expose** / gain a **one-shot Overclock** — a tempo spike that rewards setup.
- **Aw1:** Drone end-of-turn effects **repeat** once if you have **3+ total drones summoned this combat** (or “if Focus is full at EOT”) — a clear Queen payoff.

**Identity contrast:** Queen **likes** cards that **summon**, **retain**, and **burst at EOT**; she is weak if the deck never stabilizes Focus.

---

## Pilot B — **Doppelganger** (imprint / consume)

**Fantasy:** No passive EOT from drones. Instead, drones are **charges** that **imprint** the next matching baseline card.

**Core rule (must be unambiguous in implementation):**

- **Strike drone stock:** The next time you resolve a card whose **primary classification** is **Strike**, **consume one Strike drone** and **add a copy of that card’s effects** (or re-resolve the same `CardDef` once targeting the enemy) — mirror your “copy the strike card that was played.”
- **Shield drone** — same for **Shield** resolutions.
- **Energy drone** — same for the **next card that grants charge** *or* “next non-drone card that spends or produces energy” — you should pick **one** trigger so players can reason about it; “next card with `gain charge` in its effect” is learnable.

**Edge cases to decide up front:**

- **Multi-effect cards:** Define whether a card counts as Strike/Shield by **tag**, **effect pipeline order**, or **dominant effect** — tags (`CardDef.tags`) already exist per `[keywords.md](keywords.md)`.
- **Tier:** Copy at **played tier** (recommended) so tier upgrades matter.

**Suggested awakening:**

- **Aw0:** First imprint each combat costs **no drone** *or* refunds **+1 charge**.
- **Aw1:** When a drone is **consumed**, deal **small direct** damage or **junk** — keeps pressure without relying on EOT.

---

## Pilot C — **Warden** (ablative / bodyguard)

**Fantasy:** The swarm is **armor**, not only DPS. Drones **soak** or **deflect** incoming pressure so you can **stall to potency**, then **convert** spent drones into damage (synergy with **Self-Destruct**-style payoffs).

**How it differs:**


|                  | Queen              | Doppelganger           | Warden                              |
| ---------------- | ------------------ | ---------------------- | ----------------------------------- |
| **Drone job**    | End-of-turn value  | Fuel for copies        | **Intercept** / mitigation          |
| **Tempo**        | Snowball board     | Spike on correct lines | **Trade** drones for HP / stability |
| **Player skill** | Sequencing summons | Card-type tracking     | **When to break** drones            |


**Suggested base trait (always on):**

- **Focus 3** at combat start (same chassis).
- While you have a **Shield drone**, the **first** incoming strike damage to HP each **enemy activation** is reduced by **N** (or **one** drone **shatters** to negate **X** damage — pick a clear rule: *shatter* counts as **destroyed** for Self-Destruct).
- **Strike / Energy drones** on Warden might do **little or no EOT**; instead they grant **smaller** intercept pools or **retaliation** when they shatter (so Warden is not a third copy of Queen).

**Why it fits the faction:** Silver Swarm already leans on **rotation** and **destruction** triggers — Warden makes **losing** drones a **game plan**, not a mistake, without using Doppelganger’s imprint rules.

**Suggested awakenings:**

- **Aw0:** The **first** drone that shatters each combat deals **direct** damage to the enemy (“spike strip” fantasy).
- **Aw1:** **+1 max Focus** for this combat **or** **restore 1 Focus slot** when you end a round at full HP — rewards successful mitigation.

**“Activate all” for Warden:** **Fortify** — each drone **immediately** contributes its **defensive** package (emergency block, shatter-threshold refill, or **one** shared barrier based on drone count). If that overlaps Queen’s “front-load EOT,” differentiate by **numbers keyed to mitigation** (block / bulk / strip mine) rather than raw strike damage.

---

### Other archetype directions (if Warden is not the pick)

- **Relay / Spotter (offensive setup):** Drones **tag** the enemy; your next **Strike** or **Expose** application gets **+X per drone** (or **Pierce** charges). Plays like **setting up one big turn** instead of Queen’s steady EOT or Doppelganger’s copy chains.
- **Harmonics / Monotype Splicer:** Strong bonus when **all Focus slots hold the same drone type**; **weak** when mixed — rewards **specialized** decks and makes faction cards that **convert** drone types matter.
- **Empty-Hand / Lean Operator:** Bonuses when **Focus is empty** (charge retention, potency) vs when **full** — inverted curve to Queen; high skill ceiling.

---

## “Activate all drones” — unified resolution

You asked what this does for Doppelganger. **Recommended split** so the same card text works for both pilots:


| Pilot            | **Activate All** behavior                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Queen**        | Each drone’s **EOT effect fires once immediately** (then optionally still fires at real EOT if you want double-dip — usually **no**: treat “Activate All” as **front-load** only to avoid confusion).                                                                                                                                                                                                                                     |
| **Doppelganger** | **Imprint now:** For each drone type present, **consume one drone** of that type and **immediately perform one imprint** using the **last** Strike / Shield / Energy card that qualifies since combat start (or since last “clear imprints”). If **no prior imprint exists** for a type, fall back to a **token payout** (e.g. Strike drone → deal **2 direct**; Shield → **+3 block**; Energy → **+1 charge**) so the card never whiffs. |
| **Warden**       | **Fortify:** Resolve **defensive** drone value now (barrier / shatter prep / intercept charges). Avoid duplicating Queen’s strike spike unless numbers are **mitigation-first** (see Pilot C).                                                                                                                                                                                                                                            |


This keeps the card **readable** (“Resolve all drones now”) without giving Doppelganger a dead mode.

---

## Card ideas (starter kit)

Organized by job; **costs are placeholders** until you run `[simulateForgeDeckMetrics](../src/core/run/forgeDeckSimulation.ts)` / `[simulateDeckCycleReport](../src/core/run/deckCycleSimulation.ts)` against `neutral_basic_strike_t1`.

**Rules carriers (Persistent):**

- **Self-Destruct Protocol** — *Persistent:* When a drone is **destroyed** (consume, rotate off, or “destroy drone” effect), deal **X** damage to the enemy (**direct** or **strike** — pick for interaction with block/Expose).
- **Assembly Line** — *Persistent:* Your **Basic Strike** (faction basic ID) **summons a Strike drone** when played (once per copy of the passive if you need a cap).
- **Bulwark Fabricator** — *Persistent:* **Basic Shield** summons a **Shield drone** (same pattern).

**Economy / Focus:**

- **+1 Focus** (name TBD) — gain **+1 max Focus** for this combat *or* “empty slot becomes available” — careful: **4 slots** changes balance a lot; alternative is **“gain a temporary 4th slot this round only.”**
- **Hard Reset** — set **Focus to 3** and **clear all drones** *or* **destroy all drones** (synergy with Self-Destruct if destruction counts).
- **Capacitor Banks** — **+3 potency**; **lose 1 Focus** (or **-1 max Focus this combat**) — the “risk/reward” potency card you wanted.

**Potency / scaling:**

- **Hive Accounting** — **High cost:** gain **+1 potency per drone you have summoned this combat** (counter on fighter; already analogous to patterns like `strikeResolutionsThisCombat` in `[FighterState](../src/core/types.ts)`).
- **Emergency Refit** — **High cost:** **Destroy** all drones; **resummon** the same number/types (or “summon three Strike drones”) — combo with Self-Destruct if destroy triggers matter.

**Finishers / tempo:**

- **Synchronize Swarm** — **Activate All** (use the unified table above).
- **Overload Burst** — deal damage equal to **sum of Strike drone potency contributions** *once* — Queen skew; Doppelganger might convert imprints instead (optional second card).

---

## Balance goal: beat “basic attacks only”

**Benchmark in repo:** Forge preview sim uses an enemy deck of `**neutral_basic_strike_t1` repeated** (`[forgeDeckSimulation.ts](../src/core/run/forgeDeckSimulation.ts)`), 20 rounds, infinite HP — you measure **player damage per round** and stall patterns, not a kill race.

**Your stated goal (turn ~9 lethal or out-value)** is a **paper design target**. To validate:

1. Build a **minimal Silver Swarm list** (basics + 3–5 package cards) and compare **cumulative damage / block / charge** from sim events through round 9–12.
2. Tune **drone base values** so Queen’s **EOT stack** plus **Self-Destruct** damage matches or exceeds **9 × (basic strike output)** adjusted for block — or ensure **Doppelganger** imprint burst reaches the same threshold **after setup turns**.

**Knobs:** drone base damage/block/charge; Queen’s extra potency on summon; Self-Destruct damage; Focus reset / high-cost refit numbers; Doppelganger fallback payouts on “Activate All.”

---

## Implementation footprint (when you code it)

**Data / state**

- Extend `[FighterState](../src/core/types.ts)` with something like: `focusMax`, `drones: Array<'strike'|'shield'|'energy'|null>` (or parallel stacks), `dronesSummonedThisCombat`, optional `lastImprintCardIds` for Doppelganger.
- Add **trait IDs** in `[pilots.ts](../src/core/pilots.ts)` + entries in `[TRAIT_REGISTRY](../src/core/traits.ts)`; pilot-specific logic branches on `queen_base` vs `doppelganger_base` vs `warden_base` (or chosen third id).

**Engine**

- **EOT resolution** for Queen: new combat phase or `onRoundEnd` trait hook (listed as future in traits header).
- **Doppelganger imprint:** extend `**onCardResolved`** (already fires after full resolve) to detect Strike/Shield/Energy classification and consume drones.
- **Persistent** carriers: either new `CardDef` fields + compiler steps in `[src/core/effects](../src/core/effects)` or auras — `[keywords.md](keywords.md)` notes Persistent as **proposed**.

**Content**

- Author cards in JSON with tier ladders like existing neutrals (`[neutral-cards.md](neutral-cards.md)` pattern).
- Optional: link to `[TODO/silicon-swarm-and-ranged-mechanics.md](TODO/silicon-swarm-and-ranged-mechanics.md)` as the **canonical** Silver/Silicon swarm note when you start filling it (only if you want that doc populated).

---

## Open design choices (resolve before implementation)

1. **Rotate behavior:** When Focus is full and a new drone arrives, does the **pushed-out** drone count as “destroyed” for Self-Destruct? (Likely **yes** for fun; mark **yes/no** on card text.)
2. **Doppelganger energy imprint:** Trigger on **next card that adds charge** vs **next played card after an Energy drone exists** — pick one.
3. **Queen vs neutral potency:** Queen’s “extra on summon” should **not** obsolete **Servo Tune-Up** — keep **+3/+3 split** cards for raw efficiency; Queen wins on **drone count** and **EOT payoffs**, not flat potency rate.

