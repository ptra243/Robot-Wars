/**
 * Run stand-alone: `npx vitest run src/test/draftCountDamageSim.test.ts`
 *
 * Compares enemy draft round overrides (+5 steps) for several seeds; measures net player HP
 * change over 20 combat rounds (same RNG prefix for early drafts when count increases).
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
import { activeQueueSlotsForAct, rollEnemyLoadout } from '../core/run/enemyRoll';
import type { OpponentTheme } from '../core/run/opponentDecks';

const SEEDS = [1001, 4242, 9001, 1337, 40404, 7777, 31415, 27182];
const FIRST_DRAFT_ROUNDS = 5;
const DRAFT_STEP = 5;
const LAST_DRAFT_ROUNDS = 45;
const STOP_AFTER_ROUNDS = 20;

const THEME: OpponentTheme | undefined = 'expose';

const ENCOUNTER = {
  act: 2,
  stepsInAct: 4,
  act4BattleIndex: 0,
  nodeType: 'battle' as const,
  enemyAwakening: 0 as const,
};

function draftRoundList(): number[] {
  const out: number[] = [];
  for (let d = FIRST_DRAFT_ROUNDS; d <= LAST_DRAFT_ROUNDS; d += DRAFT_STEP) {
    out.push(d);
  }
  return out;
}

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

function applyEnemyRoll(
  run: RunState,
  content: CardContentService,
  draftRoundOverride: number,
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
      themeOverride: THEME,
      basicsGate: false,
      draftRoundOverride,
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
  const head = r.filledQueue.slice(0, ac);
  const short = head.length <= 4 ? head.join(',') : `${head.slice(0, 4).join(',')}…`;
  return `theme=${r.theme} [${short}]`;
}

function netPlayerHpBurn(result: ReturnType<CombatSimulator['run']>): number {
  return result.initialSnapshot.player.hp - result.finalState.player.hp;
}

describe('draft round count vs damage (20-round cap)', () => {
  it('prints Markdown table to stdout', () => {
    const content = CardContentService.loadDefault(SEEDS[0] ?? 1);
    const draftCols = draftRoundList();

    const lines: string[] = [];
    lines.push(
      `# Draft damage sim — ${String(STOP_AFTER_ROUNDS)} rounds. ` +
        `Encounter act=${String(ENCOUNTER.act)} encounterIx=3 scavengers theme=${THEME ?? 'random'}\n`,
    );

    for (const seed of SEEDS) {
      lines.push(`\n## Seed ${String(seed)}\n`);
      lines.push('| draft rounds | net player HP lost | enemy HP lost | lineup (truncated) |');
      lines.push('| ---:| ---:| ---:| --- |');

      for (const drafts of draftCols) {
        const run = baseRun(seed);
        const lineup = applyEnemyRoll(run, content, drafts);
        const setup = buildCombatSetupFromRun(run, content);
        const sim = new CombatSimulator(content, setup.seed);
        const result = sim.run(setup, { stopAfterRounds: STOP_AFTER_ROUNDS });
        const burned = netPlayerHpBurn(result);
        const enemyDealt =
          result.initialSnapshot.enemy.hp - Math.max(0, result.finalState.enemy.hp);
        lines.push(
          `| ${String(drafts)} | ${burned.toFixed(1)} | ${enemyDealt.toFixed(1)} | ${lineup} |`,
        );
      }
    }

    lines.push(
      `\n_Net player HP lost = initial − final (player healing reduces this). ` +
        `Higher draft rounds extend the pick list after the **same RNG prefix** as shorter runs._`,
    );

    console.log(lines.join('\n'));
    expect(draftCols.length).toBeGreaterThan(3);
  });
});
