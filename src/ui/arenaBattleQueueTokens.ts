/**
 * Tunable visuals for the battle arena queue: which card is "current" (cursor during playback).
 * Adjust hex colors / offsets here without hunting through Phaser paint code.
 */
export const ARENA_BATTLE_CURRENT_CARD = {
  /** Border stroke when this slot is the active queue cursor (darker blue than idle chrome). */
  strokePlayer: 0x1e3a8a,
  /** Border stroke when this slot is the active queue cursor (darker red than idle chrome). */
  strokeEnemy: 0x991b1b,
  /**
   * Phaser world Y delta while active (Y grows downward).
   * Negative nudges the player row card slightly up; positive nudges the enemy row slightly down.
   */
  offsetYPlayer: -6,
  offsetYEnemy: 6,
} as const;
