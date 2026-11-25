// 문항 2 분열 보스 — 단계 1~20 스탯표 (기존 보스 공통 곡선 기준으로 점진 증가)
//   곡선: data/dungeons/boss-curve.csv (곡선 위치 = 글라틀 단계, 체력·공격력은 카니보 = 배율 1, 방어력 공통)
//   위치: 글라틀·윈드윙과 같은 룬스톤 위치 (사용자 파티 관측이 글라틀 10단계 기준이라 그 위치에 맞춤)
//   배율: 10단계(곡선 체력 115,332)에서 시뮬레이션으로 고른 값 → 한 몸 30,000 = ×0.26, 분열체 15,000 = ×0.13
//   구간(기존 보스처럼 초반 소개 → 중반 열쇠 → 후반 열쇠 2명): tools/split-sim.mjs 로 확인한 설정
// 실행: node tools/split-stages.mjs  → data/dungeons/split-boss/boss-stats.csv
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const LEVELS = [5, 7, 9, 11, 16, 22, 27, 40, 50, 60, 85, 95, 120, 145, 165, 185, 200, 220, 240, 260];
const csvRows = readFileSync('data/dungeons/boss-curve.csv', 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).map(l => l.split(','));
const head = csvRows[0];
const iPos = 0, iHp = head.findIndex(h => h.startsWith('체력')), iAtk = head.findIndex(h => h.startsWith('공격력')), iDef = head.findIndex(h => h.startsWith('방어력'));
const curve = Object.fromEntries(csvRows.slice(1).map(r => [+r[iPos], { hp: +r[iHp], atk: +r[iAtk], def: +r[iDef] }]));
const REF = curve[10];
const glattle = Object.fromEntries(readFileSync('data/dungeons/ice-fortress/boss-stats-full.csv', 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1).map(l => l.split(',')).map(r => [+r[0], +r[2]]));   // 글라틀 단계별 체력 (관측 + 외삽) — 비교용

const BANDS = [
  { name: '초반 1~6', from: 1, to: 6, piece: 0.113, aoeCut: 30, counter: false, note: '기믹 소개: 분열·부활만, 반격 없음 — 열쇠 없이 깸 (시뮬레이션 기준 파티 100%)' },
  { name: '중반 7~15', from: 7, to: 15, piece: 0.130, aoeCut: 50, counter: true, note: '반격 시작 — 열쇠 없으면 막힘 (기준 0.5% · 대조군 75% · 톡찌리 99% · 몽실벌 83%)' },
  { name: '후반 16~20', from: 16, to: 20, piece: 0.139, aoeCut: 50, counter: true, note: '분열체가 더 단단해짐 — 열쇠 1명으로 40%대, 2명(톡찌리+몽실벌)이면 99.7%' },
];
const BODY = 0.26, ATK_MUL = 0.5;
const DMG10 = { basic: 150, single: 1500, aoe: 750, counter: 5000 };   // 10단계 기준 아군(관측 파티)이 받는 피해 후보값
const resAcc = (s) => s >= 10 ? [75, 75] : s >= 7 ? [50, 50] : s >= 4 ? [35, 30] : [30, 0];   // 기존 보스 공통 단계 (글라틀 표)

const out = [['단계', '보스 레벨', '구간', '한 몸 체력', '분열체 체력 (1마리)', '전체 체력 (한 몸 + 4마리)', '분열체 공격력 (스탯 후보)', '방어력', '속도', '치명확률', '치명피해', '효과저항', '효과명중',
  '다수 공격 피해 감소 (%)', '반격', '분열체 평타 피해', '단일 스킬 피해', '모든 적 스킬 피해', '반격 피해', '글라틀 체력 (비교)', '곡선 출처']];
for (let s = 1; s <= 20; s++) {
  const c = curve[s], b = BANDS.find(x => s >= x.from && s <= x.to), [res, acc] = resAcc(s), k = c.atk / REF.atk;
  const body = Math.round(c.hp * BODY), piece = Math.round(c.hp * b.piece);
  out.push([s, LEVELS[s - 1], b.name, body, piece, body + 4 * piece, Math.round(c.atk * ATK_MUL), c.def, 100, 15, 50, res, acc,
    b.aoeCut, b.counter ? '있음' : '없음', Math.round(DMG10.basic * k), Math.round(DMG10.single * k), Math.round(DMG10.aoe * k), b.counter ? Math.round(DMG10.counter * k) : 0,
    glattle[s],
    s <= 11 ? '관측 곡선' : '외삽 (Lv85 뒤 레벨당 ×1.0098)']);
}
mkdirSync('data/dungeons/split-boss', { recursive: true });
writeFileSync('data/dungeons/split-boss/boss-stats.csv', '﻿' + out.map(r => r.join(',')).join('\r\n') + '\r\n');
for (const r of out) console.log(r.slice(0, 9).concat(r.slice(13, 19)).join(' | '));
console.log(BANDS.map(b => `${b.name}: 분열체 ×${b.piece} · ${b.note}`).join('\n'));
