import { useEffect, useMemo, useState } from 'react';
import type { TravelEventOutcome } from '../core/types';
import { CardContentService } from '../core/content';
import { useRunCardContent } from '../hooks/useRunCardContent';
import { buildCardDescription } from '../ui/cardText';
import { useGameStore } from '../stores/gameStore';
import { getRelicDef } from '../core/run';
import { cardArtUrlFromDef } from '../features/forge/forgeCardModel';
import './travel-overlay.css';

const SHOP_CARD_PRICE = 40;

function SoldCardOffer({ priceLabel }: { priceLabel?: string }) {
  return (
    <div className="travel-overlay__card-shell">
      <div
        className="travel-overlay__card travel-overlay__card--full travel-overlay__card--sold"
        aria-label="Sold"
      >
        <div className="travel-overlay__sold-mark">- sold -</div>
      </div>
      {priceLabel ? <div className="travel-overlay__card-under-price">{priceLabel}</div> : null}
    </div>
  );
}

function FullCardOffer({
  cardId,
  seed,
  priceLabel,
  disabled = false,
  onClick,
}: {
  cardId: string;
  seed: number;
  priceLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const content = useRunCardContent(seed);
  let card;
  try {
    card = content.get(cardId);
  } catch {
    return null;
  }
  const desc = buildCardDescription(card);
  return (
    <div className="travel-overlay__card-shell">
      <button
        type="button"
        className="travel-overlay__card travel-overlay__card--full"
        disabled={disabled}
        onClick={onClick}
      >
        <div className="travel-overlay__card-art" style={{ backgroundImage: `url(${cardArtUrlFromDef(card)})` }}>
          <span className="travel-overlay__card-tier-badge">T{card.card_tier}</span>
          <span className="travel-overlay__card-cost-badge">EN {card.charge_cost}</span>
        </div>
        <div className="travel-overlay__card-body">
          <div className="travel-overlay__card-name">{card.name}</div>
          <div className="travel-overlay__card-desc">{desc}</div>
        </div>
      </button>
      {priceLabel ? <div className="travel-overlay__card-under-price">{priceLabel}</div> : null}
    </div>
  );
}

function offersKey(offers: string[]): string {
  return offers.join('|');
}

function EventOutcomeBody({
  outcome,
  seed,
}: {
  outcome: TravelEventOutcome;
  seed: number;
}) {
  const content = useRunCardContent(seed);

  if (outcome.kind === 'upgrade') {
    let beforeCard;
    let afterCard;
    try {
      beforeCard = content.get(outcome.beforeId);
      afterCard = content.get(outcome.afterId);
    } catch {
      return <p className="travel-overlay__p">Card upgraded.</p>;
    }
    return (
      <div className="travel-overlay__upgrade">
        <div className="travel-overlay__upgrade-card">
          <div className="travel-overlay__card-tier">T{beforeCard.card_tier}</div>
          <div className="travel-overlay__card-name">{beforeCard.name}</div>
          <div className="travel-overlay__card-desc">{buildCardDescription(beforeCard)}</div>
        </div>
        <div className="travel-overlay__upgrade-arrow" aria-hidden>
          →
        </div>
        <div className="travel-overlay__upgrade-card travel-overlay__upgrade-card--after">
          <div className="travel-overlay__card-tier">T{afterCard.card_tier}</div>
          <div className="travel-overlay__card-name">{afterCard.name}</div>
          <div className="travel-overlay__card-desc">{buildCardDescription(afterCard)}</div>
        </div>
      </div>
    );
  }

  if (outcome.kind === 'gold_gain' || outcome.kind === 'hearts_full_gold') {
    const amount = outcome.kind === 'gold_gain' ? outcome.amount : outcome.goldGained;
    const total = outcome.totalGold;
    return (
      <div className="travel-overlay__gold-strip">
        <span className="travel-overlay__gold-icon">⬡</span>
        <span className="travel-overlay__gold-label">+{amount} CREDITS</span>
        <span className="travel-overlay__gold-total">({total} total)</span>
      </div>
    );
  }

  if (outcome.kind === 'gold_loss') {
    return (
      <div className="travel-overlay__gold-strip travel-overlay__gold-strip--loss">
        <span className="travel-overlay__gold-label">−{outcome.amount} CREDITS</span>
        <span className="travel-overlay__gold-total">({outcome.totalGold} total)</span>
      </div>
    );
  }

  if (outcome.kind === 'paid_card') {
    let card;
    try {
      card = content.get(outcome.cardId);
    } catch {
      return <p className="travel-overlay__p">Card added to deck.</p>;
    }
    return (
      <div>
        <div className="travel-overlay__gold-strip">
          <span className="travel-overlay__gold-icon">⬡</span>
          <span className="travel-overlay__gold-label">−{outcome.goldSpent} CREDITS</span>
        </div>
        <div className="travel-overlay__single-card">
          <div className="travel-overlay__card-tier">T{card.card_tier}</div>
          <div className="travel-overlay__card-name">{card.name}</div>
          <div className="travel-overlay__card-desc">{buildCardDescription(card)}</div>
        </div>
      </div>
    );
  }

  if (outcome.kind === 'heart_restore') {
    return (
      <p className="travel-overlay__p">
        Hearts: {outcome.hearts} (+{outcome.amount})
      </p>
    );
  }

  if (outcome.kind === 'heart_loss') {
    return (
      <p className="travel-overlay__p">Hearts remaining: {outcome.heartsRemaining}</p>
    );
  }

  if (outcome.kind === 'lost_hand_card') {
    let card;
    try {
      card = content.get(outcome.cardId);
    } catch {
      return <p className="travel-overlay__p">Lost a hand card.</p>;
    }
    return (
      <div className="travel-overlay__single-card travel-overlay__single-card--loss">
        <div className="travel-overlay__card-tier">T{card.card_tier}</div>
        <div className="travel-overlay__card-name">{card.name}</div>
        <div className="travel-overlay__card-desc">{buildCardDescription(card)}</div>
      </div>
    );
  }

  if (outcome.kind === 'relic_gain') {
    const name = getRelicDef(outcome.relicId)?.name ?? outcome.relicId;
    return <p className="travel-overlay__p">Relic gained: {name}</p>;
  }

  if (outcome.kind === 'noop') {
    return <p className="travel-overlay__p travel-overlay__p--muted">Nothing changed.</p>;
  }

  return null;
}

export function TravelOverlay() {
  const run = useGameStore((s) => s.run);
  const travelModal = useGameStore((s) => s.travelModal);
  const dismissTravelModal = useGameStore((s) => s.dismissTravelModal);
  const handleShopBuyCard = useGameStore((s) => s.handleShopBuyCard);
  const handleShopRerollOffers = useGameStore((s) => s.handleShopRerollOffers);
  const handleShopBuyRerollToken = useGameStore((s) => s.handleShopBuyRerollToken);
  const handleShopBuyCommonRelic = useGameStore((s) => s.handleShopBuyCommonRelic);
  const handleTravelDraftPick = useGameStore((s) => s.handleTravelDraftPick);
  const handleAcceptEventCardOffer = useGameStore((s) => s.handleAcceptEventCardOffer);
  const handleRefuseEventCardOffer = useGameStore((s) => s.handleRefuseEventCardOffer);
  const handleAcceptEventUpgradeOffer = useGameStore((s) => s.handleAcceptEventUpgradeOffer);
  const handleRefuseEventUpgradeOffer = useGameStore((s) => s.handleRefuseEventUpgradeOffer);
  const [soldShopSlots, setSoldShopSlots] = useState<number[]>([]);
  const [shopToast, setShopToast] = useState<string | null>(null);
  const currentShopOffersKey = useMemo(
    () => (travelModal?.kind === 'shop' ? offersKey(travelModal.offers) : ''),
    [travelModal],
  );

  useEffect(() => {
    if (travelModal?.kind !== 'shop') {
      setSoldShopSlots([]);
      setShopToast(null);
    }
  }, [travelModal?.kind]);

  useEffect(() => {
    if (travelModal?.kind !== 'shop') {
      return;
    }
    setSoldShopSlots([]);
  }, [currentShopOffersKey]);

  useEffect(() => {
    if (!shopToast) return;
    const timer = window.setTimeout(() => setShopToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [shopToast]);

  if (!travelModal) {
    return null;
  }

  if (travelModal.kind === 'shop') {
    const nonCard = travelModal.nonCardPurchases;
    const extraPrice = 50 * nonCard;
    const rerollShopPrice = 50 + extraPrice;
    const rerollTokenPrice = 50 + extraPrice;
    const shopRelicPrice = 100 * 2 ** run.loop.shopRelicPurchaseCount;
    return (
      <div
        className="travel-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-shop-title"
      >
        <div className="travel-overlay__backdrop travel-overlay__backdrop--dim" aria-hidden />
        <div className="travel-overlay__panel">
          <h2 id="travel-shop-title" className="travel-overlay__title">
            SHOP
          </h2>
          <p className="travel-overlay__sub">
            Buy a card · Reroll offers · Buy reroll tokens — non-card buys raise repeat prices by 50g
            this visit. Relics start at 100g and double each buy for the whole run.
          </p>
          <div className="travel-overlay__shop-actions">
            <button
              type="button"
              className="travel-overlay__btn travel-overlay__btn--ghost"
              disabled={run.loop.gold < rerollShopPrice}
              onClick={handleShopRerollOffers}
            >
              Reroll shop ({rerollShopPrice}g)
            </button>
            <button
              type="button"
              className="travel-overlay__btn travel-overlay__btn--ghost"
              disabled={run.loop.gold < rerollTokenPrice}
              onClick={handleShopBuyRerollToken}
            >
              +1 card reroll ({rerollTokenPrice}g)
            </button>
            <button
              type="button"
              className="travel-overlay__btn travel-overlay__btn--ghost"
              disabled={run.loop.gold < shopRelicPrice}
              onClick={handleShopBuyCommonRelic}
            >
              Buy common relic ({shopRelicPrice}g)
            </button>
          </div>
          <div className="travel-overlay__cards-heading">
            CARDS — {SHOP_CARD_PRICE}g each
          </div>
          <div className="travel-overlay__cards">
            {travelModal.offers.map((cardId, offerIdx) =>
              soldShopSlots.includes(offerIdx) ? (
                <SoldCardOffer key={`sold-${String(offerIdx)}`} priceLabel={`${SHOP_CARD_PRICE}g`} />
              ) : (
                <FullCardOffer
                  key={`${cardId}-${String(offerIdx)}`}
                  cardId={cardId}
                  seed={run.seed}
                  priceLabel={`${SHOP_CARD_PRICE}g`}
                  disabled={run.loop.gold < SHOP_CARD_PRICE}
                  onClick={() => {
                    const ok = handleShopBuyCard(cardId);
                    if (!ok) return;
                    setSoldShopSlots((prev) => [...prev, offerIdx]);
                    const content = CardContentService.loadDefault(run.seed);
                    setShopToast(`${content.get(cardId).name} bought.`);
                  }}
                />
              ),
            )}
          </div>
          {shopToast ? <div className="travel-overlay__toast">{shopToast}</div> : null}
          <button type="button" className="travel-overlay__dismiss" onClick={dismissTravelModal}>
            Leave shop
          </button>
        </div>
      </div>
    );
  }

  if (travelModal.kind === 'draft') {
    return (
      <div
        className="travel-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-draft-title"
      >
        <div className="travel-overlay__panel">
          <h2 id="travel-draft-title" className="travel-overlay__title">
            EVENT — DRAFT
          </h2>
          <p className="travel-overlay__sub">Pick one card to add to your deck.</p>
          <div className="travel-overlay__cards">
            {travelModal.offers.map((cardId, offerIdx) => (
              <FullCardOffer
                key={`${cardId}-${String(offerIdx)}`}
                cardId={cardId}
                seed={run.seed}
                onClick={() => handleTravelDraftPick(cardId)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (travelModal.kind === 'event_card_offer') {
    return (
      <div
        className="travel-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-event-offer-title"
      >
        <div className="travel-overlay__panel">
          <h2 id="travel-event-offer-title" className="travel-overlay__title">
            EVENT — CARD OFFER
          </h2>
          <p className="travel-overlay__sub">{travelModal.message}</p>
          <div className="travel-overlay__cards">
            <FullCardOffer cardId={travelModal.cardId} seed={run.seed} />
          </div>
          <div className="travel-overlay__shop-actions">
            <button
              type="button"
              className="travel-overlay__btn travel-overlay__btn--ghost"
              disabled={run.loop.gold < travelModal.acceptCost}
              onClick={handleAcceptEventCardOffer}
            >
              Accept ({travelModal.acceptCost}g)
            </button>
            <button
              type="button"
              className="travel-overlay__btn travel-overlay__btn--ghost"
              onClick={handleRefuseEventCardOffer}
            >
              Refuse (+{travelModal.refuseGold}g)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (travelModal.kind === 'event_upgrade_offer') {
    return (
      <div
        className="travel-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-event-upgrade-title"
      >
        <div className="travel-overlay__panel">
          <h2 id="travel-event-upgrade-title" className="travel-overlay__title">
            EVENT — UPGRADE OFFER
          </h2>
          <p className="travel-overlay__sub">{travelModal.message}</p>
          <EventOutcomeBody
            outcome={{
              kind: 'upgrade',
              beforeId: travelModal.beforeId,
              afterId: travelModal.afterId,
            }}
            seed={run.seed}
          />
          <div className="travel-overlay__shop-actions">
            <button
              type="button"
              className="travel-overlay__btn travel-overlay__btn--ghost"
              disabled={run.loop.gold < travelModal.acceptCost}
              onClick={handleAcceptEventUpgradeOffer}
            >
              Upgrade ({travelModal.acceptCost}g)
            </button>
            <button
              type="button"
              className="travel-overlay__btn travel-overlay__btn--ghost"
              onClick={handleRefuseEventUpgradeOffer}
            >
              Refuse (+{travelModal.refuseGold}g)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="travel-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="travel-event-title"
    >
      <button
        type="button"
        className="travel-overlay__backdrop"
        aria-label="Close"
        onClick={dismissTravelModal}
      />
      <div className="travel-overlay__panel">
        <h2 id="travel-event-title" className="travel-overlay__title">
          EVENT
        </h2>
        <p className="travel-overlay__message">{travelModal.message}</p>
        <EventOutcomeBody outcome={travelModal.outcome} seed={run.seed} />
        <button type="button" className="travel-overlay__dismiss" onClick={dismissTravelModal}>
          Continue
        </button>
      </div>
    </div>
  );
}
