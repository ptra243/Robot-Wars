import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { CombatSimulator } from '../../../core/combat';
import type { CardContentService } from '../../../core/content';
import {
  type ForgeDeckSimulationResult,
  createCombatSetupFromDecklists,
  simulateForgeDeckMetrics,
} from '../../../core/run';
import type { CombatResult } from '../../../core/types';
import { QUEUE_SIZE } from './constants';
import { forgeCardFromDefWithTraits } from './forgeCardModel';
import type { ForgeCard, HoverState } from './types';

interface ForgeSimulationActionsInput {
  simModalOpen: boolean;
  setHover: Dispatch<SetStateAction<HoverState | null>>;
  content: CardContentService;
  forgeSeed: number;
  queue: (ForgeCard | null)[];
  hand: ForgeCard[];
  activeTraitIds: string[];
  programSlots: number;
  onRunDeploy?: (queueIds: (string | null)[], handCardIds: string[]) => void;
  onDeploy?: (result: CombatResult, seed: number) => void;
}

export function useForgeSimulationActions({
  simModalOpen,
  setHover,
  content,
  forgeSeed,
  queue,
  hand,
  activeTraitIds,
  programSlots,
  onRunDeploy,
  onDeploy,
}: ForgeSimulationActionsInput) {
  const forgeDeckSimulation = useMemo((): ForgeDeckSimulationResult | null => {
    if (!simModalOpen) return null;
    const queueIds = queue.map((card) => card?.id ?? null);
    const playerDeck = [...queue.filter((card): card is ForgeCard => card !== null), ...hand].map(
      (card) => card.id,
    );
    return simulateForgeDeckMetrics(
      content,
      forgeSeed,
      queueIds,
      playerDeck,
      activeTraitIds,
      programSlots,
    );
  }, [simModalOpen, content, forgeSeed, queue, hand, activeTraitIds, programSlots]);

  const handleSimulationRoundHover = useCallback(
    (round: number | null, pointer: { clientX: number; clientY: number } | null) => {
      if (round === null || pointer === null) {
        setHover(null);
        return;
      }
      if (!forgeDeckSimulation) {
        setHover(null);
        return;
      }
      const id = forgeDeckSimulation.rounds[round - 1]?.programCardId;
      const ids = forgeDeckSimulation.rounds[round - 1]?.programCardIds ?? (id ? [id] : []);
      if (ids.length === 0) {
        setHover(null);
        return;
      }
      try {
        const primary = forgeCardFromDefWithTraits(content.get(ids[0]!), activeTraitIds);
        const secondary =
          ids.length > 1
            ? forgeCardFromDefWithTraits(content.get(ids[1]!), activeTraitIds)
            : undefined;
        setHover({
          card: primary,
          ...(secondary ? { secondaryCard: secondary } : {}),
          x: pointer.clientX,
          y: pointer.clientY,
          clientX: pointer.clientX,
          clientY: pointer.clientY,
        });
      } catch {
        setHover(null);
      }
    },
    [forgeDeckSimulation, content, activeTraitIds, setHover],
  );

  useEffect(() => {
    if (!simModalOpen) {
      setHover(null);
    }
  }, [simModalOpen, setHover]);

  const handleDeploy = () => {
    const queueIds = queue.map((card) => card?.id ?? null);
    if (onRunDeploy) {
      const handCardIds = hand.map((c) => c.id);
      onRunDeploy(queueIds, handCardIds);
      return;
    }

    const playerDeck = [...queue.filter((card): card is ForgeCard => card !== null), ...hand].map(
      (card) => card.id,
    );
    const enemyDeck = Array.from({ length: QUEUE_SIZE }, () => 'neutral_basic_strike_t1');
    const setup = createCombatSetupFromDecklists({
      seed: forgeSeed,
      playerDeck,
      enemyDeck,
      playerQueue: queueIds,
      enemyQueue: enemyDeck,
      activeQueueSlots: programSlots,
    });
    const simulator = new CombatSimulator(content, forgeSeed);
    const result = simulator.run(setup);
    onDeploy?.(result, forgeSeed);
  };

  return {
    forgeDeckSimulation,
    handleSimulationRoundHover,
    handleDeploy,
  };
}

