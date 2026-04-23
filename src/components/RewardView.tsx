import { useGameStore } from '../stores/gameStore';
import { useRunCardContent } from '../hooks/useRunCardContent';
import { buildCardDescription } from '../ui/cardText';
import './reward-view.css';

/** Format a relic ID like "potency_start_plus_1" → "Potency: Start +1" */
function formatRelicName(id: string): string {
  return id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Format a relic ID into a short tooltip description */
function relicDescription(id: string): string {
  if (id === 'potency_start_plus_1') return 'Begin each battle with +1 Potency stack.';
  if (id === 'charge_start_plus_2') return 'Begin each battle with +2 energy.';
  if (id === 'if_no_shield_gain_shield_2') return 'At turn start, if you have no shield, gain 2 shield.';
  if (id === 'regen_start_turn_1') return 'At turn start, recover 1 HP.';
  if (id === 'neutral_non_basic_gain_junk_2') return 'Playing neutral non-basic cards grants +2 junk.';
  if (id === 'hp_pay_damage_equal') return 'HP paid for cards is reflected as damage.';
  if (id === 'transform_strike_2') return 'Transforming cards triggers Strike 2.';
  if (id === 'trash_dynamo') return 'If you gained energy from a card, gain 2 junk.';
  if (id === 'scrap_recycling') return 'When you gain junk, recover HP.';
  if (id === 'junk_shrapnel') return 'When you spend junk, deal that much damage.';
  if (id === 'epic_prime_directive') return 'Deck cycles grant potency and trigger Emergency Protocol mode.';
  if (id === 'epic_overclock_mandate') return 'Threshold cards gain >40 junk: Overclock.';
  if (id === 'epic_basic_instincts') return 'All-neutral decks give basic strikes Overclock.';
  if (id === 'epic_emergency_junk_shield')
    return 'Incoming damage is absorbed by junk first; non-strike is extra effective.';
  return id;
}

export function RewardView() {
  const run = useGameStore((s) => s.run);
  const rewardGold = useGameStore((s) => s.rewardGold);
  const rewardCardOffers = useGameStore((s) => s.rewardCardOffers);
  const rewardRelic = useGameStore((s) => s.rewardRelic);
  const handlePickRewardCard = useGameStore((s) => s.handlePickRewardCard);
  const handleSkipReward = useGameStore((s) => s.handleSkipReward);

  const content = useRunCardContent(run.seed);
  const encounterType = run.loop.pendingEncounterType;
  const label = encounterType === 'elite' ? 'ELITE' : encounterType === 'boss' ? 'BOSS' : 'BATTLE';

  return (
    <div className="reward-view">
      {/* Header */}
      <div className="reward-view__header">
        <div className="reward-view__eyebrow">{label} COMPLETE</div>
        <h2 className="reward-view__title">REWARDS</h2>
      </div>

      {/* Collected items: gold + relic */}
      <div className="reward-view__items">
        <div className="reward-view__item reward-view__item--gold">
          <span className="reward-view__item-icon">⬡</span>
          <span className="reward-view__item-label">+{rewardGold} CREDITS</span>
          <span className="reward-view__item-total">({run.loop.gold} total)</span>
        </div>
        {rewardRelic ? (
          <div className="reward-view__item reward-view__item--relic" title={relicDescription(rewardRelic)}>
            <span className="reward-view__item-icon">◆</span>
            <span className="reward-view__item-label">{formatRelicName(rewardRelic)}</span>
            <span className="reward-view__item-desc">{relicDescription(rewardRelic)}</span>
          </div>
        ) : null}
      </div>

      {/* Card pick section */}
      <div className="reward-view__cards-section">
        <div className="reward-view__cards-heading">
          CHOOSE A CARD — {rewardCardOffers.length} OPTIONS
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
                className="reward-view__card"
                onClick={() => handlePickRewardCard(cardId)}
              >
                <div className="reward-view__card-tier">T{card.card_tier}</div>
                <div className="reward-view__card-name">{card.name}</div>
                <div className="reward-view__card-tags">
                  {(card.tags ?? []).map((t: string) => (
                    <span key={t} className="reward-view__card-tag">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="reward-view__card-desc">{desc}</div>
              </button>
            );
          })}
        </div>

        <button type="button" className="reward-view__skip" onClick={handleSkipReward}>
          Skip →
        </button>
      </div>
    </div>
  );
}
