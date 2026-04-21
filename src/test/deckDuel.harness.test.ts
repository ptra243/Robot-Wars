import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import {
  ARCHETYPE_DECKS,
  formatDecklistOrder,
  resolveDeckEntries,
  runDeckDuel,
} from '../core/deckDuel';

describe('deck duel harness', () => {
  const content = CardContentService.loadDefault(1);

  it('resolveDeckEntries accepts ids or card names', () => {
    const ids = resolveDeckEntries(['Salvage Strike', 'neutral_basic_strike_t1', 'Junk Loader'], content);
    expect(ids).toEqual(['salvage_strike_t1', 'neutral_basic_strike_t1', 'junk_loader_t1']);
  });

  it('runDeckDuel runs combat with id-only lists (resolveEntries: false)', () => {
    const r = runDeckDuel(content, {
      player: ['salvage_strike_t1', 'neutral_basic_strike_t1'],
      enemy: ['neutral_basic_strike_t1', 'neutral_barrier_t1'],
      seed: 99,
      resolveEntries: false,
    });
    expect(r.events.length).toBeGreaterThan(0);
    expect(typeof r.playerWon).toBe('boolean');
  });

  it('applies starting refined scrap when requested', () => {
    const r = runDeckDuel(content, {
      player: [...ARCHETYPE_DECKS.refinedScrapCore],
      enemy: [...ARCHETYPE_DECKS.junkSpend],
      seed: 7,
      playerCoreScrap: 2,
    });
    expect(r.initialSnapshot.player.coreScrap).toBe(2);
    expect(r.initialSnapshot.enemy.coreScrap).toBe(0);
  });

  it('formatDecklistOrder prints names in queue order', () => {
    const s = formatDecklistOrder(content, ['core_tap_t1', 'junk_loader_t1']);
    expect(s).toContain('Core Tap');
    expect(s).toContain('Junk Loader');
  });

  it('all archetype pairs complete a combat', () => {
    const keys = Object.keys(ARCHETYPE_DECKS) as (keyof typeof ARCHETYPE_DECKS)[];
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = 0; j < keys.length; j += 1) {
        if (i === j) {
          continue;
        }
        const playerKey = keys[i];
        const enemyKey = keys[j];
        const r = runDeckDuel(content, {
          player: [...ARCHETYPE_DECKS[playerKey]],
          enemy: [...ARCHETYPE_DECKS[enemyKey]],
          seed: 200 + i * 20 + j,
          playerCoreScrap: playerKey === 'refinedScrapCore' ? 2 : 0,
          enemyCoreScrap: enemyKey === 'refinedScrapCore' ? 2 : 0,
        });
        expect(r.rounds, `${String(playerKey)} vs ${String(enemyKey)}`).toBeGreaterThan(0);
      }
    }
  });
});
