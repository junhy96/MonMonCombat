// 시뮬레이션 수렴: 시행 순서대로의 누적 평균과 95% 범위 — 워크벤치 js/lib/mcviz.js에서 계산 부분만 옮김(그리기 제외).

export function checkpoints(n, points = 48) {
  const out = new Set();
  for (let k = 0; k < points; k++) out.add(Math.max(1, Math.round(Math.exp(Math.log(n) * k / (points - 1)))));
  out.add(n);
  return [...out].sort((a, b) => a - b);
}

/**
 * 시행 순서대로의 값 → 누적 평균과 95% 범위. binary면 0/1 값(승률)이라 Wilson 범위, 아니면 평균 ± 1.96 × 표준오차.
 * 반환 [{ n, mean, lo, hi }]
 */
export function convergence(values, { binary = false, points = 48 } = {}) {
  const n = values.length;
  if (!n) return [];
  const cps = checkpoints(n, points);
  const out = [];
  let s = 0, s2 = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) return null; // 끝나지 않은 시행이 있으면 평균이 없음
    s += v; s2 += v * v;
    if (i + 1 === cps[k]) {
      const m = i + 1, mean = s / m;
      if (binary) {
        const z = 1.96, z2 = z * z, den = 1 + z2 / m, mid = (mean + z2 / (2 * m)) / den, half = z * Math.sqrt(mean * (1 - mean) / m + z2 / (4 * m * m)) / den;
        out.push({ n: m, mean, lo: Math.max(0, mid - half), hi: Math.min(1, mid + half) });
      } else {
        const sd = m > 1 ? Math.sqrt(Math.max(0, (s2 - m * mean * mean) / (m - 1))) : 0, se = sd / Math.sqrt(m);
        out.push({ n: m, mean, lo: mean - 1.96 * se, hi: mean + 1.96 * se });
      }
      k++;
    }
  }
  return out;
}
