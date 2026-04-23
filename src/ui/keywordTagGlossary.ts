import type { CardTag, KeywordType } from '../core/types';

/** Short explanations for card tags (Strike / Shield). */
export const CARD_TAG_HELP: Record<CardTag, string> = {
  Strike:
    'This card is a Strike: base damage plus your potency (potency is not spent when you Strike).',
  Shield:
    'This card is a Shield: it grants block. Shield absorbs incoming damage before your HP—only damage that gets through hits health.',
  Direct:
    'Direct damage is not a Strike: only base damage (plus Pierce from keywords if any). Potency is not added to this hit’s damage, but you can still gain potency from the same card for later Strikes and Shields.',
  Junk:
    'This card is tagged Junk: it gains or spends junk (filter chip; see card lines for amounts).',
  Bulk:
    'This card is tagged Bulk: interacts with bulk stacks or bulk economy (filter chip; may also have Bulk or TurboLink keywords).',
  Potency:
    'Potency: grants extra damage when you use a Strike skill, and extra block when you use a Shield skill (see card lines for amounts).',
  Energy:
    'This card is tagged Energy: it adds energy when played (or on each tick from Continuous, if applicable).',
  Expose:
    'This card is tagged Expose: supports or cares about the Expose rules space (filter chip; see card text for what it actually does).',
};

/** Rules text for keyword types (value is shown separately on the card). */
export const KEYWORD_TYPE_HELP: Record<KeywordType, string> = {
  CoreParts:
    'Tags a core-parts card (filter chip). Core Rebirth (and similar graft) upgrades the next Neutral Basic Strike(s) in queue order into one of these at the same tier.',
  Bulk:
    'Grants bulk stacks. Each stack reduces incoming strike damage to HP by 1 (consumed when mitigating).',
  Pierce:
    'This card\'s damage ignores block and is applied directly to HP.',
  Expose:
    'Applies Expose to the target equal to the keyword value. The next Strike that hits that target gains that much damage, then Expose clears.',
  Overclock:
    'When the value is positive, bonus-resolves the next card in your queue at most once per your turn; the first successful Overclock that turn “uses” the bonus. Overclock carriers are usually 0 energy cost.',
  TurboLink:
    'Spends bulk stacks (at least 1, up to the keyword value, capped by your bulk) as junk, then bonus-resolves the next card in your queue when allowed.',
  Continuous:
    'While this queue slot keeps resolving, every N rounds (the keyword value) you gain +1 junk and +1 energy from this slot.',
  FactoryReset:
    'After this card resolves, this deck entry becomes a Neutral Basic Strike at the printed tier (queue slot updates).',
  UniqueDeck:
    'Deckbuilding only: at most one copy of any UniqueDeck card across your hand and fatigue deck (e.g. Gathering Strike).',
  Persistent:
    'Marks rest-of-battle effects when the card’s rules say so. Counts toward the max Continuous/Persistent cards per deck.',
};
