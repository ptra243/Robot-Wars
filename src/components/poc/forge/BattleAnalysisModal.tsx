import { useMemo, useState } from 'react';
import type { CardContentService } from '../../../core/content';
import { getRelicDef, getRelicDescription } from '../../../core/run';
import type {
  BattleAnalysisRoundMetrics,
  BattleCardContribution,
  BattleStatCategory,
} from '../battlePocAnalysis';
import { ForgeDeckSimChart, type ForgeDeckSimSeriesDef } from './ForgeDeckSimChart';
import { CardHoverPopover } from './CardHoverPopover';
import { cardArtUrlFromDef, forgeCardFromDefWithTraits } from './forgeCardModel';

type AnalysisViewMode = 'timeline' | 'stats' | 'byCard';

interface BattleAnalysisModalProps {
  selected: 'player' | 'enemy';
  onSelect: (s: 'player' | 'enemy') => void;
  onClose: () => void;
  playerSeries: BattleAnalysisRoundMetrics[];
  enemySeries: BattleAnalysisRoundMetrics[];
  playerInitial: { energy: number; shields: number; junk: number; shuriken: number; expose: number };
  enemyInitial: { energy: number; shields: number; junk: number; shuriken: number; expose: number };
  playerCardContributions: BattleCardContribution[];
  enemyCardContributions: BattleCardContribution[];
  playerStatCategories: BattleStatCategory[];
  enemyStatCategories: BattleStatCategory[];
  content: CardContentService;
  activeTraitIds?: readonly string[];
}

const BATTLE_ANALYSIS_SERIES: ForgeDeckSimSeriesDef[] = [
  { key: 'energy', label: 'Energy', color: '#58aec7', cumulative: 'delta' },
  { key: 'damage', label: 'Damage', color: '#e07a52', cumulative: 'sum' },
  { key: 'shields', label: 'Shields', color: '#6fa8bd', cumulative: 'delta' },
  { key: 'stalls', label: 'Stalls', color: '#c084fc', cumulative: 'sum' },
  { key: 'junk', label: 'Junk', color: '#a3e635', cumulative: 'delta' },
  { key: 'shuriken', label: 'Shuriken', color: '#f472b6', cumulative: 'delta' },
  { key: 'expose', label: 'Expose', color: '#fb7185', cumulative: 'delta' },
];

const STAT_BAR_COLORS: Record<string, string> = {
  damage: '#e07a52',
  blocked: '#94a3b8',
  shields: '#6fa8bd',
  healing: '#4ade80',
  energy: '#58aec7',
  junk: '#a3e635',
  expose: '#fb7185',
  potency: '#fbbf24',
  shuriken: '#f472b6',
  selfDamage: '#f87171',
  stalls: '#c084fc',
};

/** Trait ids (`relic_*`) → run relic ids used by {@link getRelicDef}. */
const TRAIT_TO_RELIC_ID: Record<string, string> = {
  relic_reactive_plating: 'if_no_shield_gain_shield_2',
  relic_repair_nanites: 'regen_start_turn_1',
  relic_scrap_condenser: 'neutral_non_basic_gain_junk_2',
  relic_berserker_instincts: 'hp_pay_damage_equal',
  relic_hot_swap_injector: 'transform_strike_2',
  relic_trash_dynamo: 'trash_dynamo',
  relic_scrap_recycling: 'scrap_recycling',
  relic_junk_shrapnel: 'junk_shrapnel',
  relic_stall_shield_weaken: 'stall_shield_weaken',
  relic_delay_double_cast: 'delay_double_cast',
  relic_prime_directive: 'epic_prime_directive',
  relic_overclock_mandate: 'epic_overclock_mandate',
  relic_basic_instincts: 'epic_basic_instincts',
  relic_tempered_blanks: 'tempered_blanks',
  relic_multistrike_protocol: 'epic_multistrike_protocol',
  relic_emergency_junk_shield: 'epic_emergency_junk_shield',
  relic_clockwork_astrolabe_chip: 'clockwork_astrolabe_chip',
  relic_clockwork_second_pendulum: 'clockwork_second_pendulum',
  relic_clockwork_septenary_crown: 'clockwork_septenary_crown',
};

function contributorLabel(
  content: CardContentService,
  id: string,
  kind: 'card' | 'relic',
): { name: string; art: string; isRelic: boolean; relicId?: string } {
  if (kind === 'relic') {
    const relicId = TRAIT_TO_RELIC_ID[id] ?? id;
    const def = getRelicDef(relicId);
    if (def) {
      return { name: def.name, art: '/poc/poc-card-overclock.png', isRelic: true, relicId };
    }
    const pretty = id
      .replace(/^relic_/, '')
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return { name: pretty, art: '/poc/poc-card-overclock.png', isRelic: true, relicId };
  }
  try {
    const def = content.get(id);
    return { name: def.name, art: cardArtUrlFromDef(def), isRelic: false };
  } catch {
    return { name: id, art: '/poc/poc-card-strike.png', isRelic: false };
  }
}

function StatBreakdownList({
  categories,
  content,
  onHoverCard,
}: {
  categories: BattleStatCategory[];
  content: CardContentService;
  onHoverCard: (cardId: string | null, x: number, y: number) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(categories[0]?.id ?? null);

  return (
    <div className="battle-poc__fight-stats">
      {categories.map((cat) => {
        const open = openId === cat.id;
        const barColor = STAT_BAR_COLORS[cat.id] ?? '#e07a52';
        return (
          <div key={cat.id} className="battle-poc__fight-stat-cat">
            <button
              type="button"
              className="battle-poc__fight-stat-cat-head"
              onClick={() => setOpenId(open ? null : cat.id)}
              aria-expanded={open}
            >
              <span>{cat.label}</span>
              <span className="battle-poc__fight-stat-cat-total">{cat.total}</span>
              <span className="battle-poc__fight-stat-cat-chev" aria-hidden>
                {open ? '▴' : '▾'}
              </span>
            </button>
            {open ? (
              <ul className="battle-poc__fight-stat-rows">
                {cat.contributors.length === 0 ? (
                  <li className="battle-poc__fight-stat-empty">No contributors</li>
                ) : (
                  cat.contributors.map((row) => {
                    const meta = contributorLabel(content, row.cardId, row.kind);
                    return (
                      <li
                        key={`${cat.id}-${row.kind}-${row.cardId}`}
                        className="battle-poc__fight-stat-row"
                        onMouseEnter={(e) =>
                          row.kind === 'card' ? onHoverCard(row.cardId, e.clientX, e.clientY) : undefined
                        }
                        onMouseMove={(e) =>
                          row.kind === 'card' ? onHoverCard(row.cardId, e.clientX, e.clientY) : undefined
                        }
                        onMouseLeave={() => onHoverCard(null, 0, 0)}
                        title={
                          row.kind === 'relic'
                            ? getRelicDescription(TRAIT_TO_RELIC_ID[row.cardId] ?? row.cardId)
                            : undefined
                        }
                      >
                        <img src={meta.art} alt="" className="battle-poc__fight-stat-art" />
                        <span className="battle-poc__fight-stat-name">
                          {meta.isRelic ? '◆ ' : ''}
                          {meta.name}
                        </span>
                        <div className="battle-poc__fight-stat-bar-wrap">
                          <div
                            className="battle-poc__fight-stat-bar"
                            style={{
                              width: `${String(Math.max(4, row.pct))}%`,
                              background: barColor,
                            }}
                          />
                          <span className="battle-poc__fight-stat-bar-val">{row.value}</span>
                        </div>
                        <span className="battle-poc__fight-stat-pct">{row.pct}%</span>
                      </li>
                    );
                  })
                )}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ByCardList({
  cards,
  content,
  onHoverCard,
}: {
  cards: BattleCardContribution[];
  content: CardContentService;
  onHoverCard: (cardId: string | null, x: number, y: number) => void;
}) {
  const maxDamage = Math.max(1, ...cards.map((c) => c.damage));

  if (cards.length === 0) {
    return <div className="battle-poc__fight-stat-empty">No card resolutions recorded.</div>;
  }

  return (
    <ul className="battle-poc__by-card-list">
      {cards.map((card) => {
        const meta = contributorLabel(content, card.cardId, card.kind);
        const chips = [
          card.damage > 0 ? { key: 'dmg', label: `DMG ${card.damage}`, color: STAT_BAR_COLORS.damage } : null,
          card.blocked > 0
            ? { key: 'blk', label: `BLK ${card.blocked}`, color: STAT_BAR_COLORS.blocked }
            : null,
          card.shields > 0
            ? { key: 'sh', label: `SH ${card.shields}`, color: STAT_BAR_COLORS.shields }
            : null,
          card.healing > 0
            ? { key: 'heal', label: `HEAL ${card.healing}`, color: STAT_BAR_COLORS.healing }
            : null,
          card.energy > 0
            ? { key: 'en', label: `EN ${card.energy}`, color: STAT_BAR_COLORS.energy }
            : null,
          card.junk > 0 ? { key: 'junk', label: `JNK ${card.junk}`, color: STAT_BAR_COLORS.junk } : null,
          card.expose > 0
            ? { key: 'exp', label: `EXP ${card.expose}`, color: STAT_BAR_COLORS.expose }
            : null,
          card.potency > 0
            ? { key: 'pot', label: `POT ${card.potency}`, color: STAT_BAR_COLORS.potency }
            : null,
          card.shuriken > 0
            ? { key: 'shu', label: `SHU ${card.shuriken}`, color: STAT_BAR_COLORS.shuriken }
            : null,
          card.selfDamage > 0
            ? { key: 'self', label: `SELF ${card.selfDamage}`, color: STAT_BAR_COLORS.selfDamage }
            : null,
          card.stalls > 0
            ? { key: 'stall', label: `STALL ${card.stalls}`, color: STAT_BAR_COLORS.stalls }
            : null,
        ].filter(Boolean) as { key: string; label: string; color: string }[];

        return (
          <li
            key={`${card.kind}-${card.cardId}`}
            className="battle-poc__by-card-row"
            onMouseEnter={(e) =>
              card.kind === 'card' ? onHoverCard(card.cardId, e.clientX, e.clientY) : undefined
            }
            onMouseMove={(e) =>
              card.kind === 'card' ? onHoverCard(card.cardId, e.clientX, e.clientY) : undefined
            }
            onMouseLeave={() => onHoverCard(null, 0, 0)}
            title={
              card.kind === 'relic'
                ? getRelicDescription(TRAIT_TO_RELIC_ID[card.cardId] ?? card.cardId)
                : undefined
            }
          >
            <img src={meta.art} alt="" className="battle-poc__by-card-art" />
            <div className="battle-poc__by-card-body">
              <div className="battle-poc__by-card-title">
                <span>
                  {meta.isRelic ? '◆ ' : ''}
                  {meta.name}
                </span>
                <span className="battle-poc__by-card-resolves">
                  {meta.isRelic ? 'RELIC' : `×${card.resolves}`}
                </span>
              </div>
              <div className="battle-poc__fight-stat-bar-wrap battle-poc__fight-stat-bar-wrap--bycard">
                <div
                  className="battle-poc__fight-stat-bar"
                  style={{
                    width: `${String(Math.max(4, Math.round((card.damage / maxDamage) * 100)))}%`,
                    background: STAT_BAR_COLORS.damage,
                  }}
                />
                {card.damage > 0 ? (
                  <span className="battle-poc__fight-stat-bar-val">{card.damage}</span>
                ) : null}
              </div>
              {chips.length > 0 ? (
                <div className="battle-poc__by-card-chips">
                  {chips.map((chip) => (
                    <span
                      key={chip.key}
                      className="battle-poc__by-card-chip"
                      style={{ borderColor: chip.color, color: chip.color }}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function BattleAnalysisModal({
  selected,
  onSelect,
  onClose,
  playerSeries,
  enemySeries,
  playerInitial,
  enemyInitial,
  playerCardContributions,
  enemyCardContributions,
  playerStatCategories,
  enemyStatCategories,
  content,
  activeTraitIds = [],
}: BattleAnalysisModalProps) {
  const [viewMode, setViewMode] = useState<AnalysisViewMode>('stats');
  const [expandedHover, setExpandedHover] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [hoverCard, setHoverCard] = useState<{
    round: number;
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const rows = selected === 'player' ? playerSeries : enemySeries;
  const initial = selected === 'player' ? playerInitial : enemyInitial;
  const cardContributions =
    selected === 'player' ? playerCardContributions : enemyCardContributions;
  const statCategories = selected === 'player' ? playerStatCategories : enemyStatCategories;

  const hoverForgeCard = useMemo(() => {
    const id = expandedHover?.id ?? hoverCard?.id;
    if (!id) return null;
    try {
      return forgeCardFromDefWithTraits(content.get(id), activeTraitIds);
    } catch {
      return null;
    }
  }, [expandedHover, hoverCard, content, activeTraitIds]);

  const onHoverContribution = (cardId: string | null, x: number, y: number) => {
    if (!cardId) {
      setExpandedHover(null);
      return;
    }
    setExpandedHover({ id: cardId, x, y });
  };

  return (
    <div className="battle-poc__analysis" role="dialog" aria-modal="true" aria-label="Battle analysis">
      <div className="battle-poc__analysis-card">
        <div className="battle-poc__analysis-head">
          <strong>FIGHT STATISTICS</strong>
          <button type="button" className="battle-poc__ctrl battle-poc__ctrl--exit" onClick={onClose}>
            ✕ CLOSE
          </button>
        </div>
        <div className="battle-poc__analysis-tabs">
          <button
            type="button"
            className={`battle-poc__analysis-tab${selected === 'player' ? ' battle-poc__analysis-tab--active' : ''}`}
            onClick={() => onSelect('player')}
          >
            PLAYER
          </button>
          <button
            type="button"
            className={`battle-poc__analysis-tab${selected === 'enemy' ? ' battle-poc__analysis-tab--active' : ''}`}
            onClick={() => onSelect('enemy')}
          >
            ENEMY
          </button>
        </div>
        <div className="battle-poc__analysis-mode">
          <span className="battle-poc__analysis-mode-label">View</span>
          <button
            type="button"
            className={`battle-poc__analysis-mode-btn${viewMode === 'stats' ? ' battle-poc__analysis-mode-btn--on' : ''}`}
            onClick={() => setViewMode('stats')}
          >
            Stats
          </button>
          <button
            type="button"
            className={`battle-poc__analysis-mode-btn${viewMode === 'byCard' ? ' battle-poc__analysis-mode-btn--on' : ''}`}
            onClick={() => setViewMode('byCard')}
          >
            By card
          </button>
          <button
            type="button"
            className={`battle-poc__analysis-mode-btn${viewMode === 'timeline' ? ' battle-poc__analysis-mode-btn--on' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </button>
        </div>
        <div className="battle-poc__analysis-title">
          {selected === 'player' ? 'Player' : 'Enemy'}{' '}
          {viewMode === 'timeline'
            ? 'combat timeline'
            : viewMode === 'byCard'
              ? 'contribution by card'
              : 'stat breakdown'}
        </div>
        {viewMode === 'timeline' ? (
          <ForgeDeckSimChart
            layout="large"
            data={{
              rounds: rows,
              initial: {
                energy: initial.energy,
                shields: initial.shields,
                junk: initial.junk,
                shuriken: initial.shuriken,
                expose: initial.expose,
              },
            }}
            seriesDefs={BATTLE_ANALYSIS_SERIES}
            autoHideZeroSeries
            onRoundPointer={(round, pointer) => {
              if (!round || !pointer) {
                setHoverCard(null);
                return;
              }
              const row = rows[round - 1];
              const id = row?.programCardId ?? null;
              if (!id) {
                setHoverCard(null);
                return;
              }
              setHoverCard({ round, id, x: pointer.clientX, y: pointer.clientY });
            }}
          />
        ) : null}
        {viewMode === 'stats' ? (
          <StatBreakdownList
            categories={statCategories}
            content={content}
            onHoverCard={onHoverContribution}
          />
        ) : null}
        {viewMode === 'byCard' ? (
          <ByCardList cards={cardContributions} content={content} onHoverCard={onHoverContribution} />
        ) : null}
      </div>
      {(expandedHover || hoverCard) && hoverForgeCard ? (
        <CardHoverPopover
          hover={{
            card: hoverForgeCard,
            ...(hoverCard && rows[hoverCard.round - 1]?.programCardIds?.[1]
              ? {
                  secondaryCard: (() => {
                    const secondId = rows[hoverCard.round - 1]?.programCardIds?.[1];
                    if (!secondId) return undefined;
                    try {
                      return forgeCardFromDefWithTraits(content.get(secondId), activeTraitIds);
                    } catch {
                      return undefined;
                    }
                  })(),
                }
              : {}),
            x: (expandedHover ?? hoverCard)!.x,
            y: (expandedHover ?? hoverCard)!.y,
          }}
          zIndex={1600}
        />
      ) : null}
    </div>
  );
}
