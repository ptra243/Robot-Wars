import { useMemo, useState, type CSSProperties } from 'react';
import { publicUrl } from '../assetUrl';
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

type PilotFactionId = 'scavengers' | 'clockwork' | 'cyberpunk';

const FACTION_TABS: {
  id: PilotFactionId;
  label: string;
  shortLabel: string;
  icon: string;
}[] = [
  {
    id: 'scavengers',
    label: 'Scavengers',
    shortLabel: 'Scavengers',
    icon: publicUrl('/factions/scavengers.jpg'),
  },
  {
    id: 'clockwork',
    label: 'Clockwork Collective',
    shortLabel: 'Clockwork',
    icon: publicUrl('/factions/clockwork.jpg'),
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk Ninjas',
    shortLabel: 'Cyberpunk',
    icon: publicUrl('/factions/cyberpunk.jpg'),
  },
];

function factionLabel(faction: string): string {
  const tab = FACTION_TABS.find((t) => t.id === faction);
  return tab?.label ?? faction;
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
    <div className={`pilot-card-new pilot-card-new--${pilot.faction}`}>
      <div className="pilot-card-new__bevel" aria-hidden />
      <div className="pilot-card-new__portrait">
        {portrait ? (
          <img src={portrait} alt={pilot.name} />
        ) : (
          <div className="pilot-card-new__portrait-placeholder">?</div>
        )}
      </div>

      <div className="pilot-card-new__info">
        <div className="pilot-card-new__intro">
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
  const run = useGameStore((s) => s.run);
  const [factionId, setFactionId] = useState<PilotFactionId>('scavengers');
  const [indexInFaction, setIndexInFaction] = useState(0);

  const factionPilots = useMemo(
    () => PILOT_DEFS.filter((p) => p.faction === factionId),
    [factionId],
  );
  const safeIndex = Math.min(indexInFaction, Math.max(0, factionPilots.length - 1));
  const pilot = factionPilots[safeIndex] ?? factionPilots[0];

  if (!pilot) {
    return null;
  }

  const bgUrl = getPilotSelectBackgroundUrl(pilot.id);
  const activeTab = FACTION_TABS.find((t) => t.id === factionId) ?? FACTION_TABS[0]!;

  return (
    <div
      className={`pilot-select-screen pilot-select-screen--${factionId}`}
      style={{ '--pilot-bg': `url(${bgUrl})` } as CSSProperties}
    >
      <div className="pilot-select-screen__header">
        <h2 className="pilot-select-screen__title">Choose Your Pilot</h2>
        <p className="pilot-select-screen__subtitle">
          Your pilot shapes every run — traits unlock as your spirit awakens
        </p>
      </div>

      <div className="pilot-faction-tabs" role="tablist" aria-label="Pilot factions">
        {FACTION_TABS.map((tab) => {
          const selected = tab.id === factionId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`pilot-faction-tab pilot-faction-tab--${tab.id}${
                selected ? ' pilot-faction-tab--active' : ''
              }`}
              onClick={() => {
                setFactionId(tab.id);
                setIndexInFaction(0);
              }}
            >
              <img className="pilot-faction-tab__icon" src={tab.icon} alt="" aria-hidden />
              <span className="pilot-faction-tab__name">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="pilot-carousel-wrap">
        <div className="pilot-carousel">
          <button
            className="pilot-carousel__arrow"
            type="button"
            disabled={safeIndex === 0}
            aria-label="Previous pilot"
            onClick={() => {
              setIndexInFaction((i) => Math.max(0, i - 1));
            }}
          >
            ‹
          </button>

          <PilotCardDisplay key={pilot.id} pilot={pilot} />

          <button
            className="pilot-carousel__arrow"
            type="button"
            disabled={safeIndex >= factionPilots.length - 1}
            aria-label="Next pilot"
            onClick={() => {
              setIndexInFaction((i) => Math.min(factionPilots.length - 1, i + 1));
            }}
          >
            ›
          </button>
        </div>

        {factionPilots.length > 1 ? (
          <div className="pilot-carousel__dots">
            {factionPilots.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Select ${p.name}`}
                className={`pilot-carousel__dot ${i === safeIndex ? 'pilot-carousel__dot--active' : ''}`}
                onClick={() => {
                  setIndexInFaction(i);
                }}
              />
            ))}
          </div>
        ) : null}
        <p className="pilot-carousel__faction-readout">
          {activeTab.label} · {String(safeIndex + 1)}/{String(factionPilots.length)}
        </p>
      </div>

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
