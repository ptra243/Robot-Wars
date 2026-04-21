import type { CSSProperties } from 'react';
import { getPilotSelectBackgroundUrl } from '../core/pilots';
import { useGameStore } from '../stores/gameStore';
import './run-loop-theme.css';

function titleForType(type: string): string {
  if (type === 'battle') return 'Battle';
  if (type === 'elite') return 'Elite';
  if (type === 'boss') return 'Boss';
  if (type === 'shop') return 'Shop';
  return 'Random event';
}

export function TravelView() {
  const run = useGameStore((s) => s.run);
  const pick = useGameStore((s) => s.handlePickTravelOffer);
  const openForge = useGameStore((s) => s.handleOpenForge);
  const rerollOffers = useGameStore((s) => s.handleRerollTravelOffers);

  const travelBg = getPilotSelectBackgroundUrl(run.spirit.id);

  return (
    <div
      className="run-loop run-loop--travel"
      style={{ '--travel-pilot-bg': `url(${travelBg})` } as CSSProperties}
    >
      <div className="run-loop__topbar">
        <h2 className="run-loop__title">
          Run <span className="run-loop__title-accent">Navigator</span>
        </h2>
        <div className="run-loop__hud">
          <div className="run-loop__hud-item run-loop__hud-item--accent">
            <span className="run-loop__hud-label">ACT</span>
            <span className="run-loop__hud-value">{run.loop.act}</span>
          </div>
          <div className="run-loop__hud-item">
            <span className="run-loop__hud-label">STEP</span>
            <span className="run-loop__hud-value">{run.loop.stepsInAct}/10</span>
          </div>
          <div className="run-loop__hud-item">
            <span className="run-loop__hud-label">HEARTS</span>
            <span className="run-loop__hud-value">{run.loop.hearts}</span>
          </div>
          <div className="run-loop__hud-item">
            <span className="run-loop__hud-label">GOLD</span>
            <span className="run-loop__hud-value">{run.loop.gold}</span>
          </div>
          <div className="run-loop__hud-item">
            <span className="run-loop__hud-label">REROLLS</span>
            <span className="run-loop__hud-value">{run.loop.rerolls}</span>
          </div>
          <div className="run-loop__hud-item">
            <span className="run-loop__hud-label">AWAKENING</span>
            <span className="run-loop__hud-value">{run.loop.awakening}</span>
          </div>
        </div>
      </div>
      <div className="run-loop__travel-stage">
        <div className="run-loop__offers">
          {run.loop.travelOffers.map((offer, idx) => (
            <button
              className="run-loop__offer"
              key={offer?.id ?? `empty-${String(idx)}`}
              type="button"
              disabled={!offer}
              onClick={() => {
                pick(idx);
              }}
            >
              <span className="run-loop__offer-type">Travel node</span>
              <span className="run-loop__offer-label">{offer ? titleForType(offer.type) : 'Empty'}</span>
              <span className="run-loop__offer-note">
                {offer ? 'Resolve and refill this slot' : 'No available node'}
              </span>
            </button>
          ))}
        </div>
        <div className="run-loop__travel-footer">
          <div className="run-loop__actions">
            <button className="run-loop__btn" type="button" onClick={openForge}>
              Open forge/deck builder
            </button>
            <button className="run-loop__btn run-loop__btn--primary" type="button" onClick={rerollOffers}>
              Reroll travel offers (1 reroll)
            </button>
          </div>
          <div className="run-loop__status">Reshuffles left: {run.loop.reshufflesRemaining}</div>
        </div>
      </div>
    </div>
  );
}

