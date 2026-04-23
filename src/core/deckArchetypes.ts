/**
 * Curated 7-card queue lineups for the deck duel harness (`runDeckDuel`).
 * Order is **queue slot 0 → 6** (slots 7–8 stay empty → Neutral Basic Strike).
 *
 * ## Junk spend
 * Ramp junk with Loaders / Strikes / offerings, sustain (Junk Recycle), core bridge (Core Rebirth).
 *
 * ## Junk cycle aggro
 * Gains and spends junk every few cards (Junk Surge option, Gutter into Junk Recycle) without relying on
 * `Junk ≥ N` printed thresholds; Servo/Needle finish once charge is up.
 *
 * ## Junk pile (threshold-style)
 * Stockpile junk; Junk Generator adds Continuous ticks; recycle and gutter for pile swings.
 *
 * ## HP / sacrifice (core, no refined-scrap stockpile)
 * Plays on **0** starting refined scrap: life, factory, graft, echo, and Emergency Protocol buffers.
 * See `hpSacGraftAw0` / `hpSacGraftAw1` for queue smoke lineups.
 *
 * ## Refined scrap (legacy harness name)
 * Kept for deck-duel permutations; **0** starting refined scrap matches the current core cards (no `SpendCore` on the retool line).
 *
 * ## Bulk / potency / strikes / shields
 * Servo Tune-Up for potency, Junk Loader for fuel, Needle Driver for strikes, Salvage Mantle for defense.
 */
export const ARCHETYPE_DECKS = {
  junkSpend: [
    'junk_loader_t1',
    'salvage_strike_t1',
    'gutter_offering_t1',
    'core_rebirth_t1',
    'strip_mine_t1',
    'junk_recycle_t1',
    'salvage_mantle_t1',
  ],
  junkCycleAggro: [
    'junk_loader_t1',
    'field_diode_t1',
    'salvage_strike_t1',
    'gutter_offering_t1',
    'junk_recycle_t1',
    'neutral_servo_t1',
    'needle_driver_t1',
  ],
  junkPileThreshold: [
    'junk_spigot_t1',
    'junk_gasket_t1',
    'junk_generator_t1',
    'junk_loader_t1',
    'junk_ladder_t1',
    'gutter_offering_t1',
    'junk_crown_t1',
    'junk_aegis_t1',
  ],
  refinedScrapCore: [
    'core_tap_t1',
    'deep_core_tap_t1',
    'neutral_capacitor_feed_t1',
    'field_diode_t1',
    'neutral_barrier_t1',
    'neutral_basic_strike_t1',
    'salvage_mantle_t1',
  ],
  hpSacGraftAw0: [
    'sacrif_lumen_t1',
    'sacrif_spike_t1',
    'sacrif_plate_t1',
    'sacrif_tether_t1',
    'core_refactoring_t1',
    'core_tap_t1',
    'neutral_basic_strike_t1',
  ],
  hpSacGraftAw1: [
    'sacrif_echo_t1',
    'sacrif_cinder_t1',
    'sacrif_forge_t1',
    'sacrif_suture_t1',
    'sacrif_rift_t1',
    'deep_core_tap_t1',
    'core_rebirth_t1',
  ],
  bulkPotencyStrikesShields: [
    'junk_loader_t1',
    'neutral_servo_t1',
    'needle_driver_t1',
    'salvage_mantle_t1',
    'salvage_strike_t1',
    'junk_recycle_t1',
    'gutter_offering_t1',
  ],
} as const;

export type ArchetypeDeckKey = keyof typeof ARCHETYPE_DECKS;
