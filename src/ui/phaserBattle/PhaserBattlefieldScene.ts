import * as Phaser from 'phaser';
import {
  ENEMY_MECH_POSES,
  GLINT_PUNCH_STRIP,
  MECH_SPRITE_SHEETS,
} from '../../components/poc/battlePocConstants';
import type { BattleVisualStep } from './battleVisualStep';

/** Per-frame crop for strip sheets (must match MECH_SPRITE_SHEETS / source PNG). */
const STRIP_FRAMES: Record<string, { frameWidth: number; frameHeight: number }> = {
  [GLINT_PUNCH_STRIP]: { frameWidth: 336, frameHeight: 395 },
};

/** Match classic CSS market-stage feet: `bottom: clamp(78px, 15%, 128px)`. */
function groundY(stageHeight: number): number {
  const fromBottom = Math.min(128, Math.max(78, stageHeight * 0.15));
  return stageHeight - fromBottom;
}

export interface BattlefieldActors {
  playerSrc: string;
  enemySrc: string;
}

/**
 * Arena scene. One `playStep` runs reveal → strike → hurt → recover, then
 * reports completion so the React shell can advance the combat log.
 */
export class PhaserBattlefieldScene extends Phaser.Scene {
  private actors: BattlefieldActors = {
    playerSrc: GLINT_PUNCH_STRIP,
    enemySrc: ENEMY_MECH_POSES.idle,
  };
  private onStepComplete: ((id: string) => void) | null = null;
  private player!: Phaser.GameObjects.Sprite;
  private enemy!: Phaser.GameObjects.Sprite;
  private playerHome = { x: 0, y: 0 };
  private enemyHome = { x: 0, y: 0 };
  private ready = false;
  private paused = false;
  private speedScale = 1;
  private stepToken = 0;
  private pending: BattleVisualStep | null = null;
  private pendingToken = 0;
  private fx: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('phaser-battlefield');
  }

  configure(actors: BattlefieldActors, onStepComplete: (id: string) => void): void {
    this.actors = actors;
    this.onStepComplete = onStepComplete;
  }

  setStepHandler(onStepComplete: (id: string) => void): void {
    this.onStepComplete = onStepComplete;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyTimeScale();
  }

  setSpeed(speed: number): void {
    this.speedScale = Math.max(0.25, speed);
    this.applyTimeScale();
  }

  private applyTimeScale(): void {
    if (!this.ready) return;
    const scale = this.paused ? 0 : this.speedScale;
    this.tweens.timeScale = scale;
    this.anims.globalTimeScale = scale;
  }

  playStep(step: BattleVisualStep): void {
    this.stepToken += 1;
    const token = this.stepToken;
    if (this.ready) {
      this.tweens.killAll();
      this.clearFx();
      this.runStep(step, token);
      return;
    }
    this.pending = step;
    this.pendingToken = token;
  }

  preload(): void {
    this.loadActor('player', this.actors.playerSrc);
    this.loadActor('enemy', this.actors.enemySrc);
  }

  create(): void {
    this.ensureTexture('player', 0x3a2a22);
    this.ensureTexture('enemy', 0x3a1830);
    this.knockoutTexture('player');
    this.knockoutTexture('enemy');
    this.createAttackAnim('player', this.actors.playerSrc);
    this.createAttackAnim('enemy', this.actors.enemySrc);

    this.player = this.add.sprite(0, 0, 'player').setOrigin(0.5, 1).setDepth(5);
    // ARES-01 source faces left; mirror so she aims toward the player (CSS does the same).
    this.enemy = this.add.sprite(0, 0, 'enemy').setOrigin(0.5, 1).setDepth(5).setFlipX(true);
    this.pose(this.player, 'player', 'idle');
    this.pose(this.enemy, 'enemy', 'idle');

    this.ready = true;
    this.applyTimeScale();
    this.layout(this.scale.width, this.scale.height);
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.layout(size.width, size.height);
    });

    if (this.pending && this.pendingToken === this.stepToken) {
      const step = this.pending;
      this.pending = null;
      this.runStep(step, this.pendingToken);
    }
  }

  private loadActor(key: string, url: string): void {
    const frames = STRIP_FRAMES[url];
    const spec = MECH_SPRITE_SHEETS[url];
    if (frames && spec) {
      this.load.spritesheet(key, url, frames);
      return;
    }
    this.load.image(key, url);
  }

  private ensureTexture(key: string, color: number): void {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(16, 8, 128, 200, 18);
    g.fillStyle(0xf2e6d8, 1);
    g.fillCircle(80, 58, 22);
    g.generateTexture(key, 160, 220);
    g.destroy();
  }

  private knockoutTexture(key: string): void {
    if (!this.textures.exists(key)) return;
    const texture = this.textures.get(key);
    const sourceImage = texture.getSourceImage() as CanvasImageSource & { width?: number; height?: number };
    const width = sourceImage.width ?? 0;
    const height = sourceImage.height ?? 0;
    if (!width || !height) return;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(sourceImage, 0, 0);
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const sum = ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 255;
      data[i + 3] = Math.round(Math.max(0, Math.min(1, 2.2 - sum)) * 255);
    }
    ctx.putImageData(image, 0, 0);
    texture.source[0]?.updateSource(canvas);
  }

  private createAttackAnim(key: string, url: string): void {
    const spec = MECH_SPRITE_SHEETS[url];
    if (!spec || !this.textures.exists(key)) return;
    const animKey = `${key}-attack`;
    if (this.anims.exists(animKey)) return;
    this.anims.create({
      key: animKey,
      frames: this.anims.generateFrameNumbers(key, { start: 0, end: spec.frameCount - 1 }),
      frameRate: spec.fps,
      repeat: 0,
    });
  }

  /** Width/height of one displayed frame (strip metadata or natural texture). */
  private actorAspect(key: 'player' | 'enemy'): number {
    const url = key === 'player' ? this.actors.playerSrc : this.actors.enemySrc;
    const fromSpec = MECH_SPRITE_SHEETS[url]?.frameAspect;
    if (fromSpec && fromSpec > 0) return fromSpec;
    if (!this.textures.exists(key)) return 0.85;
    const frame = this.textures.get(key).get();
    if (frame.width > 0 && frame.height > 0) return frame.width / frame.height;
    return 0.85;
  }

  /**
   * Size a mech with object-fit:contain semantics inside a CSS-like stage box,
   * preserving natural / frameAspect instead of a hard-coded portrait ratio.
   */
  private sizeMech(
    sprite: Phaser.GameObjects.Sprite,
    key: 'player' | 'enemy',
    boxW: number,
    boxH: number,
  ): void {
    const aspect = this.actorAspect(key);
    const boxAspect = boxW / boxH;
    let displayW: number;
    let displayH: number;
    if (aspect >= boxAspect) {
      displayW = boxW;
      displayH = boxW / aspect;
    } else {
      displayH = boxH;
      displayW = boxH * aspect;
    }
    // Classic CSS boosts Glint strip frames (extra internal padding) from the feet.
    if (MECH_SPRITE_SHEETS[key === 'player' ? this.actors.playerSrc : this.actors.enemySrc]) {
      displayW *= 1.34;
      displayH *= 1.34;
    }
    sprite.setDisplaySize(displayW, displayH);
  }

  private layout(width: number, height: number): void {
    const running = this.stepToken > 0 && this.pending === null && this.tweens.getTweens().length > 0;
    const feetY = groundY(height);
    this.playerHome = { x: width * 0.3, y: feetY };
    this.enemyHome = { x: width * 0.7, y: feetY };
    // Match `.battle-poc__mech`: width clamp(180px, 22vw, 300px), aspect 1024/576.
    const boxW = Math.min(300, Math.max(180, width * 0.22));
    const boxH = boxW / (1024 / 576);
    this.sizeMech(this.player, 'player', boxW, boxH);
    this.sizeMech(this.enemy, 'enemy', boxW, boxH);
    if (!running) {
      this.player.setPosition(this.playerHome.x, this.playerHome.y);
      this.enemy.setPosition(this.enemyHome.x, this.enemyHome.y);
    }
  }

  private clearFx(): void {
    for (const obj of this.fx) {
      obj.destroy();
    }
    this.fx = [];
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.fx.push(obj);
    return obj;
  }

  private pose(
    sprite: Phaser.GameObjects.Sprite,
    key: 'player' | 'enemy',
    pose: 'idle' | 'attack' | 'hurt' | 'defeat',
  ): void {
    const animKey = `${key}-attack`;
    if (pose === 'attack' && this.anims.exists(animKey)) {
      sprite.play(animKey);
      sprite.clearTint();
      return;
    }
    if (this.anims.exists(animKey)) {
      sprite.stop();
      sprite.setFrame(0);
    }
    if (pose === 'hurt') sprite.setTint(0xffb4a8);
    else if (pose === 'defeat') sprite.setTint(0x8ea0b4);
    else sprite.clearTint();
  }

  private finish(token: number, id: string): void {
    if (token !== this.stepToken) return;
    this.onStepComplete?.(id);
  }

  private popDamage(step: BattleVisualStep, token: number): void {
    let stack = 0;
    for (const pop of step.damage) {
      const home = pop.target === 'player' ? this.playerHome : this.enemyHome;
      const baseY = home.y - this.player.displayHeight - 12 - stack;
      if (pop.shield > 0) {
        this.floatText(home.x, baseY, `-${String(pop.shield)}`, '#7ecbff', token);
        stack += 34;
      }
      if (pop.hp > 0) {
        this.floatText(home.x, baseY - (pop.shield > 0 ? 34 : 0), `-${String(pop.hp)}`, '#ff5b4a', token);
        stack += 34;
      }
    }
  }

  private floatText(x: number, y: number, text: string, color: string, token: number): void {
    const label = this.track(
      this.add
        .text(x, y, text, {
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: '34px',
          fontStyle: 'bold',
          color,
          stroke: '#14080c',
          strokeThickness: 5,
        })
        .setOrigin(0.5, 1)
        .setDepth(30),
    );
    this.tweens.add({
      targets: label,
      y: y - 72,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (token === this.stepToken) label.destroy();
      },
    });
  }

  private burst(x: number, y: number, color: number): void {
    const dot = this.track(this.add.circle(x, y, 10, color, 0.95).setDepth(16));
    this.tweens.add({
      targets: dot,
      scale: 3.2,
      alpha: 0,
      duration: 240,
      onComplete: () => dot.destroy(),
    });
  }

  private runStep(step: BattleVisualStep, token: number): void {
    this.player.setPosition(this.playerHome.x, this.playerHome.y).setAlpha(1);
    this.enemy.setPosition(this.enemyHome.x, this.enemyHome.y).setAlpha(1);
    this.pose(this.player, 'player', 'idle');
    this.pose(this.enemy, 'enemy', 'idle');

    const done = () => this.finish(token, step.id);
    if (step.kind === 'intro') {
      this.playIntro(done);
    } else if (step.kind === 'strike') {
      this.playStrike(step, token, done);
    } else if (step.kind === 'stall' || step.kind === 'whiff' || step.kind === 'buff' || step.kind === 'factory_reset') {
      this.playPulse(step, token, done);
    } else if (step.kind === 'fatigue' || step.kind === 'hurt') {
      this.playHurt(step, token, done);
    } else {
      this.playResult(step, done);
    }

    this.applyTimeScale();
  }

  private actorSprite(step: BattleVisualStep): Phaser.GameObjects.Sprite | null {
    if (step.actor === 'player') return this.player;
    if (step.actor === 'enemy') return this.enemy;
    return null;
  }

  private otherSprite(step: BattleVisualStep): Phaser.GameObjects.Sprite | null {
    if (step.actor === 'player') return this.enemy;
    if (step.actor === 'enemy') return this.player;
    return null;
  }

  private playIntro(done: () => void): void {
    this.player.setAlpha(0).setPosition(this.playerHome.x, this.playerHome.y + 12);
    this.enemy.setAlpha(0).setPosition(this.enemyHome.x, this.enemyHome.y + 12);
    let remaining = 2;
    const settle = () => {
      remaining -= 1;
      if (remaining > 0) return;
      this.player.setPosition(this.playerHome.x, this.playerHome.y);
      this.enemy.setPosition(this.enemyHome.x, this.enemyHome.y);
      done();
    };
    this.tweens.add({
      targets: this.player,
      alpha: 1,
      y: this.playerHome.y,
      duration: 620,
      ease: 'Sine.easeOut',
      onComplete: settle,
    });
    this.tweens.add({
      targets: this.enemy,
      alpha: 1,
      y: this.enemyHome.y,
      duration: 620,
      ease: 'Sine.easeOut',
      onComplete: settle,
    });
  }

  private playStrike(step: BattleVisualStep, token: number, done: () => void): void {
    const actor = this.actorSprite(step);
    const target = this.otherSprite(step);
    if (!actor || !target) {
      done();
      return;
    }
    const dir = step.actor === 'player' ? 1 : -1;
    const homeX = step.actor === 'player' ? this.playerHome.x : this.enemyHome.x;
    const key = step.actor === 'player' ? 'player' : 'enemy';
    const spec = MECH_SPRITE_SHEETS[step.actor === 'player' ? this.actors.playerSrc : this.actors.enemySrc];
    const attackMs = spec?.attackDurationMs ?? 340;

    this.tweens.add({
      targets: actor,
      x: homeX - dir * 22,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (token !== this.stepToken) return;
        this.pose(actor, key, 'attack');
        this.tweens.add({
          targets: actor,
          x: homeX + dir * 78,
          duration: attackMs,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            if (token !== this.stepToken) return;
            const targetKey = step.actor === 'player' ? 'enemy' : 'player';
            this.pose(target, targetKey, 'hurt');
            this.cameras.main.shake(150, 0.006);
            this.burst(target.x, target.y - target.displayHeight * 0.55, 0xffe29a);
            this.popDamage(step, token);
            this.tweens.add({
              targets: target,
              x: target.x + dir * 16,
              duration: 70,
              yoyo: true,
              repeat: 2,
              onComplete: () => {
                if (token !== this.stepToken) return;
                this.pose(actor, key, 'idle');
                this.pose(target, targetKey, 'idle');
                this.tweens.add({
                  targets: actor,
                  x: homeX,
                  duration: 300,
                  ease: 'Sine.easeInOut',
                  onComplete: done,
                });
              },
            });
          },
        });
      },
    });
  }

  private playPulse(step: BattleVisualStep, token: number, done: () => void): void {
    const actor = this.actorSprite(step) ?? this.player;
    if (step.kind === 'whiff') {
      const banner = this.track(
        this.add
          .text(this.scale.width / 2, this.scale.height * 0.42, 'WHIFF', {
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '40px',
            fontStyle: 'bold',
            color: '#d5deea',
            stroke: '#10141c',
            strokeThickness: 6,
          })
          .setOrigin(0.5)
          .setDepth(30),
      );
      this.tweens.add({ targets: banner, alpha: 0, y: banner.y - 24, delay: 280, duration: 320 });
    }
    this.tweens.add({
      targets: actor,
      scaleX: actor.scaleX * 1.06,
      scaleY: actor.scaleY * 1.06,
      duration: 180,
      yoyo: true,
      onComplete: () => {
        if (token !== this.stepToken) return;
        this.popDamage(step, token);
        this.tweens.add({
          targets: actor,
          alpha: 1,
          duration: step.kind === 'factory_reset' ? 420 : 280,
          onComplete: done,
        });
      },
    });
  }

  private playHurt(step: BattleVisualStep, token: number, done: () => void): void {
    const targets = step.damage.length > 0
      ? step.damage.map((pop) => (pop.target === 'player' ? this.player : this.enemy))
      : [this.player, this.enemy];
    for (const sprite of targets) {
      const key = sprite === this.player ? 'player' : 'enemy';
      this.pose(sprite, key, 'hurt');
    }
    if (step.damage.some((pop) => pop.hp > 0 || pop.shield > 0)) {
      this.cameras.main.shake(160, 0.005);
    }
    this.popDamage(step, token);
    this.tweens.add({
      targets: targets,
      x: '+=8',
      duration: 60,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        if (token !== this.stepToken) return;
        this.pose(this.player, 'player', 'idle');
        this.pose(this.enemy, 'enemy', 'idle');
        done();
      },
    });
  }

  private playResult(step: BattleVisualStep, done: () => void): void {
    const loser = step.kind === 'victory' ? this.enemy : this.player;
    const key = step.kind === 'victory' ? 'enemy' : 'player';
    this.pose(loser, key, 'defeat');
    this.tweens.add({
      targets: loser,
      y: loser.y + 28,
      alpha: 0.45,
      duration: 640,
      ease: 'Sine.easeIn',
      onComplete: done,
    });
  }
}
