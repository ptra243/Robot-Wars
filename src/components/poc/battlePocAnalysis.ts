import type { CombatEventSnapshot, CombatFighterSnapshot, CombatResult } from '../../core/types';
import { parseResolveDamage, parseResolveMetrics } from './battlePocHelpers';

export interface BattleAnalysisRoundMetrics {
  round: number;
  energy: number;
  damage: number;
  shields: number;
  stalls: number;
  junk: number;
  shuriken: number;
  expose: number;
  programCardId: string | null;
  programCardIds: string[];
}

export type BattleStatCategoryId =
  | 'damage'
  | 'blocked'
  | 'shields'
  | 'healing'
  | 'energy'
  | 'junk'
  | 'expose'
  | 'potency'
  | 'shuriken'
  | 'selfDamage'
  | 'stalls';

export interface BattleCardContribution {
  cardId: string;
  kind: 'card' | 'relic';
  damage: number;
  blocked: number;
  shields: number;
  healing: number;
  energy: number;
  junk: number;
  expose: number;
  potency: number;
  shuriken: number;
  selfDamage: number;
  stalls: number;
  resolves: number;
}

export interface BattleStatContributor {
  cardId: string;
  kind: 'card' | 'relic';
  value: number;
  pct: number;
}

export interface BattleStatCategory {
  id: BattleStatCategoryId;
  label: string;
  total: number;
  contributors: BattleStatContributor[];
}

export interface BattleAnalysisSeries {
  player: BattleAnalysisRoundMetrics[];
  enemy: BattleAnalysisRoundMetrics[];
  playerInitial: { energy: number; shields: number; junk: number; shuriken: number; expose: number };
  enemyInitial: { energy: number; shields: number; junk: number; shuriken: number; expose: number };
  playerCardContributions: BattleCardContribution[];
  enemyCardContributions: BattleCardContribution[];
  playerStatCategories: BattleStatCategory[];
  enemyStatCategories: BattleStatCategory[];
}

const PROGRAM_CARD_EVENTS = new Set([
  'resolve',
  'stall',
  'stall_skip',
  'whiff',
  'continuous_skip',
  'persistent_skip',
]);

const STAT_CATEGORY_META: Array<{ id: BattleStatCategoryId; label: string; key: keyof BattleCardContribution }> =
  [
    { id: 'damage', label: 'Damage', key: 'damage' },
    { id: 'blocked', label: 'Blocked', key: 'blocked' },
    { id: 'shields', label: 'Shields', key: 'shields' },
    { id: 'healing', label: 'Healing', key: 'healing' },
    { id: 'energy', label: 'Energy gained', key: 'energy' },
    { id: 'junk', label: 'Junk', key: 'junk' },
    { id: 'expose', label: 'Expose applied', key: 'expose' },
    { id: 'potency', label: 'Potency gained', key: 'potency' },
    { id: 'shuriken', label: 'Shuriken', key: 'shuriken' },
    { id: 'selfDamage', label: 'Self damage', key: 'selfDamage' },
    { id: 'stalls', label: 'Stalls', key: 'stalls' },
  ];

function parseTraitEffectMetrics(text: string): {
  damage: number;
  shields: number;
  healing: number;
  junk: number;
} {
  const damage =
    Number(/(?:reflects|deals|Strike)\s+(\d+)/i.exec(text)?.[1] ?? 0) ||
    Number(/(\d+)\s+damage/i.exec(text)?.[1] ?? 0);
  const shields = Number(/gains?\s+(\d+)\s+shield/i.exec(text)?.[1] ?? 0);
  const healing =
    Number(/recovers?\s+(\d+)\s+HP/i.exec(text)?.[1] ?? 0) ||
    Number(/heal(?:s|ed)?\s+(\d+)/i.exec(text)?.[1] ?? 0);
  const junk = Number(/gains?\s+(\d+)\s+junk/i.exec(text)?.[1] ?? 0);
  return { damage, shields, healing, junk };
}

function snapshotProgramCardId(
  snap: CombatEventSnapshot | undefined,
  side: 'player' | 'enemy',
): string | null {
  if (!snap) return null;
  const queue = side === 'player' ? snap.playerQueue : snap.enemyQueue;
  const cursor = side === 'player' ? snap.playerQueueCursor : snap.enemyQueueCursor;
  if (!queue || cursor == null) return null;
  return queue[cursor] ?? null;
}

function emptyContribution(
  cardId: string,
  kind: 'card' | 'relic' = 'card',
): BattleCardContribution {
  return {
    cardId,
    kind,
    damage: 0,
    blocked: 0,
    shields: 0,
    healing: 0,
    energy: 0,
    junk: 0,
    expose: 0,
    potency: 0,
    shuriken: 0,
    selfDamage: 0,
    stalls: 0,
    resolves: 0,
  };
}

function resolveEventCardId(
  ev: { cardId?: string; snapshot?: CombatEventSnapshot },
  side: 'player' | 'enemy',
): string | null {
  if (ev.cardId) return ev.cardId;
  return snapshotProgramCardId(ev.snapshot, side);
}

function applySnapshotGains(
  row: BattleCardContribution,
  cur: CombatFighterSnapshot,
  prev: CombatFighterSnapshot,
  opponentCur: CombatFighterSnapshot,
  opponentPrev: CombatFighterSnapshot,
): void {
  row.shields += Math.max(0, cur.block - prev.block);
  row.healing += Math.max(0, cur.hp - prev.hp);
  row.energy += Math.max(0, cur.charge - prev.charge);
  row.junk += Math.max(0, cur.junk - prev.junk);
  row.potency += Math.max(0, cur.potency - prev.potency);
  row.shuriken += Math.max(0, (cur.shuriken ?? 0) - (prev.shuriken ?? 0));
  /* Expose is applied to the opponent. */
  row.expose += Math.max(0, (opponentCur.exposeDamage ?? 0) - (opponentPrev.exposeDamage ?? 0));
}

function ensureContribution(
  map: Map<string, BattleCardContribution>,
  cardId: string,
  kind: 'card' | 'relic' = 'card',
): BattleCardContribution {
  let row = map.get(cardId);
  if (!row) {
    row = emptyContribution(cardId, kind);
    map.set(cardId, row);
  }
  return row;
}

const ALWAYS_SHOW_STAT_IDS = new Set<BattleStatCategoryId>([
  'damage',
  'shields',
  'energy',
  'junk',
  'expose',
  'selfDamage',
  'stalls',
]);

function buildStatCategories(cards: BattleCardContribution[]): BattleStatCategory[] {
  return STAT_CATEGORY_META.map(({ id, label, key }) => {
    if (key === 'kind' || key === 'cardId') {
      return { id, label, total: 0, contributors: [] };
    }
    const total = cards.reduce((sum, c) => sum + (c[key] as number), 0);
    const contributors = cards
      .filter((c) => (c[key] as number) > 0)
      .map((c) => ({
        cardId: c.cardId,
        kind: c.kind,
        value: c[key] as number,
        pct: total > 0 ? Math.round(((c[key] as number) / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
    return { id, label, total, contributors };
  }).filter((cat) => cat.total > 0 || ALWAYS_SHOW_STAT_IDS.has(cat.id));
}

function sortCardContributions(cards: BattleCardContribution[]): BattleCardContribution[] {
  return [...cards].sort((a, b) => {
    const score = (c: BattleCardContribution) =>
      c.damage * 4 +
      c.shields * 3 +
      c.healing * 2 +
      c.energy * 2 +
      c.junk * 2 +
      c.expose * 2 +
      c.potency * 2 +
      c.blocked +
      c.stalls +
      c.resolves;
    return score(b) - score(a);
  });
}

export function buildBattleAnalysisSeries(combatResult: CombatResult | null | undefined): {
  player: BattleAnalysisRoundMetrics[];
  enemy: BattleAnalysisRoundMetrics[];
  playerInitial: { energy: number; shields: number; junk: number; shuriken: number; expose: number };
  enemyInitial: { energy: number; shields: number; junk: number; shuriken: number; expose: number };
  playerCardContributions: BattleCardContribution[];
  enemyCardContributions: BattleCardContribution[];
  playerStatCategories: BattleStatCategory[];
  enemyStatCategories: BattleStatCategory[];
} {
  const empty = {
    player: [] as BattleAnalysisRoundMetrics[],
    enemy: [] as BattleAnalysisRoundMetrics[],
    playerInitial: { energy: 0, shields: 0, junk: 0, shuriken: 0, expose: 0 },
    enemyInitial: { energy: 0, shields: 0, junk: 0, shuriken: 0, expose: 0 },
    playerCardContributions: [] as BattleCardContribution[],
    enemyCardContributions: [] as BattleCardContribution[],
    playerStatCategories: [] as BattleStatCategory[],
    enemyStatCategories: [] as BattleStatCategory[],
  };
  if (!combatResult) {
    return empty;
  }
  const replayEvents = combatResult.events ?? [];
  const totalRounds = Math.max(1, combatResult.rounds);
  const initPlayer = combatResult.initialSnapshot.player;
  const initEnemy = combatResult.initialSnapshot.enemy;

  const mkRows = (initial: CombatFighterSnapshot): BattleAnalysisRoundMetrics[] =>
    Array.from({ length: totalRounds }, (_, i) => ({
      round: i + 1,
      energy: initial.charge,
      damage: 0,
      shields: initial.block,
      stalls: 0,
      junk: initial.junk,
      shuriken: initial.shuriken ?? 0,
      expose: initial.exposeDamage ?? 0,
      programCardId: null,
      programCardIds: [],
    }));

  const playerRows = mkRows(initPlayer);
  const enemyRows = mkRows(initEnemy);
  const playerCards = new Map<string, BattleCardContribution>();
  const enemyCards = new Map<string, BattleCardContribution>();

  let prevSnap: CombatEventSnapshot | undefined = combatResult.initialSnapshot;
  /* Attribute energy/expose/etc. across the whole card window, not just the last sub-event. */
  let lastPlayerAttrSnap: CombatFighterSnapshot = initPlayer;
  let lastEnemyAttrSnap: CombatFighterSnapshot = initEnemy;

  for (const ev of replayEvents) {
    const r = Math.max(1, Math.min(totalRounds, ev.round));
    const idx = r - 1;
    const pRow = playerRows[idx]!;
    const eRow = enemyRows[idx]!;

    if (ev.snapshot) {
      pRow.energy = ev.snapshot.player.charge;
      pRow.shields = ev.snapshot.player.block;
      pRow.junk = ev.snapshot.player.junk;
      pRow.shuriken = ev.snapshot.player.shuriken ?? 0;
      pRow.expose = ev.snapshot.player.exposeDamage ?? 0;
      eRow.energy = ev.snapshot.enemy.charge;
      eRow.shields = ev.snapshot.enemy.block;
      eRow.junk = ev.snapshot.enemy.junk;
      eRow.shuriken = ev.snapshot.enemy.shuriken ?? 0;
      eRow.expose = ev.snapshot.enemy.exposeDamage ?? 0;
    }

    if (PROGRAM_CARD_EVENTS.has(ev.type) && ev.actor === 'Player') {
      const id = resolveEventCardId(ev, 'player');
      if (id) {
        if (pRow.programCardId == null) pRow.programCardId = id;
        if (pRow.programCardIds.length < 2 && pRow.programCardIds[pRow.programCardIds.length - 1] !== id) {
          pRow.programCardIds.push(id);
        }
      }
    }
    if (PROGRAM_CARD_EVENTS.has(ev.type) && ev.actor === 'Enemy') {
      const id = resolveEventCardId(ev, 'enemy');
      if (id) {
        if (eRow.programCardId == null) eRow.programCardId = id;
        if (eRow.programCardIds.length < 2 && eRow.programCardIds[eRow.programCardIds.length - 1] !== id) {
          eRow.programCardIds.push(id);
        }
      }
    }

    if (ev.type === 'resolve') {
      const metrics = parseResolveMetrics(ev.text);
      const dealt = metrics.dealt || parseResolveDamage(ev.text);
      if (ev.actor === 'Player') {
        pRow.damage += dealt;
        const id = resolveEventCardId(ev, 'player');
        if (id && ev.snapshot) {
          const row = ensureContribution(playerCards, id);
          row.damage += dealt;
          row.blocked += metrics.blocked;
          row.selfDamage += metrics.selfDmg;
          row.resolves += 1;
          applySnapshotGains(
            row,
            ev.snapshot.player,
            lastPlayerAttrSnap,
            ev.snapshot.enemy,
            lastEnemyAttrSnap,
          );
          lastPlayerAttrSnap = ev.snapshot.player;
          lastEnemyAttrSnap = ev.snapshot.enemy;
        }
      } else if (ev.actor === 'Enemy') {
        eRow.damage += dealt;
        const id = resolveEventCardId(ev, 'enemy');
        if (id && ev.snapshot) {
          const row = ensureContribution(enemyCards, id);
          row.damage += dealt;
          row.blocked += metrics.blocked;
          row.selfDamage += metrics.selfDmg;
          row.resolves += 1;
          applySnapshotGains(
            row,
            ev.snapshot.enemy,
            lastEnemyAttrSnap,
            ev.snapshot.player,
            lastPlayerAttrSnap,
          );
          lastEnemyAttrSnap = ev.snapshot.enemy;
          lastPlayerAttrSnap = ev.snapshot.player;
        }
      }
    }

    if ((ev.type === 'stall' || ev.type === 'stunned_stall') && ev.actor === 'Player') {
      pRow.stalls += 1;
      const id = resolveEventCardId(ev, 'player');
      if (id && ev.snapshot) {
        const row = ensureContribution(playerCards, id);
        row.stalls += 1;
        applySnapshotGains(
          row,
          ev.snapshot.player,
          lastPlayerAttrSnap,
          ev.snapshot.enemy,
          lastEnemyAttrSnap,
        );
        lastPlayerAttrSnap = ev.snapshot.player;
        lastEnemyAttrSnap = ev.snapshot.enemy;
      }
    }
    if ((ev.type === 'stall' || ev.type === 'stunned_stall') && ev.actor === 'Enemy') {
      eRow.stalls += 1;
      const id = resolveEventCardId(ev, 'enemy');
      if (id && ev.snapshot) {
        const row = ensureContribution(enemyCards, id);
        row.stalls += 1;
        applySnapshotGains(
          row,
          ev.snapshot.enemy,
          lastEnemyAttrSnap,
          ev.snapshot.player,
          lastPlayerAttrSnap,
        );
        lastEnemyAttrSnap = ev.snapshot.enemy;
        lastPlayerAttrSnap = ev.snapshot.player;
      }
    }

    if (ev.type === 'trait_effect' && ev.sourceId) {
      const parsed = parseTraitEffectMetrics(ev.text);
      const side = ev.actor === 'Enemy' ? 'enemy' : 'player';
      const map = side === 'player' ? playerCards : enemyCards;
      const row = ensureContribution(map, ev.sourceId, 'relic');
      row.damage += parsed.damage;
      row.shields += parsed.shields;
      row.healing += parsed.healing;
      row.junk += parsed.junk;
      row.resolves += 1;
      if (parsed.damage > 0 && side === 'player') {
        pRow.damage += parsed.damage;
      }
      if (parsed.damage > 0 && side === 'enemy') {
        eRow.damage += parsed.damage;
      }
      if (ev.snapshot && prevSnap) {
        const cur = side === 'player' ? ev.snapshot.player : ev.snapshot.enemy;
        const prev = side === 'player' ? prevSnap.player : prevSnap.enemy;
        const oppCur = side === 'player' ? ev.snapshot.enemy : ev.snapshot.player;
        const oppPrev = side === 'player' ? prevSnap.enemy : prevSnap.player;
        if (parsed.shields === 0 && parsed.healing === 0 && parsed.junk === 0) {
          applySnapshotGains(row, cur, prev, oppCur, oppPrev);
        } else {
          row.energy += Math.max(0, cur.charge - prev.charge);
          row.expose += Math.max(0, (oppCur.exposeDamage ?? 0) - (oppPrev.exposeDamage ?? 0));
          row.potency += Math.max(0, cur.potency - prev.potency);
        }
      }
    }

    if (ev.snapshot) {
      prevSnap = ev.snapshot;
    }
  }

  const playerCardContributions = sortCardContributions([...playerCards.values()]);
  const enemyCardContributions = sortCardContributions([...enemyCards.values()]);

  return {
    player: playerRows,
    enemy: enemyRows,
    playerInitial: {
      energy: initPlayer.charge,
      shields: initPlayer.block,
      junk: initPlayer.junk,
      shuriken: initPlayer.shuriken ?? 0,
      expose: initPlayer.exposeDamage ?? 0,
    },
    enemyInitial: {
      energy: initEnemy.charge,
      shields: initEnemy.block,
      junk: initEnemy.junk,
      shuriken: initEnemy.shuriken ?? 0,
      expose: initEnemy.exposeDamage ?? 0,
    },
    playerCardContributions,
    enemyCardContributions,
    playerStatCategories: buildStatCategories(playerCardContributions),
    enemyStatCategories: buildStatCategories(enemyCardContributions),
  };
}
