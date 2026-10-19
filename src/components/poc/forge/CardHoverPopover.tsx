import { CARD_TAG_HELP, KEYWORD_TYPE_HELP, formatKeywordTypeLabel } from '../../../ui/keywordTagGlossary';
import { CardDescriptionRich } from '../../CardDescriptionRich';
import { ForgeCardFaceArt, ForgeCardFaceText } from './ForgeCardFaceParts';
import type { ForgeCard, HoverState } from './types';

interface CardHoverPopoverProps {
  hover: HoverState;
  onClose?: () => void;
  onPrevTier?: () => void;
  onNextTier?: () => void;
  canPrevTier?: boolean;
  canNextTier?: boolean;
  /** e.g. 1500 when the popover must sit above the deck simulation modal (z-index 1400). */
  zIndex?: number;
  onPointerEnterPopover?: () => void;
  onPointerLeavePopover?: () => void;
}

/**
 * Floating popover that anchors to the cursor. Shows a big card preview
 * plus a side glossary of tag / keyword explanations (same copy as the
 * real deck builder).
 */
export function CardHoverPopover({
  hover,
  onClose,
  onPrevTier,
  onNextTier,
  canPrevTier = false,
  canNextTier = false,
  zIndex,
  onPointerEnterPopover,
  onPointerLeavePopover,
}: CardHoverPopoverProps) {
  const { card, x, y } = hover;
  const secondaryCard = hover.secondaryCard;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const CARD_W = 260;
  const GLOSS_W = 220;
  const PAD = 14;
  const OFFSET_X = 20;
  const OFFSET_Y = -18;
  const hasTags = card.tags.length > 0;
  const hasKw = card.keywords.length > 0;
  const showGlossary = hasTags || hasKw;
  const extraCardW = secondaryCard ? CARD_W + 12 : 0;
  const totalW = CARD_W + extraCardW + (showGlossary ? GLOSS_W + 12 : 0);
  const totalH = 380;

  const spaceRight = vw - x;
  const spaceLeft = x;
  const spaceBottom = vh - y;
  const spaceTop = y;
  // Bias to opening on the cursor's right/up directions so we avoid covering
  // the hovered card, only flipping when there truly is not enough room.
  const rightFitsComfortably = spaceRight >= totalW + 48;
  const leftFitsComfortably = spaceLeft >= totalW + 48;
  const anchorHorizontal: 'left' | 'right' =
    rightFitsComfortably || (!leftFitsComfortably && spaceRight >= spaceLeft) ? 'left' : 'right';

  const downFitsComfortably = spaceBottom >= totalH + 32;
  const upFitsComfortably = spaceTop >= totalH + 32;
  const anchorVertical: 'top' | 'bottom' =
    upFitsComfortably || (!downFitsComfortably && spaceTop >= spaceBottom) ? 'bottom' : 'top';

  const left =
    (anchorHorizontal === 'left' ? x + PAD : x - totalW - PAD) + OFFSET_X;
  const top = (anchorVertical === 'top' ? y + PAD : y - totalH - PAD) + OFFSET_Y;
  const glossaryOnRight = anchorHorizontal === 'left';

  const interactive =
    Boolean(onClose || onPrevTier || onNextTier || onPointerEnterPopover || onPointerLeavePopover);

  return (
    <div
      className={`forge-poc__popover${interactive ? ' forge-poc__popover--interactive' : ''}`}
      style={{
        left: Math.max(8, Math.min(left, vw - totalW - 8)),
        top: Math.max(8, Math.min(top, vh - 380)),
        ...(zIndex !== undefined ? { zIndex } : {}),
      }}
      onMouseEnter={onPointerEnterPopover}
      onMouseLeave={onPointerLeavePopover}
    >
      <div
        className={`forge-poc__popover-row${
          showGlossary && glossaryOnRight
            ? ' forge-poc__popover-row--gloss-right'
            : ''
        }`}
      >
        {showGlossary && !glossaryOnRight ? <PopoverGlossary card={card} /> : null}
        <PopoverCard
          card={card}
          onClose={onClose}
          onPrevTier={onPrevTier}
          onNextTier={onNextTier}
          canPrevTier={canPrevTier}
          canNextTier={canNextTier}
        />
        {secondaryCard ? <PopoverCard card={secondaryCard} canPrevTier={false} canNextTier={false} /> : null}
        {showGlossary && glossaryOnRight ? <PopoverGlossary card={card} /> : null}
      </div>
    </div>
  );
}

function PopoverCard({
  card,
  onClose,
  onPrevTier,
  onNextTier,
  canPrevTier,
  canNextTier,
}: {
  card: ForgeCard;
  onClose?: () => void;
  onPrevTier?: () => void;
  onNextTier?: () => void;
  canPrevTier: boolean;
  canNextTier: boolean;
}) {
  return (
    <div className={`forge-poc__popover-card forge-poc__popover-card--${card.faction}`}>
      {onClose ? (
        <button
          type="button"
          className="forge-poc__popover-close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close card preview"
        >
          ✕
        </button>
      ) : null}
      <ForgeCardFaceArt card={card} variant="preview" />
      <ForgeCardFaceText variant="preview">
        {onPrevTier || onNextTier ? (
          <div className="forge-poc__popover-tier-nav">
            <button
              type="button"
              className="forge-poc__popover-tier-btn"
              disabled={!canPrevTier}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPrevTier?.();
              }}
              aria-label="Previous tier"
            >
              ◀
            </button>
            <span className="forge-poc__popover-tier-readout">TIER {card.tier}</span>
            <button
              type="button"
              className="forge-poc__popover-tier-btn"
              disabled={!canNextTier}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNextTier?.();
              }}
              aria-label="Next tier"
            >
              ▶
            </button>
          </div>
        ) : null}
        <h3 className="forge-poc__popover-name">{card.name}</h3>
        <div className="forge-poc__popover-chips">
          {card.tags.map((t) => (
            <span key={t} className="forge-poc__popover-chip">{t}</span>
          ))}
          {card.keywords.map((k, i) => (
            <span key={`${k.type}-${String(i)}`} className="forge-poc__popover-chip forge-poc__popover-chip--kw">
              {formatKeywordTypeLabel(k.type)} {k.value}
            </span>
          ))}
        </div>
        <div className="forge-poc__popover-stats">
          {card.atk !== undefined ? (
            <div className="forge-poc__popover-stat">
              <span className="forge-poc__popover-stat-label">STRIKE</span>
              <span className="forge-poc__popover-stat-value">{card.atk}</span>
            </div>
          ) : null}
          {card.def !== undefined ? (
            <div className="forge-poc__popover-stat">
              <span className="forge-poc__popover-stat-label">SHIELD</span>
              <span className="forge-poc__popover-stat-value">{card.def}</span>
            </div>
          ) : null}
        </div>
        <p className="forge-poc__popover-blurb">
          <CardDescriptionRich text={card.blurb} />
        </p>
      </ForgeCardFaceText>
    </div>
  );
}

function PopoverGlossary({ card }: { card: ForgeCard }) {
  const hasTags = card.tags.length > 0;
  const hasKw = card.keywords.length > 0;

  return (
    <aside className="forge-poc__gloss" aria-label="Tags and keywords">
      {hasTags ? (
        <div className="forge-poc__gloss-block">
          <div className="forge-poc__gloss-title">Tags</div>
          <ul className="forge-poc__gloss-list">
            {card.tags.map((tag) => (
              <li key={tag} className="forge-poc__gloss-item">
                <div className="forge-poc__gloss-label">{tag}</div>
                <p className="forge-poc__gloss-text">{CARD_TAG_HELP[tag]}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasKw ? (
        <div className="forge-poc__gloss-block">
          <div className="forge-poc__gloss-title">Keywords</div>
          <ul className="forge-poc__gloss-list">
            {card.keywords.map((k, i) => (
              <li key={`${k.type}-${String(k.value)}-${String(i)}`} className="forge-poc__gloss-item">
                <div className="forge-poc__gloss-label">
                  {formatKeywordTypeLabel(k.type)} {k.value}
                </div>
                <p className="forge-poc__gloss-text">{KEYWORD_TYPE_HELP[k.type]}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
