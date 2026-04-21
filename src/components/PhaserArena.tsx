import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { ArenaScene, type PhaserSlotHoverPayload } from '../ui/arenaScene';
import { ARENA_H, ARENA_W } from '../ui/arenaQueueUi';
import type { ArenaSnapshot } from '../core/types';

interface PhaserArenaProps {
  snapshot: ArenaSnapshot;
  onSlotHover?: (payload: PhaserSlotHoverPayload | null) => void;
  /** Base Strike damage for empty slots (default Neutral Basic Strike). */
  blankSlotStrikeDamage: number;
  /** Catalog id → forge card art URL (`/poc/...`) for mini queue faces. */
  resolveCardArtUrl?: (cardId: string) => string | null;
}

export function PhaserArena({
  snapshot,
  onSlotHover,
  blankSlotStrikeDamage,
  resolveCardArtUrl,
}: PhaserArenaProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<ArenaScene | null>(null);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) {
      return;
    }

    const scene = new ArenaScene();
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: ARENA_W,
      height: ARENA_H,
      parent: hostRef.current,
      backgroundColor: '#131823',
      scene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      // Sharper bitmap/canvas text when the game is FIT-scaled to the layout.
      render: {
        antialias: false,
        roundPixels: true,
      },
    });

    gameRef.current = game;

    const host = hostRef.current;
    const ro = new ResizeObserver(() => {
      game.scale.refresh();
    });
    if (host) {
      ro.observe(host);
    }

    return () => {
      ro.disconnect();
      sceneRef.current?.setHoverHandler(null);
      sceneRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setHoverHandler(onSlotHover ?? null);
  }, [onSlotHover]);

  useEffect(() => {
    sceneRef.current?.updateSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    sceneRef.current?.setBlankSlotStrikeDamage(blankSlotStrikeDamage);
  }, [blankSlotStrikeDamage]);

  useEffect(() => {
    sceneRef.current?.setArtResolver(resolveCardArtUrl ?? null);
  }, [resolveCardArtUrl]);

  return <div className="arena-host" ref={hostRef} />;
}
