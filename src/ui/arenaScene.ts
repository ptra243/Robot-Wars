import * as Phaser from 'phaser';
import {
  ARENA_FOOTER_Y,
  ARENA_TRANSCRIPT,
  type MiniMtgQueueCard,
  type QueueCardStyle,
  QUEUE_ROW_Y,
  QUEUE_UI,
  createQueueCard,
  createQueueRowPanel,
  queueTitleY,
} from './arenaQueueUi';
import { ARENA_BATTLE_CURRENT_CARD } from './arenaBattleQueueTokens';
import { paintMiniMtgTradingChrome } from './tradingCardPhaserChrome';
import { syncMiniCardArt } from './phaserCardArt';
import { COMBAT_RULES } from '../core/rules';
import type { ArenaSnapshot } from '../core/types';

const EMPTY_SNAPSHOT: ArenaSnapshot = {
  roundIndex: 0,
  player: {
    name: 'Player',
    hp: 0,
    block: 0,
    charge: 0,
    junk: 0,
    junkCapacity: Number.POSITIVE_INFINITY,
    programCycleCount: 0,
    pendingRustRangerCircuit: false,
    bulkStacks: 0,
    coreScrap: 0,
    potency: 0,
    exposeDamage: 0,
    deckCursor: 0,
    deckWraps: 0,
    queueCursor: 0,
    activeQueueSlots: 9,
    stallCountAtCursor: 0,
    deck: [],
    queue: [],
    auras: [],
    continuousTicksByQueueIndex: {},
    continuousNextTickRoundByQueueIndex: {},
    strikeResolutionsThisCombat: 0,
    traitIds: [],
    tempUpgrade: null,
  },
  enemy: {
    name: 'Enemy',
    hp: 0,
    block: 0,
    charge: 0,
    junk: 0,
    junkCapacity: Number.POSITIVE_INFINITY,
    programCycleCount: 0,
    pendingRustRangerCircuit: false,
    bulkStacks: 0,
    coreScrap: 0,
    potency: 0,
    exposeDamage: 0,
    deckCursor: 0,
    deckWraps: 0,
    queueCursor: 0,
    activeQueueSlots: 9,
    stallCountAtCursor: 0,
    deck: [],
    queue: [],
    auras: [],
    continuousTicksByQueueIndex: {},
    continuousNextTickRoundByQueueIndex: {},
    strikeResolutionsThisCombat: 0,
    traitIds: [],
    tempUpgrade: null,
  },
  recentEvents: [],
};

const ENEMY_STYLE: QueueCardStyle = {
  idleFill: 0x2a1518,
  activeFill: 0x7f1d1d,
  strokeColor: 0xf97373,
  strokeWidth: 1,
  labelColor: '#fecdd3',
};

const PLAYER_STYLE: QueueCardStyle = {
  idleFill: 0x182236,
  activeFill: 0x355f85,
  strokeColor: 0x49617f,
  strokeWidth: 1,
  labelColor: '#d7e2f0',
};

export interface PhaserSlotHoverPayload {
  side: 'player' | 'enemy';
  index: number;
  /** Resolved card id in queue, or null for default/basic strike slot. */
  cardId: string | null;
  clientX: number;
  clientY: number;
}

export function arenaHoverIdentityKey(h: PhaserSlotHoverPayload): string {
  return `${h.side}:${String(h.index)}:${h.cardId ?? 'basic'}`;
}

export class ArenaScene extends Phaser.Scene {
  private snapshot: ArenaSnapshot = EMPTY_SNAPSHOT;
  /** Strike damage shown for empty queue slots (same as the default Neutral Basic Strike card). */
  private blankSlotStrikeDamage = 2;
  /** Forge-style `/poc/*.png` art URLs keyed by catalog id (null = no art sync). */
  private artResolver: ((cardId: string) => string | null) | null = null;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly enemyQueueCards: MiniMtgQueueCard[] = [];
  private readonly playerQueueCards: MiniMtgQueueCard[] = [];
  private hoverHandler: ((payload: PhaserSlotHoverPayload | null) => void) | null = null;
  private activeHover: { side: 'player' | 'enemy'; index: number } | null = null;
  private hoverPointerMoveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private lastHoverClient = { x: 0, y: 0 };

  constructor() {
    super('arena');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#131823');

    const enemyY = QUEUE_ROW_Y.enemy;
    const playerY = QUEUE_ROW_Y.player;

    this.add
      .text(QUEUE_UI.CONTAINER_CX, queueTitleY(enemyY), 'Enemy queue', {
        color: '#fecaca',
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
      })
      .setOrigin(0.5);

    this.add
      .text(QUEUE_UI.CONTAINER_CX, queueTitleY(playerY), 'Player queue', {
        color: '#7dd3fc',
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
      })
      .setOrigin(0.5);

    createQueueRowPanel(this, enemyY, 0x884444);
    createQueueRowPanel(this, playerY, 0x324056);

    for (let index = 0; index < QUEUE_UI.SLOTS; index += 1) {
      const card = createQueueCard(this, index, enemyY, ENEMY_STYLE);
      this.enemyQueueCards.push(card);
      this.bindSlotHover('enemy', index, card.border);
    }

    for (let index = 0; index < QUEUE_UI.SLOTS; index += 1) {
      const card = createQueueCard(this, index, playerY, PLAYER_STYLE);
      this.playerQueueCards.push(card);
      this.bindSlotHover('player', index, card.border);
    }

    this.texts.push(this.makeTranscriptText(), this.makeFooterText());
    this.texts[0]?.setVisible(false);

    this.renderSnapshot();
  }

  setHoverHandler(handler: ((payload: PhaserSlotHoverPayload | null) => void) | null): void {
    this.hoverHandler = handler;
  }

  setBlankSlotStrikeDamage(value: number): void {
    this.blankSlotStrikeDamage = value;
  }

  setArtResolver(fn: ((cardId: string) => string | null) | null): void {
    this.artResolver = fn;
    if (this.texts.length > 0) {
      this.renderSnapshot();
    }
  }

  updateSnapshot(snapshot: ArenaSnapshot): void {
    this.snapshot = snapshot;
    if (this.texts.length > 0) {
      this.renderSnapshot();
    }
  }

  private bindSlotHover(
    side: 'player' | 'enemy',
    index: number,
    cell: Phaser.GameObjects.Rectangle,
  ): void {
    cell.setInteractive({ useHandCursor: true });
    cell.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      this.activeHover = { side, index };
      this.ensureHoverPointerMove();
      this.emitSlotHover(side, index, pointer);
    });
    cell.on('pointerout', () => {
      if (this.hoverPointerMoveHandler) {
        this.input.off('pointermove', this.hoverPointerMoveHandler);
        this.hoverPointerMoveHandler = null;
      }
      this.activeHover = null;
      this.hoverHandler?.(null);
    });
  }

  private ensureHoverPointerMove(): void {
    if (this.hoverPointerMoveHandler) {
      return;
    }
    this.hoverPointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.activeHover) {
        return;
      }
      this.emitSlotHover(this.activeHover.side, this.activeHover.index, pointer);
    };
    this.input.on('pointermove', this.hoverPointerMoveHandler);
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

  private emitSlotHover(
    side: 'player' | 'enemy',
    index: number,
    pointer?: Phaser.Input.Pointer,
  ): void {
    const fighter = side === 'player' ? this.snapshot.player : this.snapshot.enemy;
    const cardId = fighter.queue[index] ?? null;
    if (pointer) {
      const c = this.pointerToClient(pointer);
      this.lastHoverClient = c;
    }
    this.hoverHandler?.({
      side,
      index,
      cardId,
      clientX: this.lastHoverClient.x,
      clientY: this.lastHoverClient.y,
    });
  }

  private makeTranscriptText(): Phaser.GameObjects.Text {
    return this.add.text(ARENA_TRANSCRIPT.x, ARENA_TRANSCRIPT.y, '', {
      color: '#e6eef8',
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      lineSpacing: 4,
      wordWrap: { width: ARENA_TRANSCRIPT.wordWrap },
    });
  }

  private makeFooterText(): Phaser.GameObjects.Text {
    return this.add
      .text(QUEUE_UI.CONTAINER_CX, ARENA_FOOTER_Y, '', {
        color: '#cbd5e1',
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);
  }

  private renderSnapshot(): void {
    const { player, enemy } = this.snapshot;

    this.texts[0]?.setText('');

    this.texts[1]?.setText('');

    for (let index = 0; index < QUEUE_UI.SLOTS; index += 1) {
      const cardId = enemy.queue[index];
      const enemyActive = enemy.queueCursor === index && Boolean(this.snapshot.result);
      const card = this.enemyQueueCards[index];
      paintMiniMtgTradingChrome(
        card,
        'enemy',
        enemyActive ? 'active' : 'idle',
      );
      card.titleText.setText(miniMtgQueueTitle(cardId, index));
      card.rulesText.setText(miniMtgQueueRules(cardId, this.blankSlotStrikeDamage));
      if (this.artResolver) {
        const idForArt = cardId ?? COMBAT_RULES.blankQueueSlotCardId;
        syncMiniCardArt(this, card, idForArt, this.artResolver);
      }
      card.root.setY(
        QUEUE_ROW_Y.enemy +
          (enemyActive ? ARENA_BATTLE_CURRENT_CARD.offsetYEnemy : 0),
      );
      card.root.setDepth(enemyActive ? 2 : 1);
    }

    for (let index = 0; index < QUEUE_UI.SLOTS; index += 1) {
      const cardId = player.queue[index];
      const isActive = player.queueCursor === index && Boolean(this.snapshot.result);
      const card = this.playerQueueCards[index];
      paintMiniMtgTradingChrome(
        card,
        'player',
        isActive ? 'active' : 'idle',
      );
      card.titleText.setText(miniMtgQueueTitle(cardId, index));
      card.rulesText.setText(miniMtgQueueRules(cardId, this.blankSlotStrikeDamage));
      if (this.artResolver) {
        const idForArt = cardId ?? COMBAT_RULES.blankQueueSlotCardId;
        syncMiniCardArt(this, card, idForArt, this.artResolver);
      }
      card.root.setY(
        QUEUE_ROW_Y.player +
          (isActive ? ARENA_BATTLE_CURRENT_CARD.offsetYPlayer : 0),
      );
      card.root.setDepth(isActive ? 2 : 1);
    }

    if (this.activeHover) {
      this.emitSlotHover(this.activeHover.side, this.activeHover.index);
    }
  }
}

function miniMtgQueueTitle(cardId: string | null, _slotIndex: number): string {
  if (!cardId) {
    return 'Basic Strike';
  }
  const id = cardId.replace(/_t\d+$/, '');
  const last = id.split('_').pop() ?? id;
  return last.length > 13 ? `${last.slice(0, 12)}…` : last;
}

function miniMtgQueueRules(cardId: string | null, blankSlotStrikeDamage: number): string {
  if (!cardId) {
    return `Strike ${String(blankSlotStrikeDamage)}`;
  }
  return compactCardId(cardId);
}

function compactCardId(cardId: string): string {
  return cardId
    .replace(/_t\d+$/, '')
    .split('_')
    .map((part) => part.slice(0, 4))
    .join('\n');
}
