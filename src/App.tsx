import { useState } from 'react';
import { GameApp } from './components/GameApp';
import { BattleSimulationApp } from './components/BattleSimulationApp';
import { CompendiumView } from './components/CompendiumView';
import { BattlePOC } from './components/poc/BattlePOC';
import { useGameStore } from './stores/gameStore';
import './components/landing.css';

type AppView = 'landing' | 'run' | 'simulation' | 'compendium' | 'battlePoc';

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="landing__back-btn" onClick={onClick}>
      ← Menu
    </button>
  );
}

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const handleResetRun = useGameStore((s) => s.handleReset);
  const run = useGameStore((s) => s.run);

  const goHome = () => setView('landing');

  if (view === 'run') {
    return (
      <>
        <GameApp />
        <BackButton onClick={goHome} />
      </>
    );
  }

  if (view === 'simulation') {
    return (
      <>
        <BattleSimulationApp />
        <BackButton onClick={goHome} />
      </>
    );
  }

  if (view === 'compendium') {
    return <CompendiumView onExit={goHome} />;
  }

  if (view === 'battlePoc') {
    return <BattlePOC onExit={goHome} />;
  }

  const seedHex = (run.seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const seedLabel = `${seedHex.slice(0, 4)}-${seedHex.slice(4, 8)}`;

  return (
    <div className="landing">
      <div className="landing__bg" />
      <div className="landing__scanlines" />
      <div className="landing__vignette" />

      <div className="landing__panel">
        {/* Corner bracket decorations */}
        <div className="landing__corner landing__corner--tl" />
        <div className="landing__corner landing__corner--tr" />
        <div className="landing__corner landing__corner--bl" />
        <div className="landing__corner landing__corner--br" />

        <header className="landing__header">
          <div className="landing__eyebrow">
            <span className="landing__eyebrow-accent">//</span> TACTICAL COMBAT SYSTEM
          </div>
          <h1 className="landing__title">
            ROBOT<span className="landing__title-accent">WARS</span>
          </h1>
          <p className="landing__subtitle">Select a deployment mode</p>
          <div className="landing__rule" />
        </header>

        <nav className="landing__nav">
          <button
            type="button"
            className="landing__btn landing__btn--primary"
            onClick={() => {
              handleResetRun();
              setView('run');
            }}
          >
            Start Run
            <span className="landing__btn-arrow">›</span>
          </button>

          <button
            type="button"
            className="landing__btn landing__btn--cyan"
            onClick={() => setView('simulation')}
          >
            Battle Simulation
            <span className="landing__btn-arrow">›</span>
          </button>

          <button
            type="button"
            className="landing__btn landing__btn--purple"
            onClick={() => setView('compendium')}
          >
            Compendium
            <span className="landing__btn-arrow">›</span>
          </button>

          <button
            type="button"
            className="landing__btn landing__btn--ghost"
            onClick={() => setView('battlePoc')}
          >
            POC Battle
            <span className="landing__btn-hint">temporary</span>
          </button>
        </nav>

        <footer className="landing__footer">
          <span className="landing__status-dot" />
          System ready
          <span className="landing__status-seed">SEED {seedLabel}</span>
        </footer>
      </div>
    </div>
  );
}
