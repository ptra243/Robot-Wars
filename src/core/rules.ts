/**
 * Global combat constants aligned with `docs/TODO/implementation-vs-design.md` → **Global systems**.
 *
 * - **Charge:** no max; higher-cost cards are stronger at tier (enforced in card data + balance).
 * - **Fatigue (thermal):** arms at the **end** of combat round `fatigueArmAfterCombatRounds` (inclusive),
 *   when `roundIndex` reaches that value (see `CombatSimulator` loop).
 * - **Bulk keyword:** grants **bulk stacks** only (no potency by itself). Each stack reduces **incoming strike
 *   damage** to HP by 1 (consumed when mitigating).
 * - **Blank queue slot:** At combat start, empty planned slots are stored as `blankCardIdForTraits` (usually
 *   `neutral_basic_strike_t1`; Tempered Blanks / Multistrike Protocol upgrade). Factory Reset destroys the card and
 *   rematerializes the same blank. Resolve still substitutes that blank id if a slot is ever null.
 * - **Draw mix (run/shop):** `CardContentService.drawWeighted` — not mid-battle draw.
 */
export const COMBAT_RULES = {
  queueSize: 9,
  /** Empty deck-builder / planning slots are written as this id when a fight begins. */
  blankQueueSlotCardId: 'neutral_basic_strike_t1',
  startingHp: 40,
  /** Thermal runaway arms when `roundIndex >=` this (see `armFatigueIfNeeded`). */
  fatigueArmAfterCombatRounds: 20,
  fatigueBaseDamage: 1,
  fatigueStepDamage: 1,
  maxRounds: 24,
  maxStallsPerSlot: 3,
  /** Junk gained by each fighter at the start of every combat round (0 = disabled for now). */
  roundStartJunkDrip: 0,
  /**
   * At each round start (before round junk drip), each fighter's Shield (block) is multiplied by this
   * factor — i.e. default **50% of current shield decays** (retain 0.5). Some cards raise retention (e.g. 0.75 = 25% decay).
   */
  shieldBlockRetainAtRoundStartDefault: 0.5,
  /** Max bulk stack count (global cap in sim). */
  maxBulkStacks: 3,
  /** Hard guardrail to prevent aura-trigger chains from looping within one card resolution. */
  maxTriggeredAuraResolutionsPerCard: 8,
  /** Cap for Expose stacks stored on a fighter. */
  maxExposeArm: 30,
} as const;

export type PotencyOrder = 'OffensivePotencyBeforeStrikeBody';
export type FatigueDamageType = 'Unblockable' | 'PierceLike';
export type StallRetryTiming = 'SameSlotNextPass';
export type QueueEdgeBehavior = 'Fizzle';

export const RULE_LOCKS = {
  potencyOrder: 'OffensivePotencyBeforeStrikeBody' satisfies PotencyOrder,
  fatigueDamageType: 'Unblockable' satisfies FatigueDamageType,
  stallRetryTiming: 'SameSlotNextPass' satisfies StallRetryTiming,
  queueEdgeBehavior: 'Fizzle' satisfies QueueEdgeBehavior,
} as const;
