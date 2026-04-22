import { useGameStore } from '../stores/gameStore';
import './run-hud-bar.css';

export function RunHudBar() {
  const run = useGameStore((s) => s.run);
  const goToMenu = useGameStore((s) => s.handleBackToTravel);
  const actItems = [
    { label: 'ACT', value: String(run.loop.act) },
    { label: 'ENCOUNTER', value: `${String(run.loop.stepsInAct)}/10` },
  ] as const;
  const statItems = [
    { label: 'GOLD', value: String(run.loop.gold), icon: '⬡' },
    { label: 'REROLLS', value: String(run.loop.rerolls), icon: '⟳' },
    { label: 'HEARTS', value: String(run.loop.hearts), icon: '♥' },
  ] as const;

  return (
    <div className="run-hud-bar" role="status" aria-label="Run information">
      <button
        type="button"
        className="run-hud-bar__menu-btn"
        onClick={goToMenu}
      >
        ← Back
      </button>
      <div className="run-hud-bar__center">
        {actItems.map((item) => (
          <span key={item.label} className="run-hud-bar__item run-hud-bar__item--accent">
            <span className="run-hud-bar__label">{item.label}</span>
            <span className="run-hud-bar__value">{item.value}</span>
          </span>
        ))}
      </div>
      <div className="run-hud-bar__right">
        {statItems.map((item) => (
          <span key={item.label} className="run-hud-bar__item run-hud-bar__item--stat">
            <span className="run-hud-bar__label">
              <span className="run-hud-bar__icon" aria-hidden>
                {item.icon}
              </span>{' '}
              {item.label}
            </span>
            <span className="run-hud-bar__value">{item.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
