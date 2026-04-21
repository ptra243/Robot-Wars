import { savedDeckPayloadFromRun } from '../core/run/deckStringCodec';
import type { RunState, SavedDeckPayload } from '../core/types';

const STORAGE_KEY = 'robotwars.savedDecks.v1';

export type { SavedDeckPayload };

export interface SavedDeckRecord {
  id: string;
  name: string;
  payload: SavedDeckPayload;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function snapshotRunForSave(run: RunState): SavedDeckPayload {
  return savedDeckPayloadFromRun(run);
}

export function mergePayloadIntoRun(run: RunState, payload: SavedDeckPayload): void {
  run.deck = [...payload.deck];
  run.hand = [...payload.hand];
  run.plannedQueue = [...payload.plannedQueue];
  run.enemyPlannedQueue = [...payload.enemyPlannedQueue];
  run.sandboxActiveQueueSlots = payload.sandboxActiveQueueSlots;
  run.sandboxPlayerCoreScrap = payload.sandboxPlayerCoreScrap;
  run.sandboxEnemyCoreScrap = payload.sandboxEnemyCoreScrap;
}

function fitPlannedQueueLength(from: Array<string | null>, len: number): Array<string | null> {
  const next = from.slice(0, len);
  while (next.length < len) {
    next.push(null);
  }
  return next;
}

/**
 * Saved snapshots usually carry the builder plan in {@link SavedDeckPayload.plannedQueue}.
 * {@link SavedDeckPayload.enemyPlannedQueue} is often all null unless the deck was saved while editing
 * the enemy plan. When loading into the enemy editor, prefer the enemy-specific queue when it has any
 * assigned card; otherwise copy the saved player plan onto the enemy slots (typical "load my deck on
 * the opponent" flow).
 *
 * Note: if someone saves with an intentionally empty enemy plan while the player plan is non-empty,
 * this will still apply the player plan when loading into the enemy editor — a rare edge case.
 */
function enemyQueueSlotsFromSavedPayload(payload: SavedDeckPayload): Array<string | null> {
  const enemy = payload.enemyPlannedQueue;
  if (enemy.some((slot) => slot != null)) {
    return enemy;
  }
  return payload.plannedQueue;
}

/**
 * When the deck builder is focused on the **enemy** plan, load/paste should update only enemy-facing
 * fields so the player deck/hand/queue are not overwritten.
 */
export function mergePayloadIntoRunForEditTarget(
  run: RunState,
  payload: SavedDeckPayload,
  editTarget: 'player' | 'enemy',
): void {
  if (editTarget === 'player') {
    mergePayloadIntoRun(run, payload);
    return;
  }
  run.enemyPlannedQueue = fitPlannedQueueLength(
    enemyQueueSlotsFromSavedPayload(payload),
    run.enemyPlannedQueue.length,
  );
  run.sandboxEnemyCoreScrap = payload.sandboxEnemyCoreScrap;
}

export function loadSavedDecksFromStorage(): SavedDeckRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidRecord);
  } catch {
    return [];
  }
}

function isValidRecord(x: unknown): x is SavedDeckRecord {
  if (!x || typeof x !== 'object') {
    return false;
  }
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    o.payload !== null &&
    typeof o.payload === 'object'
  );
}

export function persistSavedDecks(decks: SavedDeckRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch {
    /* ignore quota */
  }
}

export function createSavedDeckRecord(name: string, run: RunState): SavedDeckRecord {
  return {
    id: newId(),
    name: name.trim() || 'Untitled',
    payload: snapshotRunForSave(run),
  };
}

export function reorderSavedDecks(list: SavedDeckRecord[], fromIndex: number, toIndex: number): SavedDeckRecord[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
