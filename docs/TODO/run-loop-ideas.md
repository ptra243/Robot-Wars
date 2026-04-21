# Run / loop ideas — design TODO

**Status:** exploration — not implemented in `RunState` / encounter flow yet.

---

## Core structure (your pitch)


| Beat                  | Idea                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Acts**              | **3 acts.** Narrative or mechanical escalation; act-specific card pools / enemy tables later.                                                                                                                                                                                                                                                                                                 |
| **Awakening**         | Grant **spirit awakening** (or equivalent milestone) at the **start of act 2** and **start of act 3** — aligns with `SpiritState.awakening` and existing Aw0 vs Aw1 card gates.                                                                                                                                                                                                               |
| **Boss**              | **Final boss** at the end of the run: **predefined deck**, **bonuses** / modifiers (auras, HP, starting resources) — details TBD.                                                                                                                                                                                                                                                             |
| **Travel deck**       | The run’s **macro map** is a **shuffled deck** of **node types**: **shop**, **events**, **battles**, **upgrade-card** (or similar) events.                                                                                                                                                                                                                                                    |
| **Shops (frequency)** | **Baseline: ~1 shop** in the travel mix per run (exact count TBD when building the deck from pools). **Metaprogression** can add **more shop slots** to the travel deck template or raise shop **weight** so runs with unlocks see merchants more often.                                                                                                                                      |
| **Choices**           | **Three fixed offer slots.** Each shows a **travel card** (shop, battle, event, etc.). The player **takes one** slot — **the other two stay on screen.** **Draw one new card** from the travel deck **only into the empty slot** (refill). So offers **accumulate** in the sense that unpicked nodes remain; e.g. a **shop** that appears early can stay until the player is ready to use it. |
| **Length**            | **Boss** after **10 resolved** travel picks (or equivalent counter — tune later: act breaks vs single track).                                                                                                                                                                                                                                                                                 |


**Open:** Are the 10 **resolves** **per act** (30 total) or **10 total** before boss? Your note says boss after 10 choices — treat as **default: 10-step capstone** or **whole-run 10** until we split by act.

### Choice row (detail)

- **State:** e.g. `offers: [TravelCard \| null, ...]` length **3**, plus **travel draw pile** / discard.
- **On pick:** resolve the chosen node (enter shop UI, start battle, etc.); **only that slot** clears; **replace that slot** with the **next draw** from the travel deck.
- **Unpicked** slots are unchanged — no automatic discard of “the road not taken.”
- **Design goal:** tempo control (save shop, avoid a fight until upgraded) and readable UI (always 3 face-up options).
- **Edge cases (TBD):** whether any node type **expires** after N steps, whether the **boss** forces a clear of remaining offers, and whether the draw pile can **run out** (reshuffle discard vs lose choices).

---

## Suggested additions (loop depth)

### Path clarity

- **Act boundaries** on the travel strip (e.g. choices 1–3 act 1, 4–7 act 2, 8–10 act 3) so awakening timing and enemy scaling match **where** you are.
- **Elite** or **mini-boss** nodes (stronger battle template, better rewards) slotted into the travel deck with low weight.
- **Rest / repair** nodes: heal, remove a card, or tweak queue — keeps fatigue and deck quality as decisions.

### Shops and metaprogression

- **Default density:** aim for **one** shop opportunity per run in the authored travel template (unless you later want zero-shop challenge paths).
- **Meta unlocks:** e.g. “+1 shop card in the travel pool,” “shop nodes can appear in act 1,” or “higher chance to roll shop among 3 choices” — stored in player profile, applied when **building** or **weighting** the travel deck for a new run.
- **Avoid shop spam:** hard cap or strong diminishing returns so unlocks don’t turn every third node into a merchant.

### Relics (run-wide passives)

- **Relics** are **run-long modifiers** (often “feels like” the **Persistent** card keyword: lasts the fight or the whole run) — ideally data-driven (`relicId` list on run state).
- **Combat hook:** on **combat start** (`createPreviewFighter` / `CombatSetup`), apply relic effects. They **may** register **auras** on the player the same way card effects do (`FighterAura` / `FighterState.auras` in `src/core/types.ts`), or use a **separate relic-only hook** (e.g. `runModifiers` applied before auras). **Shared implementation is optional** — optimize for clear rules text and fewer edge cases, not forcing one code path.
- **Player-facing copy:** relic passives and **Persistent** cards can use similar vocabulary, but they are **not** the same rules object unless we deliberately unify them later.
- **Gating — elites:** primary source = **elite battle** reward (pick 1 of 3 relics, or fixed drop). Optional secondary sources later: boss reward, rare shop, act reward.
- **Gating — shops:** weak or expensive relics in shops so non-elite paths still get *something* without invalidating elite value (tune per economy).

### Economy and stakes

- **Currency** (scrap, credits, faction tokens) earned in battles/events, spent in shops and upgrade nodes — ties to existing refined scrap / junk themes where appropriate.
- **Loss model:** discrete **lives** per run vs single-life roguelike; optional **banking** a reward between acts.

### Content variety

- **Event deck** separate from **battle deck** (weighted draw) so you do not see “shop, shop, shop” unless the pool allows.
- **Region tags** on travel cards (industrial / wasteland) for flavor and future modifiers.
- **Boss telegraph:** after choice 8–9, force **one** node to be “approach” (heal shop, lore, or mini-fight) before the locked boss.

### Meta / replay

- **Unlock tiers:** new travel cards and events after wins with a faction or pilot.
- **Daily / seeded** travel deck for comparable runs.

### Integration with current systems

- **Deck rules** (`validateDeckComposition`, UniqueDeck, Continuous cap) apply to **player deck**; boss uses **authoring** (saved payload + auras) per `docs/TODO/pilots-design.md` enemy section.
- **Awakening** gates shop / draft card rows (`awakening_min` in data) — act transitions flip `spirit.awakening` (0 → 1 at act 2, 1 → 2 at act 3 if we ever need **Aw2** in data; today many cards cap at 1).

---

## Implementation backlog (sketch)

- Extend `RunState` (or new `RunCampaignState`) with: `act`, **travel draw pile + discard**, `**travelOffers: [slot × 3]`** (refs to travel card defs), `resolvedTravelSteps` (or similar), `bossPending`, boss definition id, `**relicIds: string[]`**, **meta/unlock flags** for shop density.
- **Travel deck builder:** compose from node pools using **fixed shop count** (base 1) + metaprogression deltas; shuffle into draw pile; **initial deal: fill 3 offer slots** (or draw until full).
- Node resolution: player **picks one slot** → resolve → **clear slot → draw one** to refill → advance “steps taken” if needed → check act / boss triggers.
- **Relics:** JSON defs (`startOfBattleAuras`, `modifyStartingResources`, standalone effect ids, etc.) → applied once when spawning `CombatSetup` for each encounter; **aura-based vs bespoke** per relic as needed.
- Content: JSON lists for travel card templates, boss loadouts, event scripts, **relic catalog**, elite reward tables.

---

## Links

- Pilots / enemy presets: `[pilots-design.md](./pilots-design.md)`
- Spirit / run types: `src/core/types.ts` (`RunState`, `SpiritState`)
- Deck construction rules: `src/core/deckRules.ts`