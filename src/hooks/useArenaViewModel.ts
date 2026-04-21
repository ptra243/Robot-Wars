import { useMemo } from 'react';
import { buildArenaFromReplaySlice, buildEncounterSnapshot } from '../core/run';
import { useGameStore } from '../stores/gameStore';

/** Keeps scrub index aligned with `events.length` so we never read `events[outOfRange]`. */
export function clampBattleEventStep(eventStep: number, eventCount: number): number {
  if (eventCount === 0) {
    return -1;
  }
  return Math.min(Math.max(-1, eventStep), eventCount - 1);
}

export function useArenaViewModel() {
  const run = useGameStore((s) => s.run);
  const lastResult = useGameStore((s) => s.lastResult);
  const playback = useGameStore((s) => s.playback);
  const eventStep = useGameStore((s) => s.eventStep);

  const resultForView = playback ?? lastResult;

  const battleEventCount = resultForView?.events.length ?? 0;
  const scrubStep = useMemo(
    () => clampBattleEventStep(eventStep, battleEventCount),
    [eventStep, battleEventCount],
  );

  const snapshot = useMemo(() => {
    if (resultForView) {
      const n = resultForView.events.length;
      const step = clampBattleEventStep(eventStep, n);
      if (step < 0) {
        return buildArenaFromReplaySlice(resultForView, resultForView.initialSnapshot, []);
      }
      const ev = resultForView.events[step];
      if (!ev?.snapshot) {
        return buildArenaFromReplaySlice(resultForView, resultForView.initialSnapshot, []);
      }
      return buildArenaFromReplaySlice(
        resultForView,
        ev.snapshot,
        resultForView.events.slice(0, step + 1),
      );
    }
    return buildEncounterSnapshot(run, lastResult);
  }, [eventStep, lastResult, resultForView, run]);

  const battleLogLines = useMemo(() => {
    if (!resultForView || battleEventCount === 0 || scrubStep < 0) {
      return [];
    }
    return resultForView.events.slice(0, scrubStep + 1).map((e) => `R${e.round} ${e.text}`);
  }, [battleEventCount, resultForView, scrubStep]);

  return {
    snapshot,
    battleLogLines,
    scrubStep,
    battleEventCount,
    resultForView,
  };
}
