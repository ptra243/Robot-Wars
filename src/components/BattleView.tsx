import { useCallback, useEffect, useState } from 'react';
import { PhaserArena } from './PhaserArena';
import { CardHoverPopover } from './CardPreviewDock';
import { FighterSummary } from './FighterSummary';
import { usePinnableCardHover } from './usePinnableCardHover';
import type { CardContentService } from '../core/content';
import { COMBAT_RULES } from '../core/rules';
import { useArenaViewModel } from '../hooks/useArenaViewModel';
import { useGameStore } from '../stores/gameStore';
import { cardArtUrlFromDef } from './poc/forge/forgeCardModel';
import { ARENA_ASPECT_RATIO_STRING, ARENA_FIGHTER_OVERLAY } from '../ui/arenaQueueUi';
import { arenaHoverIdentityKey, type PhaserSlotHoverPayload } from '../ui/arenaScene';

interface BattleViewProps {
  content: CardContentService;
}

export function BattleView({ content }: BattleViewProps) {
  const playback = useGameStore((s) => s.playback);
  const playbackPaused = useGameStore((s) => s.playbackPaused);
  const setPlaybackPaused = useGameStore((s) => s.setPlaybackPaused);
  const handleSimulateEncounter = useGameStore((s) => s.handleSimulateEncounter);
  const handleExitBattleToDeck = useGameStore((s) => s.handleExitBattleToDeck);
  const handleEventScrub = useGameStore((s) => s.handleEventScrub);

  const { snapshot, battleLogLines, scrubStep, battleEventCount, resultForView } =
    useArenaViewModel();

  const eventStep = useGameStore((s) => s.eventStep);
  const setEventStep = useGameStore((s) => s.setEventStep);

  useEffect(() => {
    if (!resultForView?.events.length) {
      return;
    }
    const max = resultForView.events.length - 1;
    if (eventStep > max) {
      setEventStep(max);
    }
  }, [eventStep, resultForView, setEventStep]);

  const [phaserHover, setPhaserHover] = useState<PhaserSlotHoverPayload | null>(null);
  const [arenaPopoverPointerOver, setArenaPopoverPointerOver] = useState(false);
  const {
    displayHover: phaserHoverDisplay,
    pinned: phaserHoverPinned,
    dismissPin: dismissPhaserHoverPin,
  } = usePinnableCardHover(phaserHover, arenaHoverIdentityKey, 1000, arenaPopoverPointerOver);

  useEffect(() => {
    if (!phaserHoverDisplay) {
      setArenaPopoverPointerOver(false);
    }
  }, [phaserHoverDisplay]);

  const handlePhaserSlotHover = useCallback((payload: PhaserSlotHoverPayload | null) => {
    setPhaserHover(payload);
  }, []);

  const blankSlotStrikeDamage = content.get(COMBAT_RULES.blankQueueSlotCardId).base_damage;

  return (
    <div className="battle-view">
      <button type="button" className="battle-deck-reset" onClick={handleExitBattleToDeck}>
        ← Deck builder
      </button>
      <button
        type="button"
        className="battle-run-again accent"
        onClick={handleSimulateEncounter}
        disabled={!!playback}
      >
        {playback ? 'Playing…' : 'Run encounter'}
      </button>
      <div className="battle-view__body">
        <div className="battle-view__main">
          <div className="arena-canvas-wrap">
            <div className="arena-playback">
              <button
                type="button"
                className="arena-playback-pause"
                disabled={!playback}
                onClick={() => setPlaybackPaused((value) => !value)}
                title={playbackPaused ? 'Resume auto-advance' : 'Pause auto-advance'}
              >
                {playbackPaused ? '▶' : '⏸'}
              </button>
              <label className="arena-playback-scrub">
                <span className="arena-playback-label">
                  Event{' '}
                  {resultForView && resultForView.events.length > 0
                    ? scrubStep < 0
                      ? `— / ${String(resultForView.events.length)}`
                      : `${String(scrubStep + 1)} / ${String(resultForView.events.length)}`
                    : '—'}
                </span>
                <input
                  type="range"
                  min={-1}
                  max={Math.max(-1, (resultForView?.events.length ?? 0) - 1)}
                  step={1}
                  value={scrubStep}
                  disabled={!resultForView || (resultForView.events.length ?? 0) === 0}
                  onChange={(event) => handleEventScrub(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="arena-phaser-stack">
              <div
                className="arena-frame-match"
                style={{ aspectRatio: ARENA_ASPECT_RATIO_STRING }}
              >
                <div
                  className="fighter-overlay"
                  style={{
                    top: `${String(ARENA_FIGHTER_OVERLAY.topPct)}%`,
                    height: `${String(ARENA_FIGHTER_OVERLAY.heightPct)}%`,
                    left: `${String(ARENA_FIGHTER_OVERLAY.insetPct)}%`,
                    right: `${String(ARENA_FIGHTER_OVERLAY.insetPct)}%`,
                  }}
                >
                  {snapshot.fatigueArmed &&
                  snapshot.fatigueRoundsElapsed !== undefined &&
                  snapshot.fatigueRoundsElapsed > 0 ? (
                    <div className="fighter-overlay__fatigue" aria-live="polite">
                      Fatigue stacks: {String(snapshot.fatigueRoundsElapsed)}
                    </div>
                  ) : null}
                  <div className="fighter-overlay__columns">
                    <FighterSummary
                      label="Player"
                      side="player"
                      hp={snapshot.player.hp}
                      block={snapshot.player.block}
                      maxHp={40}
                      charge={snapshot.player.charge}
                      junk={snapshot.player.junk}
                      bulk={snapshot.player.bulkStacks}
                      core={snapshot.player.coreScrap}
                      potency={snapshot.player.potency}
                      exposeDamage={snapshot.player.exposeDamage}
                    />
                    <FighterSummary
                      label="Enemy"
                      side="enemy"
                      hp={snapshot.enemy.hp}
                      block={snapshot.enemy.block}
                      maxHp={40}
                      charge={snapshot.enemy.charge}
                      junk={snapshot.enemy.junk}
                      bulk={snapshot.enemy.bulkStacks}
                      core={snapshot.enemy.coreScrap}
                      potency={snapshot.enemy.potency}
                      exposeDamage={snapshot.enemy.exposeDamage}
                    />
                  </div>
                </div>
                <PhaserArena
                  snapshot={snapshot}
                  onSlotHover={handlePhaserSlotHover}
                  blankSlotStrikeDamage={blankSlotStrikeDamage}
                  resolveCardArtUrl={(id) => cardArtUrlFromDef(content.get(id))}
                />
              </div>
            </div>
          </div>
        </div>
        {resultForView && battleEventCount > 0 && (
          <aside className="battle-view__log-aside" aria-label="Combat log">
            <div className="battle-event-log battle-event-log--side">
              <div className="battle-event-log__heading">Combat log</div>
              <div className="battle-event-log__scroll">
                {scrubStep < 0 ? (
                  <div className="battle-event-log__line battle-event-log__muted">
                    Before first event — scrub the slider or wait for playback.
                  </div>
                ) : (
                  battleLogLines.map((line, i) => (
                    <div
                      key={`${String(i)}-${line.slice(0, 48)}`}
                      className="battle-event-log__line"
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
      <CardHoverPopover
        content={content}
        hover={phaserHoverDisplay}
        pinned={phaserHoverPinned}
        onDismissPin={dismissPhaserHoverPin}
        onPopoverPointerOverChange={setArenaPopoverPointerOver}
      />
    </div>
  );
}
