# Scavenger cards (design + data)

**Faction:** `scavengers` in card JSON. Pool split by `awakening_min` (0 = run-start pool, 1 = first spirit milestone).

**Data paths**

- Awakening 0: `src/data/cards/scavengers/awakening0.json`
- Awakening 1: `src/data/cards/scavengers/awakening1.json`

**Junk threshold pillar:** Eight printed-threshold cards (`junk_spigot`, `junk_bulwark`, `junk_ladder`, `junk_gasket`, `junk_coil`, `junk_aegis`, `junk_rivet`, `junk_crown`) — see `docs/junk-threshold-design-ideas.md`. They gate on junk held; they do **not** use `SpendJunk` as a card cost.

---

## Design identity

Open-ended starter faction. Lanes (not pilot locks):

| Lane | Fantasy |
|------|---------|
| **Hoard** | Tall junk pile; thresholds + charge dumps (Coil/Crown) |
| **Spend** | Junk buys **engines** (Dividend, Dynamo, Refinance, Transfusion) — not burst damage |
| **Graft** | Pay HP for payoff **+ shield rider** (≤ HP paid); self-damage bypasses shield |
| **Factory Reset** | Parallel cycle-1 bomb lane → Basics |
| **Scrap Hound** | Convert Scrap Engines into a pet (attack turret / auto-shield); tick = stacks + potency |

**Scrap Hound convert:** Hoard/Spend prints pay **junk** to convert up to **1 / 2 / 3** engines (t1–t3) into attack / shield / energy / expose. FR prints convert at the same caps with **no junk cost** (HP + FR + EP is the tax). HUD icons: `/icons/scrap-engine.jpg`, `scrap-hound-attack.jpg`, `scrap-hound-shield.jpg`; battle companion: `/poc/poc-scrap-hound-idle.jpg`, `poc-scrap-hound-attack.jpg`.

**Run loop:** after each **won** fight, gain **+1 card reroll** (`applyPostCombatRewards`).

---

## Keep / cut sheet (card rework)

### Awakening 0 — keep

| Base id | Role |
|---------|------|
| `junk_spigot` / `junk_loader` / `field_diode` | Light injectors |
| `salvage_strike` | Hoard payload |
| `junk_ladder` / `junk_bulwark` / `junk_gasket` / `junk_coil` / `junk_aegis` / `junk_rivet` / `junk_crown` | Threshold Hoard spine (Coil/Crown = dumps) |
| `strip_mine` | Utility SpendJunk |
| `core_tap` / `core_refactoring` | FR bombs (burst / Overclock+engine) |
| `gutter_offering` | Graft fuel (+ shield rider) |
| `graft_lancet` (Rust Lancet) | Graft mid poke (+ shield rider) |
| `sacrif_rift` (Glass Rift) | Graft hit (+ shield rider) |
| `sacrif_plate` (**Plated Cut**) | High-shield graft specialty — FR removed |
| `heap_ballast` | Hoard softens **incoming** dmg (**demoted**) |
| `scrap_anesthetic` | Graft self-dmg → Shield (**demoted**) |
| `scrap_dividend` | Spend → Persistent Strikes +junk (**demoted** so Spend starts early) |
| `scrap_dynamo` | Spend → first card of cycle +charge (**demoted**) |
| `heap_padding` | Hoard softens Graft self-dmg (**demoted**) |
| `chassis_refinance` | Scrap Engine always; optional junk spend → +max HP + 1:1 heal (**demoted**) |
| `junk_coil` / `junk_crown` | Hoard dumps (**demoted**) |
| `junk_gasket` / `junk_rivet` | Hoard density (**demoted**) |

### Awakening 0 — cut

`sacrif_lumen`, `sacrif_spike`, `sacrif_probe`, `sacrif_tether`

### Awakening 1 — bridges / sharper tools (UI “AWAKENING 2”)

| Base id | Role |
|---------|------|
| `junk_generator` / `junk_recycle` | Pile Continuous / recycle |
| `junk_aegis` | Tall-pile shield→damage |
| `needle_driver` | Pierce spend finisher |
| `salvage_mantle` | Junk-scaling shield |
| `deep_core_tap` (Core Sacrifice) | FR strike bomb |
| `core_rebirth` | FR + Scrap Engine + replace Basics with CoreParts |
| `sacrif_echo` (Corebleed Oath) | FR + Scrap Engine + mirror Persistent |
| `dynamo_peal` | Damage per Scrap Engine |
| `scrap_transfusion` | Spend → heal (rare recovery) |
| `blood_to_scrap` | Graft→Hoard Persistent bridge |
| `anemic_dividend` | Missing-HP Strikes +junk |
| `hollow_frame` | Stronger while wounded |
| `graft_bonesaw` (Bone Saw) | Graft Strike (+ shield rider) |
| `graft_spark_vein` (Spark Vein) | Graft → Energy / Overclock |
| `graft_redline` (Redline Fuse) | High-risk Graft direct finisher |
| `scrap_hound_rifle` / `scrap_hound_bulwark` | Convert engines → attack / shield hound |
| `scrap_dynamo_feed` / `scrap_paint_marker` | Convert engines → energy / expose |
| `fr_hound_rifle` / `fr_hound_bulwark` | FR convert → attack / shield (no junk) |
| `fr_dynamo_feed` / `fr_paint_marker` | FR convert → energy / expose (no junk) |
| `hot_swap` | FR bomb with shield rider |
| `heap_battery` | Continuous +charge while junk ≥ 6 |

### Awakening 1 — cut

`sacrif_cinder`, `sacrif_forge`, `sacrif_suture`

---

## Graft → shield (locked)

Graft packages grant **Shield ≤ HP paid**. Self-damage still goes straight to HP (bypasses block). Default shield decays ~50% each round.

---

## EffectStep behaviors (tests)

Composable verbs live in `src/core/effects/runner/handlers.ts` and are covered by `src/test/effectStepBehaviors.test.ts`:

- `SelfDamage` / `SelfDamageRespectFloor1`, `GainJunk`, `ShieldBlock`, `HealSelf`
- `GainMaxHp` (Refinance)
- `SetBloodToScrapJunkPerSelfDamage`, `SetHeapPadding`, `SetHeapBallast`, `SetScrapAnesthetic`
- `ConvertScrapEngines`
- `SetStrikeResolveBonusJunk`, `SetStrikeResolveBonusJunkIfHpFractionAtMost`
- `SetFirstCardOfCycleBonusCharge`, `GainScrapEngine`, `DirectHpDamagePerScrapEngine`
- `BranchIfMissingHpGte` (Hollow Frame)

---

## Factory Reset note

`TransformCurrentQueueSlot` with `matchNeutralBasicTierToResolvingCard` **clears** the slot and rematerializes a blank (`blankCardIdForTraits`, usually Neutral Basic Strike t1). It does **not** preserve print tier on the blank.

---

## Iteration checklist

- [x] Aw0 Graft ladder (Gutter, Glass Rift, Plated Cut) + shield riders
- [x] Cut sacrif twins
- [x] Aw1 Spend/Graft glue cards
- [x] EffectStep behavior tests
- [x] +1 reroll after won fight
- [ ] Playtest kill-pace vs 50/100 Basics
- [x] Heap Ballast / Scrap Anesthetic
- [x] Graft playable payloads (Lancet, Bone Saw, Spark Vein, Redline)
- [x] Scrap Engine converts + typed turn ticks
- [x] Neutral junk exception (Scrap Pickup / Dump)
- [x] Scrap Hound battle companion sprites
- [ ] Slot bays (deferred)
