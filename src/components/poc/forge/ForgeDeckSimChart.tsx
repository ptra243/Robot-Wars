import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { ForgeDeckRoundMetrics, ForgeDeckSimulationResult } from '../../../core/run/forgeDeckSimulation';
import { FORGE_DECK_SIM_ROUNDS } from '../../../core/run/forgeDeckSimulation';

export type ForgeSimSeriesKey =
  | 'energy'
  | 'damage'
  | 'shields'
  | 'stalls'
  | 'junk'
  | 'continuousTicks'
  | 'continuousSkips';

export type ForgeDeckSimLayout = 'compact' | 'large';

const SERIES: {
  key: ForgeSimSeriesKey;
  label: string;
  color: string;
}[] = [
  { key: 'energy', label: 'Energy', color: '#58aec7' },
  { key: 'damage', label: 'Damage', color: '#e07a52' },
  { key: 'shields', label: 'Shields', color: '#6fa8bd' },
  { key: 'stalls', label: 'Stalls', color: '#c084fc' },
  { key: 'junk', label: 'Junk', color: '#a3e635' },
  { key: 'continuousTicks', label: 'Cont. Ticks', color: '#22d3ee' },
  { key: 'continuousSkips', label: 'Cont. Skips', color: '#f472b6' },
];

const LAYOUT_DIMS: Record<
  ForgeDeckSimLayout,
  {
    w: number;
    h: number;
    padL: number;
    padR: number;
    padT: number;
    padBottom: number;
    gridFont: number;
    lineStroke: number;
  }
> = {
  compact: {
    w: 520,
    h: 160,
    padL: 36,
    padR: 12,
    padT: 10,
    padBottom: 22,
    gridFont: 9,
    lineStroke: 2,
  },
  large: {
    w: 920,
    h: 320,
    padL: 48,
    padR: 20,
    padT: 16,
    padBottom: 32,
    gridFont: 11,
    lineStroke: 2.5,
  },
};

function buildPlotSeries(
  rounds: ForgeDeckRoundMetrics[],
  initialPlayer: ForgeDeckSimulationResult['initialPlayer'],
  cumulative: boolean,
): ForgeDeckRoundMetrics[] {
  if (!cumulative) {
    return rounds;
  }
  let cumDamage = 0;
  let cumStalls = 0;
  let cumContinuousTicks = 0;
  let cumContinuousSkips = 0;
  return rounds.map((row) => {
    cumDamage += row.damage;
    cumStalls += row.stalls;
    cumContinuousTicks += row.continuousTicks;
    cumContinuousSkips += row.continuousSkips;
    return {
      round: row.round,
      damage: cumDamage,
      stalls: cumStalls,
      continuousTicks: cumContinuousTicks,
      continuousSkips: cumContinuousSkips,
      energy: row.energy - initialPlayer.energy,
      shields: row.shields - initialPlayer.shields,
      junk: row.junk - initialPlayer.junk,
      programCardId: row.programCardId,
    };
  });
}

interface ForgeDeckSimChartProps {
  simulation: ForgeDeckSimulationResult;
  /** 1-based round index, or null when pointer leaves the chart. */
  onRoundPointer?: (
    round: number | null,
    pointer: { clientX: number; clientY: number } | null,
  ) => void;
  layout?: ForgeDeckSimLayout;
}

export function ForgeDeckSimChart({ simulation, onRoundPointer, layout = 'compact' }: ForgeDeckSimChartProps) {
  const [valueMode, setValueMode] = useState<'discrete' | 'cumulative'>('discrete');
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [visible, setVisible] = useState<Record<ForgeSimSeriesKey, boolean>>({
    energy: true,
    damage: true,
    shields: true,
    stalls: true,
    junk: true,
    continuousTicks: true,
    continuousSkips: true,
  });

  const plotMetrics = useMemo(
    () => buildPlotSeries(simulation.rounds, simulation.initialPlayer, valueMode === 'cumulative'),
    [simulation, valueMode],
  );

  const chart = useMemo(() => {
    const keys = SERIES.filter((s) => visible[s.key]).map((s) => s.key);
    let minData = 0;
    let maxData = 0;
    if (keys.length > 0) {
      minData = Number.POSITIVE_INFINITY;
      maxData = Number.NEGATIVE_INFINITY;
      for (const row of plotMetrics) {
        for (const k of keys) {
          const v = row[k];
          if (v < minData) minData = v;
          if (v > maxData) maxData = v;
        }
      }
      if (minData === Number.POSITIVE_INFINITY) minData = 0;
      if (maxData === Number.NEGATIVE_INFINITY) maxData = 0;
    }

    const yTop = maxData + 2;
    const yBottom = Math.min(0, minData - 2);
    const span = Math.max(1e-6, yTop - yBottom);

    const L = LAYOUT_DIMS[layout];
    const { w, h, padL, padR, padT, padBottom, gridFont, lineStroke } = L;
    const innerW = w - padL - padR;
    const innerH = h - padT - padBottom;
    const n = Math.max(1, plotMetrics.length);
    const xAt = (i: number) => padL + (i / Math.max(1, n - 1)) * innerW;

    const scaleY = (v: number) =>
      padT + innerH - ((v - yBottom) / span) * innerH;

    const polylines = SERIES.filter((s) => visible[s.key]).map((s) => {
      const pts = plotMetrics.map((row, i) => {
        const x = xAt(i);
        const y = scaleY(row[s.key]);
        return `${String(x)},${String(y)}`;
      });
      return { key: s.key, color: s.color, points: pts.join(' ') };
    });

    const gridTs = [0, 0.25, 0.5, 0.75, 1];
    const gridLines = gridTs.map((t) => {
      const val = yBottom + t * (yTop - yBottom);
      const y = padT + innerH - ((val - yBottom) / span) * innerH;
      return { t, y, val: Math.round(val) };
    });

    const roundTicks = [1, 5, 10, 15, 20];
    const roundNumbersY = h - 24;
    const roundAxisTitleY = h - 8;

    const columnBands = Array.from({ length: n }, (_, i) => {
      const xa = (j: number) => padL + (j / Math.max(1, n - 1)) * innerW;
      return {
        left: i === 0 ? padL : (xa(i - 1) + xa(i)) / 2,
        right: i === n - 1 ? padL + innerW : (xa(i) + xa(i + 1)) / 2,
      };
    });

    return {
      yTop,
      yBottom,
      polylines,
      w,
      h,
      padL,
      innerW,
      padT,
      innerH,
      gridFont,
      lineStroke,
      gridLines,
      roundTicks,
      roundNumbersY,
      roundAxisTitleY,
      axisLabelX: padL + innerW / 2,
      columnBands,
      n,
    };
  }, [plotMetrics, visible, layout]);

  const toggle = (key: ForgeSimSeriesKey) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const anyVisible = SERIES.some((s) => visible[s.key]);

  useEffect(() => {
    if (!anyVisible) {
      setHoverCol(null);
      onRoundPointer?.(null, null);
    }
  }, [anyVisible, onRoundPointer]);

  const handleChartPointer = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!onRoundPointer || !anyVisible) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * chart.w;
    if (mx < chart.padL || mx > chart.padL + chart.innerW) {
      setHoverCol(null);
      onRoundPointer(null, null);
      return;
    }
    const nCol = chart.n;
    const t = ((mx - chart.padL) / chart.innerW) * Math.max(1, nCol - 1);
    const col = Math.round(Math.min(Math.max(0, t), nCol - 1));
    const round = plotMetrics[col]?.round ?? col + 1;
    setHoverCol(col);
    onRoundPointer(round, { clientX: e.clientX, clientY: e.clientY });
  };

  const handleChartLeave = () => {
    setHoverCol(null);
    onRoundPointer?.(null, null);
  };

  return (
    <div
      className={`forge-poc__sim${layout === 'large' ? ' forge-poc__sim--large' : ''}`}
    >
      <div className="forge-poc__sim-head">
        <span className="forge-poc__sim-title">{'//'} DECK SIM</span>
        <span className="forge-poc__sim-sub">
          {String(FORGE_DECK_SIM_ROUNDS)} rounds vs dummy ·{' '}
          {valueMode === 'discrete'
            ? 'Discrete: per-round damage/stalls/continuous; energy / shields / junk at round start'
            : 'Cumulative: total damage & stalls through each round; energy / shields / junk = Δ vs combat start'}
        </span>
      </div>
      <div className="forge-poc__sim-mode" role="group" aria-label="Value mode">
        <span className="forge-poc__sim-mode-label">Values</span>
        <button
          type="button"
          className={`forge-poc__sim-mode-btn${valueMode === 'discrete' ? ' forge-poc__sim-mode-btn--on' : ''}`}
          onClick={() => setValueMode('discrete')}
        >
          Discrete
        </button>
        <button
          type="button"
          className={`forge-poc__sim-mode-btn${valueMode === 'cumulative' ? ' forge-poc__sim-mode-btn--on' : ''}`}
          onClick={() => setValueMode('cumulative')}
        >
          Cumulative
        </button>
      </div>
      <div className="forge-poc__sim-toggles" role="group" aria-label="Series visibility">
        {SERIES.map((s) => (
          <label key={s.key} className="forge-poc__sim-toggle">
            <input
              type="checkbox"
              checked={visible[s.key]}
              onChange={() => {
                toggle(s.key);
              }}
            />
            <span className="forge-poc__sim-toggle-swatch" style={{ background: s.color }} />
            <span>{s.label}</span>
          </label>
        ))}
      </div>
      <div className="forge-poc__sim-chart-wrap">
        {!anyVisible ? (
          <div className="forge-poc__sim-empty">Toggle at least one series to plot.</div>
        ) : (
          <svg
            className="forge-poc__sim-svg forge-poc__sim-svg--interactive"
            viewBox={`0 0 ${String(chart.w)} ${String(chart.h)}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Deck simulation chart; hover a round column for card preview"
            onMouseMove={handleChartPointer}
            onMouseLeave={handleChartLeave}
          >
            <rect
              x="0"
              y="0"
              width={chart.w}
              height={chart.h}
              fill="rgba(5, 8, 15, 0.35)"
              stroke="rgba(150, 170, 195, 0.15)"
            />
            {hoverCol !== null && chart.columnBands[hoverCol] ? (
              <rect
                className="forge-poc__sim-col-highlight"
                x={chart.columnBands[hoverCol].left}
                y={chart.padT}
                width={chart.columnBands[hoverCol].right - chart.columnBands[hoverCol].left}
                height={chart.innerH}
              />
            ) : null}
            {chart.gridLines.map((gl) => (
              <g key={gl.t}>
                <line
                  x1={chart.padL}
                  y1={gl.y}
                  x2={chart.padL + chart.innerW}
                  y2={gl.y}
                  stroke="rgba(150, 170, 195, 0.12)"
                  strokeWidth="1"
                />
                <text
                  x={chart.padL - 6}
                  y={gl.y + 4}
                  textAnchor="end"
                  fill="var(--fp-text-dim)"
                  fontSize={chart.gridFont}
                  fontFamily="inherit"
                >
                  {String(gl.val)}
                </text>
              </g>
            ))}
            {chart.roundTicks.map((r) => {
              const i = r - 1;
              const x = chart.padL + (i / 19) * chart.innerW;
              return (
                <text
                  key={r}
                  x={x}
                  y={chart.roundNumbersY}
                  textAnchor="middle"
                  fill="var(--fp-text-dim)"
                  fontSize={chart.gridFont}
                  fontFamily="inherit"
                >
                  {String(r)}
                </text>
              );
            })}
            <text
              x={chart.axisLabelX}
              y={chart.roundAxisTitleY}
              textAnchor="middle"
              fill="var(--fp-text-dim)"
              fontSize={chart.gridFont}
              fontFamily="inherit"
            >
              Round
            </text>
            {chart.polylines.map((pl) => (
              <polyline
                key={pl.key}
                fill="none"
                stroke={pl.color}
                strokeWidth={chart.lineStroke}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={pl.points}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
