import type { BattlePocStage as Stage } from './BattlePocControls';
import { BattlePocPilotHUD, BATTLE_POC_ENERGY_BAR_CAP, BATTLE_POC_SHIELD_BAR_CAP } from './BattlePocPilotHUD';
import { ATTACK_DAMAGE } from './battlePocCardModel';
import { buffChipsFromSnapshot, debuffChipsFromSnapshot, isEnemyPhase, isPlayerPhase } from './battlePocHelpers';
import {
  AuraChipRow,
  DamagePop,
  FatiguePulse,
  GroundSlam,
  ImpactSpark,
  MechSprite,
  MuzzleFlash,
  ShieldAura,
  SpeedLines,
  SystemLock,
  TracerBolt,
  WhiffBanner,
} from './BattlePocFx';
import type { BattlePocViewModel } from './useBattlePocViewModel';

export function BattlePocArena({
  vm,
  stage,
  playerHudName,
  playerPortrait,
  pilotNameForAlt,
}: {
  vm: BattlePocViewModel;
  stage: Stage;
  playerHudName: string;
  playerPortrait: string;
  pilotNameForAlt: string | undefined;
}) {
  return (
    <main className="battle-poc__stage">
      {vm.hasReplay && vm.replaySnapshot?.fatigueArmed ? (
        <div
          className="battle-poc__fatigue-panel"
          role="status"
          aria-live="polite"
          title="Thermal runaway: each stack tick deals escalating damage to both fighters."
        >
          <span className="battle-poc__fatigue-panel-label">FATIGUE</span>
          <span className="battle-poc__fatigue-panel-stack" aria-label="Fatigue stacks">
            {String(vm.replaySnapshot.fatigueRoundsElapsed ?? 0)}
          </span>
        </div>
      ) : null}
      {stage === 'market' ? <div className="battle-poc__ground" aria-hidden /> : null}
      <BattlePocPilotHUD
        side="left"
        name={playerHudName}
        subtitle="SCAVENGER · AWAKENING 1"
        portrait={playerPortrait}
        hp={vm.uiPlayerHp}
        maxHp={vm.uiPlayerMaxHp}
        active={isPlayerPhase(vm.uiPhase)}
        taking={vm.uiPhase === 'enemy-strike'}
        theme="ally"
        energy={vm.hasReplay && vm.rp ? vm.rp.charge : undefined}
        energyCap={BATTLE_POC_ENERGY_BAR_CAP}
        shield={vm.hasReplay && vm.rp ? vm.rp.block : undefined}
        shieldCap={BATTLE_POC_SHIELD_BAR_CAP}
        shurikenStacks={vm.hasReplay && vm.rp ? (vm.rp.shuriken ?? 0) : undefined}
      />
      <div className="battle-poc__vs">
        <span>VS</span>
      </div>
      <BattlePocPilotHUD
        side="right"
        name="ARES-01"
        subtitle="CORPORATE · AEGIS STRIKE"
        portrait="/poc/poc-pilot-enemy.png"
        hp={vm.uiEnemyHp}
        maxHp={vm.uiEnemyMaxHp}
        active={isEnemyPhase(vm.uiPhase)}
        taking={vm.uiPhase === 'player-strike' || vm.uiPhase === 'player-strike-hold'}
        theme="enemy"
        energy={vm.hasReplay && vm.re ? vm.re.charge : undefined}
        energyCap={BATTLE_POC_ENERGY_BAR_CAP}
        shield={vm.hasReplay && vm.re ? vm.re.block : undefined}
        shieldCap={BATTLE_POC_SHIELD_BAR_CAP}
      />

      <div
        className={[
          'battle-poc__mech',
          'battle-poc__mech--player',
          `battle-poc__mech--${vm.uiPhase}`,
          `battle-poc__mech--pose-${vm.playerPose}`,
          `battle-poc__mech--attack-${vm.playerStrikeStyle}`,
          vm.uiPhase === 'enemy-strike' ? 'battle-poc__mech--hurt' : '',
        ].join(' ')}
      >
        {vm.hasReplay && vm.rp ? (
          <AuraChipRow variant="buff" chips={buffChipsFromSnapshot(vm.rp)} a11y="Player buffs" />
        ) : null}
        <MechSprite
          key={vm.playerAttackAnimKey}
          src={vm.playerMechSrcResolved}
          alt={pilotNameForAlt ? `${pilotNameForAlt}'s mech` : 'Player mech'}
          animState={vm.playerAnimState}
        />
        {vm.hasReplay && vm.rp ? (
          <AuraChipRow variant="debuff" chips={debuffChipsFromSnapshot(vm.rp)} a11y="Player debuffs" />
        ) : null}
      </div>
      <div
        className={[
          'battle-poc__mech',
          'battle-poc__mech--enemy',
          `battle-poc__mech--${vm.uiPhase}`,
          `battle-poc__mech--pose-${vm.enemyPose}`,
          vm.uiPhase === 'player-strike' || vm.uiPhase === 'player-strike-hold'
            ? 'battle-poc__mech--hurt'
            : '',
        ].join(' ')}
      >
        {vm.hasReplay && vm.re ? (
          <AuraChipRow variant="buff" chips={buffChipsFromSnapshot(vm.re)} a11y="Enemy buffs" />
        ) : null}
        <MechSprite
          key={vm.enemyAttackAnimKey}
          src={vm.enemyMechSrcResolved}
          alt="Enemy mech"
          animState={vm.enemyAnimState}
        />
        {vm.hasReplay && vm.re ? (
          <AuraChipRow variant="debuff" chips={debuffChipsFromSnapshot(vm.re)} a11y="Enemy debuffs" />
        ) : null}
      </div>

      {vm.uiPhase === 'player-strike' ? (
        <DamagePop
          side="right"
          amount={
            vm.hasReplay
              ? Math.max(vm.enemyDamageTaken, 0) || (vm.activePlayerCard.atk ?? ATTACK_DAMAGE)
              : ATTACK_DAMAGE
          }
        />
      ) : null}
      {vm.uiPhase === 'enemy-strike' ? (
        <DamagePop
          side="left"
          amount={
            vm.hasReplay
              ? Math.max(vm.playerDamageTaken, 0) || (vm.activeEnemyCard.atk ?? ATTACK_DAMAGE)
              : ATTACK_DAMAGE
          }
        />
      ) : null}

      {vm.eventFlags.playerResolve && vm.playerStrikeStyle === 'rush' ? <SpeedLines direction="rightward" /> : null}
      {vm.eventFlags.playerResolve && vm.playerStrikeStyle === 'overhead' ? <GroundSlam side="right" /> : null}
      {vm.eventFlags.enemyResolve ? <MuzzleFlash side="right" /> : null}
      {vm.eventFlags.enemyResolve ? <TracerBolt direction="leftward" /> : null}
      {vm.eventFlags.playerResolve ? <ImpactSpark side="right" /> : null}
      {vm.eventFlags.enemyResolve ? <ImpactSpark side="left" /> : null}
      {vm.eventFlags.stall ? <SystemLock actor={vm.activeEvent?.actor} /> : null}
      {vm.eventFlags.whiff ? <WhiffBanner /> : null}
      {vm.eventFlags.fatigueTick ? <FatiguePulse /> : null}
      {(vm.rp?.block ?? 0) > 0 ? <ShieldAura side="left" /> : null}
      {(vm.re?.block ?? 0) > 0 ? <ShieldAura side="right" /> : null}
    </main>
  );
}
