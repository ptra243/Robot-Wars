import type { CardDef } from '../core/types';
import type { BuildCardDescriptionOptions } from './cardText';
import { buildCardDescription } from './cardText';
import cardDescriptionsData from '../data/cardDescriptions.json';

export interface CardDescriptionEntry {
  /** Full body when tag/keyword lines are printed in the description (glossary hidden). */
  full: string;
  /** Body when tag summary and long keyword lines are omitted (glossary visible). */
  compact: string;
}

export interface CardDescriptionsFile {
  schemaVersion: number;
  byCardId: Record<string, CardDescriptionEntry>;
}

const data = cardDescriptionsData as CardDescriptionsFile;

export function resolveCardDescription(
  card: CardDef,
  options?: BuildCardDescriptionOptions,
): string {
  const entry = data.byCardId[card.id];
  if (entry) {
    return options?.omitTagsAndKeywords ? entry.compact : entry.full;
  }
  return buildCardDescription(card, options);
}
