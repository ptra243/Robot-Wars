import { useGameStore } from '../stores/gameStore';
import './run-hud-bar.css';

export function RunHudBar() {
  const run = useGameStore((s) => s.run);

  return (
    <div className="run-hud-bar" role="status" aria-label="Run information">
      <span className="run-hud-bar__item">Act {run.loop.act}</span>
      <span className="run-hud-bar__item">Encounter {run.encounterIndex + 1}</span>
      <span className="run-hud-bar__item">Step {run.loop.stepsInAct}/10</span>
      <span className="run-hud-bar__item">Gold {run.loop.gold}</span>
      <span className="run-hud-bar__item">Rerolls {run.loop.rerolls}</span>
      <span className="run-hud-bar__item">Awakening {run.loop.awakening}</span>
      <span className="run-hud-bar__item">Hearts {run.loop.hearts}</span>
    </div>
  );
}
