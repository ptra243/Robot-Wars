/**
 * A/B: `programOrderMode` `actSlotBands` (default) vs `threeBandConcat` after merge+battery+HP pass.
 * Run: `npx vitest run src/test/bandOrderingSim.test.ts --reporter=verbose`
 */

import { describe, it, expect } from 'vitest';
import { CardContentService, SeededRandom } from '../core/content';
import { CombatSimulator } from '../core/combat';
import { COMBAT_RULES } from '../core/rules';
import type { RunState } from '../core/types';
import {
  createNewRun,
  SANDBOX_STARTER_HAND,
  buildCombatSetupFromRun,
} from '../core/run/lifecycle';
import {
  activeQueueSlotsForAct,
  rollEnemyLoadout,
  type A3SlotBandLayout,
} from '../core/run/enemyRoll';
import type { OpponentTheme } from '../core/run/opponentDecks';

const SEEDS = [1001, 4242, 9001, 1337, 40404, 7777, 31415, 27182];
const STOP_AFTER_ROUNDS = 20;
const THEMES: OpponentTheme[] = ['expose', 'gathering_strike', 'junk_crown', 'core_factory'];
const DRAFT_OVERRIDE = 18;
const ENCOUNTER = {
  act: 3,
  stepsInAct: 4,
  act4BattleIndex: 0,
  nodeType: 'battle' as const,
  enemyAwakening: 0 as const,
};

function baseRun(seed: number): RunState {
  const run = createNewRun(seed);
  run.faction = 'scavengers';
  run.loop.awakening = 0;
  run.loop.act = ENCOUNTER.act;
  run.loop.stepsInAct = ENCOUNTER.stepsInAct;
  run.loop.act4BattleIndex = ENCOUNTER.act4BattleIndex;
  run.loop.pendingEncounterType = ENCOUNTER.nodeType;
  run.loop.earlyBattleBasicsRemaining = 0;
  run.encounterIndex = 3;
  run.deck = [...SANDBOX_STARTER_HAND];
  run.hand = [];
  run.loop.playerHp = run.loop.playerHpMax;
  run.loop.playerHpBaseMax = COMBAT_RULES.startingHp;
  run.loop.enemyHpMultiplier = 1;
  run.plannedQueue = Array.from({ length: COMBAT_RULES.queueSize }, () => null);
  run.plannedQueue[0] = 'salvage_strike_t1';
  run.plannedQueue[1] = 'junk_loader_t1';
  run.plannedQueue[2] = 'neutral_basic_strike_t1';
  return run;
}

function applyRoll(
  run: RunState,
  content: CardContentService,
  mode: 'actSlotBands' | 'threeBandConcat',
  a3Layout: A3SlotBandLayout,
  theme: OpponentTheme,
): string {
  const ac = activeQueueSlotsForAct(run.loop.act);
  const rngSeed =
    (run.seed +
      901 +
      run.encounterIndex * 97 +
      run.loop.act * 1709 +
      (run.loop.pendingEncounterType ?? 'battle').length * 13) >>>
    0;
  const rng = new SeededRandom(rngSeed);
  const r = rollEnemyLoadout(
    {
      act: run.loop.act,
      stepsInAct: run.loop.stepsInAct,
      act4BattleIndex: run.loop.act4BattleIndex,
      encounterIndex: run.encounterIndex,
      nodeType: run.loop.pendingEncounterType!,
      enemyAwakening: ENCOUNTER.enemyAwakening,
      activeQueueSlots: ac,
      basicsBattleRemaining: run.loop.earlyBattleBasicsRemaining,
      faction: run.faction,
      runSeed: run.seed,
      themeOverride: theme,
      basicsGate: false,
      draftRoundOverride: DRAFT_OVERRIDE,
      programOrderMode: mode,
      a3SlotBandLayout: a3Layout,
    },
    content,
    rng,
  );
  for (let i = 0; i < COMBAT_RULES.queueSize; i += 1) {
    run.enemyPlannedQueue[i] = i < r.filledQueue.length ? r.filledQueue[i]! : null;
  }
  run.combatEnemyFatigueDeck = r.fatigueDeck;
  run.sandboxActiveQueueSlots = ac;
  run.combatOpponentRelicId = null;
  return r.filledQueue.slice(0, ac).join(' | ');
}

function netPlayerHpBurn(result: ReturnType<CombatSimulator['run']>): number {
  return result.initialSnapshot.player.hp - result.finalState.player.hp;
}

describe('band ordering A/B (act slot bands vs three-band concat)', () => {
  it('prints Markdown comparison for fixed draft length', { timeout: 120000 }, () => {
    const content = CardContentService.loadDefault(SEEDS[0] ?? 1);
    const lines: string[] = [];
    for (const a3Layout of ['wide', 'dualCycle'] as const) {
      lines.push(
        `# Band ordering sim — ${String(STOP_AFTER_ROUNDS)} rounds, draft rounds=${String(DRAFT_OVERRIDE)}, ` +
          `act=${String(ENCOUNTER.act)}, a3Layout=${a3Layout}\n`,
      );
      lines.push('| theme | mode | avg net player HP lost | avg enemy HP lost |');
      lines.push('| --- | --- | ---:| ---:|');

      for (const theme of THEMES) {
        let burnAct = 0;
        let burnConcat = 0;
        let enemyAct = 0;
        let enemyConcat = 0;
        for (const seed of SEEDS) {
          const runAct = baseRun(seed);
          applyRoll(runAct, content, 'actSlotBands', a3Layout, theme);
          const setupAct = buildCombatSetupFromRun(runAct, content);
          const simAct = new CombatSimulator(content, setupAct.seed);
          const resultAct = simAct.run(setupAct, { stopAfterRounds: STOP_AFTER_ROUNDS });
          burnAct += netPlayerHpBurn(resultAct);
          enemyAct += resultAct.initialSnapshot.enemy.hp - Math.max(0, resultAct.finalState.enemy.hp);

          const runConcat = baseRun(seed);
          applyRoll(runConcat, content, 'threeBandConcat', a3Layout, theme);
          const setupConcat = buildCombatSetupFromRun(runConcat, content);
          const simConcat = new CombatSimulator(content, setupConcat.seed);
          const resultConcat = simConcat.run(setupConcat, { stopAfterRounds: STOP_AFTER_ROUNDS });
          burnConcat += netPlayerHpBurn(resultConcat);
          enemyConcat +=
            resultConcat.initialSnapshot.enemy.hp - Math.max(0, resultConcat.finalState.enemy.hp);
        }
        const n = SEEDS.length;
        lines.push(
          `| ${theme} | actSlotBands | ${(burnAct / n).toFixed(2)} | ${(enemyAct / n).toFixed(2)} |`,
        );
        lines.push(
          `| ${theme} | threeBandConcat | ${(burnConcat / n).toFixed(2)} | ${(enemyConcat / n).toFixed(2)} |`,
        );
        lines.push(
          `| ${theme} | delta (act - concat) | ${((burnAct - burnConcat) / n).toFixed(2)} | ${((enemyAct - enemyConcat) / n).toFixed(2)} |`,
        );
      }
      lines.push('');
    }

    lines.push(
      '\n_Default production uses `actSlotBands`; `threeBandConcat` is the legacy concat pass._',
    );
    console.log(lines.join('\n'));
    expect(SEEDS.length).toBeGreaterThan(0);
  });
});
