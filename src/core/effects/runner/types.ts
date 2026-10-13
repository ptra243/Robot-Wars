import type { CardContentService } from '../../content';
import type { AuraDispatchBudget } from '../../combat/auras';
import type {
  AuraTrigger,
  CardDef,
  CombatEvent,
  CombatState,
  EffectStep,
  FighterState,
  KeywordSpec,
} from '../../types';

export interface EffectPipelineContext {
  pushEv: (event: Omit<CombatEvent, 'snapshot'>) => void;
  applyKeyword: (spec: KeywordSpec) => void;
  dispatchAuraTrigger: (
    state: CombatState,
    actor: FighterState,
    target: FighterState,
    trigger: AuraTrigger,
  ) => void;
  auraBudget: AuraDispatchBudget;
  resolvingCard?: CardDef;
  content?: CardContentService;
  effectRngSeed?: number;
  exposePoolForMultiStrike?: number | null;
  strikeDamageStepsThisPipeline?: number;
  strikesThatConsumeExposeAtEnd?: number;
  exposeKeywordAfterStrike?: boolean;
  primeActiveForResolution?: boolean;
  completedClockworkSequenceStep?: number | null;
}

export interface PipelineFrame {
  state: CombatState;
  actor: FighterState;
  target: FighterState;
  ctx: EffectPipelineContext;
  queueSlotIndex?: number;
  junkSnapshotAtResolveStart: number;
}

export type EffectType = EffectStep['type'];
export type EffectByType<T extends EffectType> = Extract<EffectStep, { type: T }>;
export type EffectHandler<T extends EffectType> = (step: EffectByType<T>, frame: PipelineFrame) => void;

export const SNAPSHOT_STEP_TYPES = new Set<EffectType>([
  'StrikeDamage',
  'DirectHpDamage',
  'DirectHpDamageFromActorBlock',
  'DirectHpDamagePerShurikenSpent',
  'DirectHpDamagePerActivatedStance',
  'ConsumeShieldForDirectDamage',
  'ShieldBlock',
  'ShieldBlockEqualToActorBulkStacks',
  'ShieldBlockFromJunkSnapshot',
  'SelfDamage',
  'SelfDamageRespectFloor1',
  'Keyword',
]);

