import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as Phaser from 'phaser';
import { DeckBuilderSidebar } from './DeckBuilderSidebar';
import { CardHoverPopover } from './CardPreviewDock';
import { usePinnableCardHover } from './usePinnableCardHover';
import { DeckBuilderLibraryPanel } from './deckBuilder/DeckBuilderLibraryPanel';
import { DeckBuilderToastStack } from './deckBuilder/DeckBuilderToastStack';
import { useDeckBuilderToasts } from '../hooks/useDeckBuilderToasts';
import { useDeckBuilderLibraryFilters } from '../hooks/useDeckBuilderLibraryFilters';
import { useDeckBuilderCarouselViewModel } from '../hooks/useDeckBuilderCarouselViewModel';
import { DECK_BUILD } from '../ui/deckBuilderLayout';
import {
  DeckBuilderScene,
  deckBuilderHoverIdentityKey,
  type DeckBuilderHoverPayload,
} from '../ui/deckBuilderScene';
import type { CardContentService } from '../core/content';
import type { RunState } from '../core/types';
import { resolveMergeUpgradeFromIds } from '../features/forge/forgeCardModel';
import { useGameStore } from '../stores/gameStore';
import { cardArtUrlFromDef } from '../features/forge/forgeCardModel';

function resolveDropOnQueueSlot(
  content: CardContentService,
  current: string | null,
  droppedId: string,
): string {
  if (current && current === droppedId) {
    const def = content.get(droppedId);
    if (def.merge_to) {
      return def.merge_to;
    }
  }
  return droppedId;
}

interface PhaserDeckBuilderProps {
  run: RunState;
  content: CardContentService;
  onFullReset: () => void;
  onStartBattle: () => void;
  onSimulateDeckCycle: () => void;
  onSeedStep: (delta: number) => void;
}

export function PhaserDeckBuilder({
  run,
  content,
  onFullReset,
  onStartBattle,
  onSimulateDeckCycle,
  onSeedStep,
}: PhaserDeckBuilderProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  /** Parent of Phaser host + library overlay; used to align filters with scaled canvas. */
  const hostWrapRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<DeckBuilderScene | null>(null);

  const deckCycleReport = useGameStore((s) => s.deckCycleReport);
  const handleAssignPlannedSlot = useGameStore((s) => s.handleAssignPlannedSlot);
  const handleSwapPlannedSlots = useGameStore((s) => s.handleSwapPlannedSlots);
  const handleMergeHandCards = useGameStore((s) => s.handleMergeHandCards);
  const handleLoadFatigueDeckFromHand = useGameStore((s) => s.handleLoadFatigueDeckFromHand);
  const prevDeckCycleRef = useRef(deckCycleReport);

  const suppressDeckDragAfterOverlay = useCallback(() => {
    sceneRef.current?.suppressDragStarts(450);
  }, []);

  useEffect(() => {
    if (prevDeckCycleRef.current != null && deckCycleReport === null) {
      sceneRef.current?.suppressDragStarts(450);
    }
    prevDeckCycleRef.current = deckCycleReport;
  }, [deckCycleReport]);

  const [editTarget, setEditTarget] = useState<'player' | 'enemy'>('player');
  const [carouselMode, setCarouselMode] = useState<'hand' | 'all'>('all');
  const [carouselPage, setCarouselPage] = useState(0);
  const [deckHover, setDeckHover] = useState<DeckBuilderHoverPayload | null>(null);
  const [deckPopoverPointerOver, setDeckPopoverPointerOver] = useState(false);
  const {
    displayHover: deckHoverDisplay,
    pinned: deckHoverPinned,
    dismissPin: dismissDeckHoverPin,
  } = usePinnableCardHover(deckHover, deckBuilderHoverIdentityKey, 1000, deckPopoverPointerOver);

  useEffect(() => {
    if (!deckHoverDisplay) {
      setDeckPopoverPointerOver(false);
    }
  }, [deckHoverDisplay]);

  const [deckSidebarOpen, setDeckSidebarOpen] = useState(false);

  const {
    librarySearch,
    setLibrarySearch,
    libraryFactionFilter,
    setLibraryFactionFilter,
    libraryTagFilter,
    setLibraryTagFilter,
    libraryTierIndexByBase,
    setLibraryTierIndexByBase,
  } = useDeckBuilderLibraryFilters();

  const { toasts, pushToast } = useDeckBuilderToasts();

  const { viewModel, adjustCarouselTier } = useDeckBuilderCarouselViewModel({
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
  });

  const assignSlot = useCallback(
    (slotIndex: number, cardId: string) => {
      if (editTarget === 'player') {
        const cur = run.plannedQueue[slotIndex];
        const id = resolveDropOnQueueSlot(content, cur, cardId);
        handleAssignPlannedSlot('player', slotIndex, id);
      } else {
        const cur = run.enemyPlannedQueue[slotIndex];
        const id = resolveDropOnQueueSlot(content, cur, cardId);
        handleAssignPlannedSlot('enemy', slotIndex, id);
      }
    },
    [content, editTarget, handleAssignPlannedSlot, run.enemyPlannedQueue, run.plannedQueue],
  );

  const swapSlots = useCallback(
    (a: number, b: number) => {
      handleSwapPlannedSlots(editTarget, a, b);
    },
    [editTarget, handleSwapPlannedSlots],
  );

  const mergeCarouselSlots = useCallback(
    (sourceSlot: number, targetSlot: number) => {
      if (carouselMode !== 'hand' || editTarget !== 'player') {
        return;
      }
      const hi = viewModel.carouselHandIndices[sourceSlot];
      const hj = viewModel.carouselHandIndices[targetSlot];
      if (hi === null || hj === null) {
        return;
      }
      const sourceId = viewModel.carousel[sourceSlot];
      const targetId = viewModel.carousel[targetSlot];
      if (!sourceId || !targetId) {
        return;
      }
      const mergedId = resolveMergeUpgradeFromIds(content, sourceId, targetId);
      if (!mergedId) {
        pushToast('Those cards cannot be merged.');
        return;
      }
      handleMergeHandCards(sourceId, targetId, hi, hj, mergedId);
      pushToast('Cards merged.');
    },
    [carouselMode, content, editTarget, handleMergeHandCards, pushToast, viewModel],
  );

  const toggleCarouselMode = useCallback(() => {
    setCarouselMode((m) => (m === 'all' ? 'hand' : 'all'));
    setCarouselPage(0);
  }, []);

  const carouselPageCountRef = useRef(viewModel.carouselPageCount);
  carouselPageCountRef.current = viewModel.carouselPageCount;

  const carouselPageDelta = useCallback((delta: number) => {
    setCarouselPage((p) => {
      const max = Math.max(0, carouselPageCountRef.current - 1);
      return Math.max(0, Math.min(max, p + delta));
    });
  }, []);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) {
      return;
    }

    const scene = new DeckBuilderScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: DECK_BUILD.GAME_W,
      height: DECK_BUILD.GAME_H,
      parent: hostRef.current,
      backgroundColor: '#0c101b',
      scene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: { antialias: true },
    });

    gameRef.current = game;

    const host = hostRef.current;
    const wrap = hostWrapRef.current;

    let overlayRetryTimer: ReturnType<typeof setTimeout> | undefined;
    const OVERLAY_SYNC_MAX_RETRIES = 40;

    const syncLibraryOverlay = (): void => {
      if (!wrap || !game.canvas) {
        return;
      }
      const wr = wrap.getBoundingClientRect();
      const cr = game.canvas.getBoundingClientRect();
      if (cr.width < 2 || cr.height < 2) {
        return;
      }
      const sx = cr.width / DECK_BUILD.GAME_W;
      const left = cr.left - wr.left + DECK_BUILD.GAME_PAD_X * sx;
      const width = DECK_BUILD.QUEUE_BAND_W * sx;
      const top =
        cr.top - wr.top + (DECK_BUILD.LIBRARY_FILTER_TOP_WORLD_Y / DECK_BUILD.GAME_H) * cr.height;
      wrap.style.setProperty('--deck-lib-panel-left', `${String(left)}px`);
      wrap.style.setProperty('--deck-lib-panel-width', `${String(width)}px`);
      wrap.style.setProperty('--deck-lib-panel-top', `${String(top)}px`);
      wrap.style.setProperty('--deck-lib-panel-transform', 'none');
    };

    const scheduleLibraryOverlaySync = (retryCount = 0): void => {
      requestAnimationFrame(() => {
        syncLibraryOverlay();
        const cr = game.canvas?.getBoundingClientRect();
        if (
          cr &&
          (cr.width < 2 || cr.height < 2) &&
          retryCount < OVERLAY_SYNC_MAX_RETRIES
        ) {
          if (overlayRetryTimer !== undefined) {
            window.clearTimeout(overlayRetryTimer);
          }
          overlayRetryTimer = window.setTimeout(() => {
            overlayRetryTimer = undefined;
            scheduleLibraryOverlaySync(retryCount + 1);
          }, 32);
        }
      });
    };

    const onScaleResize = (): void => {
      scheduleLibraryOverlaySync();
    };
    game.scale.on('resize', onScaleResize);

    const ro = new ResizeObserver(() => {
      game.scale.refresh();
      scheduleLibraryOverlaySync();
    });
    if (host) {
      ro.observe(host);
    }
    if (wrap) {
      ro.observe(wrap);
    }
    ro.observe(game.canvas);
    const onWinResize = (): void => {
      scheduleLibraryOverlaySync();
    };
    window.addEventListener('resize', onWinResize);
    game.scale.refresh();
    scheduleLibraryOverlaySync();
    window.setTimeout(scheduleLibraryOverlaySync, 0);
    window.setTimeout(scheduleLibraryOverlaySync, 120);

    return () => {
      if (overlayRetryTimer !== undefined) {
        window.clearTimeout(overlayRetryTimer);
      }
      game.scale.off('resize', onScaleResize);
      window.removeEventListener('resize', onWinResize);
      ro.disconnect();
      if (wrap) {
        wrap.style.removeProperty('--deck-lib-panel-left');
        wrap.style.removeProperty('--deck-lib-panel-width');
        wrap.style.removeProperty('--deck-lib-panel-top');
        wrap.style.removeProperty('--deck-lib-panel-transform');
      }
      sceneRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    scene.setNameResolver((id) => content.get(id).name);
    scene.setCallbacks({
      onReset: onFullReset,
      onStartBattle,
      onSimulateDeckCycle,
      onLoadFatigueDeckFromHand: handleLoadFatigueDeckFromHand,
      onToggleEditTarget: () => {
        setEditTarget((t) => (t === 'player' ? 'enemy' : 'player'));
      },
      onAssignSlot: assignSlot,
      onSwapSlots: swapSlots,
      onToggleCarouselMode: toggleCarouselMode,
      onCarouselPage: carouselPageDelta,
      onAdjustCarouselTier: adjustCarouselTier,
      onSeedStep,
      onHoverCard: setDeckHover,
      onMergeCarouselSlots: mergeCarouselSlots,
    });
    scene.setArtResolver((id) => cardArtUrlFromDef(content.get(id)));
    scene.updateView(viewModel);
  }, [
    assignSlot,
    carouselPageDelta,
    adjustCarouselTier,
    content,
    onFullReset,
    onStartBattle,
    onSimulateDeckCycle,
    handleLoadFatigueDeckFromHand,
    onSeedStep,
    swapSlots,
    mergeCarouselSlots,
    toggleCarouselMode,
    viewModel,
  ]);

  return (
    <div className="deck-builder-layout">
      <div className="deck-builder-main">
        <div className="deck-builder-shell">
          <div className="deck-builder-host-wrap" ref={hostWrapRef}>
            <div className="deck-builder-host full-screen-phaser" ref={hostRef} />
            <DeckBuilderLibraryPanel
              run={run}
              librarySearch={librarySearch}
              onLibrarySearchChange={setLibrarySearch}
              libraryFactionFilter={libraryFactionFilter}
              setLibraryFactionFilter={setLibraryFactionFilter}
              libraryTagFilter={libraryTagFilter}
              setLibraryTagFilter={setLibraryTagFilter}
            />
          </div>
        </div>
        <CardHoverPopover
          content={content}
          hover={deckHoverDisplay}
          pinned={deckHoverPinned}
          onDismissPin={dismissDeckHoverPin}
          onPopoverPointerOverChange={setDeckPopoverPointerOver}
        />
      </div>
      <DeckBuilderSidebar
        run={run}
        editTarget={editTarget}
        open={deckSidebarOpen}
        onOpenChange={setDeckSidebarOpen}
        onToast={pushToast}
        onTransientUiClose={suppressDeckDragAfterOverlay}
      />
      <DeckBuilderToastStack toasts={toasts} />
    </div>
  );
}
