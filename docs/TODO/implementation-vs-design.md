# Implementation vs design document

**Last reviewed:** 2026-04-17

**Design source:** `../../../MetabotArena/docs/roguelike_theme_adaptation_9053d44b.plan.md` (roguelike theme adaptation plan)

**Scope:** Robot Wars codebase + JSON card data. Use this file to track **drift** and **open work**; update when you ship changes.

**Related TODOs (not full drift tables here):**

- **Faction / future mechanics:** `[silicon-swarm-and-ranged-mechanics.md](./silicon-swarm-and-ranged-mechanics.md)` — Silicon Swarm + laser/gun ideas; deprioritized detail lives there.
- **AI pilots:** `[pilots-design.md](./pilots-design.md)` — Scavenger roster + trait ideas; not wired into `RunState` yet.
- **Run / campaign loop:** `[run-loop-ideas.md](./run-loop-ideas.md)` — acts, travel deck, bosses; mostly not implemented.
- **Boss encounters (design scratchpad):** not split out yet; see repo `.cursor/plans/` if a boss plan file exists for Prince of Nothing / Undying King notes.

**Test harness (headless matchups):** `src/core/deckDuel.ts` (`runDeckDuel`, `resolveDeckEntries`), `src/core/deckArchetypes.ts`, `createCombatSetupFromDecklists` / `padQueueFromDeckList` in `src/core/run.ts`, covered by `src/test/deckDuel.harness.test.ts`. Does **not** replace in-run flow; useful for balance smoke tests.

**Player-facing naming:** UI and card rules text use **“refined scrap”** for the resource; engine fields remain `coreScrap`, `gain_core`, `spend_core`, etc.

---

## Open work (prioritized)

Use this section as the living checklist.

### 1. Engine + card data

- **0 refined scrap branch — Core Tap + Core Sacrifice:** `core_tap_t1` and `deep_core_tap_t1` both use `elseSteps` with **only** `TransformCurrentQueueSlot` (no damage step). Confirm design: should either card resolve a **tier-matched Neutral Basic Strike** hit when core = 0, then transform? If yes, implement for both for parity (`scavengers/awakening0.json` + `awakening1.json`).
- **Capitalising Strike ladder:** **t1** shipped (Pierce + **consume opponent Expose** for bonus damage via `consumeTargetExposeForBonus` in `compileLegacyToEffects`). Add **t2 / t3** + `merge_to` in `neutral/awakening1.json` when ready.
- **Aura / trigger model (longer-term):** explicit trigger dispatchers + anti-chain guardrails if card complexity grows.

### 2. Deck / run

- **Per-instance tracking for duplicate ids** (optional): same id in deck multiple times — richer state if needed for future effects.
- **Magnet Claw:** between-combat draw once the run pipeline supports it (in-combat curve already done).

### 3. Content

- **More Awakening 1 neutrals** (Auto-repair Continuous heal tick, Shield Resonance persistent, etc.) per `docs/neutral-cards.md` as mechanics exist.
- Optional: more `gain_core` cards beyond Core Rebirth tuning.

### 4. Tests

- Add/adjust cases when you ship the Core Sacrifice 0-core branch; keep deck duel harness aligned with new archetypes.

### 5. Docs / copy

- **Expose keyword glossary** (`KEYWORD_TYPE_HELP.Expose` in `keywordTagGlossary.ts`) still uses **“retaliate”** framing; confirm whether that matches final UX copy vs design doc wording.

### 6. Backlog

- `silicon-swarm-and-ranged-mechanics.md` — faction / ranged.

---

## Recently completed (keep brief — archive old bullets here)

- **2026:** **Gathering Strike** `neutral_gathering_strike_t1`–`t3` in `neutral/awakening0.json` — `UniqueDeck` + `bonusPerPriorStrikeThisCombat` on `StrikeDamage` (`strikeResolutionsThisCombat` on `FighterState`). Tests: `combat.behavior.test.ts`, `deckRules.test.ts`.
- **2026:** **Deck rules** — `validateDeckComposition` (`src/core/deckRules.ts`): max **3** copies per non-Unique id; **unlimited** neutral Basic Strike / Barrier ids; max **1** UniqueDeck **instance** in hand+deck combined; max **2** Continuous+Persistent instances.
- **2026:** **Expose Drone Uplink** — enemy Expose on Continuous tick (`auras.ts` + `resolver.ts`).
- **2026:** **Capitalising Strike t1** — consumes enemy Expose for bonus damage on the Strike (`effects/runner.ts`).
- **2026:** Card descriptions pipeline (`cardDescriptions.json` + `resolveCardDescription`), **Energy** tag, effect-only card body copy, Field Diode → **Junk Surge** naming pass.

---

## Reference: global systems (design vs code)


| Topic                       | Design                                                       | Code (current)                                                                                                        |
| --------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Charge                      | No max; higher cost ⇒ stronger tier effects                  | `charge_cost` + resolution in combat engine (`src/core/combat/`); no charge cap in rules.                             |
| Junk / bulk / refined scrap | Bulk stacks from keywords / card effects; stacks mitigate strikes | `Bulk` keyword, `gain_core` in JSON, `RunState` sandbox core for harness.                    |
| Fatigue                     | 2 deck wraps or 18 resolutions; then thermal                 | `COMBAT_RULES.fatigueDeckWrapThreshold` / `fatigueResolutionThreshold`, `armFatigueIfNeeded` / `applyFatigueIfArmed`. |
| Blank queue                 | Resolves as Basic Strike                                     | Empty queue → `neutral_basic_strike_t1` in `resolveFighter`.                                                          |
| Draw mix                    | 60/40 aw0; 40/30/30 aw≥1                                     | `CardContentService.drawWeighted` (run/shop; not mid-battle draw).                                                    |


---

## Reference: keywords


| Keyword           | Note                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Expose**        | Combat + glossary; opponent-armed value consumed when they damage you; Capitalising can consume **target** Expose on Strike. |
| **Overclock**     | Same-round next queued card; charges per combat — keep tests when changing scheduling.                                       |
| **Continuous**    | Junk + energy ticks; skip on repeat pass; Drone Uplink adds `enemyExposePerTick`.                                            |
| **Turbo Link**    | Spend bulk → junk; one bonus next resolution.                                                                                |
| **Pierce**        | Strike ignores block.                                                                                                        |
| **Factory Reset** | Queue + one deck id swap via `replaceOneDeckOccurrence`; `playEncounter` syncs run deck from combat.                         |


---

## Reference: neutral card inventory (high level)


| Area                                                           | Status                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Basic Strike / Barrier tiers                                   | **Match** JSON `neutral/awakening0.json`                                         |
| Servo / Overclock / Capacitor / Expose t1–t3                   | **Shipped**                                                                      |
| Multi-strike, Feint, Perpetual Motion, Urgent Repairs, Bulk Up | **Shipped**                                                                      |
| **Gathering Strike** t1–t3                                     | **Shipped** (`UniqueDeck` + strike-count bonus)                                  |
| **Awakening 1**                                                | Harassing / Siphoning t1–t3; Expose Drone Uplink t1–t2; Capitalising **t1** only |


---

## Reference: Scavenger “simplified vs plan” — status

Slag Coat, Junk Flare, Field Diode, Core Refactoring, Heap Shield, Core Tap, Core Sacrifice: **implemented** (see prior sections in git history or `effects.pipeline.test.ts`). Remaining gap called out in **Open work** (Core Sacrifice 0-core branch).

---

## Done (older neutral / content checklist)

- ~~Add Aw0 neutrals: Multi-strike, Feint, Perpetual Motion.~~
- ~~Neutral t2/t3 ladders for Servo, Overclock, Capacitor, Expose.~~
- ~~Initial Aw1 pool in `neutral/awakening1.json`.~~
- ~~Neutral effect steps: `GrantNextStrikePierce`, perpetual charge, `AdjustEnemyCharge`, `SelfDamageRespectFloor1`, `GrantIncomingStrikeMitigation`, `bonus_block_per_junk_every_n`.~~