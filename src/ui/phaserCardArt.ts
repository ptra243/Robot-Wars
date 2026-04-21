import * as Phaser from 'phaser';

/** Matches {@link ensureMiniCardArtPlaceholderTexture} — mini card art layer before real texture loads. */
export const MINI_CARD_ART_PLACEHOLDER_KEY = '__rw_art_placeholder';

function textureKeyForCardId(cardId: string): string {
  return `rwca_${cardId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

type Pending = { callbacks: Array<(ok: boolean) => void> };
const pendingByKey = new Map<string, Pending>();

export function ensureMiniCardArtPlaceholderTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(MINI_CARD_ART_PLACEHOLDER_KEY)) {
    return;
  }
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x080a0e, 1);
  g.fillRect(0, 0, 4, 4);
  g.generateTexture(MINI_CARD_ART_PLACEHOLDER_KEY, 4, 4);
  g.destroy();
}

/**
 * Loads card art into Phaser textures (deduped per card id) and invokes `onDone` when ready.
 */
function requestCardArtTexture(
  scene: Phaser.Scene,
  cardId: string,
  url: string,
  onDone: (ok: boolean) => void,
): void {
  const key = textureKeyForCardId(cardId);
  if (scene.textures.exists(key)) {
    onDone(true);
    return;
  }
  const existing = pendingByKey.get(key);
  if (existing) {
    existing.callbacks.push(onDone);
    return;
  }
  pendingByKey.set(key, { callbacks: [onDone] });
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (!scene.textures.exists(key)) {
      scene.textures.addImage(key, img);
    }
    const p = pendingByKey.get(key);
    pendingByKey.delete(key);
    p?.callbacks.forEach((cb) => cb(true));
  };
  img.onerror = () => {
    const p = pendingByKey.get(key);
    pendingByKey.delete(key);
    p?.callbacks.forEach((cb) => cb(false));
  };
  img.src = url;
}

export interface MiniCardArtSyncable {
  artBg: Phaser.GameObjects.Rectangle;
  artImage: Phaser.GameObjects.Image;
  /** Last card id we requested art for (guards stale image callbacks). */
  artTargetId?: string;
}

/**
 * Shows forge-style card art in the mini MTG art window (matches DOM forge URLs).
 */
export function syncMiniCardArt(
  scene: Phaser.Scene,
  card: MiniCardArtSyncable,
  cardIdForArt: string,
  getArtUrl: (id: string) => string | null,
): void {
  const { artImage } = card;
  const targetId = cardIdForArt;
  card.artTargetId = targetId;

  const url = getArtUrl(targetId);
  if (!url) {
    artImage.setAlpha(0);
    return;
  }

  const w = card.artBg.width;
  const h = card.artBg.height;

  requestCardArtTexture(scene, targetId, url, (ok) => {
    if (card.artTargetId !== targetId) {
      return;
    }
    const key = textureKeyForCardId(targetId);
    if (!ok || !scene.textures.exists(key)) {
      artImage.setAlpha(0);
      return;
    }
    artImage.setTexture(key);
    artImage.setDisplaySize(w, h);
    artImage.setAlpha(1);
  });
}
