// 상세 화면에서 스킬 원 개수·위치 찾기 — 등급마다 스킬 수가 달라(전설·에픽 4개, 레어 3개 …) 클릭 위치가 다르다.
// 실행: node tools/ocr/skill-layout.mjs [raw 폴더]  → 번호, 원 개수, 중심 x들
// 방법: 원 아래쪽 절반(y 800~850)에서 열마다 "아주 어두운 테두리" 픽셀이 있는지 보고, 원 안쪽(밝거나 색 있는) 구간을 묶는다.
import { readFileSync, readdirSync } from 'node:fs';
import { decodePNG } from '../../src/lib/png.js';
export function skillCenters(img) {
  const { width: W, data } = img, y = 793;
  // 테두리: 아주 어두운 픽셀 (원마다 좌우 두 번)
  const dark = []; for (let x = 140; x < 780; x++) { const i = (y * W + x) * 4; dark.push(data[i] + data[i + 1] + data[i + 2] < 120); }
  const runs = []; let s = -1;
  dark.forEach((d, i) => { if (d && s < 0) s = i; if (!d && s >= 0) { runs.push([140 + s, 140 + i - 1]); s = -1; } });
  const edges = runs.filter(([a, b]) => b - a <= 20).map(([a, b]) => (a + b) / 2);
  const centers = [];
  for (let i = 0; i + 1 < edges.length; i++) { const w = edges[i + 1] - edges[i]; if (w > 90 && w < 130) { centers.push(Math.round((edges[i] + edges[i + 1]) / 2)); i++; } }
  return centers;
}
if (process.argv[1].endsWith('skill-layout.mjs')) {
  const RAW = process.argv[2] || 'data/monmon/raw';
  for (const f of readdirSync(RAW).filter(f => /^\d{3}-0\.png$/.test(f)).sort()) {
    const c = skillCenters(decodePNG(readFileSync(`${RAW}/${f}`)));
    console.log(`${f.slice(0, 3)}\t${c.length}\t${c.join(',')}`);
  }
}
