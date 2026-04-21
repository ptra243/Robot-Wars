export const SANDBOX_CORE_MAX = 99;
export const SANDBOX_ACTIVE_SLOTS_MIN = 3;
export const SANDBOX_ACTIVE_SLOTS_MAX = 9;

export function clampSandboxCore(n: number): number {
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.min(SANDBOX_CORE_MAX, Math.floor(n));
}

export function clampActiveSlots(n: number): number {
  if (!Number.isFinite(n)) {
    return SANDBOX_ACTIVE_SLOTS_MAX;
  }
  return Math.max(SANDBOX_ACTIVE_SLOTS_MIN, Math.min(SANDBOX_ACTIVE_SLOTS_MAX, Math.floor(n)));
}
