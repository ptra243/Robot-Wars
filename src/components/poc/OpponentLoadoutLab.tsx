import { useCallback, useMemo, useState } from 'react';
import { CardContentService, SeededRandom } from '../../core/content';
import { COMBAT_RULES } from '../../core/rules';
import {
  activeQueueSlotsForAct,
  type EnemyRollResult,
  rollEnemyLoadout,
} from '../../core/run';
import type { OpponentTheme } from '../../core/run/opponentDecks';
import { ForgePOC } from './forge/ForgePOC';
import './forge-poc.css';

const THEMES: OpponentTheme[] = [
  'gathering_strike',
  'expose',
  'junk_crown',
  'junk_aegis',
  'core_factory',
];

function padQueue(ids: string[]): (string | null)[] {
  const q: (string | null)[] = Array.from({ length: COMBAT_RULES.queueSize }, () => null);
  for (let i = 0; i < Math.min(ids.length, COMBAT_RULES.queueSize); i += 1) {
    q[i] = ids[i]!;
  }
  return q;
}

export function OpponentLoadoutLab({ onExit }: { onExit?: () => void }) {
  const [act, setAct] = useState(1);
  const [stepsInAct, setStepsInAct] = useState(1);
  const [node, setNode] = useState<'battle' | 'elite' | 'boss'>('battle');
  const [themeMode, setThemeMode] = useState<'random' | OpponentTheme>('random');
  const [aw, setAw] = useState<0 | 1>(0);
  const [basicsGate, setBasicsGate] = useState(false);
  const [seedInput, setSeedInput] = useState('40404');
  const [result, setResult] = useState<EnemyRollResult | null>(null);
  const [labSeed, setLabSeed] = useState(40404);

  const content = useMemo(() => CardContentService.loadDefault(labSeed), [labSeed]);

  const generate = useCallback(
    (seedOverride?: number) => {
      const seed =
        seedOverride !== undefined ? seedOverride : Number(seedInput) || 0;
      setSeedInput(String(seed));
      setLabSeed(seed);
      const rng = new SeededRandom((seed + 0x9e37_79b9) >>> 0);
      const slots = activeQueueSlotsForAct(act);
      const r = rollEnemyLoadout(
        {
          act,
          stepsInAct,
          act4BattleIndex: act >= 4 ? Math.max(0, stepsInAct) : 0,
          encounterIndex: 0,
          nodeType: node,
          enemyAwakening: aw,
          activeQueueSlots: slots,
          basicsBattleRemaining: 2,
          faction: 'scavengers',
          runSeed: seed,
          themeOverride: themeMode === 'random' ? undefined : themeMode,
          basicsGate: basicsGate && node === 'battle',
        },
        content,
        rng,
      );
      setResult(r);
    },
    [act, aw, basicsGate, content, node, seedInput, stepsInAct, themeMode],
  );

  const randomizeSeed = useCallback(() => {
    let next: number;
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const u = new Uint32Array(1);
      globalThis.crypto.getRandomValues(u);
      next = (u[0]! >>> 0) || 1;
    } else {
      next = (Math.floor(Math.random() * 0x1_00_00_00_00) >>> 0) || 1;
    }
    generate(next);
  }, [generate]);

  const handIds = result?.notUsedInProgram ?? [];
  const queueIds = result ? padQueue(result.filledQueue) : [];

  return (
    <div className="app-shell app-shell--fullscreen" style={{ flexDirection: 'column', padding: 16 }}>
      {onExit ? (
        <button type="button" onClick={onExit}>
          ← Back
        </button>
      ) : null}
      <h1 style={{ fontSize: 18, margin: '8px 0' }}>Opponent loadout lab</h1>
      <p style={{ opacity: 0.8, maxWidth: 640, fontSize: 14 }}>
        Generates <code>rollEnemyLoadout</code> output. Hand column shows <strong>notUsedInProgram</strong>{' '}
        (unused / reserve for this roll). Deploy is a no-op in this preview.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 8,
          maxWidth: 900,
          marginBottom: 12,
        }}
      >
        <label>
          Act
          <input
            type="number"
            min={1}
            max={6}
            value={act}
            onChange={(e) => setAct(Number(e.target.value) || 1)}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          stepsInAct
          <input
            type="number"
            min={0}
            value={stepsInAct}
            onChange={(e) => setStepsInAct(Number(e.target.value) || 0)}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Node
          <select value={node} onChange={(e) => setNode(e.target.value as 'battle' | 'elite' | 'boss')}>
            <option value="battle">battle</option>
            <option value="elite">elite</option>
            <option value="boss">boss</option>
          </select>
        </label>
        <label>
          Theme
          <select
            value={themeMode}
            onChange={(e) =>
              setThemeMode(
                e.target.value === 'random' ? 'random' : (e.target.value as OpponentTheme),
              )
            }
          >
            <option value="random">random</option>
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Awakening
          <select value={aw} onChange={(e) => setAw(Number(e.target.value) as 0 | 1)}>
            <option value={0}>0</option>
            <option value={1}>1</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={basicsGate}
            onChange={(e) => setBasicsGate(e.target.checked)}
          />
          basics gate
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Seed
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <input
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="button" onClick={randomizeSeed} title="Pick a random seed and generate">
              Randomize
            </button>
          </div>
        </label>
      </div>
      <button type="button" onClick={() => generate()} style={{ marginBottom: 12 }}>
        Generate
      </button>
      {result ? (
        <div style={{ fontSize: 13, marginBottom: 8, fontFamily: 'monospace' }}>
          <div>theme: {result.theme}</div>
          <div>opponentRelic: {String(result.opponentRelicId)}</div>
          <div>draftRounds: {String(result.rollTrace.draftRounds)} earlyBasics: {String(result.rollTrace.earlyBasics)}</div>
        </div>
      ) : null}
      {result ? (
        <ForgePOC
          key={`${String(labSeed)}-${String(result.theme)}`}
          content={content}
          forgeSeed={labSeed}
          activeQueueSlots={activeQueueSlotsForAct(act)}
          initialHand={handIds}
          initialQueue={queueIds}
          onRunDeploy={() => {
            /* read-only lab */
          }}
        />
      ) : null}
    </div>
  );
}
