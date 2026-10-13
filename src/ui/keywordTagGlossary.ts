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
  Virus:
    'This card is tagged Virus: applies or scales virus stacks (damage-over-time / debuff lane).',
  Evade:
    'This card is tagged Evade: grants evade stacks that negate incoming Strike packets.',
  Shuriken:
    'This card is tagged Shuriken: gains or spends shuriken stacks for projectile unload cards.',
  Stance:
    'This card is tagged Stance: stance-gated effects only activate when you are in the required stance.',
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
  Switch:
    'Sets your current stance. Stance-conditional effects only activate if you are currently in that required stance.',
  TurboLink:
    'Spends bulk stacks (at least 1, up to the keyword value, capped by your bulk) as junk, then bonus-resolves the next card in your queue when allowed.',
  Continuous:
    'While this queue slot keeps resolving, every N rounds (the keyword value) you gain +1 junk and +1 energy from this slot.',
  FactoryReset:
    'After this card resolves, destroy it: the program slot becomes empty and rematerializes as a blank (Neutral Basic Strike, or upgraded blanks from relics like Tempered Blanks / Multistrike Protocol).',
  UniqueDeck:
    'Deckbuilding only: at most one copy of any UniqueDeck card across your hand and fatigue deck (e.g. Gathering Strike).',
  Persistent:
    'Resolves once, then this program slot is skipped for the rest of the fight. Counts toward the Continuous/Persistent deck limit.',
  Prime:
    'Lines labeled Prime on the card activate when it resolves from a Prime program slot. Natural prime slots are 3, 5, and 7 (left to right). Pilots and relics can add more; Temporary Prime from card effects also counts.',
  Sequence:
    'Lines labeled Sequence are chain-gated: Sequence Start opens the chain, then Sequence 2/3/4/5 need the previous step from your last Clockwork resolution.',
  Faith:
    'Faith stacks boost damage on Prime-slot resolutions: each stack adds +1 to Strike and Direct packets resolved from a Prime slot. Card lines may also gain or spend Faith.',
  Virus:
    'Applies virus stacks to the target. Virus is a non-Strike debuff lane used by cyberpunk cards.',
  Evade:
    'Grants evade stacks. Each stack negates one incoming Strike packet before mitigation.',
  Shuriken:
    'Grants shuriken stacks. Unload cards can spend all shuriken for repeated direct hits.',
  Stance:
    'Marks stance-related card text and filtering for Four Symbols cards.',
};
