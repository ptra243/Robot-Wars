import { useEffect } from 'react';
import type { ForgeDeckSimulationResult } from '../../../core/run/forgeDeckSimulation';
import { ForgeDeckSimChart } from './ForgeDeckSimChart';

interface ForgeSimModalProps {
  simulation: ForgeDeckSimulationResult;
  onClose: () => void;
  onSimulationRoundHover?: (
    round: number | null,
    pointer: { clientX: number; clientY: number } | null,
  ) => void;
}

export function ForgeSimModal({ simulation, onClose, onSimulationRoundHover }: ForgeSimModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="forge-poc__modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forge-sim-modal-title"
    >
      <button
        type="button"
        className="forge-poc__modal-scrim"
        aria-label="Close simulation"
        onClick={onClose}
      />
      <div className="forge-poc__modal-panel">
        <header className="forge-poc__modal-header">
          <h2 id="forge-sim-modal-title" className="forge-poc__modal-title">
            Deck simulation
          </h2>
          <button
            type="button"
            className="forge-poc__btn forge-poc__btn--exit"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="forge-poc__modal-body">
          <ForgeDeckSimChart
            simulation={simulation}
            layout="large"
            onRoundPointer={onSimulationRoundHover}
          />
        </div>
      </div>
    </div>
  );
}
