import { describe, expect, it } from 'vitest';
import { buffChipsFromSnapshot } from '../components/poc/battlePocHelpers';
import type { CombatFighterSnapshot } from '../core/types';
import {
  SCRAP_ENGINE_ICON,
  SCRAP_HOUND_ATTACK_ICON,
  SCRAP_HOUND_SHIELD_ICON,
} from '../ui/scrapHoundIcons';

function snap(partial: Partial<CombatFighterSnapshot>): CombatFighterSnapshot {
  return {
    hp: 40,
    block: 0,
    charge: 0,
    junk: 0,
    bulkStacks: 0,
    coreScrap: 0,
    potency: 0,
    exposeDamage: 0,
    ...partial,
  };
}

describe('scrap hound / engine battle HUD chips', () => {
  it('omits scrap icons when stacks are zero', () => {
    const chips = buffChipsFromSnapshot(snap({}));
    expect(chips.some((c) => c.key.startsWith('scrap'))).toBe(false);
  });

  it('shows scrap engine and hound icons when stacks are present', () => {
    const chips = buffChipsFromSnapshot(
      snap({
        scrapEngineCount: 2,
        scrapHoundAttackStacks: 3,
        scrapHoundShieldStacks: 1,
      }),
    );
    expect(chips.find((c) => c.key === 'scrap-engine')).toMatchObject({
      label: '2',
      iconSrc: SCRAP_ENGINE_ICON,
    });
    expect(chips.find((c) => c.key === 'scrap-hound-atk')).toMatchObject({
      label: '3',
      iconSrc: SCRAP_HOUND_ATTACK_ICON,
    });
    expect(chips.find((c) => c.key === 'scrap-hound-shd')).toMatchObject({
      label: '1',
      iconSrc: SCRAP_HOUND_SHIELD_ICON,
    });
  });
});
