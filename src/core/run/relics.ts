import { SeededRandom } from '../content';
import type { RunState } from '../types';

export type RelicRarity = 'common' | 'uncommon' | 'epic';
export type RelicSource = 'event' | 'shop' | 'elite' | 'boss';

export interface RelicDef {
  id: string;
  name: string;
  rarity: RelicRarity;
  sources: RelicSource[];
  faction?: string;
  stackable?: boolean;
  /** Optional immediate run-state side effects on acquisition (e.g. placeholder trait grants). */
  onAcquire?: (run: RunState) => void;
}

export const RELIC_DEFS: RelicDef[] = [
  {
    id: 'potency_start_plus_1',
    name: 'Cracked Potency Coil',
    rarity: 'common',
    sources: ['event', 'shop'],
    stackable: true,
  },
  {
    id: 'charge_start_plus_2',
    name: 'Aux Battery Pack',
    rarity: 'common',
    sources: ['event', 'shop'],
    stackable: true,
  },
  {
    id: 'if_no_shield_gain_shield_2',
    name: 'Reactive Plating',
    rarity: 'common',
    sources: ['event', 'shop'],
    stackable: true,
  },
  {
    id: 'regen_start_turn_1',
    name: 'Repair Nanites',
    rarity: 'common',
    sources: ['event', 'shop'],
    stackable: true,
  },
  {
    id: 'relic_max_hp_plus_3',
    name: 'Reinforced Plating',
    rarity: 'common',
    sources: ['event', 'shop'],
    stackable: true,
    onAcquire: (run) => {
      run.loop.playerHpMax += 3;
      run.loop.playerHp = Math.min(run.loop.playerHp + 3, run.loop.playerHpMax);
    },
  },
  {
    id: 'neutral_non_basic_gain_junk_2',
    name: 'Scrap Condenser',
    rarity: 'common',
    sources: ['event', 'shop'],
    stackable: true,
  },
  {
    id: 'hp_pay_damage_equal',
    name: 'Berserker Instincts',
    rarity: 'uncommon',
    sources: ['elite'],
    faction: 'scavengers',
  },
  {
    id: 'transform_strike_2',
    name: 'Hot-Swap Injector',
    rarity: 'uncommon',
    sources: ['elite'],
    faction: 'scavengers',
  },
  {
    id: 'trash_dynamo',
    name: 'Trash Dynamo',
    rarity: 'uncommon',
    sources: ['elite'],
    faction: 'scavengers',
  },
  {
    id: 'scrap_recycling',
    name: 'Scrap Recycling',
    rarity: 'uncommon',
    sources: ['elite'],
    faction: 'scavengers',
  },
  {
    id: 'junk_shrapnel',
    name: 'Junk Shrapnel',
    rarity: 'uncommon',
    sources: ['elite'],
    faction: 'scavengers',
  },
  {
    id: 'stall_shield_weaken',
    name: 'Shock Buffer',
    rarity: 'uncommon',
    sources: ['elite'],
  },
  {
    id: 'delay_double_cast',
    name: 'Chrono Fork',
    rarity: 'uncommon',
    sources: ['elite'],
  },
  {
    id: 'epic_lucky_circuit',
    name: 'Lucky Circuit',
    rarity: 'epic',
    sources: ['boss'],
    onAcquire: (run) => {
      if (!run.loop.playerTraitIds.includes('glint_aw1')) {
        run.loop.playerTraitIds.push('glint_aw1');
      }
    },
  },
  {
    id: 'epic_whole_hog_treasury',
    name: 'Whole Hog Treasury',
    rarity: 'epic',
    sources: ['boss'],
    onAcquire: (run) => {
      if (!run.loop.playerTraitIds.includes('baron_aw1')) {
        run.loop.playerTraitIds.push('baron_aw1');
      }
    },
  },
  {
    id: 'epic_gunslingers_flourish',
    name: "Gunslinger's Flourish",
    rarity: 'epic',
    sources: ['boss'],
    onAcquire: (run) => {
      if (!run.loop.playerTraitIds.includes('rust_ranger_aw0')) {
        run.loop.playerTraitIds.push('rust_ranger_aw0');
      }
      if (!run.loop.playerTraitIds.includes('rust_ranger_aw1')) {
        run.loop.playerTraitIds.push('rust_ranger_aw1');
      }
    },
  },
  {
    id: 'epic_prime_directive',
    name: 'Prime Directive',
    rarity: 'epic',
    sources: ['boss'],
  },
  {
    id: 'epic_overclock_mandate',
    name: 'Overclock Mandate',
    rarity: 'epic',
    sources: ['boss'],
  },
  {
    id: 'epic_basic_instincts',
    name: 'Basic Instincts',
    rarity: 'epic',
    sources: ['boss'],
  },
  {
    id: 'epic_emergency_junk_shield',
    name: 'Emergency Junk Shield',
    rarity: 'epic',
    sources: ['boss'],
  },
];

const RELICS_BY_ID = new Map(RELIC_DEFS.map((relic) => [relic.id, relic]));

export function getRelicDef(id: string): RelicDef | undefined {
  return RELICS_BY_ID.get(id);
}

export function listRelicsForSource(source: RelicSource, run: RunState): RelicDef[] {
  return RELIC_DEFS.filter((relic) => {
    if (!relic.sources.includes(source)) return false;
    if (relic.faction && relic.faction !== run.faction) return false;
    if (!relic.stackable && run.loop.relicIds.includes(relic.id)) return false;
    return true;
  });
}

export function rollRelicForSource(run: RunState, source: RelicSource, seed: number): RelicDef | null {
  const pool = listRelicsForSource(source, run);
  if (pool.length === 0) return null;
  const rng = new SeededRandom(seed);
  return pool[rng.nextInt(pool.length)] ?? null;
}

export function grantRelic(run: RunState, relicId: string): boolean {
  const relic = getRelicDef(relicId);
  if (!relic) return false;
  if (!relic.stackable && run.loop.relicIds.includes(relic.id)) return false;
  run.loop.relicIds.push(relic.id);
  relic.onAcquire?.(run);
  return true;
}

export function getRelicDescription(id: string): string {
  if (id === 'potency_start_plus_1') return 'Begin each battle with +1 potency.';
  if (id === 'charge_start_plus_2') return 'Begin each battle with +2 energy.';
  if (id === 'if_no_shield_gain_shield_2') return 'Turn start: if you have no shield, gain 2 shield.';
  if (id === 'regen_start_turn_1') return 'Turn start: recover 1 HP.';
  if (id === 'neutral_non_basic_gain_junk_2')
    return 'When you play a neutral non-basic strike card, gain 2 junk.';
  if (id === 'hp_pay_damage_equal') return 'When you pay HP for a card, deal that much damage.';
  if (id === 'transform_strike_2') return 'Whenever you transform a card, Strike 2.';
  if (id === 'trash_dynamo') return 'If you gained energy from a card, gain 2 junk.';
  if (id === 'scrap_recycling') return 'When you gain junk, recover HP (capped per card).';
  if (id === 'junk_shrapnel') return 'When you spend junk, deal that much damage.';
  if (id === 'stall_shield_weaken') return 'When you stall, gain 2 shield and apply 2 weaken.';
  if (id === 'delay_double_cast') return 'Delay cards also trigger an immediate bonus effect.';
  if (id === 'epic_lucky_circuit') return 'Gain Glint Aw1 trait behavior for the run.';
  if (id === 'epic_whole_hog_treasury') return 'Gain Baron Aw1 trait behavior for the run.';
  if (id === 'epic_gunslingers_flourish')
    return "Gain Rust Ranger Aw0 + Aw1 trait behavior for the run.";
  if (id === 'epic_prime_directive')
    return 'On deck cycle, gain potency from HP+junk and enter Emergency Protocol mode this turn.';
  if (id === 'epic_overclock_mandate')
    return 'Cards with junk-threshold lines also gain >40 junk: Overclock.';
  if (id === 'epic_basic_instincts')
    return 'If your deck is all neutral, basic strikes gain Overclock.';
  if (id === 'epic_emergency_junk_shield')
    return 'Incoming damage is absorbed by junk first; non-strike damage is extra effective.';
  return id;
}
