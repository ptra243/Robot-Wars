import { describe, expect, it } from 'vitest';
import {
  applyPostCombatRewards,
  createNewRun,
  getRelicDef,
  listRelicsForSource,
  rollRelicForSource,
  rollRelicOffers,
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

  it('clockwork boss pool excludes scavenger-faction epics', () => {
    const run = createNewRun(103);
    run.faction = 'clockwork';
    const bossPool = listRelicsForSource('boss', run);
    expect(bossPool.length).toBeGreaterThan(0);
    expect(bossPool.every((r) => !r.faction || r.faction === 'clockwork')).toBe(true);
    expect(bossPool.some((r) => r.id === 'clockwork_septenary_crown')).toBe(true);
    expect(bossPool.some((r) => r.id === 'epic_gunslingers_flourish')).toBe(false);
    expect(bossPool.some((r) => r.id === 'epic_emergency_junk_shield')).toBe(false);
  });
});

describe('post-combat relic rewards', () => {
  it('elite rewards queue a pending uncommon relic pick instead of auto-granting', () => {
    const run = createNewRun(201);
    run.loop.pendingEncounterType = 'elite';
    applyPostCombatRewards(run, true);
    expect(run.loop.relicIds.length).toBe(0);
    expect(run.loop.pendingRelicRewardSource).toBe('elite');
    const offers = rollRelicOffers(run, 'elite', 999);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((id) => getRelicDef(id)?.rarity === 'uncommon')).toBe(true);
  });

  it('boss rewards queue a pending epic relic pick instead of auto-granting', () => {
    const run = createNewRun(202);
    run.loop.pendingEncounterType = 'boss';
    applyPostCombatRewards(run, true);
    expect(run.loop.relicIds.length).toBe(0);
    expect(run.loop.pendingRelicRewardSource).toBe('boss');
    const offers = rollRelicOffers(run, 'boss', 1001);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((id) => getRelicDef(id)?.rarity === 'epic')).toBe(true);
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
