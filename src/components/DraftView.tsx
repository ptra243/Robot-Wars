import { useCallback, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useRunCardContent } from '../hooks/useRunCardContent';
import { getPilotById } from '../core/pilots';
import { NEUTRAL_STARTER_DECK, DRAFT_ROUNDS, DRAFT_OFFERS_PER_ROUND } from '../core/draft';
import { forgeCardFromDef } from '../features/forge/forgeCardModel';
import { CardHoverPopover, LibraryCard } from '../features/forge/ui';
import type { ForgeCard, HoverState } from '../features/forge/ui';
import './poc/forge-poc.css';
import './run-loop-theme.css';

const STARTER_CARD_NAMES: Record<string, string> = {
  neutral_barrier_t1: 'Barrier',
  neutral_feint_t1: 'Feint',
  salvage_strike_t1: 'Salvage Strike',
  neutral_servo_t1: 'Servo Tune-Up',
  neutral_multi_strike_t1: 'Multi-Strike',
};

export function DraftView() {
  const run = useGameStore((s) => s.run);
  const draftOffers = useGameStore((s) => s.draftOffers);
  const draftStep = useGameStore((s) => s.draftStep);
  const handleDraftPick = useGameStore((s) => s.handleDraftPick);

  const content = useRunCardContent(run.seed);
  const pilot = getPilotById(run.spirit.id);

  const [hover, setHover] = useState<HoverState | null>(null);

  const setHoverCardAt = useCallback((card: ForgeCard | null, ev?: { clientX: number; clientY: number }) => {
    if (!card || !ev) {
      setHover(null);
      return;
    }
    setHover({ card, x: ev.clientX, y: ev.clientY });
  }, []);

  const currentOffers = draftOffers[draftStep] ?? [];
  const pickedCardIds = run.deck.filter((id) => !NEUTRAL_STARTER_DECK.includes(id));
  const totalDraftPicks = Math.min(DRAFT_ROUNDS, draftOffers.length);

  return (
    <div className="run-loop draft-view">
      <div className="run-loop__topbar">
        <div>
          <h2 className="run-loop__title">
            Draft Your <span className="run-loop__title-accent">Deck</span>
          </h2>
          {pilot ? (
            <p className="draft-view__pilot-line">
              Pilot: <strong>{pilot.name}</strong>
            </p>
          ) : null}
        </div>
        <div className="draft-view__progress">
          {Array.from({ length: totalDraftPicks }).map((_, i) => (
            <div
              key={i}
              className={`draft-view__pip ${i < draftStep ? 'draft-view__pip--done' : ''} ${i === draftStep ? 'draft-view__pip--active' : ''}`}
            />
          ))}
          <span className="draft-view__progress-label">
            Pick {Math.min(draftStep + 1, totalDraftPicks)}/{totalDraftPicks}
          </span>
        </div>
      </div>

      <div className="draft-view__deck-preview">
        <span className="draft-view__section-label">Your Starting Deck</span>
        <div className="draft-view__deck-chips">
          {NEUTRAL_STARTER_DECK.map((id) => (
            <span key={id} className="draft-view__chip draft-view__chip--starter">
              {STARTER_CARD_NAMES[id] ?? id}
            </span>
          ))}
          {pickedCardIds.map((id, idx) => {
            let name = id;
            try {
              name = content.get(id).name;
            } catch {
              /* unknown id */
            }
            return (
              <span key={`${id}-${String(idx)}`} className="draft-view__chip draft-view__chip--picked">
                {name}
              </span>
            );
          })}
          {Array.from({ length: totalDraftPicks - pickedCardIds.length }).map((_, i) => (
            <span key={`empty-${String(i)}`} className="draft-view__chip draft-view__chip--empty">
              + Pick {String(draftStep + 1 + i)}
            </span>
          ))}
        </div>
      </div>

      <div className="draft-view__offers-section">
        <div className="draft-view__section-label draft-view__section-label--offers">
          Choose 1 of {currentOffers.length || DRAFT_OFFERS_PER_ROUND}
        </div>

        <div className="draft-view__offers-row">
          {currentOffers.map((cardId) => {
            let forgeCard: ForgeCard;
            try {
              forgeCard = forgeCardFromDef(content.get(cardId));
            } catch {
              return null;
            }

            return (
              <LibraryCard
                key={cardId}
                pickMode
                card={forgeCard}
                isDragging={false}
                onHover={setHoverCardAt}
                onAssign={() => {}}
                onPick={() => {
                  handleDraftPick(cardId);
                }}
              />
            );
          })}
        </div>
      </div>

      {hover ? <CardHoverPopover hover={hover} /> : null}
    </div>
  );
}
