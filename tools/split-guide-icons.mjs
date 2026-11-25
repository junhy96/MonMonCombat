// 분열 보스 공략 창 목업의 스킬·종족 아이콘 (tools/split-guide.mjs 가 씀). 스킬 이름으로 찾음 — guide.json 에서 스킬 이름을 바꾸면 여기 키도 바꿀 것
// 스킬 아이콘 (SVG 64×64) — 흰 그림 + 어두운 테두리
const O = '#1a1030';
const stroke = (d, w = 5) => `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + 4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const fill = (d, color = '#fff') => `<path d="${d}" fill="${color}" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>`;
const circ = (cx, cy, r, color = '#fff') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="${O}" stroke-width="3.5"/>`;
const SHIELD = 'M32 7 L53 15 V31 C53 44 44 53 32 57 C20 53 11 44 11 31 V15 Z';
export const SKILL_ICONS = {
  '젤리 몸통박치기': fill('M32 8 L37 23 L53 17 L43 30 L57 38 L41 39 L43 56 L32 43 L21 56 L23 39 L7 38 L21 30 L11 17 L27 23 Z'),
  '젤리 포탄': stroke('M7 23 H20 M5 32 H22 M7 41 H20', 4) + circ(40, 32, 13) + `<circle cx="36" cy="27" r="4" fill="#d9b8ff"/>`,
  '젤리 해일': stroke('M6 38 C13 26 21 26 27 34 C33 42 41 42 47 30 C51 22 57 21 59 25') + stroke('M6 51 C13 43 21 43 27 48 C33 53 43 53 58 43'),
  '사분열': stroke('M32 32 L17 17 M32 32 L47 17 M32 32 L17 47 M32 32 L47 47', 4) + circ(32, 32, 9) + circ(14, 14, 6.5) + circ(50, 14, 6.5) + circ(14, 50, 6.5) + circ(50, 50, 6.5),
  '다시 뭉치기': stroke('M50 34 A18 18 0 1 1 41 17') + fill('M36 9 L48 16 L37 24 Z') + circ(32, 33, 7),
  '녹지 않는 젤리': fill(SHIELD) + `<path d="M32 21 C36 27 41 32 41 38 A9 9 0 0 1 23 38 C23 32 28 27 32 21 Z" fill="#8a46d6" stroke="${O}" stroke-width="2.5"/>`,
  '반격 자세': fill(SHIELD, '#ffe6a8') + stroke('M42 20 C28 18 20 28 24 40', 4.5) + fill('M16 36 L25 47 L31 35 Z'),
  '절대 면역': fill(SHIELD) + `<path d="M21 32 L29 40 L44 24" fill="none" stroke="#2fbf6a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  '몰아붙이기': stroke('M15 15 L30 32 L15 49') + stroke('M33 15 L48 32 L33 49'),
  '기회': fill('M37 5 L15 36 H29 L25 59 L49 26 H34 Z', '#fff3a8'),
};
// 종족 배지 (변이) — 이중 나선
export const RACE_ICON = stroke('M22 8 C42 20 22 44 42 56', 4) + stroke('M42 8 C22 20 42 44 22 56', 4) + stroke('M25 16 H39 M25 32 H39 M25 48 H39', 3);
