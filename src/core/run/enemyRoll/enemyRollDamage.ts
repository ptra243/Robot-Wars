import { COMBAT_RULES } from '../../rules';
import type { CardContentService } from '../../content';
import type { EffectStep } from '../../types';

function effectStepsDealHpToOpponent(steps: EffectStep[] | undefined): boolean {
  if (!steps?.length) return false;
  for (const s of steps) {
    switch (s.type) {
      case 'StrikeDamage':
      case 'DirectHpDamage':
      case 'DirectHpDamagePerShurikenSpent':
      case 'DirectHpDamagePerActivatedStance':
      case 'ConsumeShieldForDirectDamage':
      case 'DirectHpDamageFromActorBlock':
        return true;
      case 'ScheduleEffectAfterRounds':
        if (effectStepsDealHpToOpponent(s.steps)) return true;
        break;
      case 'BranchIfCoreGte':
      case 'BranchIfJunkGte':
      case 'BranchIfChargeGte':
      case 'BranchIfActorStance':
      case 'BranchIfActorActivatedStance':
        if (effectStepsDealHpToOpponent(s.thenSteps) || effectStepsDealHpToOpponent(s.elseSteps)) return true;
        break;
      case 'ConditionalSpendCharge':
        if (effectStepsDealHpToOpponent(s.thenSteps)) return true;
        break;
      default:
        break;
    }
  }
  return false;
}

/** Static check: can this card eventually deal HP damage to the opposing fighter when played by the enemy? */
export function cardCanDealEnemyHpDamage(id: string, content: CardContentService): boolean {
  if (id === COMBAT_RULES.blankQueueSlotCardId || id.toLowerCase().includes('neutral_basic_strike')) return true;
  const c = content.get(id);
  if ((c.base_damage ?? 0) > 0) return true;
  return effectStepsDealHpToOpponent(c.effects);
}

