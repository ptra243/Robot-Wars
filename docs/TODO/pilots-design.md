# Pilots (AI battle routines) — design draft

**Status:** design exploration — not wired in `RunState` / UI yet beyond spirit placeholder naming.

**Intent:** **Pilots** are **AI personalities** that execute your **battle routine** — the ordered **queue deck** you built. They are not separate fighters; they **modify** how the run plays (passives, triggers, or starting knobs) keyed to **spirit awakening** (`SpiritState.awakening` in `src/core/types.ts`).

**Scope this doc:** **Scavengers** faction — **≥3 pilots** plus **Glint** as the current **placeholder** codename. Other factions later.

---

## Faction lock & card access

**Pilots are faction-locked:** choosing a Scavenger pilot means you are on a **Scavenger** run for normal progression.

**Card sources (shop, redraws, default rewards):** the player can acquire **neutral** cards and **their faction’s** cards only. Faction choice (and thus pilot) **defines** what appears in those pipelines — no off-faction staples in the ordinary economy.

**Exceptions:** **one-off events** (or similar) may grant a specific off-faction card or a narrow exception; that is **not** the baseline loop and can be added later.

**Spirit-tier injections:** An **Aw0** or **Aw1** choice may **add a card** to the run — see **Exclusive pilot cards** below. Those cards stay **faction-legal** (e.g. Scavenger) but need **not** appear in the normal shop / redraw tables; they are **earned** by the trait pick, not bought off the common pool.

---

## Structure (per pilot)

Each pilot has **three** authored layers:


| Layer                 | When it matters                                 | Notes                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base trait**        | Always, when this pilot is selected             | Defines the default “voice” of the routine — small, always-on rule.                                                                                                                                 |
| **Awakening 0 trait** | Unlocked at spirit **awakening ≥ 0**            | **One pick** at that tier — see **Aw0 trait choice** below (not automatic).                                                                                                                         |
| **Awakening 1 trait** | Spirit **awakening ≥ 1** (first milestone pool) | Stronger effect; often **stacks** with base + chosen Aw0. Whether Aw1 uses the **same pick-one menu** pattern as Aw0 (pilot vs shared faction vs neutral) or is **automatic / separate** — **TBD**. |


**Aw0 trait choice (draft):** When the player hits **Aw0**, they **choose one** trait for that slot from a small menu, for example:

- **This pilot’s Aw0** — the signature option tied to the pilot you’re playing (see roster tables).
- **A shared Scavenger Aw0** — from the faction pool (off-ramp / pivot).
- **Optionally:** a **random neutral** trait — *only if* we add a **neutral trait** pool later (same power band as other Aw0 offerings).

You do **not** get all of these at once for Aw0 — you pick **one** line for that awakening tier. Rerolls / future systems could revisit how the menu is built (e.g. weighted random offers).

**Stacking:** **Base** is **always on** once the pilot is selected. The **chosen** Aw0 trait then **stacks** with base. **Aw1** stacks with base **and** the chosen Aw0 — design pilot offerings so a **pilot Aw0** and **Aw1** on the same character **synergize** when the player commits to both picks; **Scavenger Aw0** as the pick is the explicit **off-ramp** when card RNG fights the pilot line.

**Naming note:** *“Glint-only”* in earlier discussion meant **Glint is the only pilot with full trait text filled in today** — not that a trait type is restricted to Glint forever. Every pilot gets their **own** base and **offered** aw0 / aw1 lines; Glint is the **placeholder** row until copy finalizes.

### Exclusive pilot cards (optional — expands design space)

Not every Aw0 / Aw1 line needs this, but **any** pilot or (if we allow it) shared trait can bundle **extra design space** by granting one **exclusive** card when taken:

- **Pilot path:** **Aw0** or **Aw1** may add a **pilot-locked** card — only that pilot’s run can obtain it (usually via that trait tier). The card **anchors** the pilot’s gameplan (combo piece, payoff, or enabler) so the deck has a **guaranteed** hook even when the shop is cruel.
- **Power budget:** The passive text + card **together** should match other options at that tier — a trait that **only** grants a strong card might run **lighter** passive text, or vice versa.
- **Faction:** Cards stay **Scavenger** (or neutral if we ever do neutral trait + neutral card) so faction identity and rules stay coherent.
- **Shop:** These ids are typically **omitted** from random offers — acquisition is **spirit tier** (or a follow-up event), not the default buy/redraw pipeline.

---

## Shared Scavenger traits (faction pool — off-ramps)

Besides **per-pilot** offerings, Scavenger runs have a **shared** Scavenger trait list used as **one branch** of the **Aw0 choice** (and potentially other tiers later — TBD). These serve two roles:

1. **Faction identity** — broad junk / scrap / survival knobs every Scavenger can lean on.
2. **Build off-ramps** — if the shop and redraws never line up with *this* pilot’s ideal card package, picking a **Scavenger Aw0** at the spirit screen lets the player **pivot** toward another viable archetype (hoard vs spend vs core bridge, etc.) without feeling hard-locked to dead synergies.

You do **not** run pilot Aw0 and Scavenger Aw0 **together** unless we later add a separate system that grants an extra trait — by default, **Aw0 is one pick** among those sources.

**Later picks:** Shared Scavenger traits at **Aw1** (or additional draft picks) can still **stack** with whatever was chosen at Aw0 + **base** — see table below.

Split by **power band** so Aw0 stays lighter than Aw1:


| Pool                      | Role                                | Examples (ideas — pick later)                                                                                                                                   |
| ------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scavenger @ Aw0 power** | Breadth, onboarding, pivot-friendly | Start-of-combat junk; small heal-on-spend rider; +1 **round-start junk drip** once; (legacy idea: soft first conversion — no global junk→bulk in engine today). |
| **Scavenger @ Aw1 power** | Spike, engine payoffs               | Threshold bonuses while **junk ≥ N**; extra **charge** when spending **≥2** junk on a card; one **free** optional junk spend per combat.                        |


**Distinction:** **Pilot Aw0** = this AI’s **signature** offer for the Aw0 slot. **Shared Scavenger Aw0** = **faction** toolbox for identity + **RNG relief** in the **same** slot. Whichever you pick **combines** with **base** and later tiers — it does not sit beside a second Aw0 from the same tier unless rules explicitly grant one.

---

## Pilot roster (ideas — ≥3 + Glint)

Flavor axis: **junk hoard** vs **junk spend** vs **core bridge** vs **risk / HP** — aligned with `docs/scavenger-cards.md` and junk design notes.

**Table columns:** **Base** = always active. **Aw0** / **Aw1** = this pilot’s **authored offerings** for those tiers — at **Aw0**, the player may still choose a **Scavenger** or **neutral** option instead of the pilot line (see **Aw0 trait choice**). Any tier may later be annotated with a **+ card** if we author an **exclusive pilot card** for that line (not filled in below — ideas only for passives today).

### 1. **Glint** *(placeholder codename — replace when IP final)*

Glint was born under a lucky star, when things go wrong, they sometimes go right.


| Layer    | Idea                                                                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base** | **Routine buffer:** When **y**ou **stall** each combat, gain **+1 charge** after the stall resolves and 2 junk (softens bad curve).                                                                                               |
| **Aw0**  | **Scrap ping:** At the start of battle, upgrade the first non-tier 3 card in your deck by 1 tier undo this at the end of battle. Every time you play a tier 2 card deal 1 damage, Every time you play a tier 3 card deal 3 damage |
| **Aw1**  | **Lucky Numbers:** Glint's lucky numbers are 2,4 and 7. Her luck coelesces into reality and those card slots will have an extra effect after resolution. 2: gain 2 junk, 4: Shield 4, 7: Strike 5                                 |


*Tune:* numbers are placeholders; Glint sells **tempo / execution** fantasy.

---

### 2. **Baron von boar** *(spend + core bridge AI)*


| Layer    | Idea                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| **Base** | **Rich get richer: When you would draft, you have an aditional choice.**              |
| **Aw0**  | **Rich get even richer: Every time you play a core parts card. gain a refined scrap** |
| **Aw1**  | **The whole hog:** For every 50 gold you have, gain 1 potency                         |


---

### 3. **Wire Saint** *(spend + core bridge AI)*


| Layer    | Idea                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base** | **Reflow:** when you **spend refined scrap**, gain **+1 junk** *(ties core economy to pile without making core cards “junk strikes”)*.                                        |
| **Aw0**  | **First spend:** the **first** time you **spend junk** each combat, **heal 1** *(stack with global heal-on-spend if that rule exists)*.                                       |
| **Aw1**  | **Core tap habit:** cards with **CoreParts** in keywords gain **+1 strike potency** on resolve for that card only *(once per card per combat cap — avoids infinite potency)*. |


---

### 4. **Ash Tick** *(pressure / attrition AI)*


| Layer    | Idea                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base** | **Residual:** enemies start combat with a **shred** marker: the next time they deal **Strike** damage to you, that damage is **−1** *(Strip Mine theme as passive — tune magnitude)*. |
| **Aw0**  | **Thermal sympathy:** while **fatigue is armed**, you take **−1** from **thermal** damage *(or: fatigue step −1 once per combat)* — *only if fatigue stays in design*.                |
| **Aw1**  | **Burn clean:** once per combat, when you **lose HP** from a card you played, gain **+2 junk** *(Gutter Offering / risk synergy)*.                                                    |


---

## Enemy pilots (AI opponents)

**Same systems:** Enemy “pilots” use the **same** pilot machinery as the player — **base**, **Aw0 pick**, **Aw1 pick**, exclusive trait cards, faction lock, etc. The difference is **authoring** and **difficulty**, not a second ruleset.

**Pre-built routines:** Designers (or tools) **assemble the enemy’s battle routine** ahead of time — fixed **deck order** / queue, known card ids, optional **planned queue** mirror of player tooling. Encounters reference a **saved loadout** rather than a procedural run.

**Difficulty knobs (examples — stack as needed):**


| Knob                   | Role                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HP / stat budget**   | Scale enemy fighter **max HP** (and related stats if we expose them) by level, act, or tier.                                                                                        |
| **Card level / tier**  | Bump **card tier** or internal scaling fields so the same list hits harder at higher difficulties.                                                                                  |
| **Starting auras**     | Enemy begins combat with **one or more auras** (extra passives, damage modifiers, junk rules, etc.) on top of pilot traits — good for **boss** identity without bloating the queue. |
| **Awakening / spirit** | Match `SpiritState.awakening` (and xp if relevant) so trait gates line up with the authored picks.                                                                                  |


Enemy loadouts should remain **deterministic** for a given encounter id: same seed + same definition ⇒ same pilot package + same deck.

---

## Deck builder: saving pilot trait choices

**Goal:** Anything you set in the **deck builder** for **pilot + Aw0 + Aw1** choices should **serialize** with the saved deck so definitions are **stable**, **shareable**, and **reusable** — including **authoring enemy encounters** from a saved snapshot later.

**Current code:** `SavedDeckPayload` in `src/core/types.ts` holds deck queue sandbox fields (`deck`, `hand`, `plannedQueue`, `enemyPlannedQueue`, sandbox scrap, etc.) — **no pilot / trait fields yet**.

**Design direction:** Extend the save payload (and deck string codec) to include at minimum:

- `pilotId` (or spirit id that implies pilot)
- **Chosen trait ids** for **Aw0** and **Aw1** (and any future tiers), or a compact **trait bundle id** if we pack presets
- Optional: **faction** string (or derived from pilot) for validation when loading

**Flow:**

1. Player (or designer) configures pilot + traits in the deck builder → **save** writes the full snapshot.
2. **Enemy pipeline** imports the same payload (or a named preset copied from it) to spawn an opponent with that pilot + deck + traits.
3. **Share codes** / exports remain one round-trip: deck **and** pilot choices stay in sync.

Version the encoded string if adding fields so old codes still decode (default missing traits → sensible defaults or reject with a clear error).

---

## Implementation hooks (future)

- `SpiritState` may gain `pilotId: string` or pilots merge into `spirit.id` strings (`glint`, `heap_mother`, …).
- Passives may compile to **run modifiers** (separate from `CardDef`) applied in `combatSetup` / `CombatSimulator` / shop.
- **Shop / redraw / reward pipelines** filter by **faction + neutral** for the run’s faction; pilot selection implies faction (see **Faction lock & card access** above).
- **Spirit Aw0 (and maybe Aw1):** UI or scripted offer list — **pilot trait id** vs **scavenger pool** vs **neutral pool** (if any); persist **chosen trait id(s)** on run / `SpiritState` **and** in `SavedDeckPayload` (see **Deck builder: saving pilot trait choices**).
- **Trait → card grants:** On pick, append card id(s) to `RunState.deck` / hand per design; `CardDef` (or data flags) marks **pilot-exclusive** / **spirit-grant-only** so shop generation skips them.
- **Enemy encounters:** Build `CombatSetup` / enemy `FighterState` from **saved deck payload** + encounter **HP / card tier / aura** overrides; reuse `mergePayloadIntoRun`-style hydration for the enemy side where applicable.
- **Glossary** entries: Pilot, Battle routine, Trait (base / Aw0 / Aw1).

---

## Open questions

- **Aw1:** same **pick-one** menu as Aw0, a **second** pick from a subset, or a **fixed** pilot Aw1 when you locked pilot at Aw0?
- **Neutral traits:** power parity and pool size so random neutral Aw0 is not strictly weaker or strictly better than pilot / Scavenger options.

---

## Links

- Scavenger card roster: `[../scavenger-cards.md](../scavenger-cards.md)`
- Junk design exploration: `[../junk-threshold-design-ideas.md](../junk-threshold-design-ideas.md)`; optional reserved note `[../junk-spending-design-ideas.md](../junk-spending-design-ideas.md)` *(global spend rules **not** committed)*
- Spirit / run / save payload: `src/core/types.ts` (`SpiritState`, `RunState`, `SavedDeckPayload`)
- Deck string codec: `src/core/run/deckStringCodec.ts` (`savedDeckPayloadFromRun`, `encodeDeckPayload`, `decodeDeckString`)
- Saved deck UI / storage: `src/ui/savedDecksStorage.ts` (`mergePayloadIntoRun`, `createSavedDeckRecord`)

