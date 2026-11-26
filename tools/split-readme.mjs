// data/dungeons/split-boss/README.md 만들기 — boss-stats.csv(split-stages.mjs) + bands.json(split-report.mjs) 를 읽어 표로
// 실행 순서: node tools/split-stages.mjs → node tools/split-report.mjs → node tools/split-readme.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const rows = readFileSync('data/dungeons/split-boss/boss-stats.csv', 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).map(l => l.split(','));
const H = rows[0], ix = (n) => H.indexOf(n), f = (n) => (+n).toLocaleString('en-US');
const bands = JSON.parse(readFileSync('docs/split-report/bands.json', 'utf8')).rows;
const sweep = JSON.parse(readFileSync('docs/split-report/sweep.json', 'utf8')).rows;
const sw = (k, hp) => (sweep.find(x => x.key === k && +x.hp === hp) || {}).clear;
const b = (o, k) => { const r = bands.find(x => x.order === o && x.key === k); return `${r.clear}% · ${r.time ?? '—'}초`; };

let md = `# 분열 보스 — 단계별 스탯 (문항 2, 기획 후보)

\`node tools/split-stages.mjs\` → [boss-stats.csv](boss-stats.csv). 기존 보스 9종에서 뽑은 **공통 곡선**(\`data/dungeons/boss-curve.csv\`)에 배율을 곱해 단계마다 점진적으로 오르게 만듦. 공략 창 문구·스킬셋은 [guide.json](guide.json).

**목표 (사용자)**: 같은 투력이면 열쇠 없이는 대부분 실패, 톡찌리가 있으면 2분 30초~3분 안에 깸.

- **곡선 위치**: 글라틀·윈드윙과 같은 룬스톤 위치 (아군 관측 피해가 글라틀 10단계 기준). 11단계까지 관측 곡선, 12단계부터 외삽(Lv85 뒤 레벨당 ×1.0098)
- **체력 배율** (곡선 체력 = 카니보 1 기준): 한 몸 ×0.867 · 분열체 1마리 초반 ×0.104 / 중반 ×0.121 / 후반 ×0.130 → 전체(한 몸 + 4마리) 약 ×2.2. 분열체는 부활할 때마다 체력이 다시 생김
- **공격력**: 분열체 1마리 곡선 ×0.15 (스탯 후보). 피해 칸은 10단계 후보값(평타 45 · 단일 450 · 모든 적 225 · 반격 6,000)을 곡선 공격력 비율로 늘린 값
- **부활마다 공격력 +10%** · **모든 적 스킬([젤리 해일])에 가까운 2명 속도 −10%** (중반 최대 2겹, 후반 3겹 — 스킬 타이밍을 점점 어긋나게)
- **[부활 차단]에는 저항하지 못함** (분열체 패시브) — 효과저항은 다른 디버프에만 적용
- **방어력·효과저항·효과명중**: 기존 보스 공통 (저항·명중 4단계 35/30 → 7단계 50/50 → 10단계 75/75). **속도 100** 고정

## 구간 (10단계 투력으로 정규화, 모두 빈 게이지로 시작, 1,000판 — 클리어율 · 이긴 판 클리어 시간 중앙값)

기본 파티 = 콜리킹 · 딸랑귀 · 파이온 · 콘센파리 + 쥐강이 자리에 열쇠 몬몬과 같은 능력치(체력 12,000 · 속도 100 · 같은 화력)의 몬몬, 열쇠 효과만 없음. 열쇠 파티는 그 자리에 열쇠 몬몬을 넣음 → 열쇠 효과 = 열쇠 파티 − 기본 파티

| 구간 | 분열체 | 피해 감소 | 반격 | 느려짐 | 기본 파티 (열쇠 효과 없음) | 톡찌리 | 멘티삿 | 톡찌리 + 멘티삿 | 톡찌리 + 토볼트 |
|---|--:|--:|---|---|---|---|---|---|---|
| 초반 1~6 | ×0.104 | 30% | 없음 | 없음 | ${b(1, 'base')} | ${b(1, 'tok')} | ${b(1, 'ment')} | ${b(1, 'duo')} | ${b(1, 'duo2')} |
| 중반 7~15 | ×0.121 | 50% | 있음 | 2명 −10% ×2 | ${b(2, 'base')} | ${b(2, 'tok')} | ${b(2, 'ment')} | ${b(2, 'duo')} | ${b(2, 'duo2')} |
| 후반 16~20 | ×0.130 | 50% | 있음 | 2명 −10% ×3 | ${b(3, 'base')} | ${b(3, 'tok')} | ${b(3, 'ment')} | ${b(3, 'duo')} | ${b(3, 'duo2')} |

- 시뮬레이션은 시작 게이지가 모두 0이라 결과가 거의 한 흐름 → 분열체 체력에 민감함 (톡찌리 ${sw('tok', 13000)}% · ${sw('tok', 14000)}% · ${sw('tok', 15000)}% — 분열체 13,000 · 14,000 · 15,000)

## 단계표

| 단계 | 레벨 | 구간 | 한 몸 체력 | 분열체 체력 | 전체 체력 | 분열체 공격력 | 방어력 | 반격 | 느려짐 (최대 겹) | 평타 / 단일 / 모든 적 / 반격 피해 | 비교: 글라틀 체력 |
|---|--:|---|--:|--:|--:|--:|--:|---|--:|---|--:|
`;
for (const r of rows.slice(1)) {
  md += `| ${r[0]} | ${r[1]} | ${r[2]} | ${f(r[ix('한 몸 체력')])} | ${f(r[ix('분열체 체력 (1마리)')])} | ${f(r[ix('전체 체력 (한 몸 + 4마리)')])} | ${f(r[ix('분열체 공격력 (스탯 후보)')])} | ${f(r[ix('방어력')])} | ${r[ix('반격')]} | ${r[ix('속도 감소 최대 겹 (가까운 2명 −10%)')]} | ${f(r[ix('분열체 평타 피해')])} / ${f(r[ix('단일 스킬 피해')])} / ${f(r[ix('모든 적 스킬 피해')])} / ${f(r[ix('반격 피해')])} | ${f(r[ix('글라틀 체력 (비교)')])} |\n`;
}
md += `\n남은 가정: 피해 공식(공격력 스탯 → 실제 피해)은 모름 · 단계별 권장 투력은 곡선만큼 자란다고 봄 · 클리어 시간은 보스전만 (잡몹 웨이브 시간은 빠짐).\n`;
writeFileSync('data/dungeons/split-boss/README.md', md);
console.log('data/dungeons/split-boss/README.md');
