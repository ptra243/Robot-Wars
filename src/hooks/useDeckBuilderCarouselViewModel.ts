import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { CardContentService } from '../core/content';
import type { RunState } from '../core/types';
import { COMBAT_RULES } from '../core/rules';
import { buildLibraryTierFamilies } from '../ui/libraryTierFamilies';
import {
  cardMatchesLibraryFilters,
  type LibraryFactionFilter,
  type LibraryTagFilter,
} from '../ui/libraryFilters';
import type { DeckBuilderViewModel } from '../ui/deckBuilderScene';

export function useDeckBuilderCarouselViewModel(options: {
  run: RunState;
  content: CardContentService;
  editTarget: 'player' | 'enemy';
  carouselMode: 'hand' | 'all';
  carouselPage: number;
  setCarouselPage: Dispatch<SetStateAction<number>>;
  librarySearch: string;
  libraryFactionFilter: LibraryFactionFilter;
  libraryTagFilter: LibraryTagFilter;
  libraryTierIndexByBase: Record<string, number>;
  setLibraryTierIndexByBase: Dispatch<SetStateAction<Record<string, number>>>;
}): {
  viewModel: DeckBuilderViewModel;
  pageCount: number;
  adjustCarouselTier: (slotIndex: number, delta: -1 | 1) => void;
} {
  const {
    run,
    content,
    editTarget,
    carouselMode,
    carouselPage,
    setCarouselPage,
    librarySearch,
    libraryFactionFilter,
    libraryTagFilter,
    libraryTierIndexByBase,
    setLibraryTierIndexByBase,
  } = options;

  const { families: libraryFamilies } = useMemo(
    () => buildLibraryTierFamilies(content.getAll()),
    [content],
  );

  const selectedTierForBase = useCallback(
    (baseId: string): string => {
      const family = libraryFamilies.find((f) => f.baseId === baseId);
      if (!family || family.tiers.length === 0) {
        return baseId;
      }
      const rawIdx = libraryTierIndexByBase[baseId] ?? 0;
      const idx = Math.max(0, Math.min(family.tiers.length - 1, rawIdx));
      return family.tiers[idx];
    },
    [libraryFamilies, libraryTierIndexByBase],
  );

  const filteredLibraryBaseIds = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    return libraryFamilies
      .filter((family) => {
        const selectedId = selectedTierForBase(family.baseId);
        const c = content.get(selectedId);
        if (!cardMatchesLibraryFilters(c, libraryFactionFilter, libraryTagFilter)) {
          return false;
        }
        if (q) {
          const familyHasSearchHit = family.tiers.some((id) =>
            content.get(id).name.toLowerCase().includes(q),
          );
          if (!familyHasSearchHit) {
            return false;
          }
        }
        return true;
      })
      .map((family) => family.baseId);
  }, [libraryFamilies, content, librarySearch, libraryFactionFilter, libraryTagFilter, selectedTierForBase]);

  const filteredLibraryIds = useMemo(() => {
    return filteredLibraryBaseIds.map((baseId) => selectedTierForBase(baseId));
  }, [filteredLibraryBaseIds, selectedTierForBase]);

  const filteredHandCards = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    const ids: string[] = [];
    const handIndices: number[] = [];
    for (let hi = 0; hi < run.hand.length; hi += 1) {
      const id = run.hand[hi]!;
      const c = content.get(id);
      if (!cardMatchesLibraryFilters(c, libraryFactionFilter, libraryTagFilter)) {
        continue;
      }
      if (q && !c.name.toLowerCase().includes(q)) {
        continue;
      }
      ids.push(id);
      handIndices.push(hi);
    }
    return { ids, handIndices };
  }, [run.hand, content, librarySearch, libraryFactionFilter, libraryTagFilter]);

  const { viewModel, pageCount } = useMemo(() => {
    const queue =
      editTarget === 'player' ? [...run.plannedQueue] : [...run.enemyPlannedQueue];

    let carouselSlots: Array<string | null>;
    let carouselBase: Array<string | null>;
    let carouselTierCanPrev: boolean[];
    let carouselTierCanNext: boolean[];
    let pc: number;

    if (carouselMode === 'hand') {
      const list = filteredHandCards.ids;
      pc = Math.max(1, Math.ceil(list.length / 9) || 1);
    } else {
      pc = Math.max(1, Math.ceil(filteredLibraryIds.length / 9) || 1);
    }

    const maxPage = Math.max(0, pc - 1);
    const safePage = Math.min(carouselPage, maxPage);

    let carouselHandIndices: Array<number | null>;

    if (carouselMode === 'hand') {
      const list = filteredHandCards.ids;
      const idxs = filteredHandCards.handIndices;
      const start = safePage * 9;
      carouselSlots = Array.from({ length: 9 }, (_, i) => list[start + i] ?? null);
      carouselHandIndices = Array.from({ length: 9 }, (_, i) => {
        const gi = start + i;
        return gi < idxs.length ? idxs[gi]! : null;
      });
      carouselBase = Array.from({ length: 9 }, () => null);
      carouselTierCanPrev = Array.from({ length: 9 }, () => false);
      carouselTierCanNext = Array.from({ length: 9 }, () => false);
    } else {
      carouselHandIndices = Array.from({ length: 9 }, () => null);
      const start = safePage * 9;
      carouselSlots = Array.from({ length: 9 }, (_, i) => filteredLibraryIds[start + i] ?? null);
      carouselBase = Array.from({ length: 9 }, (_, i) => filteredLibraryBaseIds[start + i] ?? null);
      carouselTierCanPrev = carouselBase.map((baseId) => {
        if (!baseId) {
          return false;
        }
        const family = libraryFamilies.find((f) => f.baseId === baseId);
        if (!family || family.tiers.length <= 1) {
          return false;
        }
        const idx = libraryTierIndexByBase[baseId] ?? 0;
        return idx > 0;
      });
      carouselTierCanNext = carouselBase.map((baseId) => {
        if (!baseId) {
          return false;
        }
        const family = libraryFamilies.find((f) => f.baseId === baseId);
        if (!family || family.tiers.length <= 1) {
          return false;
        }
        const idx = libraryTierIndexByBase[baseId] ?? 0;
        return idx < family.tiers.length - 1;
      });
    }

    const runSummary = `Losses ${String(run.remainingLosses)} · Encounter ${String(run.encounterIndex + 1)} · ${run.faction} · Spirit ${run.spirit.id} (aw ${String(run.spirit.awakening)}) · Deck ${String(run.deck.length)} · Hand ${String(run.hand.length)}`;

    const blankQueueSlotStrikeDamage = content.get(COMBAT_RULES.blankQueueSlotCardId).base_damage;

    const vm: DeckBuilderViewModel = {
      editTarget,
      blankQueueSlotStrikeDamage,
      queue,
      carousel: carouselSlots,
      carouselBase,
      carouselTierCanPrev,
      carouselTierCanNext,
      carouselPage: safePage,
      carouselPageCount: pc,
      carouselMode,
      seed: run.seed,
      runSummary,
      carouselHandIndices,
    };

    return { viewModel: vm, pageCount: pc };
  }, [
    run,
    content,
    editTarget,
    carouselMode,
    carouselPage,
    filteredLibraryIds,
    filteredLibraryBaseIds,
    filteredHandCards,
    libraryFamilies,
    libraryTierIndexByBase,
  ]);

  const pageCountRef = useRef(pageCount);
  pageCountRef.current = pageCount;

  useEffect(() => {
    setCarouselPage(0);
  }, [librarySearch, libraryFactionFilter, libraryTagFilter, carouselMode, editTarget, setCarouselPage]);

  useEffect(() => {
    if (carouselPage > pageCount - 1) {
      setCarouselPage(Math.max(0, pageCount - 1));
    }
  }, [carouselPage, pageCount, setCarouselPage]);

  const adjustCarouselTier = useCallback(
    (slotIndex: number, delta: -1 | 1) => {
      if (carouselMode !== 'all') {
        return;
      }
      const start = viewModel.carouselPage * 9;
      const baseId = filteredLibraryBaseIds[start + slotIndex];
      if (!baseId) {
        return;
      }
      const family = libraryFamilies.find((f) => f.baseId === baseId);
      if (!family || family.tiers.length <= 1) {
        return;
      }
      setLibraryTierIndexByBase((prev) => {
        const current = prev[baseId] ?? 0;
        const next = Math.max(0, Math.min(family.tiers.length - 1, current + delta));
        if (next === current) {
          return prev;
        }
        return { ...prev, [baseId]: next };
      });
    },
    [carouselMode, viewModel.carouselPage, filteredLibraryBaseIds, libraryFamilies, setLibraryTierIndexByBase],
  );

  return { viewModel, pageCount, adjustCarouselTier };
}
