import type { Trait } from './types';

/**
 * Awakening is stored zero-indexed in game state but surfaced to the
 * player as 1-indexed.
 */
export function awakeningDisplay(internal: number): number {
  return internal + 1;
}

export const QUEUE_SIZE = 9;

export const GLINT_TRAITS: Trait[] = [
  {
    id: 'lucky-charm',
    name: 'Lucky Charm',
    unlockAt: 0,
    blurb: 'Once per combat, transform a drawn Scrap Picker into a random Tier 2 Junk card.',
  },
  {
    id: 'finders-keepers',
    name: "Finder's Keepers",
    unlockAt: 1,
    blurb: 'Whenever a single instruction grants you 5+ Junk, also gain 1 Charge.',
  },
  {
    id: 'fae-aegis',
    name: 'Fae Aegis',
    unlockAt: 2,
    blurb: 'At the start of each combat, gain 3 Shield and draw 1 additional card.',
  },
];
