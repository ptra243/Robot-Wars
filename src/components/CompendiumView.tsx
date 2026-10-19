import { useEffect, useMemo, useState } from 'react';
import { CardContentService } from '../core/content';
import type { CardTag } from '../core/types';
import './poc/forge-poc.css';
import { forgeCardFromDef } from '../features/forge/forgeCardModel';
import { CardHoverPopover, LibraryCard } from '../features/forge/ui';
import type { ForgeCard } from '../features/forge/ui';

interface CompendiumViewProps {
  onExit: () => void;
}

interface CompendiumHover {
  card: ForgeCard;
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}

type FactionScopedTag =
  | 'dragon'
  | 'tiger'
  | 'bird'
  | 'turtle'
  | 'factoryReset'
  | 'junk'
  | 'prime'
  | 'sequence';
type CompendiumTag = CardTag | 'Factory Reset' | 'Prime' | 'Sequence' | FactionScopedTag;

const FACTION_TAGS: Record<string, FactionScopedTag[]> = {
  CYBERPUNK: ['dragon', 'tiger', 'bird', 'turtle'],
  SCAVENGERS: ['factoryReset', 'junk'],
  CLOCKWORK: ['prime', 'sequence'],
};

function formatCompendiumTagLabel(tag: CompendiumTag): string {
  if (tag === 'factoryReset') return 'Factory Reset';
  return tag;
}

function hasPrimeMarker(card: ForgeCard & { awakeningMin?: number }): boolean {
  return card.keywords.some((k) => k.type === 'Prime');
}

function hasSequenceMarker(card: ForgeCard & { awakeningMin?: number }): boolean {
  return card.keywords.some((k) => k.type === 'Sequence');
}

export function CompendiumView({ onExit }: CompendiumViewProps) {
  const content = useMemo(() => CardContentService.loadDefault(1), []);
  const cards = useMemo(
    () => content.getAll().map((def) => ({ ...forgeCardFromDef(def), awakeningMin: def.awakening_min })),
    [content],
  );
  const cardsByFamily = useMemo(() => {
    const map = new Map<string, Array<ForgeCard & { awakeningMin: number }>>();
    for (const card of cards) {
      const family = card.id.replace(/_t\d+$/, '');
      const list = map.get(family) ?? [];
      list.push(card);
      map.set(family, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.tier - b.tier);
    }
    return map;
  }, [cards]);
  const baseCards = useMemo(() => {
    const rows: Array<ForgeCard & { awakeningMin: number }> = [];
    for (const list of cardsByFamily.values()) {
      const base = list.find((card) => card.tier === 1) ?? list[0];
      if (base) {
        rows.push(base);
      }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [cardsByFamily]);
  const [activeTags, setActiveTags] = useState<CompendiumTag[]>([]);
  const [activeFactions, setActiveFactions] = useState<string[]>([]);
  const [activeAwakening, setActiveAwakening] = useState<number[]>([]);
  const [hover, setHover] = useState<CompendiumHover | null>(null);
  const [hoverTierIndex, setHoverTierIndex] = useState(0);
  const [hoverPinnedPosition, setHoverPinnedPosition] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const [isHoveringPopover, setIsHoveringPopover] = useState(false);

  const allTags = useMemo(() => {
    const tagSet = new Set<CompendiumTag>();
    for (const card of cards) {
      for (const tag of card.tags) {
        tagSet.add(tag);
      }
      if (card.keywords.some((k) => k.type === 'FactoryReset')) {
        tagSet.add('Factory Reset');
      }
      if (hasPrimeMarker(card)) {
        tagSet.add('Prime');
      }
      if (hasSequenceMarker(card)) {
        tagSet.add('Sequence');
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b));
  }, [cards]);
  const allFactions = useMemo(() => {
    const s = new Set<string>();
    for (const card of baseCards) {
      s.add(card.faction.toUpperCase());
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [baseCards]);
  const allAwakening = useMemo(() => {
    const s = new Set<number>();
    for (const card of baseCards) {
      s.add(card.awakeningMin);
    }
    return [...s].sort((a, b) => a - b);
  }, [baseCards]);
  const allDynamicTags = useMemo(() => {
    const s = new Set<FactionScopedTag>();
    for (const card of baseCards) {
      if (card.faction === 'cyberpunk') {
        if (card.id.includes('dragon')) s.add('dragon');
        if (card.id.includes('tiger')) s.add('tiger');
        if (card.id.includes('bird')) s.add('bird');
        if (card.id.includes('tortoise')) s.add('turtle');
      }
      if (card.faction === 'scavengers') {
        if (card.keywords.some((k) => k.type === 'FactoryReset')) s.add('factoryReset');
        if (card.tags.includes('Junk')) s.add('junk');
      }
      if (card.faction === 'clockwork') {
        if (hasPrimeMarker(card)) s.add('prime');
        if (hasSequenceMarker(card)) s.add('sequence');
      }
    }
    return [...s];
  }, [baseCards]);
  const visibleTags = useMemo(() => {
    if (activeFactions.length === 0) {
      return allTags;
    }
    const scoped = new Set<FactionScopedTag>();
    for (const faction of activeFactions) {
      for (const tag of FACTION_TAGS[faction] ?? []) {
        if (allDynamicTags.includes(tag)) {
          scoped.add(tag);
        }
      }
    }
    return [...scoped];
  }, [activeFactions, allDynamicTags, allTags]);

  const filteredCards = useMemo(() => {
    return baseCards.filter((card) => {
      const tagOk =
        activeTags.length === 0 ||
        activeTags.every((tag) => {
          if (tag === 'Factory Reset' || tag === 'factoryReset') {
            return card.keywords.some((k) => k.type === 'FactoryReset');
          }
          if (tag === 'dragon') return card.faction === 'cyberpunk' && card.id.includes('dragon');
          if (tag === 'tiger') return card.faction === 'cyberpunk' && card.id.includes('tiger');
          if (tag === 'bird') return card.faction === 'cyberpunk' && card.id.includes('bird');
          if (tag === 'turtle') return card.faction === 'cyberpunk' && card.id.includes('tortoise');
          if (tag === 'junk') return card.faction === 'scavengers' && card.tags.includes('Junk');
          if (tag === 'Prime' || tag === 'prime') return hasPrimeMarker(card);
          if (tag === 'Sequence' || tag === 'sequence') {
            return hasSequenceMarker(card);
          }
          return card.tags.includes(tag);
        });
      const factionOk =
        activeFactions.length === 0 || activeFactions.includes(card.faction.toUpperCase());
      const awakeningOk = activeAwakening.length === 0 || activeAwakening.includes(card.awakeningMin);
      return tagOk && factionOk && awakeningOk;
    });
  }, [baseCards, activeTags, activeFactions, activeAwakening]);

  useEffect(() => {
    setActiveTags((prev) => prev.filter((tag) => visibleTags.includes(tag)));
  }, [visibleTags]);

  const hoverFamilyCards = useMemo(() => {
    if (!hover) {
      return [] as ForgeCard[];
    }
    const family = hover.card.id.replace(/_t\d+$/, '');
    return cardsByFamily.get(family) ?? [hover.card];
  }, [cardsByFamily, hover]);
  const effectiveHoverIndex = Math.max(0, Math.min(hoverTierIndex, hoverFamilyCards.length - 1));
  const effectiveHoverCard = hoverFamilyCards[effectiveHoverIndex] ?? hover?.card ?? null;

  useEffect(() => {
    if (!hover) {
      return undefined;
    }
    if (isHoveringCard || isHoveringPopover) {
      return undefined;
    }
    const timeoutMs = 5000;
    const id = window.setTimeout(() => {
      setHover(null);
      setHoverPinnedPosition(false);
    }, timeoutMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [hover, hoverPinnedPosition, isHoveringCard, isHoveringPopover]);

  useEffect(() => {
    if (!hover || !isHoveringCard || hoverPinnedPosition) {
      return undefined;
    }
    const targetCardId = hover.card.id;
    const timer = window.setTimeout(() => {
      setHover((prev) => {
        if (!prev || prev.card.id !== targetCardId) {
          return prev;
        }
        /* Freeze coordinates so the popover stays put for scrolling tags. */
        return { ...prev, x: prev.x, y: prev.y, clientX: prev.clientX, clientY: prev.clientY };
      });
      setHoverPinnedPosition(true);
    }, 2000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [hover, isHoveringCard, hoverPinnedPosition]);

  const toggleTag = (tag: CompendiumTag) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };
  const toggleFaction = (faction: string) => {
    setActiveFactions((prev) =>
      prev.includes(faction) ? prev.filter((f) => f !== faction) : [...prev, faction],
    );
  };
  const toggleAwakening = (awakening: number) => {
    setActiveAwakening((prev) =>
      prev.includes(awakening) ? prev.filter((a) => a !== awakening) : [...prev, awakening],
    );
  };

  const setHoverCardAt = (card: ForgeCard | null, ev?: { clientX: number; clientY: number }) => {
    if (!card || !ev) {
      setIsHoveringCard(false);
      return;
    }
    setIsHoveringCard(true);
    const isSameCard = hover?.card.id === card.id;
    const family = card.id.replace(/_t\d+$/, '');
    const familyCards = cardsByFamily.get(family) ?? [card];
    const idx = Math.max(
      0,
      familyCards.findIndex((c) => c.id === card.id),
    );
    if (!isSameCard) {
      setHoverTierIndex(idx);
      setHoverPinnedPosition(false);
      setHover({ card, x: ev.clientX, y: ev.clientY, clientX: ev.clientX, clientY: ev.clientY });
      return;
    }
    if (!hoverPinnedPosition) {
      setHover({ card, x: ev.clientX, y: ev.clientY, clientX: ev.clientX, clientY: ev.clientY });
    }
  };

  return (
    <div className="forge-poc forge-poc--scavengers">
      <div className="forge-poc__bg" />
      <div className="forge-poc__scanlines" />
      <div className="forge-poc__vignette" />

      <header className="forge-poc__topbar">
        <div className="forge-poc__brand">
          <div className="forge-poc__brand-glyph">◆</div>
          <div className="forge-poc__brand-text">
            <span className="forge-poc__brand-title">
              CARD <span className="accent">COMPENDIUM</span>
            </span>
            <span className="forge-poc__brand-sub">{'//'} FILTER BY TAGS · HOVER TO INSPECT</span>
          </div>
        </div>
        <div className="forge-poc__hud">
          <div className="forge-poc__hud-item forge-poc__hud-item--accent">
            <span className="forge-poc__hud-label">VISIBLE</span>
            <span className="forge-poc__hud-value">{filteredCards.length}</span>
          </div>
          <div className="forge-poc__hud-item">
            <span className="forge-poc__hud-label">TOTAL</span>
            <span className="forge-poc__hud-value">{baseCards.length}</span>
          </div>
        </div>
        <div className="forge-poc__top-actions">
          <button className="forge-poc__btn forge-poc__btn--exit" type="button" onClick={onExit}>
            ✕
          </button>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 8, padding: '8px 24px 0' }}>
        <div className="forge-poc__section-head">
          <span className="forge-poc__section-eyebrow">{'//'} TAG FILTERS</span>
          <span className="forge-poc__section-sub">
            {activeTags.length + activeFactions.length + activeAwakening.length > 0
              ? `${String(activeTags.length + activeFactions.length + activeAwakening.length)} active`
              : 'No filters'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 8 }}>
          <div style={{ border: '1px solid rgba(224,138,58,0.35)', padding: 10, background: 'rgba(8,12,20,0.7)' }}>
            <div style={{ marginBottom: 8, color: '#e08a3a', fontSize: 11, letterSpacing: '0.2em' }}>FACTION</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allFactions.map((faction) => {
                const active = activeFactions.includes(faction);
                return (
                  <button
                    key={faction}
                    type="button"
                    className={`forge-poc__btn ${active ? 'forge-poc__btn--primary' : 'forge-poc__btn--ghost'}`}
                    onClick={() => {
                      toggleFaction(faction);
                    }}
                  >
                    {faction}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ border: '1px solid rgba(224,138,58,0.35)', padding: 10, background: 'rgba(8,12,20,0.7)' }}>
            <div style={{ marginBottom: 8, color: '#e08a3a', fontSize: 11, letterSpacing: '0.2em' }}>AWAKENING</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allAwakening.map((awakening) => {
                const active = activeAwakening.includes(awakening);
                return (
                  <button
                    key={awakening}
                    type="button"
                    className={`forge-poc__btn ${active ? 'forge-poc__btn--primary' : 'forge-poc__btn--ghost'}`}
                    onClick={() => {
                      toggleAwakening(awakening);
                    }}
                  >
                    AWAKENING {awakening + 1}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ border: '1px solid rgba(224,138,58,0.35)', padding: 10, background: 'rgba(8,12,20,0.7)' }}>
            <div style={{ marginBottom: 8, color: '#e08a3a', fontSize: 11, letterSpacing: '0.2em' }}>TAGS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {visibleTags.map((tag) => {
                const active = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`forge-poc__btn ${active ? 'forge-poc__btn--primary' : 'forge-poc__btn--ghost'}`}
                    onClick={() => {
                      toggleTag(tag);
                    }}
                  >
                    {formatCompendiumTagLabel(tag)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          {activeTags.length + activeFactions.length + activeAwakening.length > 0 ? (
            <button
              type="button"
              className="forge-poc__btn forge-poc__btn--ghost"
              onClick={() => {
                setActiveTags([]);
                setActiveFactions([]);
                setActiveAwakening([]);
              }}
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      </div>

      <main className="forge-poc__grid" style={{ gridTemplateColumns: '1fr' }}>
        <section className="forge-poc__center">
          <div className="forge-poc__library">
            {filteredCards.map((card, idx) => (
              <LibraryCard
                key={`${card.id}-${String(idx)}`}
                card={card}
                isDragging={false}
                onHover={setHoverCardAt}
                onAssign={() => {}}
                onDragStart={(e) => {
                  e.preventDefault();
                }}
                onDragEnd={() => {}}
              />
            ))}
          </div>
        </section>
      </main>

      {hover && effectiveHoverCard ? (
        <div
          onMouseEnter={() => {
            setIsHoveringPopover(true);
          }}
          onMouseLeave={() => {
            setIsHoveringPopover(false);
          }}
        >
          <CardHoverPopover
            hover={{
              card: effectiveHoverCard,
              x: hover.x,
              y: hover.y,
              clientX: hover.clientX,
              clientY: hover.clientY,
            }}
            canPrevTier={effectiveHoverIndex > 0}
            canNextTier={effectiveHoverIndex < hoverFamilyCards.length - 1}
            onPrevTier={() => {
              setHoverTierIndex((i) => Math.max(0, i - 1));
            }}
            onNextTier={() => {
              setHoverTierIndex((i) => Math.min(hoverFamilyCards.length - 1, i + 1));
            }}
            onClose={() => {
              setHover(null);
              setIsHoveringPopover(false);
              setIsHoveringCard(false);
              setHoverPinnedPosition(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

