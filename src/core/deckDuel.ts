import { CombatSimulator } from './combat';
import { CardContentService } from './content';
import { createCombatSetupFromDecklists } from './run';
import type { CombatResult } from './types';

export type DeckDuelInput = string[];

export { ARCHETYPE_DECKS, type ArchetypeDeckKey } from './deckArchetypes';

/**
 * Resolve a deck list to card ids. Entries can be **exact ids** or **card names** (case-insensitive).
 */
export function resolveDeckEntries(entries: string[], content: CardContentService): string[] {
  const all = content.getAll();
  const byId = new Set(all.map((c) => c.id));
  const byNameLower = new Map(all.map((c) => [c.name.trim().toLowerCase(), c.id] as const));

  return entries.map((raw) => {
    const e = raw.trim();
    if (e === '') {
      throw new Error('Empty deck entry');
    }
    if (byId.has(e)) {
      return e;
    }
    const id = byNameLower.get(e.toLowerCase());
    if (id) {
      return id;
    }
    throw new Error(`Unknown card reference: "${raw}"`);
  });
}

/**
 * Run a headless combat: **player** queue vs **enemy** queue. Same card order is used for the
 * player deck and the default planned queue (see `createCombatSetupFromDecklists`).
 */
export function runDeckDuel(
  content: CardContentService,
  options: {
    player: DeckDuelInput;
    enemy: DeckDuelInput;
    seed?: number;
    playerCoreScrap?: number;
    enemyCoreScrap?: number;
    /** When true (default), each entry can be a card **name** or **id**. When false, entries must be ids. */
    resolveEntries?: boolean;
  },
): CombatResult {
  const resolveEntries = options.resolveEntries !== false;
  const playerDeck = resolveEntries
    ? resolveDeckEntries(options.player, content)
    : options.player.map((e) => {
        const id = e.trim();
        content.get(id);
        return id;
      });
  const enemyDeck = resolveEntries
    ? resolveDeckEntries(options.enemy, content)
    : options.enemy.map((e) => {
        const id = e.trim();
        content.get(id);
        return id;
      });

  const setup = createCombatSetupFromDecklists({
    seed: options.seed ?? 0,
    playerDeck,
    enemyDeck,
    playerCoreScrap: options.playerCoreScrap,
    enemyCoreScrap: options.enemyCoreScrap,
  });

  const sim = new CombatSimulator(content, setup.seed);
  return sim.run(setup);
}

/** Human-readable chain for logging (card names in queue order). */
export function formatDecklistOrder(content: CardContentService, ids: readonly string[]): string {
  return ids.map((id) => content.get(id).name).join(' → ');
}
