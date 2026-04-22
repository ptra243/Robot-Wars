import { useMemo, useState } from 'react';

export type BattleAnalysisSeriesKey = 'energy' | 'damage' | 'shields' | 'stalls' | 'junk';

export interface BattleAnalysisRoundMetrics {
  round: number;
  energy: number;
  damage: number;
  shields: number;
  stalls: number;
  junk: number;
}

const BATTLE_ANALYSIS_SERIES: Array<{
  key: BattleAnalysisSeriesKey;
  label: string;
  color: string;
}> = [
  { key: 'energy', label: 'Energy', color: '#58aec7' },
  { key: 'damage', label: 'Damage', color: '#e07a52' },
  { key: 'shields', label: 'Shields', color: '#6fa8bd' },
  { key: 'stalls', label: 'Stalls', color: '#c084fc' },
  { key: 'junk', label: 'Junk', color: '#a3e635' },
];

interface BattleAnalysisModalProps {
  selected: 'player' | 'enemy';
  onSelect: (s: 'player' | 'enemy') => void;
  onClose: () => void;
  playerSeries: BattleAnalysisRoundMetrics[];
  enemySeries: BattleAnalysisRoundMetrics[];
}

export function BattleAnalysisModal({
  selected,
  onSelect,
  onClose,
  playerSeries,
  enemySeries,
}: BattleAnalysisModalProps) {
  const [valueMode, setValueMode] = useState<'discrete' | 'cumulative'>('discrete');
  const [visible, setVisible] = useState<Record<BattleAnalysisSeriesKey, boolean>>({
    energy: true,
    damage: true,
    shields: true,
    stalls: true,
    junk: true,
  });

  const sourceRows = selected === 'player' ? playerSeries : enemySeries;
  const rows = useMemo(() => {
    if (sourceRows.length === 0) return sourceRows;
    if (valueMode === 'discrete') return sourceRows;
    const initial = sourceRows[0]!;
    let cumDamage = 0;
    let cumStalls = 0;
    return sourceRows.map((row) => {
      cumDamage += row.damage;
      cumStalls += row.stalls;
      return {
        ...row,
        energy: row.energy - initial.energy,
        shields: row.shields - initial.shields,
        junk: row.junk - initial.junk,
        damage: cumDamage,
        stalls: cumStalls,
      };
    });
  }, [sourceRows, valueMode]);

  const visibleKeys = BATTLE_ANALYSIS_SERIES.filter((s) => visible[s.key]).map((s) => s.key);
  const maxX = Math.max(1, rows.length);
  let minY = 0;
  let maxY = 1;
  if (visibleKeys.length > 0 && rows.length > 0) {
    minY = Number.POSITIVE_INFINITY;
    maxY = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      for (const key of visibleKeys) {
        const v = row[key];
        if (v < minY) minY = v;
        if (v > maxY) maxY = v;
      }
    }
    minY = Math.min(0, minY - 2);
    maxY = Math.max(1, maxY + 2);
  }
  const ySpan = Math.max(1e-6, maxY - minY);
  const xPct = (round: number) => ((round - 1) / Math.max(1, maxX - 1)) * 100;
  const yPct = (v: number) => 100 - ((v - minY) / ySpan) * 100;
  const lines = BATTLE_ANALYSIS_SERIES.filter((s) => visible[s.key]).map((s) => ({
    ...s,
    points: rows.map((r) => `${xPct(r.round)},${yPct(r[s.key])}`).join(' '),
  }));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: 100 - t * 100,
    label: Math.round(minY + t * (maxY - minY)),
  }));

  const toggle = (key: BattleAnalysisSeriesKey) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="battle-poc__analysis" role="dialog" aria-modal="true" aria-label="Battle analysis">
      <div className="battle-poc__analysis-card">
        <div className="battle-poc__analysis-head">
          <strong>BATTLE ANALYSIS</strong>
          <button type="button" className="battle-poc__ctrl battle-poc__ctrl--exit" onClick={onClose}>
            ✕ CLOSE
          </button>
        </div>
        <div className="battle-poc__analysis-tabs">
          <button
            type="button"
            className={`battle-poc__analysis-tab${selected === 'player' ? ' battle-poc__analysis-tab--active' : ''}`}
            onClick={() => onSelect('player')}
          >
            PLAYER
          </button>
          <button
            type="button"
            className={`battle-poc__analysis-tab${selected === 'enemy' ? ' battle-poc__analysis-tab--active' : ''}`}
            onClick={() => onSelect('enemy')}
          >
            ENEMY
          </button>
        </div>
        <div className="battle-poc__analysis-mode" role="group" aria-label="Value mode">
          <span className="battle-poc__analysis-mode-label">Values</span>
          <button
            type="button"
            className={`battle-poc__analysis-mode-btn${valueMode === 'discrete' ? ' battle-poc__analysis-mode-btn--on' : ''}`}
            onClick={() => setValueMode('discrete')}
          >
            Discrete
          </button>
          <button
            type="button"
            className={`battle-poc__analysis-mode-btn${valueMode === 'cumulative' ? ' battle-poc__analysis-mode-btn--on' : ''}`}
            onClick={() => setValueMode('cumulative')}
          >
            Cumulative
          </button>
        </div>
        <div className="battle-poc__analysis-toggles" role="group" aria-label="Series visibility">
          {BATTLE_ANALYSIS_SERIES.map((s) => (
            <label key={s.key} className="battle-poc__analysis-toggle">
              <input
                type="checkbox"
                checked={visible[s.key]}
                onChange={() => {
                  toggle(s.key);
                }}
              />
              <span className="battle-poc__analysis-toggle-swatch" style={{ background: s.color }} />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
        <div className="battle-poc__analysis-title">
          {selected === 'player' ? 'Player' : 'Enemy'} combat timeline
        </div>
        <svg className="battle-poc__analysis-graph" viewBox="0 0 100 100" preserveAspectRatio="none">
          {yTicks.map((tick) => (
            <line
              key={tick.y}
              x1="0"
              y1={tick.y}
              x2="100"
              y2={tick.y}
              className="battle-poc__analysis-grid"
            />
          ))}
          <line x1="0" y1="100" x2="100" y2="100" className="battle-poc__analysis-axis" />
          <line x1="0" y1="0" x2="0" y2="100" className="battle-poc__analysis-axis" />
          {lines.map((line) => (
            <polyline
              key={line.key}
              points={line.points}
              fill="none"
              stroke={line.color}
              strokeWidth="1.1"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
