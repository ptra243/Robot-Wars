import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import { forgeCardFromDef } from '../components/poc/forge/forgeCardModel';

describe('forge card art resolution', () => {
  const content = CardContentService.loadDefault(1);

  it('does not give Servo Tune-Up the shared junk PNG', () => {
    const servo = forgeCardFromDef(content.get('neutral_servo_t1'));
    expect(servo.art).not.toContain('poc-card-junk');
    expect(servo.artFocus).toBe('default');
  });

  it('gives Junk Gasket and Junk Crown distinct S1 crops', () => {
    const gasket = forgeCardFromDef(content.get('junk_gasket_t1'));
    const crown = forgeCardFromDef(content.get('junk_crown_t1'));
    expect(gasket.art).toBe('/art/plates/s1-junk-hoard.jpg');
    expect(crown.art).toBe(gasket.art);
    expect(gasket.artFocus).toBe('cropped');
    expect(crown.artFocus).toBe('cropped');
    expect(gasket.artCrop).not.toEqual(crown.artCrop);
    expect(gasket.artKeyed).toBeFalsy();
  });

  it('keeps keyed knockout only on core reactor art', () => {
    const core = forgeCardFromDef(content.get('core_tap_t1'));
    expect(core.artKeyed).toBe(true);
    expect(core.artFocus).toBe('cropped');
  });
});
