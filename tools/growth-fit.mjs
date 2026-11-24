// 레벨 강화 화면 관측값(data/growth/observations.csv) → 등급별 레벨당 성장 배율(data/growth/growth.csv)
// 실행: node tools/growth-fit.mjs
//
// 모형 (관측으로 고른 것, 게임 공식 확인 아님):  화면 값 = 버림( Lv1 내부값 × r^(레벨-1) )
//  - 곱연산: 레벨마다 더해지는 양이 커지고 레벨당 비율은 일정 (라이옹 7개 레벨로 확인, 10배수 보너스 없음)
//  - 레벨마다 버림/반올림/올림하는 모형은 오차가 3~4배 커서 버림 (뿌지리·라이옹)
//  - Lv1 내부값은 몬몬·스탯마다 따로 맞춘다 (화면 값에 소수가 숨어 있을 수 있어서)
// 레벨 강화 화면 값은 계정 보너스(승리의 징표·테이머 리그)를 뺀 값이다. 도감 화면 값은 보너스가 더해져 있다.
import { readFileSync, writeFileSync } from 'node:fs';

const IN = 'data/growth/observations.csv', OUT = 'data/growth/growth.csv';
const STATS = [['hp', '체력'], ['atk', '공격력'], ['def', '방어력']];
const rows = readFileSync(IN, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1).map(l => l.split(','));
// 태생 별과 현재 별(진화 후)을 따로 둔다 — 진화하면 최대 레벨과 레벨당 배율이 바뀐다 (딸랑귀: 에픽 4성 → 5성)
const obs = rows.map(c => ({ name: c[0], no: c[1], grade: c[2], born: +c[3], stars: +c[4], maxLevel: +c[5], level: +c[6], hp: +c[7], atk: +c[8], def: +c[9] }));

/** 한 몬몬·한 스탯 점들에 r 을 고정했을 때 가장 잘 맞는 Lv1 내부값과 오차 */
function fitB(pts, r) {
  const v0 = pts[0].v / Math.pow(r, pts[0].level - 1);
  let best = null;
  for (let B = v0 * 0.995; B <= v0 * 1.005; B += v0 * 0.00002) {
    let err = 0, worst = 0;
    for (const p of pts) { const d = Math.abs(Math.floor(B * Math.pow(r, p.level - 1)) - p.v); err += d / p.v; worst = Math.max(worst, d); }
    if (!best || err < best.err) best = { B, err, worst };
  }
  return best;
}

const out = [];
for (const key of [...new Set(obs.map(o => `${o.grade}|${o.born}|${o.stars}`))]) {
  const g = obs.filter(o => `${o.grade}|${o.born}|${o.stars}` === key);
  const grade = g[0].grade + (g[0].stars !== g[0].born ? ` (${g[0].born}성→${g[0].stars}성 진화)` : '');
  const mons = [...new Set(g.map(o => o.name))];
  const series = mons.flatMap(n => STATS.map(([k]) => ({ k, pts: g.filter(o => o.name === n).sort((a, b) => a.level - b.level).map(o => ({ level: o.level, v: o[k] })) })));
  const fitR = (list) => {
    let best = null;
    for (let r = 1.005; r <= 1.06; r += 0.00001) {
      let err = 0, worst = 0;
      for (const s of list) { const b = fitB(s.pts, r); err += b.err; worst = Math.max(worst, b.worst); }
      if (!best || err < best.err) best = { r, err, worst };
    }
    return best;
  };
  // 거친 격자로 범위를 좁힌 뒤 촘촘히 (전부 촘촘히 돌면 느림)
  const coarse = (list) => { let best = null; for (let r = 1.005; r <= 1.06; r += 0.0005) { let err = 0; for (const s of list) err += fitB(s.pts, r).err; if (!best || err < best.err) best = { r, err }; } return best.r; };
  const fine = (list) => { const c = coarse(list); let best = null; for (let r = c - 0.001; r <= c + 0.001; r += 0.00001) { let err = 0, worst = 0; for (const s of list) { const b = fitB(s.pts, r); err += b.err; worst = Math.max(worst, b.worst); } if (!best || err < best.err) best = { r, err, worst }; } return best; };
  const all = fine(series);
  const per = Object.fromEntries(STATS.map(([k]) => [k, fine(series.filter(s => s.k === k))]));
  const levels = mons.map(n => `${n} Lv${g.filter(o => o.name === n).map(o => o.level).join('·')}`).join(' / ');
  const max = g[0].maxLevel;
  out.push([grade, g[0].born, g[0].stars, max, all.r.toFixed(4), ...STATS.map(([k]) => per[k].r.toFixed(4)), Math.pow(all.r, max - 1).toFixed(3), all.worst, levels]);
  console.log(`${grade}: r=${all.r.toFixed(5)} (체력 ${per.hp.r.toFixed(5)}, 공격력 ${per.atk.r.toFixed(5)}, 방어력 ${per.def.r.toFixed(5)}) · 최대 오차 ${all.worst} · Lv${max} 배율 ${Math.pow(all.r, max - 1).toFixed(3)}`);
}
const csv = (rs) => '﻿' + rs.map(r => r.join(',')).join('\r\n') + '\r\n';
writeFileSync(OUT, csv([['등급', '태생 별', '현재 별', '최대 레벨', '레벨당 배율', '체력만', '공격력만', '방어력만', '최대 레벨 배율(Lv1 대비)', '화면 값 최대 오차', '근거 (몬몬 · 관측 레벨)'], ...out]));
console.log(`→ ${OUT}`);
