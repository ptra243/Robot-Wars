import { useGameStore } from '../stores/gameStore';
import './run-loop-theme.css';

export function RetryAssistView() {
  const run = useGameStore((s) => s.run);
  const choose = useGameStore((s) => s.handleChooseRetryAssist);
  return (
    <div className="run-loop">
      <div className="run-loop__topbar">
        <h2 className="run-loop__title">
          Defeat <span className="run-loop__title-accent">Assist</span>
        </h2>
        <div className="run-loop__hud">
          <div className="run-loop__hud-item">
            <span className="run-loop__hud-label">HEARTS LEFT</span>
            <span className="run-loop__hud-value">{run.loop.hearts}</span>
          </div>
          <div className="run-loop__hud-item run-loop__hud-item--accent">
            <span className="run-loop__hud-label">ENEMY HP</span>
            <span className="run-loop__hud-value">{Math.round(run.loop.enemyHpMultiplier * 100)}%</span>
          </div>
        </div>
      </div>
      <div className="run-loop__actions">
        <button className="run-loop__btn run-loop__btn--primary" type="button" onClick={() => {
          choose('enemy_hp_down');
        }}>
          Retry with -10% enemy HP
        </button>
        <button className="run-loop__btn run-loop__btn--danger" type="button" onClick={() => {
          choose('free_rerolls');
        }}>
          Retry with +3 free card rerolls
        </button>
      </div>
      <div className="run-loop__status">Choose one assist to immediately replay this encounter.</div>
    </div>
  );
}

