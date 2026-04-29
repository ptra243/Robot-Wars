import { useState } from 'react';
import {
  getPilotSelectBackgroundUrl,
  PILOT_DEFS,
  PILOT_PORTRAITS,
  type PilotDef,
} from '../core/pilots';
import { TRAIT_REGISTRY } from '../core/traits';
import { NEUTRAL_STARTER_DECK } from '../core/draft';
import { useGameStore } from '../stores/gameStore';
import { useRunCardContent } from '../hooks/useRunCardContent';
import { buildCardDescription } from '../ui/cardText';
import { CardDescriptionRich } from './CardDescriptionRich';
import './pilot-select.css';

function factionLabel(faction: string): string {
  if (faction === 'cyberpunk') return 'Cyberpunk Ninjas';
  if (faction === 'scavengers') return 'Scavengers';
  return faction;
}

function DeckMiniCard({ cardId, seed }: { cardId: string; seed: number }) {
  const content = useRunCardContent(seed);
  let name = cardId;
  let faction = 'Neutral';
  let tags = '';
  let desc = '';
  try {
    const card = content.get(cardId);
    name = card.name;
    faction = card.neutral ? 'Neutral' : factionLabel(card.faction);
    tags = card.tags.join(' · ');
    desc = buildCardDescription(card, { omitTagsAndKeywords: false });
  } catch {
    /* unknown id */
  }

  return (
    <div className="deck-mini-card">
      <span className="deck-mini-card__faction">{faction}</span>
      <span className="deck-mini-card__name">{name}</span>
      {tags ? <span className="deck-mini-card__tags">{tags}</span> : null}
      <div className="deck-mini-card__tooltip">
        <CardDescriptionRich text={desc} />
      </div>
    </div>
  );
}

function PilotCardDisplay({ pilot }: { pilot: PilotDef }) {
  const handleSelectPilot = useGameStore((s) => s.handleSelectPilot);
  const [unlockAllAwakenings, setUnlockAllAwakenings] = useState(false);
  const portrait = PILOT_PORTRAITS[pilot.id];

  return (
    <div className="pilot-card-new">
      {/* Portrait */}
      <div className="pilot-card-new__portrait">
        {portrait ? (
          <img src={portrait} alt={pilot.name} />
        ) : (
          <div className="pilot-card-new__portrait-placeholder">?</div>
        )}
      </div>

      {/* Info */}
      <div className="pilot-card-new__info">
        <div>
          <span className="pilot-card-new__faction">{factionLabel(pilot.faction)}</span>
          <div className="pilot-card-new__name">{pilot.name}</div>
          <p className="pilot-card-new__flavor">{pilot.flavor}</p>
        </div>

        <div className="pilot-card-new__traits">
          {[
            { tier: 'Base', id: pilot.traitIds.base, locked: false },
            { tier: 'Aw0', id: pilot.traitIds.aw0, locked: true },
            { tier: 'Aw1', id: pilot.traitIds.aw1, locked: true },
          ].map(({ tier, id, locked }) => {
            const trait = TRAIT_REGISTRY[id];
            return (
              <div
                key={id}
                className={`pilot-card-new__trait${locked ? ' pilot-card-new__trait--locked' : ''}`}
              >
                <div className="pilot-card-new__trait-header">
                  <span className="pilot-card-new__trait-tier">{tier}</span>
                  <span className="pilot-card-new__trait-label">{trait?.label ?? id}</span>
                </div>
                <p className="pilot-card-new__trait-text">{trait?.text ?? '—'}</p>
              </div>
            );
          })}
        </div>

        <div className="pilot-card-new__cta">
          <label className="pilot-card-new__toggle">
            <input
              type="checkbox"
              checked={unlockAllAwakenings}
              onChange={(e) => {
                setUnlockAllAwakenings(e.target.checked);
              }}
            />
            <span>Dev mode: start with all awakening powers</span>
          </label>
          <button
            className="pilot-start-btn"
            type="button"
            onClick={() => {
              handleSelectPilot(pilot.id, { unlockAllAwakenings });
            }}
          >
            Start Run with {pilot.name}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PilotSelectView() {
  const [index, setIndex] = useState(0);
  const run = useGameStore((s) => s.run);
  const pilot = PILOT_DEFS[index]!;

  const bgUrl = getPilotSelectBackgroundUrl(pilot.id);

  return (
    <div
      className="pilot-select-screen"
      style={{ '--pilot-bg': `url(${bgUrl})` } as React.CSSProperties}
    >
      <div className="pilot-select-screen__header">
        <h2 className="pilot-select-screen__title">Choose Your Pilot</h2>
        <p className="pilot-select-screen__subtitle">
          Your pilot shapes every run — traits unlock as your spirit awakens
        </p>
      </div>

      {/* Pilot carousel */}
      <div style={{ width: '100%', maxWidth: 780 }}>
        <div className="pilot-carousel">
          <button
            className="pilot-carousel__arrow"
            type="button"
            disabled={index === 0}
            aria-label="Previous pilot"
            onClick={() => {
              setIndex((i) => Math.max(0, i - 1));
            }}
          >
            ‹
          </button>

          <PilotCardDisplay pilot={pilot} />

          <button
            className="pilot-carousel__arrow"
            type="button"
            disabled={index === PILOT_DEFS.length - 1}
            aria-label="Next pilot"
            onClick={() => {
              setIndex((i) => Math.min(PILOT_DEFS.length - 1, i + 1));
            }}
          >
            ›
          </button>
        </div>

        {/* Dot indicators */}
        {PILOT_DEFS.length > 1 ? (
          <div className="pilot-carousel__dots">
            {PILOT_DEFS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Select ${p.name}`}
                className={`pilot-carousel__dot ${i === index ? 'pilot-carousel__dot--active' : ''}`}
                onClick={() => {
                  setIndex(i);
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Starter deck strip */}
      <div className="pilot-deck-strip">
        <span className="pilot-deck-strip__label">Neutral Starter Deck — all pilots begin here</span>
        <div className="pilot-deck-strip__cards">
          {NEUTRAL_STARTER_DECK.map((id) => (
            <DeckMiniCard key={id} cardId={id} seed={run.seed} />
          ))}
        </div>
      </div>
    </div>
  );
}
