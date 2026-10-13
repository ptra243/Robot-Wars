import { useGameStore } from '../stores/gameStore';
import { useRunCardContent } from '../hooks/useRunCardContent';
import { CardDescriptionRich } from './CardDescriptionRich';
import { buildCardDescription } from '../ui/cardText';
import { getRelicDef, getRelicDescription } from '../core/run';
import { cardArtUrlFromDef } from '../features/forge/forgeCardModel';
import './reward-view.css';

export function RewardView() {
  const run = useGameStore((s) => s.run);
  const rewardGold = useGameStore((s) => s.rewardGold);
  const rewardCardOffers = useGameStore((s) => s.rewardCardOffers);
  const rewardRelicOffers = useGameStore((s) => s.rewardRelicOffers);
  const rewardRelic = useGameStore((s) => s.rewardRelic);
  const handlePickRewardCard = useGameStore((s) => s.handlePickRewardCard);
  const handlePickRewardRelic = useGameStore((s) => s.handlePickRewardRelic);
  const handleRerollRewardCards = useGameStore((s) => s.handleRerollRewardCards);
  const handleRerollRewardRelics = useGameStore((s) => s.handleRerollRewardRelics);
  const handleSkipReward = useGameStore((s) => s.handleSkipReward);

  const content = useRunCardContent(run.seed);
  const needsRelicPick = rewardRelicOffers.length > 0 && !rewardRelic;
  const canSkipCards = !needsRelicPick;

  return (
    <div className="reward-view">
      <div className="reward-view__header">
        <div className="reward-view__eyebrow">ENCOUNTER COMPLETE</div>
        <h2 className="reward-view__title">REWARDS</h2>
        <div className="reward-view__rerolls">Rerolls: {run.loop.rerolls}</div>
      </div>

      <div className="reward-view__items">
        <div className="reward-view__item reward-view__item--gold">
          <span className="reward-view__item-icon">⬡</span>
          <span className="reward-view__item-label">+{rewardGold} CREDITS</span>
          <span className="reward-view__item-total">({run.loop.gold} total)</span>
        </div>
        {rewardRelic ? (
          <div
            className="reward-view__item reward-view__item--relic"
            title={getRelicDescription(rewardRelic)}
          >
            <span className="reward-view__item-icon">◆</span>
            <span className="reward-view__item-label">
              {getRelicDef(rewardRelic)?.name ?? rewardRelic}
            </span>
            <span className="reward-view__item-desc">{getRelicDescription(rewardRelic)}</span>
          </div>
        ) : null}
      </div>

      {needsRelicPick ? (
        <div className="reward-view__cards-section">
          <div className="reward-view__cards-heading-row">
            <div className="reward-view__cards-heading">
              CHOOSE A RELIC — {rewardRelicOffers.length} OPTIONS
            </div>
            <button
              type="button"
              className="reward-view__reroll-btn"
              disabled={run.loop.rerolls <= 0}
              onClick={handleRerollRewardRelics}
            >
              Reroll ({run.loop.rerolls})
            </button>
          </div>
          <div className="reward-view__relics">
            {rewardRelicOffers.map((relicId) => {
              const def = getRelicDef(relicId);
              return (
                <button
                  key={relicId}
                  type="button"
                  className="reward-view__relic-card"
                  onClick={() => handlePickRewardRelic(relicId)}
                >
                  <div className="reward-view__relic-rarity">{def?.rarity ?? 'relic'}</div>
                  <div className="reward-view__relic-name">{def?.name ?? relicId}</div>
                  <div className="reward-view__relic-desc">{getRelicDescription(relicId)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!needsRelicPick ? (
        <div className="reward-view__cards-section">
          <div className="reward-view__cards-heading-row">
            <div className="reward-view__cards-heading">
              CHOOSE A CARD — {rewardCardOffers.length} OPTIONS
            </div>
            <button
              type="button"
              className="reward-view__reroll-btn"
              disabled={run.loop.rerolls <= 0}
              onClick={handleRerollRewardCards}
            >
              Reroll ({run.loop.rerolls})
            </button>
          </div>
          <div className="reward-view__cards">
            {rewardCardOffers.map((cardId) => {
              let card;
              try {
                card = content.get(cardId);
              } catch {
                return null;
              }
              const desc = buildCardDescription(card);
              return (
                <button
                  key={cardId}
                  type="button"
                  className="reward-view__card reward-view__card--full"
                  onClick={() => handlePickRewardCard(cardId)}
                >
                  <div
                    className="reward-view__card-art"
                    style={{ backgroundImage: `url(${cardArtUrlFromDef(card)})` }}
                  >
                    <span className="reward-view__card-tier">T{card.card_tier}</span>
                    <span className="reward-view__card-cost">EN {card.charge_cost}</span>
                  </div>
                  <div className="reward-view__card-body">
                    <div className="reward-view__card-name">{card.name}</div>
                    <div className="reward-view__card-tags">
                      {(card.tags ?? []).map((t: string) => (
                        <span key={t} className="reward-view__card-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="reward-view__card-desc">
                      <CardDescriptionRich text={desc} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {canSkipCards ? (
            <button type="button" className="reward-view__skip" onClick={handleSkipReward}>
              Skip →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
