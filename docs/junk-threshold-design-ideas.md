# Junk threshold stacking — design ideas

**Status:** exploration — not committed balance or implementation.

**Purpose:** Describe a **junk stacking** fantasy built from **printed thresholds** on individual cards. **[junk spending](./junk-spending-design-ideas.md)** is only a **reserved / exploratory** placeholder for *possible* **global** or rules-wide spend hooks — **not committed** and **not** a dependency here. **Per-card** `SpendJunk` on specific cards (e.g. **Strip Mine**, **Scrap Derrick** in data today) is normal card text, not “global spend for junk.”

**Not required:** This pillar does **not** assume **Shield = junk**, **end-of-turn junk → Shield**, or any other **global** rule that ties pile height to **Shield**. **Printed-threshold** scavenger cards (`junk_*_t1`) **do not** use `**SpendJunk`** — they only **read** junk at resolve-time snapshot (and may **gain** junk or other resources). Other cards in the faction may still spend junk on their own text (e.g. **Strip Mine**). There is **no** automatic global junk→bulk drain after resolves. Per-card Shield lines (e.g. **Junk Aegis**) are fine; you can also run **pure threshold** lists with almost no Shield text.

### Terminology: **deck cycle** vs **combat round**


| Term                            | Meaning                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deck cycle**                  | One full pass through the planned queue: **nine player cards** resolved in order (`COMBAT_RULES.queueSize` = 9). Same idea as a **deck pass** / wrap bucket (`passIndex` in `[deckCycleSimulation.ts](../src/core/run/deckCycleSimulation.ts)`). Say **deck cycle** (or **cycle**) for this — **not** “round.” |
| **Combat round** (engine / sim) | One `roundIndex` step: **junk drip**, **Continuous** ticks, then **player** resolves **one** card, **enemy** resolves **one** card. The deck-cycle report’s **damage / combat round** divides total damage by **this** count (e.g. 24 **combat rounds** in your core run).                                     |


One **deck cycle** spans **nine** **combat rounds** (nine player resolutions, one per combat round). When comparing rates, say **per deck cycle** vs **per combat round** explicitly.

---

## Pillar: cards as **threshold ladders**

**Intent:** A card has a **baseline** effect that always resolves, plus **extra riders** that turn on when **junk held** crosses breakpoints. Higher piles unlock **more text** on the same card — a **ladder** identity: early combats hit only the base line; later **deck cycles** or heavy stacking hit **Overclock** and **per-junk** payoffs.

- **Easy to read:** Each line is a gate (`Junk > N`). **No Shield pipeline required** — optional mix-ins only if the deck wants both fantasies.
- **Balance knobs:** Threshold heights (5 / 15 in the example), damage shape (flat vs `1 per junk`). The **per-junk** scaling line intentionally has **no hard cap** — reaching a very high junk count should take **heavy investment** (drip, generators, loaders, skipped spends), so the payoff can stay uncapped until real matches prove otherwise.

---

## Helpful threshold card **roles** (what to print)

Not every threshold card needs to be a finisher. Mix **stabilization**, **engine**, and **damage** so deck **cycle 1** sets up and **cycles 2–3** pay off.

### 1. Stabilization — bulk / Shield **early**

**Why:** Tall-junk decks can be fragile in the **first deck cycle** before payoffs fire. Thresholds that grant **mitigation** only when the pile is already going reward **holding junk** without a separate **global** Shield=junk conversion rule.

**Examples (template lines, not final balance):**

- **Junk > 3:** **+1 bulk** (or “gain bulk stacks until you have at least 1”).
- **Junk > 6:** **+4 Shield** (or “+Shield equal to half your junk,” capped for cycle 1).
- If the combat rules include **shield decay** or other **time pressure**, these thresholds read as **windows** — slam them when the pile crosses, then keep racing. *(No assumption of a future **global** spend/heal loop.)*

These cards answer: *“Can I survive long enough for the 15+ junk line?”*

### 2. Engine / ramp — energy + junk to **enable** the rest

**Why:** The deck needs **charge** to play costs and **junk** to hit gates. Baseline should be **cheap tempo**; higher thresholds **accelerate** the economy so later slots can be expensive payoffs.

**Examples:**

- **Always:** Gain **1 charge** and **1 junk**.
- **Junk > 5:** Gain **+2 charge**.
- **Junk > 10:** Gain **+3 junk**.

### 3. “Double down” on energy ↔ junk (threshold **multipliers**)

**Why:** Once the pile is real, you want **one card** to **recursively feed** the rest of the list — the “investment” card that makes cycle 2–3 explosive.

**Examples (pick one shape per card so rules stay clear):**

- **Junk > 8:** Whenever you **gain energy (charge)** this combat round, **also gain 1 junk** *(aura-like rider until end of round — implementation detail TBD)*.
- **Junk > 14:** The **next** time you would gain junk from a **card effect** this combat, **gain that much again** *(once per activation)*.
- **Junk > 12:** **Double** the **charge** and **junk** granted by **this card’s** other lines *(once per activation; order with Overclock carefully).*

These pair well with existing **Junk Loader**-style cards and with a future **Salvage Capacitor**-style persistent (“gain junk when you gain charge”) — the threshold card can **turn on** or **amplify** that package for the rest of the **deck cycle**.

---

## Threshold bands: single digit → double digit, **aw0** vs **aw1**

**Suggested pattern**

- Use **two–three gates per card**: a **low single-digit** gate (first reward), a **mid single-digit or low double-digit** gate (tempo / Overclock / stabilization), and optionally a **double-digit** gate (finisher or “1 per junk”).
- **Numbers that read well:** **3–7** (early), **8–12** (mid — often reachable late **deck cycle 1** or in **cycle 2** with drip + engine), **15–22** (late — **cycle 2–3** or high-investment turns). Exact values tie to drip (1/round) and how fast your **engine** cards add junk.

**Awakening 0 vs 1**

- **aw0:** Prefer **lower thresholds** *or* the **same** thresholds with **smaller riders** (e.g. **Junk > 6: +2 damage** vs aw1 **Junk > 6: +4 damage**). Keeps starter picks playable without rewriting the whole ladder.
- **aw1+:** Either **raise gates** by a few points (**+2 to +5** on the top line) *or* keep gates and **inflate only the top rider** (bigger payoff at **Junk > 15**). Mixing both on every card can blur progression — pick one primary knob per tier.

**Single digit vs double digit**

- **Yes:** early game cares about **4 vs 7**; late game cares about **12 vs 18**. The jump to **double digits** signals “this deck is online.”

---

## Deck composition: **engine / stabilization / damage** ratio

**Starting point (nine slots):** **3 engine / 2 stabilization / 3 damage** + **1 flex** slot *(e.g. **Junk Recycle**, **Gutter Offering**, `**junk_generator_t1`**, or **Basic Strike** — not every slot must be a new Junk threshold id).*


| Role              | Count | Job                                                                                                                                                |
| ----------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine**        | **3** | Add **charge** and **junk**; optional **double-down** at higher junk so **cycle 2–3** accelerates.                                                 |
| **Stabilization** | **2** | **Bulk** and/or **Shield** at thresholds so you don’t lose before the pile peaks.                                                                  |
| **Damage**        | **3** | **Junk Ladder** *(aw0 mini Crown)*, **Junk Rivet** *(Expose Strike)*, **Junk Crown** *(non-Strike pile finisher; Shield lives on **Aegis** only)*. |


**Feel:** Roughly **~35% engine / ~25% stabilization / ~35% damage** + flex — enough **fuel**, **defense**, and **three** distinct damage identities without a generic Pierce beatstick. If **stalls** rise, use the **flex** slot for **0-cost** junk or **charge** injection.

**Energy ↔ junk engine (appropriate shape)**

- **Baseline:** **+1 charge** and **+1 junk** on the same card appears often — mirrors “I advance two resources.”
- **Scaling:** Higher junk → **more junk per line** before **more charge** (junk is the pile stat; charge spends it on costs).
- **Double-down:** Reserve for **one** card per deck (or one **aw1** upgrade) so the rules stay legible — “this is the **Coil** turn” that makes the rest of the **deck cycle** hum.

---

## Fictional **9-card** threshold deck (design-only — not in data)

Order is a **suggested play queue** (one resolution per **combat round** in deck-cycle order). **Eight** rows below are **named Junk** designs; the last row is **flex** *(existing card or neutral — see below)*. The first column is **suggested energy (charge) cost** — hints for tuning against **stalls** and the **Energy (charge) cost pass** heuristics later in this doc *(not slot indices)*. **Junk Filch** was **cut** as redundant / low interest vs **Rivet** / **Ladder** / **Crown**.

### How many **new** cards?

- **Eight** distinct **Junk**-named designs in the table + **one flex** pick — i.e. **up to 8 new `CardDef` ids** for this archetype (plus tier merges). The ninth queue slot can stay a **staple** or **spend** card you already have.
- **Nothing here has been added to the repo**; this is a **target lineup** for when pure `**Junk > N`** data and effects exist.

### Existing cards — **cut / keep** vs threshold archetype (suggestions only)


| Suggestion                                                                   | Cards                                                                                                      | Rationale                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Strong cut candidates** *(overlap threshold fantasy, not pure `Junk > N`)* | `slag_coat_t1`, `junk_flare_t1`, `heap_shield_t1`, `scrap_derrick_t1`, `induction_pit_t1`, `turbo_link_t1` | **Slag / Flare:** hybrid **junk+core** gates. **Heap / Scrap Derrick / Pit:** smooth Shield or **spend-Strike** roles that **Junk Aegis**, **Bulwark**, **Ladder**, **Crown** will cover as **threshold** cards. **Turbo Link:** bulk→junk bridge — useful elsewhere, not the **printed-ladder** core story. |
| **Keep for spend tempo**                                                     | `junk_generator_t1`                                                                                        | **Passive junk** so **spenders** can grow the pile without spamming queue engines — supports **tempo spend** even before global spend rules exist.                                                                                                                                                           |
| **Still useful glue**                                                        | `junk_loader_t1`, `salvage_strike_t1`, `gutter_offering_t1`, `strip_mine_t1`, …                            | Ramp, pile injection, **per-card** spend — until **Junk Spigot** / **Gasket** / **Coil** exist in data.                                                                                                                                                                                                      |
| **Low priority**                                                             | `magnet_claw_t1`                                                                                           | Generic **Strike** — swap slot for a **Junk**-named card when ready.                                                                                                                                                                                                                                         |
| **Neutral filler**                                                           | `neutral_basic_strike_t1`                                                                                  | Staples stay in **flex** until the queue is full of scavenger picks.                                                                                                                                                                                                                                         |


**Do not** treat this as a mandate to delete JSON entries without a **content / migration** pass (awakening pools, merge chains, tests).


| Cost *(suggested)* | Card name        | Type                               | Summary (thresholds = junk at **start of resolution** unless noted)                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ---------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0**              | **Junk Spigot**  | Engine                             | **Identity:** fuel **charge + junk** for threshold gates. **Base:** gain **1 charge**, **1 junk**. **>4:** gain **2 charge**, **2 junk**. **>10:** gain **1 charge per 4 junk** *(i.e. **floor(junk/4)** charge — tune)*.                                                                                                                                                                          |
| **0**              | **Junk Gasket**  | Engine / stabilization hybrid      | **Base:** **1 charge**, **1 junk**. **>4:** **+1 bulk**, **1 charge**, **1 junk**. **>10:** **Overclock** *(once)*.                                                                                                                                                                                                                                                                                |
| **0**              | **Junk Coil**    | Engine *(energy → junk “wind-up”)* | **Base:** gain **1 charge**. **>4:** gain **1 junk per 1 charge you currently have** *(junk gained = current charge — tune if too explosive)*. **>12:** pay **+4 charge** *(additional cost to unlock this clause on this play — tune)*: gain **1 potency per 4 junk** *(floor)*. *Fantasy:* bank **charge**, convert to **junk** / **potency**, then **Strike** payoffs (**Junk Rivet**) cash in. |
| **1**              | **Junk Bulwark** | Stabilization → **fuels Aegis**    | **Shield 3**. **>5:** +**2** bulk. **>10:** gain **Shield** (block) from your **bulk stacks** (+ potency) — not a separate damage rider; **Junk Aegis** converts **Shield** to damage on its **>11** line.                                                                                                                                                                                         |
| **0** *(aw0)*      | **Junk Ladder**  | Damage *(starter Crown)*           | **Non-scaling** sibling of **Crown** for new players: **5** non-Strike damage *(or same damage type as Crown base — tune)*. **>8:** **Overclock** *(once)*. **No** **>15** pile-finisher — upgrade into **Junk Crown** for the scaling line.                                                                                                                                                       |
| **2** *(+unlock)*  | **Junk Crown**   | Non-Strike damage finisher         | **Charge cost 2.** **Base:** **5** non-Strike damage. **>8:** **Overclock** *(once)*. **>15:** pay **+A additional charge** when resolving to unlock *(tune **A**, e.g. **4** — same “fuel gate” idea as **Coil**’s **>12**)*: **gain 2 charge**, then **1 non-Strike damage per junk** at snapshot. **No Shield** on this card — **all Shield payoffs stay on Junk Aegis**.                       |
| **2**              | **Junk Aegis**   | Stabilization / Shield payoff      | **Only** place for **Shield** stacking in this lineup. Resolve **in order:** **+1 bulk**. **Junk > 4:** +**1** Shield per **4** junk *(floor)*. **Junk > 11:** **1** non-Strike damage per **Shield you have** *(after prior lines)*. **Bulwark** adds **Shield** earlier so this line hits harder — not a separate Bulwark→damage modifier.                                                       |
| **1**              | **Junk Rivet**   | **Junk-stacking Strike**           | **One** **StrikeDamage** step — one Strike for **Gathering** tallies. **>5:** **Expose** value **= max(1, floor(junk/4))** *(divisor tunable)*. **>10:** +**2** Strike damage. **>12:** +**5** Strike damage. Benefits from **Coil** potency / charge pacing.                                                                                                                                      |
| **0–1**            | *(flex)*         | *Player choice*                    | e.g. `**junk_generator_t1`** (passive junk for spend tempo), `**junk_recycle_t1`**, `**gutter_offering_t1`**, `**neutral_basic_strike_t1**`. **Junk Filch** remains **cut** from this lineup.                                                                                                                                                                                                      |


*Costs:* three **0-cost** engines (**Spigot**, **Gasket**, **Coil**) are **different** fuel patterns; **Ladder** is **0** at **aw0** as the **non-scaling** Crown sibling; **Crown** is the **2-cost** pile closer with an **optional extra charge** to unlock **>15**. **Junk Aegis** stays **2**. Tune **stalls** before lowering costs.

**Totals:** **3** engine · **2** stabilization · **3** damage · **1** flex — eight **Junk**-named designs.

**Roles — how the closers differ**

- **Junk Crown:** **Non-Strike** pile damage (**>15** line); **Shield** deliberately **not** here.
- **Junk Ladder:** Same **shape** as Crown through **>8**, **no** **>15** — onboarding / **aw0** card.
- **Junk Rivet:** **Strike** + **Expose**; synergizes with **Coil** potency and charge banking.
- **Junk Aegis:** All **Shield** + **Shield→damage** sequencing; **Bulwark** adds **Shield** so this line scales.

### Duplicates: up to **3×** the same card (run rules)

**Design decision:** Keep the **maximum of 3** copies per non-staple for now (`validateDeckComposition`). Revisit a **2-copy** cap only if triples dominate threshold meta.

Deck validation (`validateDeckComposition` in `src/core/run`, see `src/test/deckRules.test.ts`) allows **at most 3 copies** of the same **non-staple** card (neutrals like **Basic Strike** / **Barrier** are exempt and can exceed 3). Cards with **UniqueDeck** allow **only one** instance total — none of the fictional **Junk** designs above are marked unique unless you add that keyword for a specific card.

So the **nine-slot queue** can be **e.g. 3× Junk Spigot + 3× Junk Ladder + 3× Junk Bulwark** — same **nine** physical cards with repetition — or **nine unique** names. The **3 / 2 / 4 role split** is a *role* budget, not “nine different ids required.”

### Does each card fill a **niche**? What if you run **2×** or **3×**?


| Card             | Primary niche                                                                 | **2nd / 3rd copy** — usually                                                        |
| ---------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Junk Spigot**  | **Charge + junk**; **>10** scales charge off pile                             | More copies ⇒ more **>4** / **>10** hits per **deck cycle**; sim **charge** income. |
| **Junk Bulwark** | **Bulk + Shield**; **>10** adds **Shield** from bulk for **Aegis** to convert | Extra **block** can decay if you take hits before **Aegis**.                        |
| **Junk Gasket**  | **Bulk** early + **Overclock** at **>10**                                     | Duplicates accelerate **OC**; can feel samey at **3×**.                             |
| **Junk Ladder**  | **Starter** Crown — **no** **>15**                                            | Safe **3×** cheap damage; graduate to **Crown** for finisher.                       |
| **Junk Coil**    | **Charge → junk**; **paid** **>12** potency                                   | **Highest duplicate risk** — tune **>4** and **+4** gate hard.                      |
| **Junk Aegis**   | **Shield** + **non-Strike** damage from Shield                                | Duplicates stack big **Aegis** turns; only **Shield** role in this lineup.          |
| **Junk Rivet**   | **Strike** / **Expose**                                                       | **2×** = **Gathering** density; **Expose** per resolution.                          |
| **Junk Crown**   | **Non-Strike** **>15** pile line                                              | **2×** with **>15** unlock — sim for **OP**; **no** Shield on Crown.                |


**Summary**

- **Spigot / Gasket / Coil** are three **0-cost** engines — consider **stricter** copy limits on **Coil** if **>4** warps charge.
- **Crown** balance hinges on the **extra charge** to unlock **>15**.
- **Rivet** remains the clean **Strike** duplicate.

---

## Energy (**charge**) cost pass — not everything must cost energy

**Goal:** **0-cost** cards feel like **setup**, **payoff timing**, or **filler**; **1–2+ cost** cards feel like **spikes**. Threshold decks already **pay** in **attention** (pile management, stalls).

**Heuristics (tune with data):**


| Cost   | Typical use                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **0**  | Small **junk/charge** injection, **Continuous** attach, **low** baseline Strike when the **thresholds** carry power.              |
| **1**  | **Mid** damage or **engine** that would **dominate** at 0; **Strike** payoffs that should **not** be free every **combat round**. |
| **2+** | **Big** Shield, **Pierce**, **Scrap Derrick**-class spend, or **Crown**-tier closers.                                             |


**How to evaluate power** (until full sim on every card):

- **Per deck cycle:** expected **damage**, **Shield gained**, **energy spent** vs your **core baseline** (~6.63 damage / **combat round** in the deck-cycle report) — same tool as today.
- **Stalls:** high **charge** costs on **engine** cards can **stall** the queue; if **stalls/combat round** rises, **−1 cost** on **one** engine or add **0-cost** junk injectors.
- **Internal:** for two cards with similar text, **+1 cost** on the one with **higher floor** damage or **more keywords** (**Overclock**, **Pierce**).

**Not everything needs energy** — especially **threshold riders** that only fire when **junk** is already high (the **pile** is the real cost).

---

## Overclock on threshold cards

**Rules (design lock):**

- **Overclock** from a threshold line can trigger **at most once per card activation** — even if multiple clauses would grant it, the player gets **one** Overclock application from this card this resolution.
- **Why put Overclock on a mid threshold:** It adds **tempo value** in a different shape than raw damage — e.g. bonus-resolve the next queue card (see existing **Overclock** keyword in the sim), or a utility rider. **Expose 3** (or similar) is “about three Strike’s worth of value” in the right matchup — reasonable as a **last gate before** the all-in scaling line.
- **Top threshold** *(e.g. **Junk Crown** **>15** — non-Strike damage per junk, gated by **extra charge**):** That line is the **investment payoff** — printed **after** Overclock: *baseline damage → Overclock → pay more charge → pile line*.

**Engine note:** Today, **Overclock** is a real keyword (`src/core/types.ts`, `resolver.ts`). A future **threshold Overclock** would need to respect **once per activation** when composing with existing keyword handling.

---

## When junk is measured (design lock)

- **Junk is snapshotted at the start of resolution** of the card (when that card begins to resolve, before its own `SpendJunk` / `GainJunk` / strike body mutates the pile for *this* card’s effects).
- **Included in that snapshot:** Any **junk already on the fighter** from **earlier this combat round** (engine sense) — in particular **round-start junk drip** (`roundStartJunkDrip`) and **Continuous** ticks that run at **OnTurnStart** before the fighter’s card resolves (`applyContinuousTicks` in the combat loop). So “start of turn” junk sources count toward thresholds on the **first card you play in that combat round**.

There is **no** global **junk → bulk** step after resolution (junk stacks freely unless a card spends it or grants bulk another way).

**Implementation gap (current engine):** `compileLegacy.ts` runs `**GainJunk` before `StrikeDamage`** when both exist (e.g. **Salvage Strike**). That means **junk+core** for a strike bonus is evaluated **after** on-card junk gains — not strictly “start of resolution.” Pure `**Junk > N`** thresholds should either **snapshot** before any steps or **reorder** the pipeline when those cards ship.

---

## Example card (worked) — **Junk Crown**-shaped

**Note:** **Junk Crown** deals **non-Strike** damage only; **Shield** lives on **Junk Aegis**. The **>15** line assumes you **paid the extra charge** to unlock it this resolution.

**Template (hypothetical — not in data yet):**

- **5** non-Strike damage *(base)*.
- **Junk > 8:** Overclock *(once this activation)*.
- **Junk > 15:** *(requires **+A** additional charge paid to unlock — not shown in table below)* **gain 2 charge**, then **1** non-Strike damage **per junk** at snapshot.

**Resolve at junk @snapshot = 20, player pays unlock for >15:**


| Clause    | Met? | Effect                                                        |
| --------- | ---- | ------------------------------------------------------------- |
| Base      | yes  | **5** non-Strike damage                                       |
| Junk > 8  | yes  | **Overclock** (at most once)                                  |
| Junk > 15 | yes  | **+2 charge**, then **+20** non-Strike damage *(1 × 20 junk)* |


**Total non-Strike damage:** **5 + 20 = 25** *(plus Overclock)*, before enemy block / type tweaks. Tune numbers and unlock cost **A** in sims.

---

## Worked examples — **three deck cycles** *(TBD)*

Older versions of this doc had **27-round toy tables** for **Junk Crown** with **delayed Shield** and a different **Spigot** / **Coil** model. **Those tables are removed** until someone recomputes them against the **current** fictional deck *(non-Strike **Crown**, **0-cost** engine triad, **Coil** pay-for-**>12**, **no** Crown Shield)*.

When redoing the sim: track **junk @snapshot**, **charge** (for **Spigot >10**, **Coil** unlocks, **Crown >15** unlock), **Shield** (mostly **Aegis** / **Bulwark**), and **non-Strike** vs **Strike** damage (**Crown** vs **Rivet**).

---

## Example deck — **existing** ids for pile tests *(until `Junk > N` ships)*

These IDs exist under `src/data/cards/`. They are **not** the final threshold lineup — several overlap the **fictional** cards and are **cut candidates** (see table above). Use this as a **playtest queue** for “does the pile feel good?”:


| #   | Card id                   | Role                                                                  |
| --- | ------------------------- | --------------------------------------------------------------------- |
| 0   | `salvage_strike_t1`       | Strike + junk                                                         |
| 1   | `junk_loader_t1`          | 0-cost ramp (stands in for **Spigot** / **Gasket** until those exist) |
| 2   | `gutter_offering_t1`      | Burst junk / risk                                                     |
| 3   | `strip_mine_t1`           | Per-card **spend**                                                    |
| 4   | `junk_recycle_t1`         | Spend + heal *(if testing spend tempo)*                               |
| 5   | `junk_generator_t1`       | **Keep** — passive junk for spend / long fights                       |
| 6   | `neutral_basic_strike_t1` | Filler                                                                |
| 7   | *(open)*                  | Second filler or second ramp                                          |
| 8   | *(open)*                  | Flex                                                                  |


**Omitted from this sketch** *(per **cut** list):* `slag_coat_t1`, `junk_flare_t1`, `heap_shield_t1`, `scrap_derrick_t1`, `induction_pit_t1`, `turbo_link_t1` — replace with **Junk Aegis** / **Bulwark** / **Ladder** / **Crown** data when implemented.

**Pure `Junk > N` on cards** is implemented via `BranchIfJunkGte` (junk snapshot at resolve start) and related effect steps — see `src/core/effects/expandEffects.ts` and scavenger `junk_*_t1` ids in JSON.

---

## Opening sketch — three **combat rounds** (not a full **deck cycle**)

**Baseline you measured (core-parts deck, deck-cycle sim):** **~6.63 damage per combat round** (159 damage ÷ 24 **combat rounds** — engine `round_start` count). That is **not** the same as **damage per deck cycle**; see [Terminology](#terminology-deck-cycle-vs-combat-round) above.

This section walks only the **first three player cards** (three **combat rounds**). It is **not** a full **deck cycle** (nine cards), let alone three deck cycles. Enemy is sketched as a **Basic Strike**-class line (~**2** damage to HP before block). **Goal:** show **early ramp**, not match **6.63** in three steps.

**Assumptions:** Player **refined scrap = 0** for simplicity; no global junk→bulk conversion. **Potency** adds to Strike damage where the card is a Strike.


| Combat round | After drip (+1 junk each) | Player card (slot)  | Approx. damage to enemy | Notes                                                                                                                                   |
| ------------ | ------------------------- | ------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1            | 1 junk                    | `salvage_strike_t1` | **3**                   | Snapshot junk=1; `junk+core` < 3. After: +1 junk → 2 junk (no bulk yet).                                                                |
| 2            | 3 junk (2 + drip)         | `junk_loader_t1`    | **0**                   | Snapshot 3; +2 junk → 5 → **spend 3** → **2 junk**, +1 bulk, +1 potency.                                                                |
| 3            | 3 junk (2 + drip)         | `junk_flare_t1`     | **~8**                  | At `StrikeDamage`, `junk+core` ≥ 3 → **+3**; base **4**; **+1 potency** from one prior bulk conversion → **4+3+1 = 8** (enemy block 0). |


**Player damage over those 3 combat rounds:** **3 + 0 + 8 = 11** total → **~3.7 damage / combat round** — **below** your core deck’s **~6.63** **per combat round**, which fits an **opening** window. To compare **per deck cycle** pacing, run a full **pass** (or read `roundSummaries` / `passIndex` buckets in the deck-cycle report), not this abbreviated trace.

---

## Relationship to other junk docs


| Doc                                                              | Focus                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **This doc**                                                     | **Junk thresholds** on cards — **damage**, **Overclock**, **stabilization** (bulk/Shield), and **engine** (charge/junk / double-down riders); pure-junk piles do **not** require global Shield=junk conversion |
| [junk-spending-design-ideas.md](./junk-spending-design-ideas.md) | **Reserved / exploratory** — *possible* global or macro-level spend ideas; **may never ship**. **Not** required for threshold design. Per-card spend already exists in JSON.                                   |


---

## Anti-snowball / feel

- **High thresholds** (e.g. 15+) gate **explosive** lines to **deck cycles 2–3**, aligned with “ramp then crush” pacing.
- **Overclock** at a mid threshold gives **tempo** without requiring the top line every time — **once per activation** keeps it readable.
- **Shield decay** (where the engine applies it) and **enemy pressure** limit stalling. **Global** heal-on-spend or similar is **not** assumed — see **[junk spending](./junk-spending-design-ideas.md)** only if that exploration ever becomes real.

---

## Open questions

- Cards that **spend junk as a cost:** Confirm whether cost is paid **after** the start-of-resolution snapshot so thresholds and spend don’t fight.
- `**Junk Aegis`-style sequencing:** Lines that care about **Shield gained earlier on the same card** conflict with a **global** “snapshot junk once at start” rule — specify **ordered steps** for that card type (bulk → Shield from junk → damage from Shield) vs snapshot-only cards.
- **Finisher uniqueness:** **Junk Crown** is **non-Strike** pile damage (**>15**); **Junk Ladder** is the **non-scaling** sibling. **Junk Aegis** owns **Shield** text — don’t duplicate big Shield on Crown.
- **Crown / Coil unlock costs:** Engine must support “**pay +A additional charge** to activate **>15** / **>12** clause this resolution” — UI and `canPlay` clarity.
- Should **“1 damage per junk”** use **only junk above the highest passed threshold** (e.g. damage = `junk - 15`) vs **full snapshot junk** — readability vs burst size.
- Keyword for “threshold junk” lines vs **every X junk** smooth scaling (contrast with e.g. **Heap Shield** / **Salvage Mantle** in data today).
- Porting **pure `Junk > N`** vs existing **junk + refined scrap ≥ N** (`bonus_strike_damage_if_junk_plus_core_gte`, etc.) — one engine path or two?
- **Deck copy limit:** Stay at **3** or move to **2** for non-staples — needs **validation** + player testing.
- `**Junk Rivet` — Expose per junk:** Data shape e.g. `expose_value_floor_div_junk: 4` *(Expose amount = max(1, floor(junk/divisor)), cap optional)* — must respect **Expose** + **Strike** rules in `resolver.ts` / auras.

---

## References

- `src/core/rules.ts` — `maxBulkStacks`, `roundStartJunkDrip`.
- `src/core/combat/engine.ts` — round order (drip → Continuous ticks → resolve player).
- `src/core/effects/runner.ts` / `compileLegacy.ts` — `GainJunk`, `SpendJunk`, effect pipelines.
- `src/core/deckArchetypes.ts` — `junkPileThreshold` lineup for headless tests.
- `docs/junk-spending-design-ideas.md` — reserved note; **global** spend **not** committed.