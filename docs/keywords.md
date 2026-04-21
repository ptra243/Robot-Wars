# Keywords (design reference)

This document captures **keyword rules** for Robot Wars, aligned with the roguelike design in:

`../../MetabotArena/docs/roguelike_theme_adaptation_9053d44b.plan.md`

It is a **living spec**—update it as combat rules and data catch up.

---

## How keywords appear in data

- Each keyword is a `{ type, value }` entry on `CardDef.keywords` (`src/core/types.ts`).
- Implemented types: `Bulk`, `Overclock`, `Expose`, `Pierce`, `Continuous`, `TurboLink`, `FactoryReset`, `CoreParts`.
- Proposed next types: `Unique`, `Persistent`.

### Bulk keyword

- `**Bulk` keyword:** grants **bulk stacks** only (no potency on the card). Each stack mitigates **1** incoming strike damage to HP (consumed when used).
- There is **no** global “junk → bulk” conversion after resolves — junk can stack for threshold cards without being drained into bulk automatically.

---

## Overclock X

**Design intent (plan)**

- Tracks **charges per combat**; **X** is authored on the card.
- On play: if charges remain, consume one and **bonus-resolve the next queued card once**, **immediately after** this card, **same combat round**—not the next round’s queue.
- If no charges left, the card can **whiff** (still occupies the slot).

**Robot Wars note**

- Implement `resolveBonusNext` in `src/core/combat.ts`; scheduling should match “next slot in queue” semantics. Revisit initiative, fatigue, and empty-next edge cases as the sim grows.

---

## Expose X

**Design intent (plan)**

- **Buff on you**: the **next time the opponent resolves a card whose effect includes dealing damage to you**, they **also take X damage**; then Expose clears.

**Robot Wars note**

- Current combat path may differ (retaliate-on-hit framing). **Align implementation and UI copy** with the plan definition when you tighten expose.

---

## Pierce

**Design intent (plan)**

- On a **Strike**: that hit’s damage **ignores block** (define scope: enemy block from Shield, temp barriers, etc.).

**Robot Wars**

- `src/core/combat.ts` applies Pierce to damage vs block before HP; extend glossary/tests if you add more barrier types.

---

## Continuous N

**Design intent (plan)**

- On **first resolution**, card enters **Active** (aura).
- Every **N combat rounds**, gain **+1 junk** and **+1 charge** (global round counter).
- When the **queue would resolve this card again** on a later loop, **skip** it (no charge, no body); **periodic ticks** can still run if aura persists (per plan default).

**Robot Wars**

- See `continuousTicksByQueueIndex`, `isContinuousSkipped`, `applyContinuousTicks` in `src/core/combat.ts`.

---

## Turbo Link

**Design intent (plan)**

- **Spend 1+ bulk stacks** → **+1 junk per stack spent**.
- If you spent **≥1 stack**, **once**, bonus-resolve **next queued card** a **single** time (same timing band as Overclock—not next combat round).

**Robot Wars**

- Implemented via `TurboLink` keyword + bulk handling in `src/core/combat.ts`; verify stack spend math vs plan.

---

## Factory Reset

**Display name:** **Factory Reset** · **Data / code:** `FactoryReset`

**Design intent**

- After this card **finishes resolving**, **replace** this **deck entry** with a **neutral basic** print — default **Neutral Basic Strike** at a chosen **card tier** (same **merge ladder** as `neutral_basic_strike_t1` … `t3`).
- **Value** `1`–`3` selects the **Basic Strike** **tier** to become; if **out of range**, treat as **tier 1** (implementation default in `cardText.ts`).
- **Combat** must apply the swap **after** on-play effects (damage, spend core, etc.) so **Core Tap** / **Core Sacrifice** can **downgrade** into a **staple** without a dead card.

**Robot Wars**

- Listed on `CardDef.keywords` as `{ "type": "FactoryReset", "value": 1 }` (etc.) when data authors the behavior.
- **Deck transform** in the run sim / `src/core/combat.ts` is **not** fully wired until deck state supports **in-combat id replacement** — track in `docs/TODO/implementation-vs-design.md`.

---

## Unique

**Display name:** **Unique** · **Data / code:** `Unique`

**Design intent**

- **Deckbuilding constraint** only: a deck may include **at most 1** card with this keyword (or, if you scope it later, at most 1 copy of the same unique id).
- No in-combat effect by itself; duplicate copies can still appear in hand/queue through generation/copy effects unless a separate rule forbids that.

**Robot Wars note**

- Use this for cards like **Gathering Strike** where you want a hard deck cap without adding resolve-time complexity.

---

## Persistent

**Display name:** **Persistent** · **Data / code:** `Persistent`

**Design intent**

- Marks effects that last **for the rest of the battle** after resolution (for example: “whenever you gain charge, gain equal shield”).
- `value` can be reserved as a strength/tier scalar where needed (or set to `1` for boolean behavior).

**Robot Wars note**

- Treat as a marker keyword plus explicit effect steps/state wiring in combat (aura registration and trigger hooks), not as a standalone behavior without backing effect logic.

---

## Tags vs keywords (Strike / Shield / Direct / filter tags)

**Design intent (plan)**

- **Strike** / **Shield** are **tags**, not keyword types.
- **Direct** is a **tag** for damage that uses block / Pierce / bulk mitigation like a hit, but **only** deals **base damage** — it does **not** add or spend **strike potency** on that hit (you can still grant potency on the same card for later Strikes).
- **Junk** / **Bulk** / **Potency** are optional **filter tags** (deck builder chips) alongside scalars/keywords — author them when the card clearly belongs in that bucket.
- **Bulk stacks** mitigate **incoming strike damage** to HP (1 per stack, consumed). **Strike** / **Shield** add **base** + **potency** only; **Bulk** keyword grants stacks (see Bulk rules above).

**Robot Wars**

- Tags live on `CardDef.tags`; potency scalars are `strike_potency_gain` / `shield_potency_gain` where relevant.

---

## Cross-links

- Resource model (junk, bulk, core): see plan § “Junk, bulk stacks, and core scrap”.
- Neutral cards that carry keywords: `docs/neutral-cards.md`.
- Scavenger cards: `docs/scavenger-cards.md`.
- Gaps vs design doc: `TODO/implementation-vs-design.md`.