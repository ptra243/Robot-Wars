import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CardContentService } from '../../core/content';
import { getPilotById, getPilotMechSpriteUrl, getPilotPortraitUrl } from '../../core/pilots';
import type { CombatFighterSnapshot, CombatResult } from '../../core/types';
import { buildCardDescription } from '../../ui/cardText';
import { cardArtUrlFromDef } from './forge/forgeCardModel';
import './battle-poc.css';

type Speed = 1 | 2 | 4;

interface BattlePOCProps {
  onExit: () => void;
  combatResult?: CombatResult | null;
  seed?: number;
  /** Run pilot id (`run.spirit.id`); selects player mech art. Defaults to glint. */
  pilotId?: string;
  /** When provided, a "RUN NEW" button appears in the topbar to re-simulate. */
  onRunEncounter?: () => void;
  /** Victory: takes player to the reward screen to pick a card + collect gold. */
  onContinue?: () => void;
  /** Defeat: apply -10% enemy HP assist and return to forge. */
  onRetryHpDown?: () => void;
  /** Defeat: apply +3 free rerolls assist and return to forge. */
  onRetryRerolls?: () => void;
  /** When set with `onReplaySpeedChange`, speed is persisted (e.g. per run). */
  replaySpeed?: Speed;
  onReplaySpeedChange?: (s: Speed) => void;
}

interface BattleCard {
  id: string;
  name: string;
  cost: number;
  atk: number;
  /** Shield value when this is primarily a Shield card. */
  def?: number;
  text: string;
  art: string;
  /** Visual row in expanded chip: Strike (ATK) vs Shield (DEF). */
  statKind: 'strike' | 'shield' | 'other';
  /** If true, this card is hidden from the viewer (fog-of-war preview). */
  fog?: boolean;
}

/**
 * Battle phase machine. The scripted POC cycles through these in order,
 * alternating between player and enemy. Durations are tuned in
 * PHASE_DURATIONS below; `speedScale` state divides them.
 */
type Phase =
  | 'intro'
  | 'player-reveal'
  | 'player-strike'
  | 'player-recover'
  | 'enemy-reveal'
  | 'enemy-strike'
  | 'enemy-recover'
  | 'victory'
  | 'defeat';

/**
 * Arena stage preset.
 * - `alley` — `poc-bg-alley-dusk.png` (clean dusk alley + platform, no UI baked in).
 * - `market` — high-noon duel strip illustration (`poc-bg-duel-market.png`): stalls, saloon, crowd.
 * - `neon` — saturated cyber plaza (`poc-bg-battlefield`).
 */
type Stage = 'alley' | 'market' | 'neon';

const DECK_SIZE = 9;
const PLAYER_MAX_HP = 50;
const ENEMY_MAX_HP = 50;
const ATTACK_DAMAGE = 6;
/** Visual cap for energy / shield bar fill (combat has no hard energy max). */
const ENERGY_BAR_CAP = 12;
const SHIELD_BAR_CAP = 40;

const PHASE_DURATIONS: Record<Phase, number> = {
  intro: 900,
  'player-reveal': 650,
  'player-strike': 520,
  'player-recover': 360,
  'enemy-reveal': 650,
  'enemy-strike': 520,
  'enemy-recover': 360,
  victory: 0,
  defeat: 0,
};

const makeDeck = (prefix: string, fogLast: boolean): BattleCard[] =>
  Array.from({ length: DECK_SIZE }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    name: 'Basic Attack',
    cost: 1,
    atk: ATTACK_DAMAGE,
    text: `Deal ${ATTACK_DAMAGE} damage.`,
    art: '/poc/poc-card-attack.png',
    statKind: 'strike' as const,
    fog: fogLast && i === DECK_SIZE - 1,
  }));

function buffChipsFromSnapshot(s: CombatFighterSnapshot): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (s.potency > 0) out.push({ key: 'pot', label: `POT +${String(s.potency)}` });
  if (s.bulkStacks > 0) out.push({ key: 'bulk', label: `BULK ${String(s.bulkStacks)}` });
  if (s.coreScrap > 0) out.push({ key: 'core', label: `CORE ${String(s.coreScrap)}` });
  if (s.junk > 0) out.push({ key: 'junk', label: `JNK ${String(s.junk)}` });
  return out;
}

function debuffChipsFromSnapshot(s: CombatFighterSnapshot): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (s.exposeDamage > 0) {
    out.push({ key: 'exp', label: `EXPOSE +${String(s.exposeDamage)}` });
  }
  if (s.stunnedTurnsLeft != null && s.stunnedTurnsLeft > 0) {
    out.push({ key: 'stun', label: `STUN ${String(s.stunnedTurnsLeft)}` });
  }
  return out;
}

const isPlayerPhase = (p: Phase): boolean =>
  p === 'player-reveal' || p === 'player-strike' || p === 'player-recover';
const isEnemyPhase = (p: Phase): boolean =>
  p === 'enemy-reveal' || p === 'enemy-strike' || p === 'enemy-recover';

function battleCardFromId(id: string, content: CardContentService): BattleCard {
  try {
    const card = content.get(id);
    const hasStrike = card.tags.includes('Strike');
    const hasShield = card.tags.includes('Shield');
    const statKind: BattleCard['statKind'] =
      hasShield && !hasStrike ? 'shield' : hasStrike ? 'strike' : 'other';
    const atkV = card.base_damage > 0 ? card.base_damage : 0;
    const defV = card.base_block > 0 ? card.base_block : 0;
    const primary = statKind === 'shield' ? defV || atkV : atkV || defV;
    return {
      id,
      name: card.name,
      cost: card.charge_cost,
      atk: primary,
      def: statKind === 'shield' && defV > 0 ? defV : undefined,
      text: buildCardDescription(card, { omitTagsAndKeywords: true }),
      art: cardArtUrlFromDef(card),
      statKind,
    };
  } catch {
    return {
      id,
      name: id,
      cost: 1,
      atk: ATTACK_DAMAGE,
      text: `Deal ${ATTACK_DAMAGE} damage.`,
      art: '/poc/poc-card-attack.png',
      statKind: 'strike',
    };
  }
}

export function BattlePOC({
  onExit,
  combatResult,
  seed = 1,
  onRunEncounter,
  onContinue,
  onRetryHpDown,
  onRetryRerolls,
  pilotId = 'glint',
  replaySpeed,
  onReplaySpeedChange,
}: BattlePOCProps) {
  const pilot = getPilotById(pilotId);
  const playerMechSrc = getPilotMechSpriteUrl(pilotId);
  const playerPortrait = getPilotPortraitUrl(pilotId);
  const playerHudName = (pilot?.name ?? 'Glint').toUpperCase();
  const replayContent = useMemo(() => CardContentService.loadDefault(seed), [seed]);
  const replayEvents = combatResult?.events ?? [];
  const hasReplay = replayEvents.length > 0;
  const playerDeck = useMemo(() => makeDeck('p', false), []);
  const enemyDeck = useMemo(() => makeDeck('e', true), []);

  const [phase, setPhase] = useState<Phase>('intro');
  const [turnIndex, setTurnIndex] = useState(0);
  const [playerHP, setPlayerHP] = useState(PLAYER_MAX_HP);
  const [enemyHP, setEnemyHP] = useState(ENEMY_MAX_HP);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(replaySpeed ?? 1);
  const [stage, setStage] = useState<Stage>('market');
  const [replayStep, setReplayStep] = useState(-1);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisSide, setAnalysisSide] = useState<'player' | 'enemy'>('player');

  useEffect(() => {
    if (replaySpeed !== undefined) {
      setSpeed(replaySpeed);
    }
  }, [replaySpeed]);

  const handleSpeedChange = (s: Speed) => {
    setSpeed(s);
    onReplaySpeedChange?.(s);
  };

  const resetBattle = () => {
    if (hasReplay) {
      setReplayStep(-1);
      setPaused(false);
      return;
    }
    setPhase('intro');
    setTurnIndex(0);
    setPlayerHP(PLAYER_MAX_HP);
    setEnemyHP(ENEMY_MAX_HP);
    setPaused(false);
  };

  useEffect(() => {
    if (hasReplay) {
      return undefined;
    }
    if (paused) return undefined;
    if (phase === 'victory' || phase === 'defeat') return undefined;

    const duration = PHASE_DURATIONS[phase] / speed;
    const timer = window.setTimeout(() => {
      if (phase === 'player-strike') {
        const next = Math.max(0, enemyHP - ATTACK_DAMAGE);
        setEnemyHP(next);
        setPhase(next <= 0 ? 'victory' : 'player-recover');
        return;
      }
      if (phase === 'enemy-strike') {
        const next = Math.max(0, playerHP - ATTACK_DAMAGE);
        setPlayerHP(next);
        setPhase(next <= 0 ? 'defeat' : 'enemy-recover');
        return;
      }
      if (phase === 'enemy-recover') {
        const nextTurn = turnIndex + 1;
        if (nextTurn >= DECK_SIZE) {
          // Deck exhausted without KO — in a real run we'd loop the deck;
          // for this scripted POC we end the engagement as a tie winner.
          setPhase(playerHP >= enemyHP ? 'victory' : 'defeat');
          return;
        }
        setTurnIndex(nextTurn);
        setPhase('player-reveal');
        return;
      }
      switch (phase) {
        case 'intro':
          setPhase('player-reveal');
          break;
        case 'player-reveal':
          setPhase('player-strike');
          break;
        case 'player-recover':
          setPhase('enemy-reveal');
          break;
        case 'enemy-reveal':
          setPhase('enemy-strike');
          break;
        default:
          break;
      }
    }, duration);

    return () => window.clearTimeout(timer);
  }, [phase, paused, playerHP, enemyHP, turnIndex, speed]);

  useEffect(() => {
    if (!hasReplay || paused) {
      return undefined;
    }
    if (replayStep >= replayEvents.length - 1) {
      return undefined;
    }
    const duration = 450 / speed;
    const timer = window.setTimeout(() => {
      setReplayStep((step) => Math.min(step + 1, replayEvents.length - 1));
    }, duration);
    return () => window.clearTimeout(timer);
  }, [hasReplay, paused, replayStep, replayEvents.length, speed]);

  const replaySnapshot =
    replayStep >= 0
      ? replayEvents[Math.min(replayStep, replayEvents.length - 1)]?.snapshot
      : combatResult?.initialSnapshot;
  const rp = replaySnapshot?.player;
  const re = replaySnapshot?.enemy;
  const activeEvent = replayStep >= 0 ? replayEvents[replayStep] : undefined;
  const replayDone = hasReplay && replayStep >= replayEvents.length - 1;
  const replayPlayerDeck = useMemo(() => {
    const ids =
      combatResult?.initialSnapshot.playerQueue?.map((id) => id ?? 'neutral_basic_strike_t1') ??
      Array.from({ length: DECK_SIZE }, () => 'neutral_basic_strike_t1');
    return ids.map((id, i) => ({ ...battleCardFromId(id, replayContent), id: `rp-${String(i)}-${id}` }));
  }, [combatResult?.initialSnapshot.playerQueue, replayContent]);
  const replayEnemyDeck = useMemo(() => {
    const ids =
      combatResult?.initialSnapshot.enemyQueue?.map((id) => id ?? 'neutral_basic_strike_t1') ??
      combatResult?.enemyDeckUsed ??
      Array.from({ length: DECK_SIZE }, () => 'neutral_basic_strike_t1');
    return ids.slice(0, DECK_SIZE).map((id, i) => ({
      ...battleCardFromId(id, replayContent),
      id: `re-${String(i)}-${id}`,
      fog: i === DECK_SIZE - 1,
    }));
  }, [combatResult?.enemyDeckUsed, combatResult?.initialSnapshot.enemyQueue, replayContent]);
  const uiPlayerDeck = hasReplay ? replayPlayerDeck : playerDeck;
  const uiEnemyDeck = hasReplay ? replayEnemyDeck : enemyDeck;
  // Real deck size comes from the initial queue snapshot; fall back to the
  // POC constant when running the scripted demo (no combat result).
  const uiDeckSize = hasReplay
    ? (combatResult?.initialSnapshot.playerQueue?.length ?? DECK_SIZE)
    : DECK_SIZE;
  // Use playerQueueCursor (accurate 0-based slot index) instead of roundIndex-1
  // so the highlighted card is always the one that actually resolved.
  const uiTurnIndex = hasReplay
    ? Math.max(0, Math.min(uiDeckSize - 1, replaySnapshot?.playerQueueCursor ?? 0))
    : turnIndex;
  // Real starting HP from the initial combat snapshot (game uses 40, not 50).
  const uiPlayerMaxHp = hasReplay
    ? (combatResult?.initialSnapshot.player.hp ?? PLAYER_MAX_HP)
    : PLAYER_MAX_HP;
  const uiEnemyMaxHp = hasReplay
    ? (combatResult?.initialSnapshot.enemy.hp ?? ENEMY_MAX_HP)
    : ENEMY_MAX_HP;
  const uiPlayerHp = hasReplay ? (replaySnapshot?.player.hp ?? uiPlayerMaxHp) : playerHP;
  const uiEnemyHp = hasReplay ? (replaySnapshot?.enemy.hp ?? uiEnemyMaxHp) : enemyHP;
  const activePlayerCard =
    uiPlayerDeck[uiTurnIndex] ?? battleCardFromId('neutral_basic_strike_t1', replayContent);
  const replayPhase: Phase =
    replayDone && combatResult
      ? combatResult.playerWon
        ? 'victory'
        : 'defeat'
      : activeEvent?.actor === 'Player'
        ? activeEvent.type === 'resolve'
          ? 'player-strike'
          : 'player-reveal'
        : activeEvent?.actor === 'Enemy'
          ? activeEvent.type === 'resolve'
            ? 'enemy-strike'
            : 'enemy-reveal'
          : 'intro';
  const uiPhase = hasReplay ? replayPhase : phase;

  // Fog cards are revealed (fog cleared) once the enemy has actually played
  // them (enemy-strike phase or later). This lets the player see what was
  // hidden after the fact without spoiling it before the card resolves.
  const uiEnemyDeckRevealed = useMemo(
    () =>
      uiEnemyDeck.map((card, i) => {
        if (!card.fog) return card;
        const played =
          uiTurnIndex > i ||
          (uiTurnIndex === i &&
            (uiPhase === 'enemy-strike' ||
              uiPhase === 'enemy-recover' ||
              uiPhase === 'victory' ||
              uiPhase === 'defeat'));
        return played ? { ...card, fog: false } : card;
      }),
    [uiEnemyDeck, uiTurnIndex, uiPhase],
  );

  const activeEnemyCard =
    uiEnemyDeckRevealed[uiTurnIndex] ?? battleCardFromId('neutral_basic_strike_t1', replayContent);

  const statusText = useMemo(() => {
    if (hasReplay) {
      if (replayDone && combatResult) {
        return combatResult.playerWon ? 'VICTORY — Enemy core offline' : 'DEFEAT — Reactor critical';
      }
      return activeEvent?.text ?? 'BATTLE COMMENCE — replaying simulation';
    }
    switch (phase) {
      case 'intro':
        return `BATTLE COMMENCE — ${playerHudName} has priority`;
      case 'player-reveal':
        return `${playerHudName} reveals ${playerDeck[turnIndex].name}`;
      case 'player-strike':
        return `${playerHudName} strikes — ${ATTACK_DAMAGE} damage`;
      case 'player-recover':
        return `${playerHudName} resolves`;
      case 'enemy-reveal': {
        const card = enemyDeck[turnIndex];
        return card.fog
          ? `ARES-01 reveals UNKNOWN instruction`
          : `ARES-01 reveals ${card.name}`;
      }
      case 'enemy-strike':
        return `ARES-01 strikes — ${ATTACK_DAMAGE} damage`;
      case 'enemy-recover':
        return `ARES-01 resolves`;
      case 'victory':
        return 'VICTORY — Enemy core offline';
      case 'defeat':
        return 'DEFEAT — Reactor critical';
      default:
        return '';
    }
  }, [
    hasReplay,
    replayDone,
    combatResult,
    activeEvent,
    phase,
    turnIndex,
    playerDeck,
    enemyDeck,
    playerHudName,
  ]);

  const analysisSeries = useMemo(() => {
    if (!combatResult) {
      return { player: [] as Array<{ x: number; y: number }>, enemy: [] as Array<{ x: number; y: number }> };
    }
    const initialPlayerHp = combatResult.initialSnapshot.player.hp;
    const initialEnemyHp = combatResult.initialSnapshot.enemy.hp;
    const points = replayEvents
      .map((ev, idx) => {
        if (!ev.snapshot) return null;
        return {
          idx,
          playerHp: ev.snapshot.player.hp,
          enemyHp: ev.snapshot.enemy.hp,
        };
      })
      .filter((p): p is { idx: number; playerHp: number; enemyHp: number } => p !== null);
    const player = points.map((p) => ({ x: p.idx + 1, y: Math.max(0, initialPlayerHp - p.playerHp) }));
    const enemy = points.map((p) => ({ x: p.idx + 1, y: Math.max(0, initialEnemyHp - p.enemyHp) }));
    return { player, enemy };
  }, [combatResult, replayEvents]);

  return (
    <div
      className={`battle-poc battle-poc--scavengers battle-poc--stage-${stage}`}
      role="dialog"
      aria-label="Battle UI preview"
    >
      {/* SVG chroma-key filters for the mech sprites. Both follow the same
          pipeline:
           1. feColorMatrix knocks out pure-white sprite background while
              keeping black armor intact (mix-blend-mode: multiply can't do
              this without eating dark pixels).
           2. feMorphology dilates the keyed silhouette outward by a few px.
           3. feFlood + feComposite(in) stamps that dilated silhouette in a
              stage-appropriate ink tone.
           4. feMerge lays the keyed mech on top of the outline.
          Variants tuned per stage:
           - bp-knockout-alley: soft dusk outline vs the alley plate.
           - bp-knockout-neon: thick near-black outline vs the neon plaza.
           - bp-knockout-market: warm dust-brown outline vs high-noon dirt.
          Filter box is enlarged so the outline renders past source bounds. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <filter
            id="bp-knockout-alley"
            colorInterpolationFilters="sRGB"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1 -1 -1 2.2 0"
              result="keyed"
            />
            <feMorphology in="keyed" operator="dilate" radius="2.2" result="dilated" />
            <feFlood floodColor="#2a2228" result="ink" />
            <feComposite in="ink" in2="dilated" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="keyed" />
            </feMerge>
          </filter>
          <filter
            id="bp-knockout-neon"
            colorInterpolationFilters="sRGB"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1 -1 -1 2.2 0"
              result="keyed"
            />
            <feMorphology in="keyed" operator="dilate" radius="2.5" result="dilated" />
            <feFlood floodColor="#070709" result="ink" />
            <feComposite in="ink" in2="dilated" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="keyed" />
            </feMerge>
          </filter>
          <filter
            id="bp-knockout-market"
            colorInterpolationFilters="sRGB"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1 -1 -1 2.2 0"
              result="keyed"
            />
            <feMorphology in="keyed" operator="dilate" radius="1.6" result="dilated" />
            <feFlood floodColor="#3d2e26" result="ink" />
            <feComposite in="ink" in2="dilated" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="keyed" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div className="battle-poc__bg" />
      <div className="battle-poc__scrim" />

      {/* Enemy deck: top strip — topbar chrome is baked in as topChrome */}
      <DeckStrip
        cards={uiEnemyDeckRevealed}
        activeIndex={uiTurnIndex}
        active={isEnemyPhase(uiPhase)}
        side="enemy"
        phase={uiPhase}
        topChrome={
          <header className="battle-poc__topbar">
            <div className="battle-poc__topbar-brand">
              <span className="battle-poc__topbar-mark">◆</span>
              <span className="battle-poc__topbar-title">COMBAT · ACT I · RUN 001</span>
            </div>
            <div className="battle-poc__topbar-turn">
              ROUND <strong>{uiTurnIndex + 1}</strong> / {uiDeckSize}
            </div>
            <div className="battle-poc__topbar-controls">
              <StageControl value={stage} onChange={setStage} />
              <SpeedControl value={speed} onChange={handleSpeedChange} />
              <button
                type="button"
                className="battle-poc__ctrl"
                onClick={() => {
                  setPaused((p) => !p);
                }}
              >
                {paused ? '▶ PLAY' : '❚❚ PAUSE'}
              </button>
              <button type="button" className="battle-poc__ctrl" onClick={resetBattle}>
                ↻ RESTART
              </button>
              {onRunEncounter ? (
                <button type="button" className="battle-poc__ctrl" onClick={onRunEncounter}>
                  ⟳ RUN NEW
                </button>
              ) : null}
              <button type="button" className="battle-poc__ctrl battle-poc__ctrl--exit" onClick={onExit}>
                ✕ EXIT
              </button>
            </div>
          </header>
        }
      />

      <main className="battle-poc__stage">
        {hasReplay && replaySnapshot?.fatigueArmed ? (
          <div
            className="battle-poc__fatigue-panel"
            role="status"
            aria-live="polite"
            title="Thermal runaway: each stack tick deals escalating damage to both fighters."
          >
            <span className="battle-poc__fatigue-panel-label">FATIGUE</span>
            <span className="battle-poc__fatigue-panel-stack" aria-label="Fatigue stacks">
              {String(replaySnapshot.fatigueRoundsElapsed ?? 0)}
            </span>
          </div>
        ) : null}
        {stage === 'market' ? <div className="battle-poc__ground" aria-hidden /> : null}
        {/* Pilot HUDs overlay the stage corners */}
        <PilotHUD
          side="left"
          name={playerHudName}
          subtitle="SCAVENGER · AWAKENING 1"
          portrait={playerPortrait}
          hp={uiPlayerHp}
          maxHp={uiPlayerMaxHp}
          active={isPlayerPhase(uiPhase)}
          taking={uiPhase === 'enemy-strike'}
          theme="ally"
          energy={hasReplay && rp ? rp.charge : undefined}
          energyCap={ENERGY_BAR_CAP}
          shield={hasReplay && rp ? rp.block : undefined}
          shieldCap={SHIELD_BAR_CAP}
        />
        <div className="battle-poc__vs">
          <span>VS</span>
        </div>
        <PilotHUD
          side="right"
          name="ARES-01"
          subtitle="CORPORATE · AEGIS STRIKE"
          portrait="/poc/poc-pilot-enemy.png"
          hp={uiEnemyHp}
          maxHp={uiEnemyMaxHp}
          active={isEnemyPhase(uiPhase)}
          taking={uiPhase === 'player-strike'}
          theme="enemy"
          energy={hasReplay && re ? re.charge : undefined}
          energyCap={ENERGY_BAR_CAP}
          shield={hasReplay && re ? re.block : undefined}
          shieldCap={SHIELD_BAR_CAP}
        />

        {/* Mechs — independently positioned sprites on top of shared bg */}
        <div
          className={[
            'battle-poc__mech',
            'battle-poc__mech--player',
            `battle-poc__mech--${uiPhase}`,
            uiPhase === 'enemy-strike' ? 'battle-poc__mech--hurt' : '',
          ].join(' ')}
        >
          {hasReplay && rp ? (
            <AuraChipRow variant="buff" chips={buffChipsFromSnapshot(rp)} a11y="Player buffs" />
          ) : null}
          <img src={playerMechSrc} alt={pilot ? `${pilot.name}'s mech` : "Player mech"} />
          {hasReplay && rp ? (
            <AuraChipRow variant="debuff" chips={debuffChipsFromSnapshot(rp)} a11y="Player debuffs" />
          ) : null}
        </div>
        <div
          className={[
            'battle-poc__mech',
            'battle-poc__mech--enemy',
            `battle-poc__mech--${uiPhase}`,
            uiPhase === 'player-strike' ? 'battle-poc__mech--hurt' : '',
          ].join(' ')}
        >
          {hasReplay && re ? (
            <AuraChipRow variant="buff" chips={buffChipsFromSnapshot(re)} a11y="Enemy buffs" />
          ) : null}
          <img src="/poc/poc-mech-enemy-sprite.png" alt="Enemy mech" />
          {hasReplay && re ? (
            <AuraChipRow variant="debuff" chips={debuffChipsFromSnapshot(re)} a11y="Enemy debuffs" />
          ) : null}
        </div>

        {/* Active card is no longer a floating panel — the relevant chip in
            each DeckStrip expands in-place into a full card during its own
            reveal/strike phases. See DeckStrip + .battle-poc__chip--expanded. */}

        {/* FX overlays */}
        {uiPhase === 'player-strike' ? (
          <DamagePop side="right" amount={hasReplay ? activePlayerCard.atk ?? ATTACK_DAMAGE : ATTACK_DAMAGE} />
        ) : null}
        {uiPhase === 'enemy-strike' ? <DamagePop side="left" amount={hasReplay ? activeEnemyCard.atk ?? ATTACK_DAMAGE : ATTACK_DAMAGE} /> : null}

        {uiPhase === 'player-strike' ? <TracerBolt direction="rightward" /> : null}
        {uiPhase === 'enemy-strike' ? <TracerBolt direction="leftward" /> : null}
      </main>

      {/* Player deck: bottom strip — statusbar chrome is baked in as bottomChrome */}
      <DeckStrip
        cards={uiPlayerDeck}
        activeIndex={uiTurnIndex}
        active={isPlayerPhase(uiPhase)}
        side="player"
        phase={uiPhase}
        bottomChrome={
          <footer className="battle-poc__statusbar">
            <div className="battle-poc__status-marker" />
            <div className="battle-poc__status-text">{statusText}</div>
            <div className="battle-poc__status-hint">
              {hasReplay
                ? `REPLAY · event ${String(replayStep + 1)} / ${String(replayEvents.length)}`
                : 'POC · auto-plays · both decks: 9× Basic Attack · enemy card 9 hidden'}
            </div>
          </footer>
        }
      />

      {uiPhase === 'victory' ? (
        <ResultBanner
          kind="victory"
          onAgain={resetBattle}
          onContinue={onContinue}
          onOpenAnalysis={hasReplay ? () => setAnalysisOpen(true) : undefined}
        />
      ) : null}
      {uiPhase === 'defeat' ? (
        <ResultBanner
          kind="defeat"
          pilotFirstName={pilot?.name ?? 'Pilot'}
          onAgain={resetBattle}
          onRetryHpDown={onRetryHpDown}
          onRetryRerolls={onRetryRerolls}
          onOpenAnalysis={hasReplay ? () => setAnalysisOpen(true) : undefined}
        />
      ) : null}
      {analysisOpen ? (
        <BattleAnalysisModal
          selected={analysisSide}
          onSelect={setAnalysisSide}
          onClose={() => setAnalysisOpen(false)}
          playerSeries={analysisSeries.player}
          enemySeries={analysisSeries.enemy}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Speed selector (1x / 2x / 4x segmented)                                     */
/* -------------------------------------------------------------------------- */

function SpeedControl({ value, onChange }: { value: Speed; onChange: (s: Speed) => void }) {
  const options: Speed[] = [1, 2, 4];
  return (
    <div className="battle-poc__speed" role="group" aria-label="Battle speed">
      <span className="battle-poc__speed-label">SPEED</span>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={[
            'battle-poc__speed-btn',
            value === opt ? 'battle-poc__speed-btn--active' : '',
          ].join(' ')}
          onClick={() => {
            onChange(opt);
          }}
          aria-pressed={value === opt}
        >
          {opt}×
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stage selector (alley / duel strip / neon)                                  */
/* -------------------------------------------------------------------------- */

function StageControl({ value, onChange }: { value: Stage; onChange: (s: Stage) => void }) {
  const options: { id: Stage; label: string }[] = [
    { id: 'alley', label: 'ALLEY' },
    { id: 'market', label: 'DUEL' },
    { id: 'neon', label: 'NEON' },
  ];
  return (
    <div className="battle-poc__speed" role="group" aria-label="Arena stage">
      <span className="battle-poc__speed-label">STAGE</span>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={[
            'battle-poc__speed-btn',
            value === opt.id ? 'battle-poc__speed-btn--active' : '',
          ].join(' ')}
          onClick={() => {
            onChange(opt.id);
          }}
          aria-pressed={value === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mech aura chips (replay)                                                    */
/* -------------------------------------------------------------------------- */

function AuraChipRow({
  variant,
  chips,
  a11y,
}: {
  variant: 'buff' | 'debuff';
  chips: { key: string; label: string }[];
  a11y: string;
}) {
  if (chips.length === 0) {
    return null;
  }
  return (
    <div
      className={`battle-poc__aura-row battle-poc__aura-row--${variant}`}
      aria-label={a11y}
    >
      {chips.map((c) => (
        <span key={`${variant}-${c.key}`} className="battle-poc__aura-chip">
          {c.label}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pilot HUD                                                                   */
/* -------------------------------------------------------------------------- */

interface PilotHUDProps {
  side: 'left' | 'right';
  name: string;
  subtitle: string;
  portrait: string;
  hp: number;
  maxHp: number;
  active: boolean;
  taking: boolean;
  theme: 'ally' | 'enemy';
  energy?: number;
  energyCap?: number;
  shield?: number;
  shieldCap?: number;
}

const HUD_PIPS = 20; // one pip per 5 % of max HP

function PilotHUD({
  side,
  name,
  subtitle,
  portrait,
  hp,
  maxHp,
  active,
  taking,
  theme,
  energy,
  energyCap,
  shield,
  shieldCap,
}: PilotHUDProps) {
  const activePips = Math.round(Math.max(0, Math.min(1, hp / maxHp)) * HUD_PIPS);
  const ec = energyCap ?? ENERGY_BAR_CAP;
  const sc = shieldCap ?? SHIELD_BAR_CAP;
  const energyPct =
    energy !== undefined ? Math.max(0, Math.min(1, energy / Math.max(ec, 1))) : null;
  const shieldPct =
    shield !== undefined ? Math.max(0, Math.min(1, shield / Math.max(sc, 1))) : null;

  return (
    <div
      className={[
        'battle-poc__hud',
        `battle-poc__hud--${side}`,
        `battle-poc__hud--${theme}`,
        active ? 'battle-poc__hud--active' : '',
        taking ? 'battle-poc__hud--taking' : '',
      ].join(' ')}
    >
      <div className="battle-poc__hud-portrait">
        <img src={portrait} alt={`${name} portrait`} />
        <div className="battle-poc__hud-portrait-frame" />
      </div>
      <div className="battle-poc__hud-body">
        <div className="battle-poc__hud-name">{name}</div>
        <div className="battle-poc__hud-subtitle">{subtitle}</div>
        {shieldPct !== null ? (
          <div className="battle-poc__res battle-poc__res--shield" title="Shield (block)">
            <span className="battle-poc__res-label">SH</span>
            <div className="battle-poc__res-track">
              <div className="battle-poc__res-fill battle-poc__res-fill--shield" style={{ width: `${String(shieldPct * 100)}%` }} />
            </div>
            <span className="battle-poc__res-num">{String(shield ?? 0)}</span>
          </div>
        ) : null}
        <div className="battle-poc__hud-pips-row">
          <div className="battle-poc__hud-pips">
            {Array.from({ length: HUD_PIPS }, (_, i) => {
              // Each pip's color is determined by its position in the HP track,
              // not the current HP fraction, so the zone boundaries are always
              // visible. Pips drain from the right (high HP) to the left (low HP).
              let state: string;
              if (i >= activePips) {
                state = 'empty';
              } else if (i <= 2) {
                state = 'red';    // 0–15 %
              } else if (i <= 9) {
                state = 'yellow'; // 15–50 %
              } else {
                state = 'green';  // 50–100 %
              }
              return <span key={i} className={`battle-poc__hud-pip battle-poc__hud-pip--${state}`} />;
            })}
          </div>
          <span className="battle-poc__hud-hp-num">
            {hp}<span className="battle-poc__hud-hp-max"> /{maxHp}</span>
          </span>
        </div>
        {energyPct !== null ? (
          <div className="battle-poc__res battle-poc__res--energy" title="Energy (charge)">
            <span className="battle-poc__res-label">EN</span>
            <div className="battle-poc__res-track">
              <div className="battle-poc__res-fill battle-poc__res-fill--energy" style={{ width: `${String(energyPct * 100)}%` }} />
            </div>
            <span className="battle-poc__res-num">{String(energy ?? 0)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Deck strip (horizontal)                                                     */
/* -------------------------------------------------------------------------- */

interface DeckStripProps {
  cards: BattleCard[];
  activeIndex: number;
  active: boolean;
  side: 'player' | 'enemy';
  phase: Phase;
  topChrome?: ReactNode;
  bottomChrome?: ReactNode;
}

function DeckStrip({ cards, activeIndex, active, side, phase, topChrome, bottomChrome }: DeckStripProps) {
  // A chip "expands" into a full card during its own side's reveal + strike
  // phases. It stays `--active` (highlighted) for the whole round so the
  // player can see which card most recently resolved, even after it has
  // shrunk back to chip size during recover.
  const expandingPhase =
    side === 'player'
      ? phase === 'player-reveal' || phase === 'player-strike'
      : phase === 'enemy-reveal' || phase === 'enemy-strike';
  return (
    <aside className={`battle-poc__strip battle-poc__strip--${side}`}>
      {topChrome}
      <div className="battle-poc__strip-label">
        <span>{side === 'player' ? 'BATTLE PROGRAM' : 'ENEMY PROGRAM'}</span>
        <span className="battle-poc__strip-counter">
          {activeIndex + 1}/{cards.length}
        </span>
      </div>
      <ol className="battle-poc__strip-list">
        {cards.map((card, i) => {
          const isActive = i === activeIndex;
          const isExpanded = isActive && active && expandingPhase;
          return (
            <li
              key={card.id}
              className={[
                'battle-poc__chip',
                `battle-poc__chip--${side}`,
                isActive ? 'battle-poc__chip--active' : '',
                isExpanded ? 'battle-poc__chip--expanded' : '',
                card.fog ? 'battle-poc__chip--fog' : '',
              ].join(' ')}
            >
              <div className="battle-poc__chip-index">{String(i + 1).padStart(2, '0')}</div>
              <div
                className="battle-poc__chip-art"
                style={{
                  backgroundImage: card.fog ? 'none' : `url(${card.art})`,
                }}
              >
                {card.fog ? <div className="battle-poc__chip-fog">?</div> : null}
              </div>
              <div className="battle-poc__chip-meta">
                <span className="battle-poc__chip-name">{card.fog ? 'UNKNOWN' : card.name}</span>
                <span className="battle-poc__chip-cost">{card.cost}</span>
              </div>
              {/* Detail body — slides open only when this chip is expanded.
                  Kept in the DOM at all times (with max-height: 0) so the
                  grow / shrink animation is smooth. */}
              <div className="battle-poc__chip-detail">
                <div className="battle-poc__chip-detail-tags">
                  {card.statKind === 'shield' ? (
                    <>
                      <span className="battle-poc__chip-detail-tag">SHIELD</span>
                      <span className="battle-poc__chip-detail-tag battle-poc__chip-detail-tag--def">
                        DEF {card.def ?? card.atk}
                      </span>
                    </>
                  ) : card.statKind === 'strike' ? (
                    <>
                      <span className="battle-poc__chip-detail-tag">STRIKE</span>
                      <span className="battle-poc__chip-detail-tag battle-poc__chip-detail-tag--atk">
                        ATK {card.atk}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="battle-poc__chip-detail-tag">CARD</span>
                      <span className="battle-poc__chip-detail-tag battle-poc__chip-detail-tag--atk">
                        ···
                      </span>
                    </>
                  )}
                </div>
                <p className="battle-poc__chip-detail-text">
                  {card.fog ? '— hidden —' : card.text}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {bottomChrome}
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* FX: floating damage number + tracer bolt                                    */
/* -------------------------------------------------------------------------- */

function DamagePop({ side, amount }: { side: 'left' | 'right'; amount: number }) {
  return (
    <div className={`battle-poc__dmg battle-poc__dmg--${side}`}>
      -{amount}
      <span className="battle-poc__dmg-label">HP</span>
    </div>
  );
}

function TracerBolt({ direction }: { direction: 'leftward' | 'rightward' }) {
  return <div className={`battle-poc__tracer battle-poc__tracer--${direction}`} />;
}

/* -------------------------------------------------------------------------- */
/* Result banner                                                               */
/* -------------------------------------------------------------------------- */

function ResultBanner({
  kind,
  pilotFirstName = 'Pilot',
  onAgain,
  onContinue,
  onRetryHpDown,
  onRetryRerolls,
  onOpenAnalysis,
}: {
  kind: 'victory' | 'defeat';
  pilotFirstName?: string;
  onAgain: () => void;
  onContinue?: () => void;
  onRetryHpDown?: () => void;
  onRetryRerolls?: () => void;
  onOpenAnalysis?: () => void;
}) {
  return (
    <div className={`battle-poc__result battle-poc__result--${kind}`}>
      <div className="battle-poc__result-inner">
        <div className="battle-poc__result-eyebrow">ENGAGEMENT COMPLETE</div>
        <div className="battle-poc__result-title">{kind === 'victory' ? 'VICTORY' : 'DEFEAT'}</div>
        <div className="battle-poc__result-sub">
          {kind === 'victory'
            ? 'ARES-01 neutralized'
            : `${pilotFirstName} is down — reroute emergency power`}
        </div>

        {kind === 'victory' && onContinue ? (
          <button type="button" className="battle-poc__result-btn battle-poc__result-btn--primary" onClick={onContinue}>
            COLLECT REWARDS →
          </button>
        ) : null}

        {kind === 'defeat' && (onRetryHpDown ?? onRetryRerolls) ? (
          <div className="battle-poc__result-retry-group">
            <div className="battle-poc__result-retry-label">CHOOSE ASSIST TO RETURN TO FORGE</div>
            {onRetryHpDown ? (
              <button
                type="button"
                className="battle-poc__result-btn battle-poc__result-btn--assist"
                onClick={onRetryHpDown}
              >
                ↓ −10% ENEMY HP
              </button>
            ) : null}
            {onRetryRerolls ? (
              <button
                type="button"
                className="battle-poc__result-btn battle-poc__result-btn--assist"
                onClick={onRetryRerolls}
              >
                ⟳ +3 FREE REROLLS
              </button>
            ) : null}
          </div>
        ) : null}

        {onOpenAnalysis ? (
          <button type="button" className="battle-poc__result-btn battle-poc__result-btn--assist" onClick={onOpenAnalysis}>
            ANALYZE BATTLE
          </button>
        ) : null}

        <button type="button" className="battle-poc__result-btn battle-poc__result-btn--secondary" onClick={onAgain}>
          ↻ REPLAY ENGAGEMENT
        </button>
      </div>
    </div>
  );
}

function BattleAnalysisModal({
  selected,
  onSelect,
  onClose,
  playerSeries,
  enemySeries,
}: {
  selected: 'player' | 'enemy';
  onSelect: (s: 'player' | 'enemy') => void;
  onClose: () => void;
  playerSeries: Array<{ x: number; y: number }>;
  enemySeries: Array<{ x: number; y: number }>;
}) {
  const series = selected === 'player' ? playerSeries : enemySeries;
  const maxY = Math.max(1, ...series.map((p) => p.y));
  const maxX = Math.max(1, series.length);
  const points = series
    .map((p) => `${((p.x - 1) / Math.max(1, maxX - 1)) * 100},${100 - (p.y / maxY) * 100}`)
    .join(' ');

  return (
    <div className="battle-poc__analysis" role="dialog" aria-modal="true" aria-label="Battle analysis">
      <div className="battle-poc__analysis-card">
        <div className="battle-poc__analysis-head">
          <strong>BATTLE ANALYSIS</strong>
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
        <div className="battle-poc__analysis-title">
          Damage Taken Over Timeline ({selected === 'player' ? 'Player' : 'Enemy'})
        </div>
        <svg className="battle-poc__analysis-graph" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="100" x2="100" y2="100" className="battle-poc__analysis-axis" />
          <line x1="0" y1="0" x2="0" y2="100" className="battle-poc__analysis-axis" />
          {points.length > 0 ? (
            <polyline points={points} className="battle-poc__analysis-line" />
          ) : null}
        </svg>
      </div>
    </div>
  );
}
