import { Fragment, type ReactNode } from 'react';
import type { CardTag, KeywordType } from '../core/types';
import { CARD_TAG_HELP, KEYWORD_TYPE_HELP } from '../ui/keywordTagGlossary';

/** Multi-word phrases bolded in rules text (must stay in sync with `PHRASE_TERMS`). */
const PHRASE_HELP: Record<string, string> = {
  'Factory Reset': KEYWORD_TYPE_HELP.FactoryReset,
  'Refined Scrap':
    'Refined scrap (core scrap): a combat resource some cards spend or gain — not junk.',
};

function tooltipForHighlightedTerm(part: string): string | undefined {
  const phrase = PHRASE_HELP[part];
  if (phrase) {
    return phrase;
  }
  if (Object.prototype.hasOwnProperty.call(KEYWORD_TYPE_HELP, part)) {
    return KEYWORD_TYPE_HELP[part as KeywordType];
  }
  if (Object.prototype.hasOwnProperty.call(CARD_TAG_HELP, part)) {
    return CARD_TAG_HELP[part as CardTag];
  }
  return undefined;
}

/** Match longest names first so e.g. TurboLink wins over embedded substrings. */
const KEYWORD_TYPES: KeywordType[] = [
  'FactoryReset',
  'Continuous',
  'TurboLink',
  'Overclock',
  'CoreParts',
  'Expose',
  'Pierce',
  'Bulk',
];

const TAG_TYPES: CardTag[] = ['Strike', 'Shield', 'Direct', 'Junk', 'Bulk', 'Potency', 'Energy', 'Expose'];

/** Multi-word game terms (matched before single tokens). */
const PHRASE_TERMS: string[] = ['Factory Reset', 'Refined Scrap'];

const ALL_BOLD_PARTS = [...PHRASE_TERMS, ...KEYWORD_TYPES, ...TAG_TYPES].sort(
  (a, b) => b.length - a.length,
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TERM_PATTERN = new RegExp(`(${ALL_BOLD_PARTS.map(escapeRegex).join('|')})`, 'g');

const TERM_SET = new Set<string>(ALL_BOLD_PARTS);

function renderBoldLine(line: string, keyPrefix: string): ReactNode {
  const parts = line.split(TERM_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        TERM_SET.has(part) ? (
          <strong
            className="trading-card__keyword"
            key={`${keyPrefix}-${i}`}
            title={tooltipForHighlightedTerm(part)}
          >
            {part}
          </strong>
        ) : (
          <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Renders card rules text with game keyword and tag names in **bold**.
 * Newlines render as line breaks.
 */
export function CardDescriptionRich({ text }: { text: string }): ReactNode {
  if (!text) {
    return null;
  }
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 ? <br /> : null}
          {renderBoldLine(line, `L${String(li)}`)}
        </Fragment>
      ))}
    </>
  );
}
