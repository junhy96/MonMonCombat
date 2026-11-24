// 시드 고정 난수 — 워크벤치 js/enhance/simulate.js(mulberry32)·js/lib/simconfig.js(seedMix)에서 순수 함수만 옮김.
// 같은 시드 = 같은 결과. seedMix: 사용자 시드가 기본값이면 예전(legacy) 시드를 그대로 써서 결과가 바뀌지 않게.

export const DEFAULT_SEED = 20261018;

/** 32비트 시드 → [0, 1) 난수 함수 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedMix(userSeed, legacy, def = DEFAULT_SEED) {
  if (userSeed == null || !Number.isFinite(userSeed) || userSeed === def) return legacy >>> 0;
  return (legacy ^ Math.imul((userSeed >>> 0) || 1, 2654435761)) >>> 0;
}
