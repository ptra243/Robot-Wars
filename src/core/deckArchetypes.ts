/**
 * Curated 7-card queue lineups for the deck duel harness (`runDeckDuel`).
 * Order is **queue slot 0 → 6** (slots 7–8 stay empty → Neutral Basic Strike).
 *
 * ## Junk spend
 * Ramp junk with Loaders / Strikes / offerings, sustain (Junk Recycle), core bridge (Core Rebirth).
 *
 * ## Junk pile (threshold-style)
 * Stockpile junk; Junk Generator adds Continuous ticks; recycle and gutter for pile swings.
 *
 * ## Refined scrap (core)
 * Assumes **2** starting refined scrap (`sandboxPlayerCoreScrap` / duel `playerCoreScrap`).
 * Double big spenders (Core Tap, Deep Core Tap) plus charge and defense so the line can fire.
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
