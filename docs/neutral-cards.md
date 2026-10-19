# Neutral cards (design + data)

Neutrals are the **shared staple pool** (drafts, starters). Design language comes from:

`../../MetabotArena/docs/roguelike_theme_adaptation_9053d44b.plan.md` (Neutral staples + tier tables)

**Data paths**

- Awakening 0: `src/data/cards/neutral/awakening0.json`
- Awakening 1: `src/data/cards/neutral/awakening1.json` *(Harassing / Siphoning **t1–t3**, Expose Drone Uplink **t1–t2**, Capitalising Strike **t1** — see § Awakening 1 in-repo vs full design table)*

---

## Design rules (plan)

- **Hard rule for neutrals in the plan**: no junk / bulk / **core** in **card text** for this row set—only **charge**, **tags**, and neutral mechanics (Overclock, Expose, Potency). Strike/Shield still benefit from **global bulk-on-tag** and potency from rules.
- **Exception (intentional):** `neutral_scrap_pickup` and `neutral_scrap_dump` may print **Junk** (thin cross-faction injector / spend utility). No other neutrals should gain this exception without a design note.
- **Awakening tier** (`awakening_min`) is **spirit/run** pool gating; **card tier** (`card_tier` 1–3) is **same-name merge** in the salvage yard.

---

## Current prints (Robot Wars)


| Neutral         | Cost (current) | Effect (current)                             | Notes                                                        |
| --------------- | -------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Basic Strike    | 0              | Strike for 2 / 3 / 4                         | Fully implemented (`t1`/`t2`/`t3`) in data with merge chain. |
| Barrier         | 0              | Shield 3 / 5 / 7                             | Fully implemented (`t1`/`t2`/`t3`) in data with merge chain. |
| Servo Tune-Up   | 1              | +1/+1 potency (t1) → +2/+2 (t2) → +3/+3 (t3) | **t1–t3** in `awakening0.json` with merge chain.             |
| Overclock Burst | 2 / 2 / 1      | OC 1 / OC 2 / OC 2 (tiers 1–3)               | **t1–t3** in data.                                           |
| Capacitor Feed  | 0              | +2 / +3 / +4 charge (t1–t3)                  | **t1–t3** in data.                                           |
| Expose Wiring   | 0              | Expose 3 / 5 / 7                             | **t1–t3** in data.                                           |
| Urgent Repairs  | -1             | Heal 2 / 4 / 6                               | Fully implemented (`t1`/`t2`/`t3`) in data with merge chain. |
| Scrap Pickup    | 0              | +1 / +2 / +2 Junk                            | **Junk exception** — thin cross-faction injector.            |
| Scrap Dump      | 0              | Spend 2 Junk → +1 EN / +2 EN / +2 EN +1 pot  | **Junk exception** — small spend utility.                    |


---

## Tier ladders (target values)


| Neutral         | T1                                  | T2                                  | T3                                  | Impl status |
| --------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------- |
| Basic Strike    | cost 0, strike 2                    | cost 0, strike 3                    | cost 0, strike 4                    | Implemented |
| Barrier         | cost 0, shield 3                    | cost 0, shield 5                    | cost 0, shield 7                    | Implemented |
| Servo Tune-Up   | cost 1, +1 strike/+1 shield potency | cost 1, +2 strike/+2 shield potency | cost 1, +3 strike/+3 shield potency | Implemented |
| Overclock Burst | cost 2, Overclock 1                 | cost 2, Overclock 2                 | cost 1, Overclock 2                 | Implemented |
| Capacitor Feed  | cost 1, +2 charge                   | cost 1, +3 charge                   | cost 1, +4 charge                   | Implemented |
| Expose Wiring   | cost 1, Expose 3                    | cost 1, Expose 5                    | cost 1, Expose 7                    | Implemented |
| Urgent Repairs  | cost -1, heal 2                     | cost -1, heal 4                     | cost -1, heal 6                     | Implemented |
| Scrap Pickup    | cost 0, +1 Junk                     | cost 0, +2 Junk                     | cost 0, +2 Junk                     | Implemented (junk exception) |
| Scrap Dump      | spend 2 Junk → +1 charge            | spend 2 Junk → +2 charge            | spend 2 Junk → +2 charge +1 potency | Implemented (junk exception) |


**Robot Wars:** Basic Strike, Barrier, Urgent Repairs, Servo, Overclock, Capacitor, Expose, and the Scrap Pickup/Dump junk exception match tier ladders in `neutral/awakening0.json`. Awakening 1 pool started in `neutral/awakening1.json` (see § Planned Awakening 1 additions below).

---

## Planned Awakening 0 additions


| Card                 | Cost (target) | Proposed effect                                                                                                    | Notes                                             |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **Multi-strike**     | 1             | Two strike packets (`1 + 1` at t1, `2+2` t2, `3+3` t3). Counts as **2 Strikes** for effects like Gathering Strike. | **In data** (`neutral_multi_strike_t1`–`t3`).     |
| **Feint**            | 1             | Strike 3; your **next** Strike resolution gains Pierce (`GrantNextStrikePierce`).                                  | **In data** (`neutral_feint_t1`).                 |
| **Perpetual Motion** | 1/2/3         | Gain 1/2/3 charge at **round start** for the next **3** rounds (`GrantPerpetualRoundCharge`).                      | **In data** (`neutral_perpetual_motion_t1`–`t3`). |


---

## Blank queue slot (engine)

- Plan: empty slot resolves as **Neutral Basic Strike** profile: **2** damage, **Strike** tag, **0** charge, no junk from the default.
- Implemented in combat / UI as “basic strike” when queue slot is null—keep in sync with `neutral_basic_strike_t1` tuning.
- **Faction** cards that **transform** into **Basic Strike** (e.g. **Core Tap** → staple) should **target the same profile** for **damage / tag / charge** unless a card explicitly says otherwise.

---

## Awakening 1 neutrals (draft — future-facing)

**Purpose:** When **spirit awakening ≥1** unlocks a second **neutral** row, these prints should stay **generic** so **future factions** and **subthemes** can pick them without reading like **Scavengers** (or any one team).

### Design rules

- **Vocabulary:** prefer **charge**, **block**, **damage**, **keywords** (**Expose**, **Overclock**, **Pierce**, **Continuous** where neutral-appropriate), **potency** — not **junk**, **core**, **Scrap**, **Compress**, or **bulk** **on the card line** unless you deliberately add a **single** cross-faction exception later.
- **Role:** **curve**, **tempo**, **defensive** windows, **answer** cards — things **any** archetype might want a **copy** of.
- **Combat:** there is **no draw-into-hand** during a battle — design around the **ordered queue** and **deck** only (no neutral that assumes mid-fight **draw**).
- **Synergy:** neutrals should still **ride** **global** rules (e.g. bulk-on-tag, potency) so a **faction** deck **powers them up** without the **text** naming that faction.

### Proposed values (Awakening 1 candidates)


| Card idea                  | Cost  | Proposed effect                                                                                                                                | Notes                                                                                                                         |
| -------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Expose Drone Uplink**    | 1     | `Continuous 2`: at tick, apply `Expose 1` to enemy.                                                                                            | Neutral setup engine for Expose builds; keep value low because it is repeatable.                                              |
| **Harassing Strike**       | 1     | Strike 1, `Overclock 1`; does not consume Expose on this hit.                                                                                  | Tempo/poke tool. Needs an explicit “does not trigger Expose consume” rule hook if Expose is consumed on any damaging trigger. |
| **Capitalising Strike**    | 2     | Strike; consume all enemy Expose stacks, gain +3 damage per stack consumed for this hit.                                                       | Main Expose finisher; tune around max realistic Expose stack count.                                                           |
| **Auto-repair Subroutine** | 1/1/1 | `Continuous 4/3/2`; heal 3/4/6 on each tick.                                                                                                   | Sustain package; intended tier ladder for Aw1 neutral durability cards.                                                       |
| **Siphoning Strike**       | 2     | Strike 4; drain 1 charge (enemy -1, you +1); gain 4 block.                                                                                     | Hybrid tempo card; probably too efficient if cost drops below 2.                                                              |
| **Shield Resonance**       | 2     | Unique, Persistent: for the rest of battle, whenever you gain charge, gain equal block (unaffected by potency until t3) (`+0/+1/+1` +potency). | Requires a persistent-buff hook in combat state; high-snowball risk, so keep rare/costed.                                     |


**Shipped in data (awakening 0):** **Multi-strike**, **Feint**, **Perpetual Motion** (tiers per `neutral/awakening0.json`).

**Shipped in data (awakening 1):** **Harassing Strike** / **Siphoning Strike** (merge ladders t1–t3), **Expose Drone Uplink** (Continuous junk/charge ticks only; **Expose on tick to enemy** not implemented), **Capitalising Strike** (Pierce Strike for printed base damage; **consume enemy Expose for bonus** not implemented — see `cardText.ts` / in-game description).

**Backlog:** **Gathering Strike** — **UniqueDeck** + **strike-count payoff** hooks (engine TBD). Not in JSON until those systems exist.

---

## Iteration checklist

- Add missing neutral **tier 2/3** cards for Servo, Overclock, Capacitor, Expose, Urgent Repairs (per tables above).
- Add Aw0 neutrals: **Multi-strike**, **Feint**, **Perpetual Motion**.
- Keep **Gathering Strike** queued as an Aw0/Aw1-adjacent neutral with **UniqueDeck** once strike-count payoff support is ready.
- ~~Draft **awakening 1** neutral list + `neutral/awakening1.json` when ready.~~ **awakening1.json** populated (extend as mechanics land).
- Keep `cardText.ts` / glossary aligned with authored numbers.
- Re-read plan “Neutral staples” if balance shifts.