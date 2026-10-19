import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { PhaserBattlefieldScene } from '../../ui/phaserBattle/PhaserBattlefieldScene';
import type { BattleVisualStep } from '../../ui/phaserBattle/battleVisualStep';

export interface PhaserBattlefieldProps {
  playerSrc: string;
  enemySrc: string;
  speed: number;
  paused: boolean;
  onReady: () => void;
  onStepComplete: (id: string) => void;
  playStep: BattleVisualStep | null;
  playNonce: number;
}

export function PhaserBattlefield({
  playerSrc,
  enemySrc,
  speed,
  paused,
  onReady,
  onStepComplete,
  playStep,
  playNonce,
}: PhaserBattlefieldProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<PhaserBattlefieldScene | null>(null);
  const onReadyRef = useRef(onReady);
  const onStepCompleteRef = useRef(onStepComplete);
  const playStepRef = useRef(playStep);
  onReadyRef.current = onReady;
  onStepCompleteRef.current = onStepComplete;
  playStepRef.current = playStep;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new PhaserBattlefieldScene();
    scene.configure(
      { playerSrc, enemySrc },
      (id) => {
        onStepCompleteRef.current(id);
      },
    );
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: '#000000',
      transparent: true,
      banner: false,
      scene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: Math.max(320, host.clientWidth),
        height: Math.max(240, host.clientHeight),
      },
      render: {
        antialias: true,
        roundPixels: false,
      },
      input: {
        mouse: false,
        keyboard: false,
      },
      audio: {
        noAudio: true,
      },
    });

    const ro = new ResizeObserver(() => {
      game.scale.refresh();
    });
    ro.observe(host);
    onReadyRef.current();

    return () => {
      ro.disconnect();
      sceneRef.current = null;
      game.destroy(true);
    };
  }, [playerSrc, enemySrc]);

  useEffect(() => {
    sceneRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    sceneRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (playNonce === 0) return;
    const step = playStepRef.current;
    if (!step) return;
    sceneRef.current?.playStep(step);
  }, [playNonce]);

  return <div className="phaser-battlefield-host" ref={hostRef} />;
}
