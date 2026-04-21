import * as Phaser from 'phaser';
import {
  createMiniMtgQueueCard,
  type MiniMtgQueueCard,
  type QueueCardStyle,
} from './arenaQueueUi';
import { paintMiniMtgTradingChrome } from './tradingCardPhaserChrome';
import { syncMiniCardArt } from './phaserCardArt';
import { COMBAT_RULES } from '../core/rules';
import { DECK_BUILD, deckCarouselSlotCenterX, deckQueueSlotCenterX } from './deckBuilderLayout';

export interface DeckBuilderViewModel {
  editTarget: 'player' | 'enemy';
  /** `neutral_basic_strike` tier-1 base damage — shown for empty queue slots. */
  blankQueueSlotStrikeDamage: number;
  queue: Array<string | null>;
  carousel: Array<string | null>;
  /** Library mode: base-card family id per carousel slot (null in hand mode). */
  carouselBase: Array<string | null>;
  /** Library mode: whether tier can move left/right for the slot (false in hand mode). */
  carouselTierCanPrev: boolean[];
  carouselTierCanNext: boolean[];
  carouselPage: number;
  carouselPageCount: number;
  carouselMode: 'hand' | 'all';
  seed: number;
  runSummary: string;
  /** Hand mode: `run.hand` index for each carousel slot on this page (merge / edit). */
  carouselHandIndices: Array<number | null>;
}

/** Hover payload for React floating preview (`client*` in viewport pixels for positioning). */
export type DeckBuilderHoverPayload =
  | {
      kind: 'queue';
      slotIndex: number;
      cardId: string | null;
      clientX: number;
      clientY: number;
    }
  | {
      kind: 'carousel';
      slotIndex: number;
      cardId: string | null;
      clientX: number;
      clientY: number;
    };

export function deckBuilderHoverIdentityKey(h: DeckBuilderHoverPayload): string {
  return `${h.kind}:${String(h.slotIndex)}:${h.cardId ?? (h.kind === 'queue' ? 'basic' : 'empty')}`;
}

export interface DeckBuilderCallbacks {
  onReset(): void;
  onStartBattle(): void;
  onToggleEditTarget(): void;
  onAssignSlot(slotIndex: number, cardId: string): void;
  onSwapSlots(a: number, b: number): void;
  onToggleCarouselMode(): void;
  onCarouselPage(delta: number): void;
  onAdjustCarouselTier(slotIndex: number, delta: -1 | 1): void;
  onSimulateDeckCycle(): void;
  onLoadFatigueDeckFromHand(): void;
  onSeedStep(delta: number): void;
  /** `null` clears the preview. Suppressed while dragging. */
  onHoverCard?(payload: DeckBuilderHoverPayload | null): void;
  /** Hand mode: merge tier by dropping a carousel card onto another slot. */
  onMergeCarouselSlots?(sourceSlot: number, targetSlot: number): void;
}

const defaultCallbacks: DeckBuilderCallbacks = {
  onReset: () => undefined,
  onStartBattle: () => undefined,
  onToggleEditTarget: () => undefined,
  onAssignSlot: () => undefined,
  onSwapSlots: () => undefined,
  onToggleCarouselMode: () => undefined,
  onCarouselPage: () => undefined,
  onAdjustCarouselTier: () => undefined,
  onSimulateDeckCycle: () => undefined,
  onLoadFatigueDeckFromHand: () => undefined,
  onSeedStep: () => undefined,
  onHoverCard: () => undefined,
  onMergeCarouselSlots: () => undefined,
};

const COL_PLAYER = 0x3b82f6;
const COL_ENEMY = 0xef4444;

const DECK_QUEUE_STYLE_PLAYER: QueueCardStyle = {
  idleFill: 0x172554,
  activeFill: 0x1e3a5f,
  strokeColor: 0x64748b,
  strokeWidth: 1,
  labelColor: '#e2e8f0',
};

export class DeckBuilderScene extends Phaser.Scene {
  private callbacks: DeckBuilderCallbacks = defaultCallbacks;
  private getCardShortName: (cardId: string) => string = (id) => id.slice(0, 12);
  private artResolver: ((cardId: string) => string | null) | null = null;
  private viewModel: DeckBuilderViewModel | null = null;
  private pendingView: DeckBuilderViewModel | null = null;

  private queuePanel: Phaser.GameObjects.Rectangle | undefined;
  private queueCards: MiniMtgQueueCard[] = [];
  /** Library carousel slots — same mini MTG card component as the plan queue. */
  private carouselCards: MiniMtgQueueCard[] = [];

  private carouselModeText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;
  private editTargetHint!: Phaser.GameObjects.Text;
  private toggleEditLabel!: Phaser.GameObjects.Text;
  private seedText!: Phaser.GameObjects.Text;
  private runSummaryText!: Phaser.GameObjects.Text;

  private dragKind: 'queue' | 'carousel' | null = null;
  private dragQueueIndex: number | null = null;
  private dragCardId: string | null = null;
  private dragCarouselFromSlot: number | null = null;
  private dragGhost: Phaser.GameObjects.Container | undefined;
  private carouselTierLeftArrows: Phaser.GameObjects.Text[] = [];
  private carouselTierRightArrows: Phaser.GameObjects.Text[] = [];
  private hoveredCarouselSlot: number | null = null;
  /** Queue slot index highlighted as drop/swap target while dragging. */
  private highlightedQueueSlot: number | null = null;
  /** Carousel slot highlighted as merge target while dragging a hand card. */
  private highlightedCarouselSlot: number | null = null;
  /** Dedup React hover updates (pointermove + hit-test; stable across scale refresh). */
  private lastHoverKey = '';
  /** After DOM overlays (modal, prompt) close, ignore pointerdown briefly to avoid accidental drags. */
  private dragStartSuppressedUntil = 0;

  constructor() {
    super('deckBuilder');
  }

  /**
   * Call when a browser overlay above the canvas closes (modal, `prompt`, `confirm`, etc.)
   * so the same gesture does not start a queue/library drag on the card under the cursor.
   */
  suppressDragStarts(ms: number = 450): void {
    this.dragStartSuppressedUntil = Date.now() + ms;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0c101b');

    const inset = DECK_BUILD.SCENE_EDGE_INSET;
    this.add
      .rectangle(
        DECK_BUILD.GAME_W / 2,
        DECK_BUILD.GAME_H / 2,
        DECK_BUILD.GAME_W - 2 * inset,
        DECK_BUILD.GAME_H - 2 * inset,
        0x000000,
        0,
      )
      .setStrokeStyle(1, 0x1e293b, 0.45)
      .setDepth(0);

    this.add
      .rectangle(DECK_BUILD.CONTAINER_CX, 32, DECK_BUILD.GAME_W - 40, 52, 0x111827, 0.98)
      .setStrokeStyle(1, 0x334155)
      .setDepth(0);

    const resetHit = this.add
      .rectangle(72, 32, 108, 40, 0x1e293b, 0.4)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add
      .text(72, 32, 'Reset', {
        color: '#f8fafc',
        fontFamily: 'Consolas, monospace',
        fontSize: '14px',
      })
      .setOrigin(0.5)
      .setDepth(4);
    resetHit.on('pointerdown', () => this.callbacks.onReset());

    const seedMinus = this.add
      .rectangle(168, 32, 40, 36, 0x1e293b, 0.85)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add.text(168, 32, '−', { color: '#e2e8f0', fontSize: '18px' }).setOrigin(0.5).setDepth(4);
    seedMinus.on('pointerdown', () => this.callbacks.onSeedStep(-1));

    this.seedText = this.add
      .text(230, 32, '', {
        color: '#fde68a',
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
      })
      .setOrigin(0.5)
      .setDepth(4);

    const seedPlus = this.add
      .rectangle(312, 32, 40, 36, 0x1e293b, 0.85)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add.text(312, 32, '+', { color: '#e2e8f0', fontSize: '18px' }).setOrigin(0.5).setDepth(4);
    seedPlus.on('pointerdown', () => this.callbacks.onSeedStep(1));

    this.add
      .text(DECK_BUILD.CONTAINER_CX, 32, 'Deck building sandbox', {
        color: '#e2e8f0',
        fontFamily: 'Consolas, monospace',
        fontSize: '18px',
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.toggleEditLabel = this.add
      .text(900, 32, '', {
        color: '#93c5fd',
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
      })
      .setOrigin(0.5)
      .setDepth(4);

    const editHit = this.add
      .rectangle(900, 32, 180, 38, 0x000000, 0.01)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    editHit.on('pointerdown', () => this.callbacks.onToggleEditTarget());

    const cycleHit = this.add
      .rectangle(1040, 32, 158, 40, 0x0f766e, 0.88)
      .setStrokeStyle(1, 0x2dd4bf)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add
      .text(1040, 32, 'Simulate deck cycle', {
        color: '#ecfeff',
        fontFamily: 'Consolas, monospace',
        fontSize: '11px',
      })
      .setOrigin(0.5)
      .setDepth(4);
    cycleHit.on('pointerdown', () => this.callbacks.onSimulateDeckCycle());

    const loadDeckHit = this.add
      .rectangle(1180, 32, 132, 40, 0x1e3a8a, 0.88)
      .setStrokeStyle(1, 0x60a5fa)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add
      .text(1180, 32, 'Load deck ← hand', {
        color: '#dbeafe',
        fontFamily: 'Consolas, monospace',
        fontSize: '11px',
      })
      .setOrigin(0.5)
      .setDepth(4);
    loadDeckHit.on('pointerdown', () => this.callbacks.onLoadFatigueDeckFromHand());

    const battleHit = this.add
      .rectangle(1315, 32, 128, 40, 0x1d4ed8, 0.85)
      .setStrokeStyle(1, 0x60a5fa)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    this.add
      .text(1315, 32, 'Start battle', {
        color: '#f8fafc',
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
      })
      .setOrigin(0.5)
      .setDepth(4);
    battleHit.on('pointerdown', () => this.callbacks.onStartBattle());

    this.runSummaryText = this.add.text(DECK_BUILD.CONTAINER_CX, 64, '', {
      color: '#94a3b8',
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
    });
    this.runSummaryText.setOrigin(0.5).setVisible(false);

    this.editTargetHint = this.add.text(DECK_BUILD.CONTAINER_CX, 86, '', {
      color: '#94a3b8',
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
    });
    this.editTargetHint.setOrigin(0.5).setVisible(false);

    const queueY = DECK_BUILD.QUEUE_ROW_CY;
    this.queuePanel = this.add
      .rectangle(
        DECK_BUILD.CONTAINER_CX,
        queueY,
        DECK_BUILD.QUEUE_BAND_W,
        DECK_BUILD.QUEUE_PANEL_H,
        0x0f1420,
        0.95,
      )
      .setStrokeStyle(2, COL_PLAYER)
      .setDepth(0);

    this.add
      .text(
        DECK_BUILD.CONTAINER_CX,
        queueY - DECK_BUILD.QUEUE_PANEL_H / 2 - 18,
        'Plan queue — drag slots to swap · drag cards from the library onto a slot',
        {
          color: '#94a3b8',
          fontFamily: 'Consolas, monospace',
          fontSize: '13px',
        },
      )
      .setOrigin(0.5);

    for (let i = 0; i < DECK_BUILD.SLOTS; i += 1) {
      const x = deckQueueSlotCenterX(i);
      const card = createMiniMtgQueueCard(
        this,
        x,
        queueY,
        DECK_BUILD.QUEUE_CELL_W,
        DECK_BUILD.QUEUE_CELL_H,
        DECK_QUEUE_STYLE_PLAYER,
      );
      this.queueCards.push(card);
      card.root.setDepth(2);
      card.border.setInteractive({ useHandCursor: true });

      card.border.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.beginQueueDrag(i, pointer);
      });
    }

    const carouselHeaderY = DECK_BUILD.CAROUSEL_ROW_CY - DECK_BUILD.CAROUSEL_PANEL_H / 2 - 22;
    this.add
      .text(140, carouselHeaderY, 'Library', {
        color: '#cbd5e1',
        fontFamily: 'Consolas, monospace',
        fontSize: '16px',
      })
      .setOrigin(0, 0.5);

    this.carouselModeText = this.add
      .text(1180, carouselHeaderY, '', {
        color: '#7dd3fc',
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
      })
      .setOrigin(0.5, 0.5);

    const modeHit = this.add
      .rectangle(1180, carouselHeaderY, 160, 34, 0x1e293b, 0.9)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true });
    modeHit.on('pointerdown', () => this.callbacks.onToggleCarouselMode());

    this.pageText = this.add.text(DECK_BUILD.CONTAINER_CX, carouselHeaderY + 4, '', {
      color: '#64748b',
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
    });
    this.pageText.setOrigin(0.5);

    const prevHit = this.add
      .rectangle(460, carouselHeaderY, 44, 32, 0x1e293b, 0.9)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true });
    this.add.text(460, carouselHeaderY, '◀', { color: '#e2e8f0', fontSize: '16px' }).setOrigin(0.5);
    prevHit.on('pointerdown', () => this.callbacks.onCarouselPage(-1));

    const nextHit = this.add
      .rectangle(940, carouselHeaderY, 44, 32, 0x1e293b, 0.9)
      .setStrokeStyle(1, 0x475569)
      .setInteractive({ useHandCursor: true });
    this.add.text(940, carouselHeaderY, '▶', { color: '#e2e8f0', fontSize: '16px' }).setOrigin(0.5);
    nextHit.on('pointerdown', () => this.callbacks.onCarouselPage(1));

    const carY = DECK_BUILD.CAROUSEL_ROW_CY + DECK_BUILD.LIBRARY_CAROUSEL_Y_OFFSET;
    this.add
      .rectangle(
        DECK_BUILD.CONTAINER_CX,
        carY,
        DECK_BUILD.QUEUE_BAND_W,
        DECK_BUILD.CAROUSEL_PANEL_H,
        0x0a0f18,
        0.95,
      )
      .setStrokeStyle(1, 0x334155)
      .setDepth(0);

    for (let i = 0; i < DECK_BUILD.SLOTS; i += 1) {
      const x = deckCarouselSlotCenterX(i);
      const card = createMiniMtgQueueCard(
        this,
        x,
        carY,
        DECK_BUILD.CAROUSEL_CELL_W,
        DECK_BUILD.CAROUSEL_CELL_H,
        DECK_QUEUE_STYLE_PLAYER,
      );
      this.carouselCards.push(card);
      card.root.setDepth(2);
      paintMiniMtgTradingChrome(card, 'player', 'idle');

      card.border.setInteractive({ useHandCursor: true });
      card.border.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const id = this.viewModel?.carousel[i] ?? null;
        if (id) {
          this.beginCarouselDrag(id, i, pointer);
        }
      });

      const arrowY = carY;
      // Keep arrows inside the card bounds so pointer hit-testing is reliable.
      const arrowOffset = DECK_BUILD.CAROUSEL_CELL_W / 2 - 14;
      const left = this.add
        .text(x - arrowOffset, arrowY, '◀', {
          color: '#e2e8f0',
          fontFamily: 'Consolas, monospace',
          fontSize: '16px',
        })
        .setOrigin(0.5)
        .setDepth(4)
        .setVisible(false)
        .setInteractive({ useHandCursor: true });
      const right = this.add
        .text(x + arrowOffset, arrowY, '▶', {
          color: '#e2e8f0',
          fontFamily: 'Consolas, monospace',
          fontSize: '16px',
        })
        .setOrigin(0.5)
        .setDepth(4)
        .setVisible(false)
        .setInteractive({ useHandCursor: true });
      left.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          ev: Phaser.Types.Input.EventData,
        ) => {
          ev.stopPropagation();
          this.callbacks.onAdjustCarouselTier(i, -1);
        },
      );
      right.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          ev: Phaser.Types.Input.EventData,
        ) => {
          ev.stopPropagation();
          this.callbacks.onAdjustCarouselTier(i, 1);
        },
      );
      this.carouselTierLeftArrows.push(left);
      this.carouselTierRightArrows.push(right);
    }

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.finishDrag(pointer);
    });
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('gameout', () => {
      this.lastHoverKey = '';
      this.hoveredCarouselSlot = null;
      this.refreshCarouselTierArrows();
      this.callbacks.onHoverCard?.(null);
    });

    this.applyViewWhenReady();
  }

  private pointerWorldXY(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const cam = this.cameras.main;
    const out = cam.getWorldPoint(pointer.x, pointer.y);
    return { x: out.x, y: out.y };
  }

  private pointerToClient(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const ev = pointer.event as MouseEvent | undefined;
    if (ev && typeof ev.clientX === 'number') {
      return { x: ev.clientX, y: ev.clientY };
    }
    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / this.scale.gameSize.width;
    const sy = rect.height / this.scale.gameSize.height;
    return { x: rect.left + pointer.x * sx, y: rect.top + pointer.y * sy };
  }

  private finishDrag(pointer: Phaser.Input.Pointer): void {
    const kind = this.dragKind;
    const qIdx = this.dragQueueIndex;
    const cId = this.dragCardId;
    const mergeFrom = this.dragCarouselFromSlot;

    this.destroyDragGhost();
    this.highlightedQueueSlot = null;
    this.highlightedCarouselSlot = null;
    this.dragKind = null;
    this.dragQueueIndex = null;
    this.dragCardId = null;
    this.dragCarouselFromSlot = null;
    this.refreshQueueSlotDecorations();
    this.refreshCarouselDragHighlight();

    if (kind === null) {
      return;
    }

    const { x, y } = this.pointerWorldXY(pointer);
    if (kind === 'carousel' && cId) {
      const slot = this.hitQueueSlotAt(x, y);
      if (slot !== null) {
        this.callbacks.onAssignSlot(slot, cId);
      } else {
        const cSlot = this.hitCarouselSlotAt(x, y);
        if (
          mergeFrom !== null &&
          cSlot !== null &&
          cSlot !== mergeFrom &&
          this.viewModel?.carouselMode === 'hand'
        ) {
          this.callbacks.onMergeCarouselSlots?.(mergeFrom, cSlot);
        }
      }
    } else if (kind === 'queue' && qIdx !== null) {
      const slot = this.hitQueueSlotAt(x, y);
      if (slot !== null && slot !== qIdx) {
        this.callbacks.onSwapSlots(qIdx, slot);
      }
    }

    this.refreshHoverFromPointer(pointer);
  }

  private beginQueueDrag(fromIndex: number, pointer: Phaser.Input.Pointer): void {
    if (Date.now() < this.dragStartSuppressedUntil) {
      return;
    }
    this.lastHoverKey = '';
    this.callbacks.onHoverCard?.(null); // hide dock while dragging
    const id = this.viewModel?.queue[fromIndex] ?? null;
    const { x, y } = this.pointerWorldXY(pointer);
    this.dragKind = 'queue';
    this.dragQueueIndex = fromIndex;
    this.dragCardId = null;
    this.highlightedQueueSlot = null;
    this.createDragGhost(id, x, y);
    this.updateDragHighlight(x, y);
  }

  private beginCarouselDrag(cardId: string, fromSlot: number, pointer: Phaser.Input.Pointer): void {
    if (Date.now() < this.dragStartSuppressedUntil) {
      return;
    }
    this.lastHoverKey = '';
    this.callbacks.onHoverCard?.(null);
    const { x, y } = this.pointerWorldXY(pointer);
    this.dragKind = 'carousel';
    this.dragQueueIndex = null;
    this.dragCardId = cardId;
    this.dragCarouselFromSlot = fromSlot;
    this.highlightedQueueSlot = null;
    this.highlightedCarouselSlot = null;
    this.createDragGhost(cardId, x, y);
    this.updateDragHighlight(x, y);
  }

  private destroyDragGhost(): void {
    if (this.dragGhost) {
      this.dragGhost.destroy();
      this.dragGhost = undefined;
    }
  }

  private createDragGhost(cardId: string | null, worldX: number, worldY: number): void {
    this.destroyDragGhost();
    const editingPlayer = this.viewModel?.editTarget !== 'enemy';
    const labelText = cardId ? this.getCardShortName(cardId) : 'Basic Strike';
    const w = DECK_BUILD.QUEUE_CELL_W * 0.92;
    const h = DECK_BUILD.QUEUE_CELL_H * 0.92;
    const fill = editingPlayer ? 0x1e3a5f : 0x3d1f24;
    const stroke = editingPlayer ? 0x38bdf8 : 0xf97373;
    const r = this.add.rectangle(0, 0, w, h, fill, 0.95).setStrokeStyle(2, stroke);
    const t = this.add
      .text(0, 0, labelText, {
        color: '#f8fafc',
        fontFamily: 'Consolas, monospace',
        fontSize: '11px',
        align: 'center',
        wordWrap: { width: w - 10 },
      })
      .setOrigin(0.5);
    this.dragGhost = this.add.container(worldX, worldY, [r, t]);
    this.dragGhost.setDepth(500);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragKind) {
      if (this.dragGhost) {
        const { x, y } = this.pointerWorldXY(pointer);
        this.dragGhost.setPosition(x, y);
        this.updateDragHighlight(x, y);
      }
      return;
    }
    this.updateHoverFromPointerPosition(pointer);
  }

  private updateHoverFromPointerPosition(pointer: Phaser.Input.Pointer): void {
    if (this.dragKind) {
      return;
    }
    const client = this.pointerToClient(pointer);
    const { x, y } = this.pointerWorldXY(pointer);
    const q = this.hitQueueSlotAt(x, y);
    if (q !== null) {
      this.hoveredCarouselSlot = null;
      this.refreshCarouselTierArrows();
      const id = this.viewModel?.queue[q] ?? null;
      this.lastHoverKey = `q:${String(q)}:${id ?? 'basic'}`;
      this.callbacks.onHoverCard?.({
        kind: 'queue',
        slotIndex: q,
        cardId: id,
        clientX: client.x,
        clientY: client.y,
      });
      return;
    }
    const c = this.hitCarouselSlotAt(x, y);
    if (c !== null) {
      this.hoveredCarouselSlot = c;
      this.refreshCarouselTierArrows();
      const id = this.viewModel?.carousel[c] ?? null;
      this.lastHoverKey = `c:${String(c)}:${id ?? 'empty'}`;
      this.callbacks.onHoverCard?.({
        kind: 'carousel',
        slotIndex: c,
        cardId: id,
        clientX: client.x,
        clientY: client.y,
      });
      return;
    }
    if (this.lastHoverKey !== '') {
      this.lastHoverKey = '';
      this.hoveredCarouselSlot = null;
      this.refreshCarouselTierArrows();
      this.callbacks.onHoverCard?.(null);
    }
  }

  private refreshCarouselTierArrows(): void {
    const vm = this.viewModel;
    for (let i = 0; i < DECK_BUILD.SLOTS; i += 1) {
      const left = this.carouselTierLeftArrows[i];
      const right = this.carouselTierRightArrows[i];
      if (!left || !right || !vm) {
        continue;
      }
      const isHovered = this.hoveredCarouselSlot === i;
      const hasCard = !!vm.carousel[i];
      const show = isHovered && hasCard && vm.carouselMode === 'all';
      const canPrev = show && !!vm.carouselTierCanPrev[i];
      const canNext = show && !!vm.carouselTierCanNext[i];
      left.setVisible(show).setAlpha(canPrev ? 1 : 0.35);
      right.setVisible(show).setAlpha(canNext ? 1 : 0.35);
    }
  }

  private updateDragHighlight(worldX: number, worldY: number): void {
    const raw = this.hitQueueSlotAt(worldX, worldY);
    let next: number | null = null;
    if (this.dragKind === 'carousel' && raw !== null) {
      next = raw;
    } else if (
      this.dragKind === 'queue' &&
      this.dragQueueIndex !== null &&
      raw !== null &&
      raw !== this.dragQueueIndex
    ) {
      next = raw;
    }
    if (this.highlightedQueueSlot !== next) {
      this.highlightedQueueSlot = next;
      this.refreshQueueSlotDecorations();
    }

    const vm = this.viewModel;
    let nextCar: number | null = null;
    if (
      this.dragKind === 'carousel' &&
      vm?.carouselMode === 'hand' &&
      this.dragCarouselFromSlot !== null
    ) {
      const rawC = this.hitCarouselSlotAt(worldX, worldY);
      if (
        rawC !== null &&
        rawC !== this.dragCarouselFromSlot &&
        (vm.carousel[rawC] ?? null) !== null
      ) {
        nextCar = rawC;
      }
    }
    if (this.highlightedCarouselSlot !== nextCar) {
      this.highlightedCarouselSlot = nextCar;
      this.refreshCarouselDragHighlight();
    }
  }

  private refreshCarouselDragHighlight(): void {
    const model = this.viewModel;
    if (!model || this.carouselCards.length < DECK_BUILD.SLOTS) {
      return;
    }
    for (let i = 0; i < DECK_BUILD.SLOTS; i += 1) {
      const id = model.carousel[i] ?? null;
      const card = this.carouselCards[i];
      const isHl = this.dragKind === 'carousel' && this.highlightedCarouselSlot === i;
      paintMiniMtgTradingChrome(card, 'player', isHl ? 'dropHighlight' : 'idle');
      card.root.setAlpha(!id ? 0.55 : 1);
    }
  }

  private refreshHoverFromPointer(pointer: Phaser.Input.Pointer): void {
    this.lastHoverKey = '';
    this.updateHoverFromPointerPosition(pointer);
  }

  private hitCarouselSlotAt(worldX: number, worldY: number): number | null {
    const hw = DECK_BUILD.CAROUSEL_CELL_W / 2;
    const hh = DECK_BUILD.CAROUSEL_CELL_H / 2;
    for (let i = 0; i < this.carouselCards.length; i += 1) {
      const { x: cx, y: cy } = this.carouselCards[i].root;
      if (Math.abs(worldX - cx) <= hw && Math.abs(worldY - cy) <= hh) {
        return i;
      }
    }
    return null;
  }

  private refreshQueueSlotDecorations(): void {
    const model = this.viewModel;
    if (!model || this.queueCards.length < DECK_BUILD.SLOTS) {
      return;
    }
    const editingPlayer = model.editTarget === 'player';
    const tone = editingPlayer ? 'player' : 'enemy';
    for (let i = 0; i < DECK_BUILD.SLOTS; i += 1) {
      const card = this.queueCards[i];
      const isHighlighted =
        this.dragKind !== null && this.highlightedQueueSlot === i;
      const variant = isHighlighted ? 'dropHighlight' : 'idle';
      paintMiniMtgTradingChrome(card, tone, variant);
    }
  }

  private hitQueueSlotAt(worldX: number, worldY: number): number | null {
    const hw = DECK_BUILD.QUEUE_CELL_W / 2;
    const hh = DECK_BUILD.QUEUE_CELL_H / 2;
    for (let i = 0; i < this.queueCards.length; i += 1) {
      // `border` lives inside a Container at local (0,0); use root world position (card center).
      const { x: cx, y: cy } = this.queueCards[i].root;
      if (Math.abs(worldX - cx) <= hw && Math.abs(worldY - cy) <= hh) {
        return i;
      }
    }
    return null;
  }

  setCallbacks(callbacks: DeckBuilderCallbacks): void {
    this.callbacks = { ...defaultCallbacks, ...callbacks };
  }

  setNameResolver(fn: (cardId: string) => string): void {
    this.getCardShortName = fn;
  }

  setArtResolver(fn: ((cardId: string) => string | null) | null): void {
    this.artResolver = fn;
  }

  updateView(model: DeckBuilderViewModel): void {
    this.pendingView = model;
    this.applyViewWhenReady();
  }

  private applyViewWhenReady(): void {
    if (
      !this.queuePanel ||
      this.queueCards.length < DECK_BUILD.SLOTS ||
      this.carouselCards.length < DECK_BUILD.SLOTS
    ) {
      return;
    }
    const model = this.pendingView;
    if (!model) {
      return;
    }

    this.viewModel = model;

    const editingPlayer = model.editTarget === 'player';
    const stroke = editingPlayer ? COL_PLAYER : COL_ENEMY;
    this.queuePanel.setStrokeStyle(2, stroke);

    this.seedText.setText(`Seed ${String(model.seed)}`);
    this.runSummaryText.setText(model.runSummary);

    this.editTargetHint.setText(
      editingPlayer ? 'Editing: Player queue (blue)' : 'Editing: Enemy queue (red)',
    );
    this.toggleEditLabel.setText(editingPlayer ? 'Edit enemy deck' : 'Edit player deck');

    this.carouselModeText.setText(model.carouselMode === 'all' ? 'All cards ▾' : 'Hand ▾');

    const pageIdx = model.carouselPageCount > 0 ? model.carouselPage + 1 : 0;
    const pc = model.carouselPageCount;
    this.pageText.setText(pc > 0 ? `Page ${String(pageIdx)} / ${String(pc)}` : 'Page —');

    for (let i = 0; i < DECK_BUILD.SLOTS; i += 1) {
      const id = model.queue[i] ?? null;
      const line = this.formatLabel(id, true);
      const card = this.queueCards[i];
      const title = id
        ? line.length > 15
          ? `${line.slice(0, 14)}…`
          : line
        : 'Basic Strike';
      const rules = id ? line : `Strike ${String(model.blankQueueSlotStrikeDamage)}`;
      card.titleText.setText(title);
      card.rulesText.setText(rules);
      if (this.artResolver) {
        const idForArt = id ?? COMBAT_RULES.blankQueueSlotCardId;
        syncMiniCardArt(this, card, idForArt, this.artResolver);
      }
    }

    for (let i = 0; i < DECK_BUILD.SLOTS; i += 1) {
      const id = model.carousel[i] ?? null;
      const card = this.carouselCards[i];
      const line = id ? this.formatLabel(id, false) : '';
      const raw = id ? this.getCardShortName(id) : '';
      const title = id
        ? raw.length > 12
          ? `${raw.slice(0, 11)}…`
          : raw
        : '—';
      const rules = id ? line : '';
      card.titleText.setText(title);
      card.rulesText.setText(rules);
      const isCarHl = this.dragKind === 'carousel' && this.highlightedCarouselSlot === i;
      paintMiniMtgTradingChrome(card, 'player', isCarHl ? 'dropHighlight' : 'idle');
      card.root.setAlpha(!id ? 0.55 : 1);
      if (this.artResolver) {
        if (id) {
          syncMiniCardArt(this, card, id, this.artResolver);
        } else {
          card.artImage.setAlpha(0);
        }
      }
    }

    this.refreshCarouselTierArrows();
    this.refreshQueueSlotDecorations();
  }

  private formatLabel(id: string | null, isQueue: boolean): string {
    if (!id) {
      return isQueue ? 'Basic' : '';
    }
    const raw = this.getCardShortName(id);
    const max = isQueue ? 22 : 20;
    return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
  }
}
