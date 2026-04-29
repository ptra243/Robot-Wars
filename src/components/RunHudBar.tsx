import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getRelicDef, getRelicDescription, stepsCapForAct } from '../core/run';
import { useGameStore } from '../stores/gameStore';
import './run-hud-bar.css';

export function RunHudBar() {
  const run = useGameStore((s) => s.run);
  const goToMenu = useGameStore((s) => s.handleBackToTravel);
  const [showRelics, setShowRelics] = useState(false);
  const relicBtnRef = useRef<HTMLButtonElement>(null);
  const [relicPanelPos, setRelicPanelPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const cap = run.loop.infiniteMode
    ? null
    : stepsCapForAct(run.loop.act);
  const stepLabel =
    run.loop.infiniteMode
      ? `♾ ${String(run.loop.act4BattleIndex)}`
      : cap != null && cap > 0
        ? `${String(run.loop.stepsInAct)}/${String(cap)}`
        : String(run.loop.stepsInAct);
  const actItems = [
    { label: 'ACT', value: String(run.loop.act) },
    { label: 'ENCOUNTER', value: stepLabel },
  ] as const;
  const statItems = [
    { label: 'GOLD', value: String(run.loop.gold), icon: '⬡' },
    { label: 'REROLLS', value: String(run.loop.rerolls), icon: '⟳' },
    { label: 'HEARTS', value: String(run.loop.hearts), icon: '♥' },
  ] as const;
  const relicRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of run.loop.relicIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()].map(([id, count]) => ({
      id,
      name: getRelicDef(id)?.name ?? id,
      desc: getRelicDescription(id),
      count,
    }));
  }, [run.loop.relicIds]);

  useLayoutEffect(() => {
    if (!showRelics) {
      setRelicPanelPos(null);
      return;
    }
    const btn = relicBtnRef.current;
    if (!btn) {
      return;
    }
    const r = btn.getBoundingClientRect();
    setRelicPanelPos({
      top: r.bottom + 6,
      right: Math.max(10, window.innerWidth - r.right),
    });
  }, [showRelics]);

  const relicPanel =
    showRelics && relicPanelPos
      ? createPortal(
          <div
            className="run-hud-bar__relic-panel run-hud-bar__relic-panel--portal"
            style={{
              position: 'fixed',
              top: relicPanelPos.top,
              right: relicPanelPos.right,
              zIndex: 12000,
            }}
          >
            <div className="run-hud-bar__relic-title">Owned relics</div>
            {relicRows.length === 0 ? (
              <div className="run-hud-bar__relic-empty">No relics yet.</div>
            ) : (
              relicRows.map((r) => (
                <div key={r.id} className="run-hud-bar__relic-row">
                  <div className="run-hud-bar__relic-name">
                    {r.name}
                    {r.count > 1 ? ` x${String(r.count)}` : ''}
                  </div>
                  <div className="run-hud-bar__relic-desc">{r.desc}</div>
                </div>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

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
        <button
          ref={relicBtnRef}
          type="button"
          className="run-hud-bar__menu-btn"
          onClick={() => setShowRelics((v) => !v)}
          aria-expanded={showRelics}
        >
          Relics ({run.loop.relicIds.length})
        </button>
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
      {relicPanel}
    </div>
  );
}
