import type { CardDef } from '../core/types';

/**
 * Library / hand filter chips — map to tags, keyword types, or resource lines on cards.
 */
export type LibraryFilterId =
  | 'neutral'
  | 'scavenger'
  | 'cyberpunk'
  | 'clockwork'
  | 'strike'
  | 'shield'
  | 'expose'
  | 'overclock'
  | 'pierce'
  | 'continuous'
  | 'bulk'
  | 'junk'
  | 'potency'
  | 'factoryReset'
  | 'chargeGain'
  | 'chargeCost';

/** Order of chips in the deck builder UI. */
export const LIBRARY_FILTER_ORDER: LibraryFilterId[] = [
  'neutral',
  'scavenger',
  'cyberpunk',
  'clockwork',
  'strike',
  'shield',
  'expose',
  'overclock',
  'pierce',
  'continuous',
  'bulk',
  'junk',
  'potency',
  'factoryReset',
  'chargeGain',
  'chargeCost',
];

/** Faction chips (deck builder library toolbar — first group). */
export const LIBRARY_FACTION_IDS = ['neutral', 'scavenger', 'cyberpunk', 'clockwork'] as const;
export type LibraryFactionId = (typeof LIBRARY_FACTION_IDS)[number];
export type LibraryFactionFilter = null | LibraryFactionId;

/** Tag / mechanic chips — everything except faction ids (second group). */
export type LibraryTagFilterId = Exclude<
  LibraryFilterId,
  'neutral' | 'scavenger' | 'cyberpunk' | 'clockwork'
>;

export const LIBRARY_TAG_FILTER_ORDER: LibraryTagFilterId[] = [
  'strike',
  'shield',
  'expose',
  'overclock',
  'pierce',
  'continuous',
  'bulk',
  'junk',
  'potency',
  'factoryReset',
  'chargeGain',
  'chargeCost',
];

export type LibraryTagFilter = null | LibraryTagFilterId;

export const LIBRARY_FILTER_LABELS: Record<LibraryFilterId, string> = {
  neutral: 'Neutral',
  scavenger: 'Scavenger',
  cyberpunk: 'Cyberpunk Ninja',
  clockwork: 'Clockwork Collective',
  strike: 'Strike',
  shield: 'Shield',
  expose: 'Expose',
  overclock: 'Overclock',
  pierce: 'Pierce',
  continuous: 'Continuous / Persistent',
  bulk: 'Bulk',
  junk: 'Junk',
  potency: 'Potency',
  factoryReset: 'Factory Reset',
  chargeGain: '+Energy',
  chargeCost: 'Costs EN',
};

export function cardMatchesLibraryFilter(card: CardDef, filter: LibraryFilterId): boolean {
  switch (filter) {
    case 'neutral':
      return card.neutral === true;
    case 'scavenger':
      return card.neutral === false && card.faction === 'scavengers';
    case 'cyberpunk':
      return card.neutral === false && card.faction === 'cyberpunk';
    case 'clockwork':
      return card.neutral === false && card.faction === 'clockwork';
    case 'strike':
      return card.tags.includes('Strike');
    case 'shield':
      return card.tags.includes('Shield');
    case 'expose':
      return card.tags.includes('Expose') || card.keywords.some((k) => k.type === 'Expose');
    case 'overclock':
      return card.keywords.some((k) => k.type === 'Overclock');
    case 'pierce':
      return card.keywords.some((k) => k.type === 'Pierce');
    case 'continuous':
      return card.keywords.some((k) => k.type === 'Continuous' || k.type === 'Persistent');
    case 'bulk':
      return (
        card.tags.includes('Bulk') ||
        card.keywords.some((k) => k.type === 'Bulk' || k.type === 'TurboLink')
      );
    case 'junk':
      return (
        card.tags.includes('Junk') || (card.gain_junk ?? 0) > 0 || (card.spend_junk ?? 0) > 0
      );
    case 'potency':
      return (
        card.tags.includes('Potency') ||
        (card.strike_potency_gain ?? 0) > 0 ||
        (card.shield_potency_gain ?? 0) > 0
      );
    case 'factoryReset':
      return card.keywords.some((k) => k.type === 'FactoryReset');
    case 'chargeGain':
      return (
        card.tags.includes('Energy') ||
        (card.gain_charge ?? 0) > 0 ||
        (card.optional_spend_junk_for_charge != null &&
          (card.optional_spend_junk_for_charge.gainCharge ?? 0) > 0) ||
        card.keywords.some((k) => k.type === 'Continuous')
      );
    case 'chargeCost':
      return (card.charge_cost ?? 0) > 0 || card.charge_cost_if_core_gte != null;
  }
}

/** Deck builder: apply faction filter AND tag filter (each dimension optional). */
export function cardMatchesLibraryFilters(
  card: CardDef,
  faction: LibraryFactionFilter,
  tag: LibraryTagFilter,
): boolean {
  if (faction !== null && !cardMatchesLibraryFilter(card, faction)) {
    return false;
  }
  if (tag !== null && !cardMatchesLibraryFilter(card, tag)) {
    return false;
  }
  return true;
}
