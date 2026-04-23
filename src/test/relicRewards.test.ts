import { describe, expect, it } from 'vitest';
import {
  applyPostCombatRewards,
  createNewRun,
  getRelicDef,
  listRelicsForSource,
  rollRelicForSource,
} from '../core/run';

describe('relic source gating', () => {
  it('event and shop pools contain only common relics', () => {
    const run = createNewRun(100);
    const eventPool = listRelicsForSource('event', run);
    const shopPool = listRelicsForSource('shop', run);
    expect(eventPool.length).toBeGreaterThan(0);
    expect(shopPool.length).toBeGreaterThan(0);
    expect(eventPool.every((r) => r.rarity === 'common')).toBe(true);
    expect(shopPool.every((r) => r.rarity === 'common')).toBe(true);
  });

  it('elite pool contains only uncommon relics for faction', () => {
    const run = createNewRun(101);
    const elitePool = listRelicsForSource('elite', run);
    expect(elitePool.length).toBeGreaterThan(0);
    expect(elitePool.every((r) => r.rarity === 'uncommon')).toBe(true);
    expect(elitePool.every((r) => !r.faction || r.faction === run.faction)).toBe(true);
  });

  it('boss pool contains only epic relics', () => {
    const run = createNewRun(102);
    const bossPool = listRelicsForSource('boss', run);
    expect(bossPool.length).toBeGreaterThan(0);
    expect(bossPool.every((r) => r.rarity === 'epic')).toBe(true);
  });
});

describe('post-combat relic rewards', () => {
  it('elite rewards grant an uncommon relic', () => {
    const run = createNewRun(201);
    run.loop.pendingEncounterType = 'elite';
    applyPostCombatRewards(run, true);
    expect(run.loop.relicIds.length).toBe(1);
    const relic = getRelicDef(run.loop.relicIds[0]);
    expect(relic?.rarity).toBe('uncommon');
  });

  it('boss rewards grant an epic relic', () => {
    const run = createNewRun(202);
    run.loop.pendingEncounterType = 'boss';
    applyPostCombatRewards(run, true);
    expect(run.loop.relicIds.length).toBe(1);
    const relic = getRelicDef(run.loop.relicIds[0]);
    expect(relic?.rarity).toBe('epic');
  });

  it('source roller never returns off-rarity relics', () => {
    const run = createNewRun(300);
    for (let i = 0; i < 25; i += 1) {
      const eventRelic = rollRelicForSource(run, 'event', 1000 + i);
      const shopRelic = rollRelicForSource(run, 'shop', 2000 + i);
      const eliteRelic = rollRelicForSource(run, 'elite', 3000 + i);
      const bossRelic = rollRelicForSource(run, 'boss', 4000 + i);
      expect(eventRelic?.rarity).toBe('common');
      expect(shopRelic?.rarity).toBe('common');
      expect(eliteRelic?.rarity).toBe('uncommon');
      expect(bossRelic?.rarity).toBe('epic');
    }
  });
});
