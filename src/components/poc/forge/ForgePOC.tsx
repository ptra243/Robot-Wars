import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { CombatSimulator } from '../../../core/combat';
import { CardContentService } from '../../../core/content';
import { getPilotSelectBackgroundUrl } from '../../../core/pilots';
import { COMBAT_RULES } from '../../../core/rules';
import {
  type ForgeDeckSimulationResult,
  createCombatSetupFromDecklists,
  simulateForgeDeckMetrics,
} from '../../../core/run';
import type { CombatResult } from '../../../core/types';
import '../forge-poc.css';
import { BattleProgramSection } from './BattleProgramSection';
import { CardHoverPopover } from './CardHoverPopover';
import { ContextMenu } from './ContextMenu';
import { QUEUE_SIZE } from './constants';
import {
  forgeCardFromDef,
  getCardBaseId,
  pickRandomForgeLayout,
  resolveForgeMergeUpgradeId,
} from './forgeCardModel';
import { ForgeSimModal } from './ForgeSimModal';
import { ForgeTopBar } from './ForgeTopBar';
import { HandSection } from './HandSection';
import { LibraryCard } from './LibraryCard';
import { PilotPanel } from './PilotPanel';
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
  /** Run mode: scrap a hand card for gold + reroll (syncs deck in parent). */
  onScrapHandCard?: (cardId: string) => void;
}

// ── Run-mode initialisation helpers ─────────────────────────────────────────

/**
 * Converts raw card IDs from the run's planned queue into ForgeCard objects.
 * Unknown IDs are silently replaced with null so the slot stays empty.
 */
function buildRunModeQueue(
  queueIds: (string | null)[],
  content: CardContentService,
): (ForgeCard | null)[] {
  return Array.from({ length: QUEUE_SIZE }, (_, i) => {
    const id = queueIds[i] ?? null;
    if (!id) return null;
    try {
      return forgeCardFromDef(content.get(id));
    } catch {
      return null;
    }
  });
}

/**
 * Converts raw card IDs from `run.hand` into ForgeCard objects, filtering out
 * any cards that are already placed in the planned queue so they appear only
 * in their queue slot — not duplicated in the hand section.
 */
function buildRunModeHand(
  handIds: string[],
  queueIds: (string | null)[],
  content: CardContentService,
): ForgeCard[] {
  // Build a pool of "queued" id occurrences to deduct from hand display.
  const queued = queueIds.filter(Boolean) as string[];
  const remaining = [...handIds];
  for (const qId of queued) {
    const idx = remaining.indexOf(qId);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return remaining.flatMap((id) => {
    try {
      return [forgeCardFromDef(content.get(id))];
    } catch {
      return [];
    }
  });
}

function formatSeedLabel(seed: number): string {
  const hex = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Forge battle program: shift operations open an empty slot at the **pivot** index so the player can
 * drop a card from hand. Only the contiguous block from the pivot toward the nearest existing gap (or
 * the end of the strip) moves; slots beyond that gap are left unchanged.
 *
 * **Shift right (pivot p)** — empties slot `p` (after the move `queue[p] === null`):
 * - Consider slots `p … 8` (the pivot slot and everything to its right).
 * - If there is any empty slot at index `e` with `p < e ≤ 8`, find the **smallest** such `e`. Shift
 *   cards right by one **only** within `[p, e]`: for `i` from `e` down to `p+1`, `queue[i] = queue[i-1]`,
 *   then set `queue[p] = null`. Indices `e+1 … 8` are **not** modified (cards past the gap stay put).
 * - If there is **no** empty slot in `(p, 8]`, the suffix is full: shift the entire block `p … 8`
 *   right by one; the card that was in slot `8` goes to the **hand**, and `queue[p] = null`.
 *
 * **Shift left (pivot p)** — symmetric, empties slot `p`:
 * - Consider slots `0 … p` (the pivot and everything to its left).
 * - If there is any empty slot at index `e` with `0 ≤ e < p`, find the **smallest** such `e`. Shift
 *   cards left by one **only** within `[e, p]`: for `i` from `e` to `p-1`, `queue[i] = queue[i+1]`,
 *   then set `queue[p] = null`. Indices `0 … e-1` are **not** modified.
 * - If there is **no** empty slot in `[0, p)`, the prefix is full: shift `0 … p` left by one; the card
 *   that was in slot `0` goes to the **hand**, and `queue[p] = null`.
 */

function forgeShiftProgramRight(
  queue: (ForgeCard | null)[],
  pivot: number,
): { next: (ForgeCard | null)[]; toHand: ForgeCard | null } {
  const next = [...queue];
  const p = Math.max(0, Math.min(QUEUE_SIZE - 1, pivot));

  let firstEmptyRight = -1;
  for (let i = p + 1; i < QUEUE_SIZE; i += 1) {
    if (next[i] === null) {
      firstEmptyRight = i;
      break;
    }
  }

  if (firstEmptyRight !== -1) {
    for (let i = firstEmptyRight; i > p; i -= 1) {
      next[i] = next[i - 1] ?? null;
    }
    next[p] = null;
    return { next, toHand: null };
  }

  const pushed = next[QUEUE_SIZE - 1];
  for (let i = QUEUE_SIZE - 1; i > p; i -= 1) {
    next[i] = next[i - 1] ?? null;
  }
  next[p] = null;
  return { next, toHand: pushed };
}

function forgeShiftProgramLeft(
  queue: (ForgeCard | null)[],
  pivot: number,
): { next: (ForgeCard | null)[]; toHand: ForgeCard | null } {
  const next = [...queue];
  const p = Math.max(0, Math.min(QUEUE_SIZE - 1, pivot));

  let firstEmptyLeft = -1;
  for (let i = 0; i < p; i += 1) {
    if (next[i] === null) {
      firstEmptyLeft = i;
      break;
    }
  }

  if (firstEmptyLeft !== -1) {
    for (let i = firstEmptyLeft; i < p; i += 1) {
      next[i] = next[i + 1] ?? null;
    }
    next[p] = null;
    return { next, toHand: null };
  }

  const pushed = next[0];
  for (let i = 0; i < p; i += 1) {
    next[i] = next[i + 1] ?? null;
  }
  next[p] = null;
  return { next, toHand: pushed };
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
  onScrapHandCard,
}: ForgePOCProps) {
  const isRunMode = initialHand !== undefined && onRunDeploy !== undefined;
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
      ? buildRunModeHand(initialHand, initialQueue ?? [], content)
      : initialLayout.hand,
  );
  const [queue, setQueue] = useState<(ForgeCard | null)[]>(() =>
    isRunMode && initialQueue
      ? buildRunModeQueue(initialQueue, content)
      : initialLayout.queue,
  );
  const [hover, setHover] = useState<HoverState | null>(null);
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

  const setHoverCardAt = (card: ForgeCard | null, ev?: { clientX: number; clientY: number }) => {
    if (!card) {
      setHover(null);
      return;
    }
    if (!ev) return;
    setHover({ card, x: ev.clientX, y: ev.clientY });
  };

  const assignNextEmpty = (handIndex: number) => {
    const card = hand[handIndex];
    if (!card) return;
    const empty = queue.findIndex((c) => c === null);
    if (empty === -1) return;
    setQueue((prev) => {
      const next = [...prev];
      next[empty] = card;
      return next;
    });
    setHand((prev) => prev.filter((_, i) => i !== handIndex));
  };

  const clearSlot = (idx: number) => {
    const card = queue[idx];
    setQueue((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
    if (card) setHand((prev) => [...prev, card]);
  };

  const handleDropOnSlot = (slotIndex: number, payload: DragPayload) => {
    if (payload.source === 'hand') {
      const card = hand[payload.index];
      if (!card) return;
      const displaced = queue[slotIndex];
      setHand((prev) => {
        const next = prev.filter((_, i) => i !== payload.index);
        if (displaced) next.push(displaced);
        return next;
      });
      setQueue((prev) => {
        const next = [...prev];
        next[slotIndex] = card;
        return next;
      });
      return;
    }

    if (payload.source === 'queue' && payload.index !== slotIndex) {
      setQueue((prev) => {
        const next = [...prev];
        const src = next[payload.index];
        next[payload.index] = next[slotIndex];
        next[slotIndex] = src;
        return next;
      });
    }
  };

  const handleDropOnHand = (payload: DragPayload) => {
    if (payload.source !== 'queue') return;
    const card = queue[payload.index];
    if (!card) return;
    setQueue((prev) => {
      const next = [...prev];
      next[payload.index] = null;
      return next;
    });
    setHand((prev) => [...prev, card]);
  };

  /** Context menu pivot: slot index, or `null` = whole strip (shift left from slot 8, shift right from slot 0). */
  const shiftQueueLeft = (pivot: number | null) => {
    const p = pivot ?? QUEUE_SIZE - 1;
    let toHand: ForgeCard | null = null;
    setQueue((prev) => {
      const r = forgeShiftProgramLeft(prev, p);
      toHand = r.toHand;
      return r.next;
    });
    if (toHand) {
      const pushed = toHand;
      setHand((h) => [...h, pushed]);
    }
  };

  const shiftQueueRight = (pivot: number | null) => {
    const p = pivot ?? 0;
    let toHand: ForgeCard | null = null;
    setQueue((prev) => {
      const r = forgeShiftProgramRight(prev, p);
      toHand = r.toHand;
      return r.next;
    });
    if (toHand) {
      const pushed = toHand;
      setHand((h) => [...h, pushed]);
    }
  };

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
    const newCard = content.drawWeighted(
      faction as Parameters<typeof content.drawWeighted>[0],
      awakening,
    );
    const forgeCard = forgeCardFromDef(newCard);
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
    const targetCard = hand[toHandIdx];
    const sourceCard =
      fromPayload.source === 'hand' ? hand[fromPayload.index] : queue[fromPayload.index];
    if (!sourceCard || !targetCard) return;

    const upgradedId = resolveForgeMergeUpgradeId(content, sourceCard, targetCard);
    if (!upgradedId) return;
    let upgradedCard: ForgeCard;
    try {
      upgradedCard = forgeCardFromDef(content.get(upgradedId));
    } catch {
      return;
    }

    if (fromPayload.source === 'hand') {
      // Remove both hand cards, add merged card
      setHand((prev) => {
        const next = prev.filter(
          (_, i) => i !== fromPayload.index && i !== toHandIdx,
        );
        return [...next, upgradedCard];
      });
    } else {
      // Source from queue slot — clear that slot, remove target hand card
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

    // Tier-up grants +1 reroll token
    setLocalRerolls((r) => r + 1);
    onRerollsChange?.(+1);
  };

  const filledCount = queue.filter((c) => c !== null).length;

  const forgeDeckSimulation = useMemo((): ForgeDeckSimulationResult | null => {
    if (!simModalOpen) {
      return null;
    }
    const queueIds = queue.map((card) => card?.id ?? null);
    const playerDeck = [...queue.filter((card): card is ForgeCard => card !== null), ...hand].map(
      (card) => card.id,
    );
    return simulateForgeDeckMetrics(content, forgeSeed, queueIds, playerDeck);
  }, [simModalOpen, content, forgeSeed, queue, hand]);

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
      if (!id) {
        setHover(null);
        return;
      }
      try {
        setHover({
          card: forgeCardFromDef(content.get(id)),
          x: pointer.clientX,
          y: pointer.clientY,
        });
      } catch {
        setHover(null);
      }
    },
    [forgeDeckSimulation, content],
  );

  useEffect(() => {
    if (!simModalOpen) {
      setHover(null);
    }
  }, [simModalOpen]);

  const handleDeploy = () => {
    const queueIds = queue.map((card) => card?.id ?? null);

    if (onRunDeploy) {
      // Run mode: queue + hand card ids rebuild run.deck (includes tier merges).
      const handCardIds = hand.map((c) => c.id);
      onRunDeploy(queueIds, handCardIds);
      return;
    }

    // POC / standalone mode: run a self-contained combat with the forge's own
    // random cards and a dummy enemy deck, then report the result upward.
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
    });
    const simulator = new CombatSimulator(content, forgeSeed);
    const result = simulator.run(setup);
    onDeploy?.(result, forgeSeed);
  };

  return (
    <div
      className={`forge-poc forge-poc--scavengers${isRunMode ? ' forge-poc--run' : ''}`}
      style={runBackdropStyle}
    >
      <div className="forge-poc__bg" />
      <div className="forge-poc__scanlines" />
      <div className="forge-poc__vignette" />

      <ForgeTopBar
        awakeningInternal={awakening}
        seedLabel={seedLabel}
        filledCount={filledCount}
        onSimulate={() => {
          setHover(null);
          setSimModalOpen(true);
        }}
        onDeploy={handleDeploy}
        onExit={onExit}
      />

      <BattleProgramSection
        queue={queue}
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
      />

      <div className="forge-poc__grid">
        <PilotPanel
          awakeningInternal={awakening}
          pilotId={pilotId ?? 'glint'}
          playerHp={playerHp}
          playerHpMax={playerHpMax}
        />

        <HandSection
          hand={hand}
          queue={queue}
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

      {hover && !dragging ? (
        <CardHoverPopover hover={hover} zIndex={simModalOpen ? 1500 : undefined} />
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
              ? queue.some((c) => c !== null)
              : queue.slice(0, menu.slotIndex + 1).some((c) => c !== null)
          }
          canShiftRight={
            menu.slotIndex === null
              ? queue.some((c) => c !== null)
              : queue.slice(menu.slotIndex).some((c) => c !== null)
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
                  fc = forgeCardFromDef(content.get(id));
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
