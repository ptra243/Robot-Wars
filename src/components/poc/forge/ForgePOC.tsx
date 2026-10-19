import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CardContentService } from '../../../core/content';
import { getPilotSelectBackgroundUrl } from '../../../core/pilots';
import { COMBAT_RULES } from '../../../core/rules';
import type { CombatResult } from '../../../core/types';
import { usePinnableCardHover } from '../../usePinnableCardHover';
import '../forge-poc.css';
import { BattleProgramSection } from './BattleProgramSection';
import { CardHoverPopover } from './CardHoverPopover';
import { ContextMenu } from './ContextMenu';
import { QUEUE_SIZE } from './constants';
import {
  forgeCardFromDefWithTraits,
  getCardBaseId,
  pickRandomForgeLayout,
  resolveForgeMergeUpgradeId,
} from './forgeCardModel';
import {
  buildRunModeHand,
  buildRunModeQueue,
  formatSeedLabel,
} from './forgeProgramOps';
import { useForgeQueueInteractions } from './useForgeQueueInteractions';
import { useForgeMenuActions } from './useForgeMenuActions';
import { useForgeSimulationActions } from './useForgeSimulationActions';
import { ForgeSimModal } from './ForgeSimModal';
import { ForgeTopBar } from './ForgeTopBar';
import { HandSection } from './HandSection';
import { LibraryCard } from './LibraryCard';
import { PilotPanel } from './PilotPanel';
import { PocKnockoutCardFilter } from '../PocKnockoutCardFilter';
import type { ContextMenuState, DragPayload, ForgeCard, HoverState } from './types';

interface ForgePOCProps {
  onExit?: () => void;

  // ── POC / standalone mode ────────────────────────────────────────────────
  /** Called after a self-contained combat simulation (POC / preview mode only). */
  onDeploy?: (result: CombatResult, seed: number) => void;
  /**
   * Optional catalog + seed. Defaults to `CardContentService.loadDefault` and a
   * random 32-bit seed for the POC hand / queue shuffle.
   */
  content?: CardContentService;
  forgeSeed?: number;

  // ── Run / real-game mode ─────────────────────────────────────────────────
  /**
   * Real drawn hand for this encounter (card IDs from `run.hand`).
   * When provided together with `onRunDeploy` the forge enters run mode:
   * it shows the player's actual cards and skips the self-contained combat.
   */
  initialHand?: string[];
  /**
   * The player's existing planned queue (card IDs from `run.plannedQueue`, may include nulls).
   * Cards already queued here are pre-placed in the queue section; remaining
   * hand cards not already queued appear in the hand section.
   */
  initialQueue?: (string | null)[];
  /**
   * Called on Deploy in run mode with the final queue card IDs.
   * The caller (store action) writes these into `run.plannedQueue` and runs the
   * real encounter through the full `playEncounter` lifecycle.
   */
  onRunDeploy?: (queueIds: (string | null)[], handCardIds: string[]) => void;

  // ── Shared ───────────────────────────────────────────────────────────────
  /** Faction used for draw-weighted rerolls. Defaults to 'scavengers'. */
  faction?: string;
  /** Awakening level used for draw-weighted rerolls. Defaults to 0. */
  awakening?: number;
  /** Initial reroll token count. Defaults to 0. */
  rerolls?: number;
  /** Called with +1 or -1 whenever the reroll count changes so callers can sync run state. */
  onRerollsChange?: (delta: number) => void;

  /** Run mode only: full-screen backdrop matching travel / pilot select. Ignored in POC sandbox. */
  pilotId?: string;
  /** Run mode: persisted HP between fights. Defaults to combat starting HP in POC. */
  playerHp?: number;
  playerHpMax?: number;
  /** Active run trait IDs (base/aw0/aw1 as unlocked). */
  activeTraitIds?: string[];
  /** Run mode: scrap a hand card for gold + reroll (syncs deck in parent). */
  onScrapHandCard?: (cardId: string) => void;
  /**
   * How many program slots are active in combat (5–9). Omitted in standalone forge → full 9.
   * Run mode should pass `run.sandboxActiveQueueSlots` (act 1 = 5, …, act 3+ = 9).
   */
  activeQueueSlots?: number;
  /** Run mode pre-battle enemy program (queue slots). */
  initialEnemyQueue?: (string | null)[];
  /** Run mode pre-battle enemy deck list. */
  initialEnemyDeck?: string[];
}

export function ForgePOC({
  onExit,
  onDeploy,
  content: contentProp,
  forgeSeed: forgeSeedProp,
  initialHand,
  initialQueue,
  onRunDeploy,
  faction = 'scavengers',
  awakening = 0,
  rerolls: rerollsProp = 0,
  onRerollsChange,
  pilotId,
  playerHp = COMBAT_RULES.startingHp,
  playerHpMax = COMBAT_RULES.startingHp,
  activeTraitIds = [],
  onScrapHandCard,
  activeQueueSlots: activeQueueSlotsProp,
  initialEnemyQueue,
  initialEnemyDeck,
}: ForgePOCProps) {
  const isRunMode = initialHand !== undefined && onRunDeploy !== undefined;
  const [viewMode, setViewMode] = useState<'player' | 'enemy'>('player');

  const programSlots = useMemo((): number => {
    if (activeQueueSlotsProp === undefined) {
      return COMBAT_RULES.queueSize;
    }
    return Math.max(5, Math.min(COMBAT_RULES.queueSize, Math.floor(activeQueueSlotsProp)));
  }, [activeQueueSlotsProp]);
  const runBackdropStyle: CSSProperties | undefined = isRunMode
    ? ({
        '--forge-pilot-bg': `url(${getPilotSelectBackgroundUrl(pilotId ?? 'glint')})`,
      } as CSSProperties)
    : undefined;
  const forgeSeed = useMemo(
    () =>
      forgeSeedProp ??
      Math.floor(Math.random() * 0x1_0000_0000),
    [forgeSeedProp],
  );

  const content = useMemo(
    () => contentProp ?? CardContentService.loadDefault(forgeSeed),
    [contentProp, forgeSeed],
  );

  const initialLayout = useMemo(
    () => pickRandomForgeLayout(content, forgeSeed),
    [content, forgeSeed],
  );

  const seedLabel = useMemo(() => formatSeedLabel(forgeSeed), [forgeSeed]);

  // In run mode the hand and queue are seeded from the real run state;
  // in POC mode they come from the random forge layout.
  const [hand, setHand] = useState<ForgeCard[]>(() =>
    isRunMode && initialHand
      ? buildRunModeHand(initialHand, initialQueue ?? [], content, activeTraitIds)
      : initialLayout.hand,
  );
  const [queue, setQueue] = useState<(ForgeCard | null)[]>(() =>
    isRunMode && initialQueue
      ? buildRunModeQueue(initialQueue, content, activeTraitIds)
      : initialLayout.queue,
  );
  const [hover, setHover] = useState<HoverState | null>(null);
  const [popoverPointerOver, setPopoverPointerOver] = useState(false);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [localRerolls, setLocalRerolls] = useState<number>(rerollsProp);
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [tierModalCardId, setTierModalCardId] = useState<string | null>(null);
  /** Sync drag payload before React re-renders (merge dragOver needs source card immediately). */
  const dragPayloadRef = useRef<DragPayload | null>(null);

  useEffect(() => {
    setLocalRerolls(rerollsProp);
  }, [rerollsProp]);

  useEffect(() => {
    setQueue((prev) => {
      const extras: ForgeCard[] = [];
      const next = [...prev];
      let changed = false;
      for (let i = programSlots; i < QUEUE_SIZE; i += 1) {
        if (next[i]) {
          extras.push(next[i]!);
          next[i] = null;
          changed = true;
        }
      }
      if (!changed) {
        return prev;
      }
      if (extras.length > 0) {
        queueMicrotask(() => {
          setHand((h) => [...h, ...extras]);
        });
      }
      return next;
    });
  }, [programSlots]);

  useEffect(() => {
    if (!menu) return;
    const onDocClick = () => {
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const enemyDeckCards = useMemo<ForgeCard[]>(
    () =>
      (initialEnemyDeck ?? []).flatMap((id) => {
        try {
          return [forgeCardFromDefWithTraits(content.get(id), activeTraitIds)];
        } catch {
          return [];
        }
      }),
    [initialEnemyDeck, content],
  );
  const enemyProgramCards = useMemo<(ForgeCard | null)[]>(
    () => buildRunModeQueue(initialEnemyQueue ?? [], content),
    [initialEnemyQueue, content],
  );
  const showingEnemy = viewMode === 'enemy' && isRunMode;
  const displayQueue = showingEnemy
    ? enemyDeckCards.length > 0
      ? [...enemyDeckCards, ...Array.from({ length: Math.max(0, QUEUE_SIZE - enemyDeckCards.length) }, () => null)]
      : enemyProgramCards
    : queue;
  const displayProgramSlots = showingEnemy ? Math.max(1, displayQueue.length) : programSlots;
  const displayHand = showingEnemy ? enemyDeckCards : hand;

  const setHoverCardAt = (card: ForgeCard | null, ev?: { clientX: number; clientY: number }) => {
    if (!card) {
      setHover(null);
      return;
    }
    if (!ev) return;
    setHover({
      card,
      x: ev.clientX,
      y: ev.clientY,
      clientX: ev.clientX,
      clientY: ev.clientY,
    });
  };

  const {
    displayHover,
    pinned: hoverPinned,
    dismissPin: dismissHoverPin,
  } = usePinnableCardHover(hover, (h) => h.card.id, 2000, popoverPointerOver);

  useEffect(() => {
    if (!displayHover) {
      setPopoverPointerOver(false);
    }
  }, [displayHover]);

  const {
    assignNextEmpty,
    clearSlot,
    handleDropOnSlot,
    handleDropOnHand,
    shiftQueueLeft,
    shiftQueueRight,
  } = useForgeQueueInteractions({
    hand,
    queue,
    programSlots,
    setHand,
    setQueue,
    resolveCardById: (id) => {
      try {
        return forgeCardFromDefWithTraits(content.get(id), activeTraitIds);
      } catch {
        return null;
      }
    },
  });

  const {
    onQueueContextMenu,
    onHandContextMenu,
    handleScrapFromMenu,
    handleViewTiersFromMenu,
    handleRerollHandCard,
    handleMergeCards,
  } = useForgeMenuActions({
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
    activeTraitIds,
    setMenu,
    setHover,
    setHand,
    setQueue,
    setLocalRerolls,
    setTierModalCardId,
  });

  const filledCount = displayQueue.slice(0, displayProgramSlots).filter((c) => c !== null).length;
  const factionClass =
    faction === 'scavengers'
      ? 'forge-poc--scavengers'
      : faction === 'cyberpunk'
        ? 'forge-poc--cyberpunk'
      : faction === 'clockwork'
        ? 'forge-poc--clockwork'
      : faction === 'overclock'
        ? 'forge-poc--overclock'
        : faction === 'aegis'
          ? 'forge-poc--aegis'
          : 'forge-poc--neutral';

  const { forgeDeckSimulation, handleSimulationRoundHover, handleDeploy } = useForgeSimulationActions({
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
  });

  return (
    <div
      className={`forge-poc ${factionClass}${isRunMode ? ' forge-poc--run' : ''} forge-poc--view-${showingEnemy ? 'enemy' : 'player'}`}
      style={runBackdropStyle}
    >
      <PocKnockoutCardFilter />
      <div className="forge-poc__bg" />
      <div className="forge-poc__scanlines" />
      <div className="forge-poc__vignette" />

      <ForgeTopBar
        awakeningInternal={awakening}
        seedLabel={seedLabel}
        filledCount={filledCount}
        programSlotCap={displayProgramSlots}
        viewMode={showingEnemy ? 'enemy' : 'player'}
        onViewModeChange={isRunMode ? setViewMode : undefined}
        onSimulate={() => {
          setHover(null);
          setSimModalOpen(true);
        }}
        onDeploy={handleDeploy}
        onExit={onExit}
      />

      <BattleProgramSection
        queue={displayQueue}
        activeProgramSlots={displayProgramSlots}
        dragOverSlot={dragOverSlot}
        dragging={dragging}
        dragPayloadRef={dragPayloadRef}
        setDragging={setDragging}
        setDragOverSlot={setDragOverSlot}
        setHover={setHover}
        setHoverCardAt={setHoverCardAt}
        clearSlot={clearSlot}
        onQueueContextMenu={onQueueContextMenu}
        handleDropOnSlot={handleDropOnSlot}
        sectionTitle={showingEnemy ? 'ENEMY PROGRAM' : 'BATTLE PROGRAM'}
        sectionSubtitle={
          showingEnemy
            ? 'Full enemy deck preview for this encounter'
            : 'Instruction sequence · executes left to right each round'
        }
        readOnly={showingEnemy}
        primeTraitIds={showingEnemy ? [] : activeTraitIds}
        faction={showingEnemy ? undefined : faction}
      />

      <div className="forge-poc__grid">
        <PilotPanel
          awakeningInternal={awakening}
          pilotId={pilotId ?? 'glint'}
          playerHp={playerHp}
          playerHpMax={playerHpMax}
          activeTraitIds={activeTraitIds}
          viewMode={showingEnemy ? 'enemy' : 'player'}
        />

        <HandSection
          hand={displayHand}
          queue={displayQueue}
          dragging={dragging}
          dragPayloadRef={dragPayloadRef}
          setDragging={setDragging}
          setDragOverSlot={setDragOverSlot}
          setHover={setHover}
          setHoverCardAt={setHoverCardAt}
          assignNextEmpty={assignNextEmpty}
          handleDropOnHand={handleDropOnHand}
          onHandContextMenu={onHandContextMenu}
          onMergeCards={handleMergeCards}
          canMergeCards={(a, b) => resolveForgeMergeUpgradeId(content, a, b) !== null}
          sectionTitle={showingEnemy ? 'ENEMY DECK' : 'HAND'}
          sectionSubtitle={
            showingEnemy
              ? 'Deck list generated at encounter select'
              : 'Hover to inspect · double-click to add · right-click to reroll · drag same card to tier-up'
          }
          readOnly={showingEnemy}
        />
      </div>

      {simModalOpen && forgeDeckSimulation ? (
        <ForgeSimModal
          simulation={forgeDeckSimulation}
          onClose={() => setSimModalOpen(false)}
          onSimulationRoundHover={handleSimulationRoundHover}
        />
      ) : null}

      <footer className="forge-poc__statusbar">
        <span className="forge-poc__status-dot" />
        READY · DRAG HAND → PROGRAM · RIGHT-CLICK PROGRAM TO SHIFT · DOUBLE-CLICK TO AUTO-ADD
        {localRerolls > 0 ? ` · REROLLS: ${String(localRerolls)}` : ''}
      </footer>

      {displayHover && !dragging ? (
        <CardHoverPopover
          hover={
            hoverPinned
              ? { ...displayHover, x: displayHover.x, y: displayHover.y }
              : displayHover
          }
          zIndex={simModalOpen ? 1500 : undefined}
          onPointerEnterPopover={() => {
            setPopoverPointerOver(true);
          }}
          onPointerLeavePopover={() => {
            setPopoverPointerOver(false);
          }}
          onClose={
            hoverPinned
              ? () => {
                  dismissHoverPin();
                  setHover(null);
                  setPopoverPointerOver(false);
                }
              : undefined
          }
        />
      ) : null}
      {menu ? (
        <ContextMenu
          menu={menu}
          onShiftLeft={() => {
            shiftQueueLeft(menu.slotIndex);
            setMenu(null);
          }}
          onShiftRight={() => {
            shiftQueueRight(menu.slotIndex);
            setMenu(null);
          }}
          canShiftLeft={
            menu.slotIndex === null
              ? queue.slice(0, programSlots).some((c) => c !== null)
              : menu.slotIndex < programSlots &&
                queue.slice(0, menu.slotIndex + 1).some((c) => c !== null)
          }
          canShiftRight={
            menu.slotIndex === null
              ? queue.slice(0, programSlots).some((c) => c !== null)
              : menu.slotIndex < programSlots &&
                queue.slice(menu.slotIndex, programSlots).some((c) => c !== null)
          }
          onReroll={
            menu.handIndex !== undefined
              ? () => handleRerollHandCard(menu.handIndex as number)
              : undefined
          }
          canReroll={menu.handIndex !== undefined && localRerolls > 0}
          rerolls={localRerolls}
          onScrap={menu.handIndex !== undefined && onScrapHandCard ? handleScrapFromMenu : undefined}
          canScrap={Boolean(onScrapHandCard)}
          onViewTiers={menu.handIndex !== undefined ? handleViewTiersFromMenu : undefined}
        />
      ) : null}

      {tierModalCardId ? (
        <div
          className="forge-poc__modal-backdrop"
          role="presentation"
          onClick={() => {
            setTierModalCardId(null);
          }}
        >
          <div
            className="forge-poc__tier-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Card tiers"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="forge-poc__tier-modal-head">Tiers</div>
            <div className="forge-poc__tier-modal-row">
              {([1, 2, 3] as const).map((t) => {
                const id = `${getCardBaseId(tierModalCardId)}_t${String(t)}`;
                const isCurrent = id === tierModalCardId;
                let fc: ForgeCard;
                try {
                  fc = forgeCardFromDefWithTraits(content.get(id), activeTraitIds);
                } catch {
                  return (
                    <div key={id} className="forge-poc__tier-slot forge-poc__tier-slot--missing">
                      <span className="forge-poc__tier-missing">T{t} — unavailable</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={id}
                    className={`forge-poc__tier-slot${isCurrent ? ' forge-poc__tier-slot--current' : ''}`}
                  >
                    <LibraryCard
                      card={fc}
                      isDragging={false}
                      onHover={() => {}}
                      onAssign={() => {}}
                      pickMode
                      onPick={() => {
                        setTierModalCardId(null);
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="forge-poc__tier-modal-close"
              onClick={() => {
                setTierModalCardId(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
