import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';

const PLAYBACK_MS = 500;

/**
 * Auto-advances `eventStep` during playback; on completion, moves result to `lastResult` and clears `playback`.
 */
export function useBattlePlayback(): void {
  const playback = useGameStore((s) => s.playback);
  const playbackPaused = useGameStore((s) => s.playbackPaused);

  useEffect(() => {
    if (!playback || playbackPaused) {
      return;
    }

    if (playback.events.length === 0) {
      useGameStore.setState({
        lastResult: playback,
        playback: null,
        eventStep: -1,
        statusMessage: 'Encounter finished (no events).',
      });
      return;
    }

    const id = window.setInterval(() => {
      const state = useGameStore.getState();
      const pb = state.playback;
      if (!pb || state.playbackPaused) {
        return;
      }
      const next = state.eventStep + 1;
      if (next >= pb.events.length) {
        window.clearInterval(id);
        useGameStore.setState({
          lastResult: pb,
          playback: null,
          statusMessage: `Encounter complete: ${pb.playerWon ? 'WIN' : 'LOSS'} in ${pb.rounds} rounds.`,
          eventStep: pb.events.length - 1,
        });
        return;
      }
      useGameStore.setState({ eventStep: next });
    }, PLAYBACK_MS);

    return () => window.clearInterval(id);
  }, [playback, playbackPaused]);
}
