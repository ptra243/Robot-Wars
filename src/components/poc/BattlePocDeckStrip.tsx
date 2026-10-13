import type { ReactNode } from 'react';
import { isPrimeSlotForTraitPlanning, primeSlotHoverText } from '../../core/clockwork';
import { PrimeSlotMark } from '../../ui/PrimeSlotMark';
import type { BattleCard } from './battlePocCardModel';
import { CardDescriptionRich } from '../CardDescriptionRich';

export interface BattlePocDeckStripProps {
  cards: BattleCard[];
  activeIndex: number;
  /** Reveal+strike stand-in: when true, the active queue chip can expand into a full card. */
  expandChips: boolean;
  side: 'player' | 'enemy';
  /** In-play program size (5–9); used for the slot readout, not the displayed chip count. */
  programWidth?: number;
  topChrome?: ReactNode;
  bottomChrome?: ReactNode;
  onCardHover?: (card: BattleCard, ev: { clientX: number; clientY: number }) => void;
  onCardLeave?: () => void;
  /** Prime slot geometry for this strip (player traits / natural enemy slots). */
  primeTraitIds?: readonly string[];
  faction?: string;
  /** Slot index currently playing Factory Reset rip/explode FX, if any. */
  factoryResetSlotIndex?: number | null;
}

/**
 * Full battle program strip — matches legacy BattlePOC deck row (labels, clip-path chips, expand).
 */
export function BattlePocDeckStrip({
  cards,
  activeIndex,
  expandChips,
  side,
  programWidth,
  topChrome,
  bottomChrome,
  onCardHover,
  onCardLeave,
  primeTraitIds = [],
  faction,
  factoryResetSlotIndex = null,
}: BattlePocDeckStripProps) {
  const slotReadoutW = programWidth ?? cards.length;
  return (
    <aside className={`battle-poc__strip battle-poc__strip--${side}`}>
      {topChrome}
      <div className="battle-poc__strip-label">
        <span>{side === 'player' ? 'BATTLE PROGRAM' : 'ENEMY PROGRAM'}</span>
        <span className="battle-poc__strip-counter">
          {Math.min(activeIndex, Math.max(0, slotReadoutW - 1)) + 1}/{slotReadoutW}
        </span>
      </div>
      <ol className="battle-poc__strip-list">
        {cards.map((card, i) => {
          const isActive = i === activeIndex;
          const isFactoryReset = factoryResetSlotIndex === i;
          const isExpanded = (isActive && expandChips) || isFactoryReset;
          const isPrime =
            !card.locked && i < slotReadoutW && isPrimeSlotForTraitPlanning(i, primeTraitIds, faction);
          const primeTip = isPrime ? primeSlotHoverText(i, primeTraitIds, faction) : undefined;
          return (
            <li
              key={`${String(side)}-${String(i)}-${card.id}`}
              className={[
                'battle-poc__chip',
                `battle-poc__chip--${side}`,
                isActive ? 'battle-poc__chip--active' : '',
                isExpanded ? 'battle-poc__chip--expanded' : '',
                card.fog ? 'battle-poc__chip--fog' : '',
                card.locked ? 'battle-poc__chip--locked' : '',
                isPrime ? 'battle-poc__chip--prime' : '',
                isFactoryReset ? 'battle-poc__chip--factory-reset' : '',
              ].join(' ')}
              title={primeTip}
              onMouseMove={(e) => {
                onCardHover?.(card, { clientX: e.clientX, clientY: e.clientY });
              }}
              onMouseLeave={() => {
                onCardLeave?.();
              }}
            >
              <div className="battle-poc__chip-index">
                {String(i + 1).padStart(2, '0')}
                {isPrime ? (
                  <PrimeSlotMark
                    slotIndex={i}
                    traitIds={primeTraitIds}
                    faction={faction}
                    className="battle-poc__prime-mark"
                  />
                ) : null}
              </div>
              <div
                className={[
                  'battle-poc__chip-art',
                  !card.fog && !card.locked && card.artFocus === 'core-reactor' ? 'battle-poc__chip-art--core-reactor' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  card.locked
                    ? { backgroundImage: 'none' }
                    : card.fog
                      ? { backgroundImage: 'none' }
                      : card.artFocus === 'core-reactor'
                        ? { backgroundImage: 'none' }
                        : { backgroundImage: `url(${card.art})` }
                }
              >
                {!card.fog && !card.locked && card.artFocus === 'core-reactor' ? (
                  <>
                    <div className="battle-poc__chip-art-void" aria-hidden />
                    <div className="battle-poc__chip-art-bgi">
                      <img className="battle-poc__chip-art-bgi-img" src={card.art} alt="" draggable={false} />
                    </div>
                  </>
                ) : null}
                {card.fog ? <div className="battle-poc__chip-fog">?</div> : null}
                {isFactoryReset && !card.fog && !card.locked ? (
                  <div className="battle-poc__factory-reset-fx" aria-hidden>
                    <div
                      className="battle-poc__factory-reset-half battle-poc__factory-reset-half--left"
                      style={{ backgroundImage: card.art ? `url(${card.art})` : undefined }}
                    />
                    <div
                      className="battle-poc__factory-reset-half battle-poc__factory-reset-half--right"
                      style={{ backgroundImage: card.art ? `url(${card.art})` : undefined }}
                    />
                    <div className="battle-poc__factory-reset-burst" />
                    <div className="battle-poc__factory-reset-shard battle-poc__factory-reset-shard--a" />
                    <div className="battle-poc__factory-reset-shard battle-poc__factory-reset-shard--b" />
                    <div className="battle-poc__factory-reset-shard battle-poc__factory-reset-shard--c" />
                    <span className="battle-poc__factory-reset-tag">RESET</span>
                  </div>
                ) : null}
              </div>
              <div className="battle-poc__chip-meta">
                <span className="battle-poc__chip-name">
                  {card.locked ? 'INACTIVE' : card.fog ? 'UNKNOWN' : card.name}
                </span>
                {card.locked ? (
                  <span className="battle-poc__chip-cost">—</span>
                ) : card.hpPlayCost !== undefined ? (
                  <span className="battle-poc__chip-cost battle-poc__chip-cost--hp">
                    <span className="battle-poc__chip-cost-hp-lbl">HP</span>
                    {String(card.hpPlayCost)}
                  </span>
                ) : (
                  <span className="battle-poc__chip-cost">{card.cost}</span>
                )}
              </div>
              <div className="battle-poc__chip-detail">
                <div className="battle-poc__chip-detail-tags">
                  {card.statKind === 'shield' ? (
                    <>
                      <span className="battle-poc__chip-detail-tag">SHIELD</span>
                      <span className="battle-poc__chip-detail-tag battle-poc__chip-detail-tag--def">
                        DEF {card.def ?? card.atk}
                      </span>
                    </>
                  ) : card.statKind === 'strike' ? (
                    <>
                      <span className="battle-poc__chip-detail-tag">STRIKE</span>
                      <span className="battle-poc__chip-detail-tag battle-poc__chip-detail-tag--atk">
                        ATK {card.atk}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="battle-poc__chip-detail-tag">CARD</span>
                      <span className="battle-poc__chip-detail-tag battle-poc__chip-detail-tag--atk">
                        ···
                      </span>
                    </>
                  )}
                </div>
                <p className="battle-poc__chip-detail-text">
                  {card.fog ? '— hidden —' : <CardDescriptionRich text={card.text} />}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {bottomChrome}
    </aside>
  );
}
