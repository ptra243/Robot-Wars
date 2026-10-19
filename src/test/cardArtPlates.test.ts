import { describe, expect, it } from 'vitest';
import { plateArtForCardId } from '../ui/cardArtPlates';

describe('cardArtPlates mapping', () => {
  it('maps Basic Strike tiers to N1 with a tight fist crop', () => {
    const t1 = plateArtForCardId('neutral_basic_strike_t1');
    const t3 = plateArtForCardId('neutral_basic_strike_t3');
    expect(t1?.url).toBe('/art/plates/n1-arena-clash.jpg');
    expect(t3?.url).toBe(t1?.url);
    expect(t1?.crop).toEqual(t3?.crop);
    expect(t1?.crop.zoom).toBeGreaterThanOrEqual(3.2);
  });

  it('maps Barrier hard-right on N1 so fists can leave the frame', () => {
    const strike = plateArtForCardId('neutral_basic_strike_t1');
    const barrier = plateArtForCardId('neutral_barrier_t2');
    expect(barrier?.url).toBe(strike?.url);
    expect(barrier!.crop.px).toBeGreaterThan(0.65);
    expect(barrier!.crop.px).toBeGreaterThan(strike!.crop.px);
  });

  it('maps Multi-strike to the dedicated multi-fists plate', () => {
    const multi = plateArtForCardId('neutral_multi_strike_t1');
    expect(multi?.url).toBe('/art/plates/n1b-multi-fists.jpg');
  });

  it('maps Capacitor Feed to Rust Ranger backpack plate', () => {
    const cap = plateArtForCardId('neutral_capacitor_feed_t2');
    expect(cap?.url).toBe('/art/plates/n1c-capacitor-pack.jpg');
  });

  it('maps Feint and Overdrive Slam to N6 with distinct crops', () => {
    const feint = plateArtForCardId('neutral_feint_t1');
    const slam = plateArtForCardId('neutral_overdrive_slam_t1');
    expect(feint?.url).toBe('/art/plates/n6-feint-overdrive.jpg');
    expect(slam?.url).toBe(feint?.url);
    expect(slam!.crop.px).toBeLessThan(feint!.crop.px);
  });

  it('reclaims N1 background for Delayed Burst / Shell', () => {
    const burst = plateArtForCardId('neutral_delayed_burst_t1');
    const shell = plateArtForCardId('neutral_delayed_shell_t1');
    expect(burst?.url).toBe('/art/plates/n1-arena-clash.jpg');
    expect(shell?.url).toBe(burst?.url);
    expect(burst!.crop.zoom).toBeLessThan(2.5);
    expect(shell!.crop.py).toBeGreaterThan(burst!.crop.py);
  });

  it('keeps core sacrifice on reactor plate with keyed knockout', () => {
    const core = plateArtForCardId('core_tap_t1');
    expect(core?.url).toContain('core-werewolf');
    expect(core?.crop.zoom).toBeGreaterThan(1);
    expect(core?.keyed).toBe(true);
  });

  it('returns undefined for unmapped neutrals', () => {
    expect(plateArtForCardId('neutral_urgent_repairs_t1')).toBeUndefined();
    expect(plateArtForCardId('neutral_servo_t1')).toBeUndefined();
  });

  it('maps S1 junk cards to distinct crops on the junk-hoard plate', () => {
    const gasket = plateArtForCardId('junk_gasket_t1');
    const crown = plateArtForCardId('junk_crown_t1');
    expect(gasket?.url).toBe('/art/plates/s1-junk-hoard.jpg');
    expect(crown?.url).toBe(gasket?.url);
    expect(gasket?.crop).not.toEqual(crown?.crop);
    expect(gasket?.keyed).toBeFalsy();
    expect(crown!.crop.py).toBeLessThan(gasket!.crop.py);
  });
});
