import type { CSSProperties, ReactNode } from 'react';
import { artCropCssVars } from '../../../ui/cardArtPlates';
import type { ForgeCard } from './types';

export type ForgeCardFaceArtVariant = 'library' | 'preview';

/**
 * Single implementation of the art strip + tier + cost, shared by library cards
 * and hover preview so compendium / forge match the popover chrome.
 */
export function ForgeCardFaceArt({
  card,
  variant,
}: {
  card: ForgeCard;
  variant: ForgeCardFaceArtVariant;
}) {
  const isPreview = variant === 'preview';
  const cropped = Boolean(card.artFocus === 'cropped' && card.artCrop);
  // Cropped faces must not keep a prior background-image; default faces must not
  // keep crop CSS vars from a previous card identity on the same DOM node.
  const artStyle = (
    cropped
      ? { backgroundImage: 'none', ...artCropCssVars(card.artCrop!) }
      : {
          backgroundImage: `url(${card.art})`,
          '--bgi-px': undefined,
          '--bgi-py': undefined,
          '--bgi-zoom-base': undefined,
        }
  ) as CSSProperties;
  return (
    <div
      className={[
        'forge-poc__fc-art',
        cropped ? 'forge-poc__fc-art--cropped' : '',
        cropped && card.artKeyed ? 'forge-poc__fc-art--keyed' : '',
        isPreview ? 'forge-poc__fc-art--preview' : 'forge-poc__fc-art--library',
      ]
        .filter(Boolean)
        .join(' ')}
      style={artStyle}
    >
      {cropped ? (
        <>
          <div className="forge-poc__fc-art-void" aria-hidden />
          <div className="forge-poc__fc-art-bgi">
            <img
              key={card.art}
              className="forge-poc__fc-art-bgi-img"
              src={card.art}
              alt=""
              draggable={false}
            />
          </div>
        </>
      ) : null}
      <div className="forge-poc__fc-art-scrim" />
      <div className="forge-poc__fc-tier">
        {isPreview ? (
          <>TIER {card.tier}</>
        ) : (
          <>T{card.tier}</>
        )}
      </div>
      <div
        className={[
          'forge-poc__fc-cost',
          card.hpPlayCost !== undefined ? 'forge-poc__fc-cost--hp' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="forge-poc__fc-cost-label">
          {card.hpPlayCost !== undefined ? 'HP' : 'EN'}
        </span>
        <span className="forge-poc__fc-cost-value">
          {card.hpPlayCost !== undefined ? card.hpPlayCost : card.cost}
        </span>
      </div>
    </div>
  );
}

/** Lower text panel: same surface as hover preview (dark body under art). */
export function ForgeCardFaceText({
  variant,
  className = '',
  children,
}: {
  variant: ForgeCardFaceArtVariant;
  className?: string;
  children: ReactNode;
}) {
  const isPreview = variant === 'preview';
  return (
    <div
      className={[
        'forge-poc__fc-text',
        isPreview ? 'forge-poc__fc-text--preview' : 'forge-poc__fc-text--library',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
