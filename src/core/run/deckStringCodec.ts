import type { RunState, SavedDeckPayload } from '../types';

/** Current deck-share format (bump when payload shape changes). */
export const DECK_STRING_FORMAT_VERSION = 1;

const PREFIX = 'RWDB';

/** Same fields as {@link snapshotRunForSave} — single source for save + share string. */
export function savedDeckPayloadFromRun(run: RunState): SavedDeckPayload {
  return {
    deck: [...run.deck],
    hand: [...run.hand],
    plannedQueue: [...run.plannedQueue],
    enemyPlannedQueue: [...run.enemyPlannedQueue],
    sandboxActiveQueueSlots: run.sandboxActiveQueueSlots,
    sandboxPlayerCoreScrap: run.sandboxPlayerCoreScrap,
    sandboxEnemyCoreScrap: run.sandboxEnemyCoreScrap,
  };
}

interface DeckStringBodyV1 {
  v: typeof DECK_STRING_FORMAT_VERSION;
  p: SavedDeckPayload;
}

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64: string): string {
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i)!;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Compact, versioned deck code (base64url over JSON — not human-readable raw JSON).
 * Prefix: `RWDB` + format version + `.` + payload.
 */
export function encodeDeckPayload(payload: SavedDeckPayload): string {
  const body: DeckStringBodyV1 = {
    v: DECK_STRING_FORMAT_VERSION,
    p: {
      deck: [...payload.deck],
      hand: [...payload.hand],
      plannedQueue: [...payload.plannedQueue],
      enemyPlannedQueue: [...payload.enemyPlannedQueue],
      sandboxActiveQueueSlots: payload.sandboxActiveQueueSlots,
      sandboxPlayerCoreScrap: payload.sandboxPlayerCoreScrap,
      sandboxEnemyCoreScrap: payload.sandboxEnemyCoreScrap,
    },
  };
  const json = JSON.stringify(body);
  return `${PREFIX}${String(DECK_STRING_FORMAT_VERSION)}.${utf8ToBase64Url(json)}`;
}

export function encodeDeckString(run: RunState): string {
  return encodeDeckPayload(savedDeckPayloadFromRun(run));
}

export function decodeDeckString(s: string): SavedDeckPayload | null {
  const trimmed = s.trim();
  const m = new RegExp(`^${PREFIX}(\\d+)\\.(.+)$`).exec(trimmed);
  if (!m) {
    return null;
  }
  const ver = Number(m[1]);
  const b64 = m[2] ?? '';
  if (ver !== DECK_STRING_FORMAT_VERSION) {
    return null;
  }
  try {
    const raw = JSON.parse(base64UrlToUtf8(b64)) as unknown;
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const o = raw as DeckStringBodyV1;
    if (o.v !== DECK_STRING_FORMAT_VERSION || !o.p || typeof o.p !== 'object') {
      return null;
    }
    return isValidPayload(o.p) ? o.p : null;
  } catch {
    return null;
  }
}

function isQueueSlot(x: unknown): x is string | null {
  return x === null || typeof x === 'string';
}

function isValidPayload(p: unknown): p is SavedDeckPayload {
  if (!p || typeof p !== 'object') {
    return false;
  }
  const x = p as Record<string, unknown>;
  return (
    Array.isArray(x.deck) &&
    x.deck.every((id) => typeof id === 'string') &&
    Array.isArray(x.hand) &&
    x.hand.every((id) => typeof id === 'string') &&
    Array.isArray(x.plannedQueue) &&
    x.plannedQueue.every(isQueueSlot) &&
    Array.isArray(x.enemyPlannedQueue) &&
    x.enemyPlannedQueue.every(isQueueSlot) &&
    typeof x.sandboxActiveQueueSlots === 'number' &&
    typeof x.sandboxPlayerCoreScrap === 'number' &&
    typeof x.sandboxEnemyCoreScrap === 'number'
  );
}
