import type { CSSProperties, ReactNode } from 'react';
import { isPrimeSlotForTraitPlanning, primeSlotHoverText } from '../../core/clockwork';
import { artCropCssVars } from '../../ui/cardArtPlates';
import { PrimeSlotMark } from '../../ui/PrimeSlotMark';
import type { BattleCard } from '../poc/battlePocCardModel';

/** Degrees of yaw between adjacent cartridges in the coverflow arc. */
const CAROUSEL_YAW = 22;
/** Horizontal spacing (px) along the rail before perspective. */
const CAROUSEL_STEP_X = 58;
/** Depth pull (px) per step away from the active index. */
const CAROUSEL_DEPTH = 36;
/** Max |offset| that stays fully visible before fading. */
const CAROUSEL_VISIBLE = 4;

export interface CartridgeBeltProps {
  cards: BattleCard[];
  activeIndex: number;
  /** Pitch the acting cartridge into the slot. The other belt stays parked. */
  slotting: boolean;
  side: 'player' | 'enemy';
  programWidth?: number;
  topChrome?: ReactNode;
  bottomChrome?: ReactNode;
  onCardHover?: (card: BattleCard, ev: { clientX: number; clientY: number }) => void;
  onCardLeave?: () => void;
  primeTraitIds?: readonly string[];
  faction?: string;
  factoryResetSlotIndex?: number | null;
}

export function CartridgeBelt({
  cards,
  activeIndex,
  slotting,
  side,
  programWidth,
  topChrome,
  bottomChrome,
  onCardHover,
  onCardLeave,
  primeTraitIds = [],
  faction,
  factoryResetSlotIndex = null,
}: CartridgeBeltProps) {
  const slotReadoutW = programWidth ?? cards.length;
  const safeActive = Math.min(Math.max(0, activeIndex), Math.max(0, cards.length - 1));

  return (
    <aside className={`battle-poc__strip battle-poc__strip--${side} cartridge-rail cartridge-rail--${side}`}>
      {topChrome}
      <div className="battle-poc__strip-label">
        <span>{side === 'player' ? '// BATTLE PROGRAM' : '// ENEMY PROGRAM'}</span>
        <span className="battle-poc__strip-counter">
          {Math.min(safeActive, Math.max(0, slotReadoutW - 1)) + 1}/{slotReadoutW}
        </span>
      </div>
      <div className="cartridge-rail__stage">
        <div className={`cartridge-slot cartridge-slot--${side}${slotting ? ' is-live' : ''}`} aria-hidden>
          <span className="cartridge-slot__rail cartridge-slot__rail--left" />
          <span className="cartridge-slot__bay">
            <span className="cartridge-slot__teeth" />
            <span className="cartridge-slot__mouth" />
            <span className="cartridge-slot__led" />
          </span>
          <span className="cartridge-slot__rail cartridge-slot__rail--right" />
        </div>
        <ol className="cartridge-belt" aria-label={side === 'player' ? 'Your program' : 'Opponent program'}>
          {cards.map((card, i) => {
            const offset = i - safeActive;
            const abs = Math.abs(offset);
            const slotted = slotting && i === safeActive;
            const isPrime =
              !card.locked && i < slotReadoutW && isPrimeSlotForTraitPlanning(i, primeTraitIds, faction);
            const primeTip = isPrime ? primeSlotHoverText(i, primeTraitIds, faction) : undefined;
            const yaw = offset * (side === 'player' ? -CAROUSEL_YAW : CAROUSEL_YAW);
            const x = offset * CAROUSEL_STEP_X;
            const z = -abs * CAROUSEL_DEPTH;
            /* Slight pitch so the belt reads as a cylinder facing the arena. */
            const tilt = side === 'player' ? 8 : -8;
            const parkedY = side === 'player' ? 10 : -10;
            const transform = slotted
              ? undefined
              : `translate(-50%, -50%) translateX(${String(x)}px) translateY(${String(parkedY)}px) translateZ(${String(z)}px) rotateY(${String(yaw)}deg) rotateX(${String(tilt)}deg)`;
            const dim = abs > CAROUSEL_VISIBLE ? 0.28 : abs > 2 ? 0.55 : 1;

            return (
              <li
                key={`${side}-${String(i)}-${card.id}`}
                className={[
                  'cartridge',
                  `cartridge--${side}`,
                  slotted ? 'is-slotted' : '',
                  i < safeActive ? 'is-spent' : '',
                  i === safeActive ? 'is-active' : '',
                  card.fog ? 'is-fog' : '',
                  card.locked ? 'is-locked' : '',
                  isPrime ? 'is-prime' : '',
                  factoryResetSlotIndex === i ? 'is-reset' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  transform,
                  zIndex: slotted ? 12 : 8 - abs,
                  opacity: slotted ? 1 : dim,
                }}
                title={primeTip}
                onMouseMove={(e) => {
                  onCardHover?.(card, { clientX: e.clientX, clientY: e.clientY });
                }}
                onMouseLeave={() => {
                  onCardLeave?.();
                }}
              >
                <span className="cartridge__index">
                  {String(i + 1).padStart(2, '0')}
                  {isPrime ? (
                    <PrimeSlotMark
                      slotIndex={i}
                      traitIds={primeTraitIds}
                      faction={faction}
                      className="battle-poc__prime-mark"
                    />
                  ) : null}
                </span>
                <CartridgeLabel card={card} />
                <span className="cartridge__name">
                  {card.locked ? 'INACTIVE' : card.fog ? 'UNKNOWN' : card.name}
                </span>
                <span className="cartridge__connector" aria-hidden />
              </li>
            );
          })}
        </ol>
      </div>
      {bottomChrome}
    </aside>
  );
}

function CartridgeLabel({ card }: { card: BattleCard }) {
  if (card.locked || card.fog) {
    return <div className="cartridge__label cartridge__label--blank">{card.fog ? '?' : ''}</div>;
  }
  const cropped = card.artFocus === 'cropped' && card.artCrop;
  const style: CSSProperties = cropped
    ? ({ backgroundImage: 'none', ...artCropCssVars(card.artCrop!) } as CSSProperties)
    : { backgroundImage: `url(${card.art})` };
  return (
    <div
      className={[
        'cartridge__label',
        cropped ? 'cartridge__label--cropped' : '',
        cropped && card.artKeyed ? 'battle-poc__chip-art--keyed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {cropped ? (
        <div className="cartridge__label-bgi">
          <img className="battle-poc__chip-art-bgi-img" src={card.art} alt="" draggable={false} />
        </div>
      ) : null}
    </div>
  );
}
