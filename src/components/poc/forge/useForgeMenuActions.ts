import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';
import { CardContentService, cardOfferStreamSeed } from '../../../core/content';
import { forgeCardFromDefWithTraits, resolveForgeMergeUpgradeId } from './forgeCardModel';
import type { ContextMenuState, DragPayload, ForgeCard, HoverState } from './types';

interface ForgeMenuActionsInput {
  menu: ContextMenuState | null;
  hand: ForgeCard[];
  queue: (ForgeCard | null)[];
  programSlots: number;
  content: CardContentService;
  faction: string;
  awakening: number;
  localRerolls: number;
  onRerollsChange?: (delta: number) => void;
  onScrapHandCard?: (cardId: string) => void;
  setMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
  setHover: Dispatch<SetStateAction<HoverState | null>>;
  setHand: Dispatch<SetStateAction<ForgeCard[]>>;
  setQueue: Dispatch<SetStateAction<(ForgeCard | null)[]>>;
  setLocalRerolls: Dispatch<SetStateAction<number>>;
  setTierModalCardId: Dispatch<SetStateAction<string | null>>;
  activeTraitIds?: readonly string[];
}

export function useForgeMenuActions(input: ForgeMenuActionsInput) {
  const {
    menu,
    hand,
    queue,
    programSlots,
    content,
    faction,
    awakening,
    localRerolls,
    onRerollsChange,
    onScrapHandCard,
    setMenu,
    setHover,
    setHand,
    setQueue,
    setLocalRerolls,
    setTierModalCardId,
    activeTraitIds = [],
  } = input;

  const onQueueContextMenu = (e: ReactMouseEvent<HTMLElement>, slotIndex: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, slotIndex });
    setHover(null);
  };

  const onHandContextMenu = (e: ReactMouseEvent<HTMLElement>, handIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, slotIndex: null, handIndex: handIdx });
    setHover(null);
  };

  const handleScrapFromMenu = () => {
    if (menu?.handIndex === undefined) return;
    const idx = menu.handIndex;
    const card = hand[idx];
    if (!card || !onScrapHandCard) return;
    onScrapHandCard(card.id);
    setHand((prev) => prev.filter((_, i) => i !== idx));
    setMenu(null);
  };

  const handleViewTiersFromMenu = () => {
    if (menu?.handIndex === undefined) return;
    const card = hand[menu.handIndex];
    if (!card) return;
    setTierModalCardId(card.id);
    setMenu(null);
  };

  const handleRerollHandCard = (handIdx: number) => {
    if (localRerolls <= 0) return;
    const current = hand[handIdx];
    if (!current) return;
    /* Fresh stream each reroll — reusing loadDefault(seed) always yields the same first draw. */
    const stream = cardOfferStreamSeed(Date.now() ^ (handIdx * 9973), localRerolls * 17 + 1);
    const drawContent = CardContentService.loadDefault(stream);
    let currentDef;
    try {
      currentDef = content.get(current.id);
    } catch {
      currentDef = null;
    }
    const newCard = currentDef
      ? drawContent.drawWeightedSameTier(
          faction as Parameters<typeof content.drawWeighted>[0],
          awakening,
          currentDef,
          current.id,
        )
      : drawContent.drawWeighted(
          faction as Parameters<typeof content.drawWeighted>[0],
          awakening,
        );
    const forgeCard = forgeCardFromDefWithTraits(newCard, activeTraitIds);
    setHand((prev) => {
      const next = [...prev];
      next[handIdx] = forgeCard;
      return next;
    });
    setLocalRerolls((r) => r - 1);
    onRerollsChange?.(-1);
    setMenu(null);
  };

  const handleMergeCards = (fromPayload: DragPayload, toHandIdx: number) => {
    if (fromPayload.source === 'queue' && fromPayload.index >= programSlots) return;
    const targetCard = hand[toHandIdx];
    const sourceCard =
      fromPayload.source === 'hand' ? hand[fromPayload.index] : queue[fromPayload.index];
    if (!sourceCard || !targetCard) return;

    const upgradedId = resolveForgeMergeUpgradeId(content, sourceCard, targetCard);
    if (!upgradedId) return;
    let upgradedCard: ForgeCard;
    try {
      upgradedCard = forgeCardFromDefWithTraits(content.get(upgradedId), activeTraitIds);
    } catch {
      return;
    }

    if (fromPayload.source === 'hand') {
      setHand((prev) => {
        const next = prev.filter((_, i) => i !== fromPayload.index && i !== toHandIdx);
        return [...next, upgradedCard];
      });
    } else {
      setQueue((prev) => {
        const next = [...prev];
        next[fromPayload.index] = null;
        return next;
      });
      setHand((prev) => {
        const next = prev.filter((_, i) => i !== toHandIdx);
        return [...next, upgradedCard];
      });
    }

    setLocalRerolls((r) => r + 1);
    onRerollsChange?.(+1);
  };

  return {
    onQueueContextMenu,
    onHandContextMenu,
    handleScrapFromMenu,
    handleViewTiersFromMenu,
    handleRerollHandCard,
    handleMergeCards,
  };
}

