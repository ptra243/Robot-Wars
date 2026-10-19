# Phaser Battlefield PR Checklist

## Scope and Cutover

- `GameApp` and `BattleSimulationApp` use `BattlePhaserPOC` for run/sim battle.
- Landing `POC Battle` continues using legacy `BattlePOC` path for behavior reference.
- Battlefield ownership is clear: Phaser controls mechs, effects, pilot HUD.
- React ownership is clear: top deck rail, bottom deck rail, controls, result shell.

## Layout and Rails

- Battle shell is a non-floating 3-row layout (top rail, battlefield, bottom rail).
- Middle battlefield expands to available width/height between rails.
- Card panel can visually overlap battlefield without breaking Phaser input.
- Separation between rails and battlefield is visually obvious (borders/background split).

## Timeline and Step Gating

- Playback uses animation-gated progression (no blind interval stepping).
- Per-step sequence runs to completion before incrementing step:
  - actor action start
  - card reveal/popout beat
  - target hurt/shield beat
  - return idle
- Pause blocks new step starts.
- Speed multiplier modulates step timeline duration.

## Scrub Semantics

- Scrub targets turn-start increments only.
- Scrub to step N restarts from that step's timeline start.
- Scrub does not jump to mid-animation state.
- Step index and status text stay in sync during scrub and autoplay.

## Event Mapping

- Combat events mapped to normalized step actions.
- MVP actions covered: attack, buff, stall, hurt, defeat.
- Shield damage, buff, stall can reuse hurt animation for MVP.
- Damage numbers derive from snapshot deltas when available.

## Phaser Battlefield Component

- `PhaserBattlefield` creates/destroys Phaser game safely.
- Resize observer keeps scene fitted to container bounds.
- Scene exposes `playStep` and emits `onStepComplete`.
- Scene supports pause/resume and speed scaling.

## Skeletal Runtime Track

- Plugin track scaffolded (runtime hook points in scene for skeletal actors).
- Fallback sprite path works while skeletal exports are pending.
- Animation id contract defined: idle, attack, hurt, defeat, buff, stall.

## Art and FX Assets

- Generated/added MVP FX assets:
  - muzzle flash
  - impact spark
  - shield ring
  - speed lines
  - slam dust ring
- Assets are referenced by Phaser scene and loaded once.
- Asset naming convention documented and stable.

## Verification

- `npm run build` passes.
- Run battle replay plays step-by-step with animation gates.
- Sim battle replay plays step-by-step with animation gates.
- Legacy `POC Battle` menu link still works as before.