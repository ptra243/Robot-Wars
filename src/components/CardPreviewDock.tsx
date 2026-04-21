import { CardDescriptionRich } from './CardDescriptionRich';
import { QueueCardFrame } from './QueueCardFrame';
import { TradingCard } from './TradingCard';
import type { PhaserSlotHoverPayload } from '../ui/arenaScene';
import type { CardContentService } from '../core/content';
import { CARD_TAG_HELP, KEYWORD_TYPE_HELP } from '../ui/keywordTagGlossary';
import type { DeckBuilderHoverPayload } from '../ui/deckBuilderScene';
import { COMBAT_RULES } from '../core/rules';
import type { CardDef } from '../core/types';
import { resolveCardDescription } from '../ui/cardDescriptions';
import { cardPopoverAnchorTransform, computeCardPopoverAnchor } from './cardPopoverAnchor';

export type CardPreviewPayload = Omit<DeckBuilderHoverPayload, 'clientX' | 'clientY'>;

function resolvePreviewCard(
  content: CardContentService,
  preview: CardPreviewPayload,
): CardDef | undefined {
  if (preview.kind === 'carousel' && !preview.cardId) {
    return undefined;
  }
  if (preview.kind === 'queue' && !preview.cardId) {
    return undefined;
  }
  if (!preview.cardId) {
    return undefined;
  }
  try {
    return content.get(preview.cardId);
  } catch {
    return undefined;
  }
}

/** Side column: tag/keyword boxes with rules text (used next to the card preview). */
export function CardPreviewGlossary({ card }: { card: CardDef }) {
  const hasTags = card.tags.length > 0;
  const hasKw = card.keywords.length > 0;

  return (
    <aside className="card-preview-glossary" aria-label="Tags and keywords">
      {hasTags ? (
        <div className="card-preview-glossary__block">
          <div className="card-preview-glossary__section-title">Tags</div>
          <ul className="card-preview-glossary__list">
            {card.tags.map((tag) => (
              <li key={tag} className="card-preview-glossary__item">
                <div className="card-preview-glossary__label">{tag}</div>
                <p className="card-preview-glossary__text">{CARD_TAG_HELP[tag]}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasKw ? (
        <div className="card-preview-glossary__block">
          <div className="card-preview-glossary__section-title">Keywords</div>
          <ul className="card-preview-glossary__list">
            {card.keywords.map((k, i) => (
              <li key={`${k.type}-${k.value}-${i}`} className="card-preview-glossary__item">
                <div className="card-preview-glossary__label">
                  {k.type} {k.value}
                </div>
                <p className="card-preview-glossary__text">{KEYWORD_TYPE_HELP[k.type]}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * Inner preview using `QueueCardFrame` chrome — shared by deck and battle popovers.
 */
export function CardQueuePreview({
  content,
  preview,
  omitTagsAndKeywords = false,
}: {
  content: CardContentService;
  preview: CardPreviewPayload;
  omitTagsAndKeywords?: boolean;
}) {
  if (preview.kind === 'carousel' && !preview.cardId) {
    return (
      <TradingCard
        width="100%"
        maxWidth="min(200px, calc(100vw - 32px))"
        variant="placeholder"
        className="trading-card--chrome"
      >
        <p className="card-preview-hint">Empty library slot.</p>
      </TradingCard>
    );
  }

  if (preview.kind === 'queue' && !preview.cardId) {
    const strike = content.get(COMBAT_RULES.blankQueueSlotCardId).base_damage;
    return (
      <QueueCardFrame title="Basic Strike" showCost={false} costContent="">
        <CardDescriptionRich text={`Strike ${String(strike)}`} />
      </QueueCardFrame>
    );
  }

  if (!preview.cardId) {
    return null;
  }

  let card;
  try {
    card = content.get(preview.cardId);
  } catch {
    return (
      <TradingCard
        width="100%"
        maxWidth="min(200px, calc(100vw - 32px))"
        variant="placeholder"
        className="trading-card--chrome"
      >
        <p className="card-preview-hint">Unknown card id.</p>
      </TradingCard>
    );
  }

  const showCost = card.charge_cost > 0;

  return (
    <QueueCardFrame
      title={card.name}
      showCost={showCost}
      costContent={showCost ? `EN ${String(card.charge_cost)}` : ''}
    >
      <CardDescriptionRich text={resolveCardDescription(card, { omitTagsAndKeywords })} />
    </QueueCardFrame>
  );
}

export type CardHoverPopoverPayload =
  | DeckBuilderHoverPayload
  | PhaserSlotHoverPayload;

/**
 * Floating card preview (viewport-fixed). Renders nothing when `hover` is null.
 */
export function CardHoverPopover({
  content,
  hover,
  pinned = false,
  onDismissPin,
  onPopoverPointerOverChange,
}: {
  content: CardContentService;
  hover: CardHoverPopoverPayload | null;
  pinned?: boolean;
  onDismissPin?: () => void;
  /** When pointer enters/leaves this popover (not the canvas). Used to pause pin timers on hover. */
  onPopoverPointerOverChange?: (over: boolean) => void;
}) {
  if (!hover) {
    return null;
  }

  const { clientX, clientY } = hover;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const anchor = computeCardPopoverAnchor(clientX, clientY, vw, vh);
  const transform = cardPopoverAnchorTransform(anchor);

  const preview: CardPreviewPayload =
    'kind' in hover
      ? { kind: hover.kind, cardId: hover.cardId, slotIndex: hover.slotIndex }
      : { kind: 'queue', cardId: hover.cardId, slotIndex: hover.index };

  const resolved = resolvePreviewCard(content, preview);
  const showGlossary =
    !!resolved && (resolved.tags.length > 0 || resolved.keywords.length > 0);
  /** Put the glossary on the side of the cursor that has more viewport room. */
  const glossaryOnRight = vw - clientX >= clientX;

  const subtitle =
    'side' in hover
      ? `${hover.side === 'player' ? 'Player' : 'Enemy'} queue · slot ${hover.index + 1}`
      : null;

  return (
    <div
      className={[
        'card-hover-popover',
        showGlossary ? 'card-hover-popover--with-glossary' : '',
        pinned ? 'card-hover-popover--pinned' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: clientX, top: clientY, transform }}
      data-popover-anchor={anchor}
      onPointerEnter={() => onPopoverPointerOverChange?.(true)}
      onPointerLeave={() => onPopoverPointerOverChange?.(false)}
    >
      {pinned && onDismissPin ? (
        <button
          type="button"
          className="card-hover-popover__close"
          aria-label="Close card preview"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore if capture unsupported */
            }
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const el = e.currentTarget;
            try {
              if (el.hasPointerCapture(e.pointerId)) {
                el.releasePointerCapture(e.pointerId);
              }
            } catch {
              /* ignore */
            }
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismissPin();
          }}
        >
          ×
        </button>
      ) : null}
      {subtitle ? <div className="card-hover-popover__meta">{subtitle}</div> : null}
      <div
        className="card-hover-popover__row"
        data-glossary-side={showGlossary ? (glossaryOnRight ? 'right' : 'left') : undefined}
      >
        {showGlossary && !glossaryOnRight ? <CardPreviewGlossary card={resolved} /> : null}
        <div className="card-hover-popover__card">
          <CardQueuePreview
            content={content}
            preview={preview}
            omitTagsAndKeywords={showGlossary}
          />
        </div>
        {showGlossary && glossaryOnRight ? <CardPreviewGlossary card={resolved} /> : null}
      </div>
    </div>
  );
}
