/**
 * Static opponent "ideal" lists and draft pools (plan §1, §1.5).
 * Per theme × band (normal|elite|boss) × enemy awakening 0|1.
 */

import type { CardDef } from '../types';

export type OpponentTheme =
  | 'gathering_strike'
  | 'expose'
  | 'junk_crown'
  | 'junk_aegis'
  | 'core_factory';

export type OpponentBand = 'normal' | 'elite' | 'boss';

export type OpponentCardRole = 'payoff' | 'setup' | 'filler' | 'engine' | 'junkSource' | 'junkSpender';

export interface OpponentPoolSlice {
  primary: string[];
  secondary: string[];
  dud: string[];
  /** Ids to pin as payoff tail in boss order (see enemyRoll). */
  payoffIds?: string[];
  /** Per-id role hints; defaults inferred from lists if missing. */
  cardRoleById?: Record<string, OpponentCardRole>;
}

export type OpponentDecksByAw = Record<0 | 1, OpponentPoolSlice>;
export type OpponentThemeTable = Record<OpponentTheme, Record<OpponentBand, OpponentDecksByAw>>;

const D: OpponentDecksByAw = {
  0: {
    primary: [
      'neutral_gathering_strike_t1',
      'neutral_multi_strike_t1',
      'needle_driver_t1',
      'neutral_servo_t1',
      'junk_loader_t1',
      'salvage_strike_t1',
    ],
    secondary: ['neutral_capacitor_feed_t1', 'neutral_basic_strike_t1'],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
    payoffIds: ['neutral_gathering_strike_t1', 'neutral_multi_strike_t1'],
  },
  1: {
    primary: [
      'neutral_gathering_strike_t1',
      'neutral_multi_strike_t1',
      'needle_driver_t1',
      'neutral_servo_t1',
      'junk_loader_t1',
      'salvage_strike_t1',
    ],
    secondary: ['neutral_capacitor_feed_t1', 'neutral_overclock_t1', 'neutral_basic_strike_t1'],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
    payoffIds: ['neutral_gathering_strike_t1', 'neutral_multi_strike_t1'],
  },
};

const A_NORMAL: OpponentDecksByAw = D;
const A_ELITE: OpponentDecksByAw = {
  0: {
    primary: [
      'neutral_gathering_strike_t2',
      'neutral_multi_strike_t2',
      'needle_driver_t2',
      'neutral_servo_t1',
      'junk_loader_t1',
      'salvage_strike_t1',
    ],
    secondary: ['neutral_overclock_t1', 'neutral_capacitor_feed_t1', 'neutral_basic_strike_t1'],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
    payoffIds: ['neutral_gathering_strike_t2', 'neutral_multi_strike_t2'],
  },
  1: {
    primary: [
      'neutral_gathering_strike_t2',
      'neutral_multi_strike_t2',
      'needle_driver_t2',
      'neutral_servo_t2',
      'junk_loader_t1',
      'salvage_strike_t1',
    ],
    secondary: ['neutral_overclock_t1', 'neutral_capacitor_feed_t1', 'neutral_basic_strike_t1'],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
    payoffIds: ['neutral_gathering_strike_t2', 'neutral_multi_strike_t2', 'neutral_perpetual_motion_t1'],
  },
};

const A_BOSS: OpponentDecksByAw = {
  0: A_ELITE[0],
  1: {
    primary: [
      'neutral_gathering_strike_t2',
      'neutral_multi_strike_t2',
      'neutral_multi_strike_t1',
      'needle_driver_t2',
      'neutral_servo_t2',
      'neutral_overclock_t1',
      'junk_loader_t1',
      'neutral_capacitor_feed_t1',
      'neutral_perpetual_motion_t1',
    ],
    secondary: ['gutter_offering_t1', 'field_diode_t1', 'neutral_basic_strike_t1'],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
    payoffIds: ['neutral_perpetual_motion_t1', 'neutral_overclock_t1', 'neutral_multi_strike_t2'],
  },
};

const B_BASE_AW0: OpponentPoolSlice = {
  primary: [
    'neutral_expose_wiring_t1',
    'neutral_multi_strike_t1',
    'field_diode_t1',
    'neutral_urgent_repairs_t1',
  ],
  secondary: ['neutral_feint_t1', 'neutral_capacitor_feed_t1', 'gutter_offering_t1', 'neutral_basic_strike_t1'],
  dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
  payoffIds: ['neutral_multi_strike_t1'],
};

const B_NORMAL: OpponentDecksByAw = {
  0: { ...B_BASE_AW0, primary: [...B_BASE_AW0.primary, 'neutral_basic_strike_t1', 'neutral_basic_strike_t1'] },
  1: {
    ...B_BASE_AW0,
    primary: [...B_BASE_AW0.primary, 'neutral_harassing_strike_t1', 'neutral_basic_strike_t1'],
    secondary: [...(B_BASE_AW0.secondary ?? []), 'neutral_harassing_strike_t1'],
  },
};

const B_ELITE: OpponentDecksByAw = {
  0: {
    primary: ['neutral_expose_wiring_t2', 'neutral_multi_strike_t2', 'field_diode_t1', 'neutral_urgent_repairs_t1'],
    secondary: ['neutral_multi_strike_t1', 'neutral_expose_wiring_t1', 'gutter_offering_t1', 'neutral_basic_strike_t1'],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
    payoffIds: ['neutral_expose_wiring_t2', 'neutral_multi_strike_t2'],
  },
  1: {
    primary: [
      'neutral_harassing_strike_t1',
      'neutral_expose_wiring_t2',
      'neutral_multi_strike_t2',
      'field_diode_t1',
    ],
    secondary: [
      'neutral_harassing_strike_t1',
      'neutral_expose_wiring_t1',
      'gutter_offering_t1',
      'neutral_capacitor_feed_t1',
      'neutral_basic_strike_t1',
    ],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
    payoffIds: ['neutral_overdrive_slam_t1', 'neutral_harassing_strike_t1'],
  },
};

const B_BOSS: OpponentDecksByAw = {
  0: B_ELITE[0],
  1: {
    primary: [
      'neutral_harassing_strike_t1',
      'neutral_expose_wiring_t2',
      'neutral_multi_strike_t2',
      'neutral_overdrive_slam_t1',
      'neutral_harassing_strike_t1',
      'neutral_expose_wiring_t1',
      'field_diode_t1',
      'gutter_offering_t1',
      'neutral_overclock_t1',
    ],
    secondary: ['neutral_expose_wiring_t1', 'gutter_offering_t1', 'field_diode_t1', 'neutral_capacitor_feed_t1'],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
    payoffIds: ['neutral_overdrive_slam_t1', 'neutral_harassing_strike_t1'],
  },
};

const C_NORMAL: OpponentDecksByAw = {
  0: {
    primary: [
      'junk_crown_t1',
      'junk_loader_t1',
      'gutter_offering_t1',
      'junk_recycle_t1',
      'salvage_strike_t1',
      'strip_mine_t1',
    ],
    secondary: ['field_diode_t1', 'neutral_basic_strike_t1', 'junk_ladder_t1'],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
    payoffIds: ['junk_crown_t1', 'strip_mine_t1'],
  },
  1: {
    primary: [
      'junk_crown_t1',
      'junk_loader_t1',
      'gutter_offering_t1',
      'junk_recycle_t1',
      'salvage_strike_t1',
      'strip_mine_t1',
    ],
    secondary: ['field_diode_t1', 'neutral_basic_strike_t1', 'junk_ladder_t1'],
    dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
  },
};

const C_ELITE_0: OpponentPoolSlice = {
  primary: [
    'junk_crown_t2',
    'junk_loader_t1',
    'junk_spigot_t1',
    'junk_recycle_t1',
    'strip_mine_t1',
    'salvage_strike_t1',
  ],
  secondary: [
    'junk_gasket_t1',
    'field_diode_t1',
    'gutter_offering_t1',
    'neutral_basic_strike_t1',
    'junk_ladder_t1',
  ],
  dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
};

const C_ELITE: OpponentDecksByAw = { 0: C_ELITE_0, 1: C_ELITE_0 };

const C_BOSS_0: OpponentPoolSlice = {
  primary: [
    'junk_crown_t2',
    'junk_spigot_t1',
    'junk_gasket_t1',
    'junk_loader_t1',
    'junk_recycle_t1',
    'strip_mine_t1',
    'gutter_offering_t1',
    'junk_ladder_t1',
    'field_diode_t1',
  ],
  secondary: ['gutter_offering_t1', 'field_diode_t1', 'neutral_basic_strike_t1'],
  dud: ['neutral_basic_strike_t1'],
};

const C_BOSS: OpponentDecksByAw = { 0: C_BOSS_0, 1: C_BOSS_0 };

const D_NORMAL_0: OpponentPoolSlice = {
  primary: [
    'junk_aegis_t1',
    'junk_loader_t1',
    'junk_gasket_t1',
    'gutter_offering_t1',
    'junk_recycle_t1',
  ],
  secondary: [
    'neutral_barrier_t1',
    'strip_mine_t1',
    'salvage_mantle_t1',
    'neutral_basic_strike_t1',
    'field_diode_t1',
  ],
  dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
};

const D_NORMAL: OpponentDecksByAw = { 0: D_NORMAL_0, 1: { ...D_NORMAL_0, primary: [...D_NORMAL_0.primary] } };

const D_ELITE_0: OpponentPoolSlice = {
  primary: ['junk_aegis_t2', 'junk_loader_t1', 'junk_gasket_t1', 'junk_ladder_t1', 'strip_mine_t1'],
  secondary: [
    'neutral_barrier_t1',
    'gutter_offering_t1',
    'field_diode_t1',
    'junk_recycle_t1',
    'neutral_basic_strike_t1',
  ],
  dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
};

const D_ELITE: OpponentDecksByAw = { 0: D_ELITE_0, 1: { ...D_ELITE_0, primary: [...D_ELITE_0.primary] } };

const D_BOSS_0: OpponentPoolSlice = {
  primary: [
    'junk_aegis_t2',
    'junk_spigot_t1',
    'junk_gasket_t1',
    'junk_loader_t1',
    'strip_mine_t1',
    'junk_ladder_t1',
    'gutter_offering_t1',
    'salvage_mantle_t1',
    'field_diode_t1',
  ],
  secondary: ['gutter_offering_t1', 'field_diode_t1', 'neutral_basic_strike_t1'],
  dud: ['neutral_basic_strike_t1'],
};

const D_BOSS: OpponentDecksByAw = { 0: D_BOSS_0, 1: { ...D_BOSS_0, primary: [...D_BOSS_0.primary] } };

const E_NORMAL_0: OpponentPoolSlice = {
  primary: [
    'core_refactoring_t1',
    'core_rebirth_t1',
    'core_tap_t1',
    'deep_core_tap_t1',
    'neutral_capacitor_feed_t1',
  ],
  secondary: ['neutral_barrier_t1', 'gutter_offering_t1', 'neutral_basic_strike_t1', 'field_diode_t1'],
  dud: ['neutral_basic_strike_t1', 'gutter_offering_t1', 'neutral_basic_strike_t1'],
};

const E_NORMAL: OpponentDecksByAw = { 0: E_NORMAL_0, 1: { ...E_NORMAL_0, primary: [...E_NORMAL_0.primary] } };

const E_ELITE_0: OpponentPoolSlice = {
  primary: [
    'core_rebirth_t2',
    'core_refactoring_t1',
    'core_tap_t1',
    'deep_core_tap_t1',
    'neutral_capacitor_feed_t1',
  ],
  secondary: [
    'sacrif_plate_t1',
    'neutral_urgent_repairs_t1',
    'gutter_offering_t1',
    'field_diode_t1',
    'neutral_basic_strike_t1',
  ],
  dud: ['neutral_basic_strike_t1', 'gutter_offering_t1'],
};

const E_ELITE: OpponentDecksByAw = { 0: E_ELITE_0, 1: { ...E_ELITE_0, primary: [...E_ELITE_0.primary] } };

const E_BOSS_0: OpponentPoolSlice = {
  primary: [
    'core_rebirth_t2',
    'core_refactoring_t2',
    'deep_core_tap_t1',
    'core_tap_t1',
    'neutral_urgent_repairs_t1',
    'neutral_capacitor_feed_t1',
    'gutter_offering_t1',
    'field_diode_t1',
    'neutral_multi_strike_t1',
  ],
  secondary: ['gutter_offering_t1', 'neutral_basic_strike_t1', 'sacrif_echo_t1', 'sacrif_rift_t1'],
  dud: ['neutral_basic_strike_t1'],
};

const E_BOSS: OpponentDecksByAw = { 0: E_BOSS_0, 1: { ...E_BOSS_0, primary: [...E_BOSS_0.primary] } };

/**
 * All opponent themes. Missing slots in a column are backfilled in enemyRoll; validation should still pass catalog.
 */
export const OPPONENT_THEME_TABLE: OpponentThemeTable = {
  gathering_strike: { normal: A_NORMAL, elite: A_ELITE, boss: A_BOSS },
  expose: { normal: B_NORMAL, elite: B_ELITE, boss: B_BOSS },
  junk_crown: { normal: C_NORMAL, elite: C_ELITE, boss: C_BOSS },
  junk_aegis: { normal: D_NORMAL, elite: D_ELITE, boss: D_BOSS },
  core_factory: { normal: E_NORMAL, elite: E_ELITE, boss: E_BOSS },
};

const ALL_THEMES: OpponentTheme[] = [
  'gathering_strike',
  'expose',
  'junk_crown',
  'junk_aegis',
  'core_factory',
];

export function getPoolSlice(
  theme: OpponentTheme,
  band: OpponentBand,
  aw: 0 | 1,
): OpponentPoolSlice {
  const t = OPPONENT_THEME_TABLE[theme][band][aw] ?? OPPONENT_THEME_TABLE[theme][band][0];
  return t;
}

export function rollOpponentTheme(rng: { nextInt(max: number): number }): OpponentTheme {
  return ALL_THEMES[rng.nextInt(ALL_THEMES.length)]!;
}

export function unionPoolIds(slice: OpponentPoolSlice): string[] {
  return [...new Set([...slice.primary, ...slice.secondary, ...slice.dud])];
}

/** In-combat boons for enemy (must map in {@link lifecycle.ts} `RELIC_TRAIT_MAP` or `RELIC_OPPONENT_EXTRA`). */
export const OPPONENT_ELITE_RELIC_POOL: string[] = [
  'charge_start_plus_2',
  'potency_start_plus_1',
  'if_no_shield_gain_shield_2',
  'regen_start_turn_1',
];

export const OPPONENT_BOSS_RELIC_POOL: string[] = [
  'charge_start_plus_2',
  'potency_start_plus_1',
  'if_no_shield_gain_shield_2',
  'regen_start_turn_1',
  'neutral_non_basic_gain_junk_2',
];

/** Player max-HP common relic id (see `RELIC_DEFS` `relic_max_hp_plus_3`). */
export const MAX_HP_COMMON_RELIC_ID = 'relic_max_hp_plus_3';

/**
 * When a drafted enemy line has `charge_cost > 0` cards but no 0-cost net-charge “battery” in the
 * program, {@link ensureOpponentBatteryInProgram} may inject one of these (if legal for Aw/faction).
 */
export const OPPONENT_BATTERY_FALLBACK_IDS: readonly string[] = [
  'neutral_capacitor_feed_t1',
  'neutral_capacitor_feed_t2',
  'field_diode_t1',
] as const;

/**
 * PvE / tutorial / odd cards excluded from `opponentPiles.coverage` (extend as needed).
 */
export const OPPONENT_POOL_COVER_EXCLUDE: string[] = [];

/**
 * @param allCards - optional filter for `isFreeEnergyGenerator` / catalog validation; uses charge_cost + gain_charge
 */
export function isFreeEnergyGeneratorInPool(card: CardDef): boolean {
  const hasCost = (card.charge_cost ?? 0) > 0;
  if (hasCost) return false;
  if ((card.gain_charge ?? 0) > 0) return true;
  if (card.optional_spend_junk_for_charge && (card.gain_charge ?? 0) >= 0) return true;
  return false;
}
