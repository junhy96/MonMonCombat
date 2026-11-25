// 단계별 보스 스탯 채우기: 열린 단계에서 찍은 값(data/dungeons/*/boss-stats.csv)으로 공통 곡선을 만들고, 잠긴 단계를 채운다.
// 실행: node tools/boss-curve.mjs   → data/dungeons/<던전>/boss-stats-full.csv, data/dungeons/boss-curve.csv
//
// 관측으로 본 규칙 (2026-11-25, 카니보·울프릭·윈드윙):
//  - 방어력은 모든 보스가 같은 곡선. 체력·공격력은 곡선 × 보스별 배율 (단, 크리스탈 섬은 1~2단계만 따로 조정됨)
//  - 룬스톤은 곡선에서 한 단계 앞 (윈드윙 N단계 = 크리스탈 N+1단계) → 방어력이 같은 곡선 위치로 "어긋남"을 찾는다
//  - 효과저항·효과명중·속도는 보스(던전)마다 계단식 — 곡선으로 채우지 않고 마지막 관측값을 이어 쓴다(추정 표시)
// 채운 값의 출처: 관측 / 곡선(다른 보스가 연 단계) / 외삽(아무도 안 연 단계 — 마지막 레벨당 배율로 늘임, 오차 큼)
import { readFileSync, writeFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';

const DIR = 'data/dungeons';
const KEYS = ['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effRes', 'effAcc'];
const LABEL = { hp: '체력', atk: '공격력', def: '방어력', spd: '속도', critRate: '치명확률', critDmg: '치명피해', effRes: '효과저항', effAcc: '효과명중' };
const csv = (rs) => '﻿' + rs.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';

const bosses = [];
for (const d of readdirSync(DIR)) {
  if (!existsSync(`${DIR}/${d}/boss-stats.csv`)) continue;
  const g = JSON.parse(readFileSync(`${DIR}/${d}/guide.json`, 'utf8'));
  const rows = readFileSync(`${DIR}/${d}/boss-stats.csv`, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1).map(l => l.split(','));
  const obs = {};
  for (const r of rows) obs[+r[0]] = Object.fromEntries(KEYS.map((k, i) => [k, Number(r[i + 2])]));
  // 단계 수: 단계 레벨 표의 마지막 번호 (bands 모양이 던전 파일마다 달라서)
  const stages = Math.max(...Object.keys(g.stageLevels || {}).map(Number), ...Object.keys(obs).map(Number));
  bosses.push({ dir: d, name: g.name, obs, stages, levels: g.stageLevels || {} });
}
if (!bosses.length) { console.log('boss-stats.csv 없음'); process.exit(0); }

// 곡선 만들기 — 단계 사이 증가율을 이어 붙인다 (절댓값을 섞으면 보스별 조정이 곡선에 들어감)
//  1) 어긋남(offset): 방어력은 모든 보스가 같은 곡선 → 방어력이 같은 위치로 맞춤 (기준 = 가장 많이 연 보스)
//  2) 위치 p-1 → p 증가율: 그 두 단계를 연 모든 보스의 증가율 중앙값. 단, 체력·공격력 증가율이 같은 보스의 방어력 증가율과
//     3% 넘게 다르면 그 보스만의 조정(울프릭 1~2단계, 파이렘 10단계 공격력 등)으로 보고 뺀다
//  3) 보스별 배율 = 관측값 ÷ 곡선의 중앙값, 배율에서 1% 넘게 벗어난 단계는 "따로 조정된 단계"
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
// 기준: 방어력 값이 겹치는 보스가 가장 많은 보스 (같은 곡선 무리 중에서), 같으면 가장 많이 연 보스
const defSet = (b) => new Set(Object.values(b.obs).map(o => o.def));
const group = (b) => bosses.filter(x => [...defSet(x)].some(v => defSet(b).has(v))).length;
const ref = bosses.slice().sort((a, b) => group(b) - group(a) || Object.keys(b.obs).length - Object.keys(a.obs).length)[0];
const refDef = Object.entries(ref.obs).map(([s, o]) => [+s, o.def]);
for (const b of bosses) {
  const votes = {};
  for (const [s, o] of Object.entries(b.obs)) { const hit = refDef.find(([, v]) => v === o.def); if (hit) votes[hit[0] - s] = (votes[hit[0] - s] || 0) + 1; }
  b.offset = Number(Object.entries(votes).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0);
  b.alone = !Object.keys(votes).length;   // 방어력이 하나도 안 맞음 = 다른 곡선(고블린 영토 등) → 공통 곡선에서 뺌
}
const alone = bosses.filter(b => b.alone);
for (const b of alone) bosses.splice(bosses.indexOf(b), 1);
const rates = {};   // p → { hp: [], atk: [], def: [] }
for (const b of bosses) for (const [s, o] of Object.entries(b.obs)) {
  const prev = b.obs[+s - 1];
  if (!prev) continue;
  const p = +s + b.offset, rd = o.def / prev.def;
  rates[p] ??= { hp: [], atk: [], def: [] };
  rates[p].def.push(rd);
  for (const k of ['hp', 'atk']) { const r = o[k] / prev[k]; if (Math.abs(r / rd - 1) <= 0.03) rates[p][k].push(r); }
}
const p0 = Math.min(...Object.keys(ref.obs).map(s => +s + ref.offset));
const curve = { [p0]: { ...ref.obs[p0 - ref.offset], from: ref.name } };
for (let p = p0 + 1; rates[p]; p++) {
  const c = {};
  for (const k of ['hp', 'atk', 'def']) c[k] = curve[p - 1][k] * (median(rates[p][k]) ?? median(rates[p].def));
  c.from = `증가율 ${rates[p].hp.length}개 보스`;
  curve[p] = c;
}
for (let p = p0 - 1; rates[p + 1]; p--) {   // 기준 보스보다 아래쪽(다른 보스만 연 위치)
  const c = {};
  for (const k of ['hp', 'atk', 'def']) c[k] = curve[p + 1][k] / (median(rates[p + 1][k]) ?? median(rates[p + 1].def));
  c.from = `증가율 ${rates[p + 1].hp.length}개 보스`;
  curve[p] = c;
}
for (const b of bosses) {
  b.mul = { def: 1 }; const special = new Set();
  for (const k of ['hp', 'atk']) {
    const ratios = Object.entries(b.obs).filter(([s]) => curve[+s + b.offset]).map(([s, o]) => [+s, o[k] / curve[+s + b.offset][k]]);
    b.mul[k] = median(ratios.map(r => r[1]));
    for (const [s, r] of ratios) if (Math.abs(r / b.mul[k] - 1) > 0.01) special.add(s);
  }
  b.special = [...special].sort((x, y) => x - y);
}
// 배율 기준 맞추기: 따로 조정된 단계가 없는(가장 적은) 보스의 배율을 1 로 → 곡선 = 그 보스의 체력·공격력
const base = bosses.slice().sort((a, b) => a.special.length - b.special.length || Object.keys(b.obs).length - Object.keys(a.obs).length)[0];
const scale = { hp: base.mul.hp, atk: base.mul.atk };
for (const c of Object.values(curve)) { c.hp *= scale.hp; c.atk *= scale.atk; }
for (const b of bosses) { b.mul.hp /= scale.hp; b.mul.atk /= scale.atk; }
const known = Object.keys(curve).map(Number).sort((a, b) => a - b);
const maxP = known[known.length - 1];

// 외삽: 아무도 안 연 단계 — 레벨 기준. 공통 곡선은 레벨 구간마다 몬몬 별 성장 배율(1성 ×1.080, 2성 ×1.034, 3성 ×1.020, 5성 ×1.011)과
// 같은 레벨당 배율로 오르고 그 사이에 진화형 점프가 있다 → 마지막 구간의 레벨당 배율을 레벨 차이만큼 (더 높은 별·점프가 있으면 모자람)
const LV = { ...ref.levels };
const lvKeys = Object.keys(LV).map(Number).sort((a, b) => a - b), lvLast = lvKeys[lvKeys.length - 1];
for (let p = lvLast + 1; p <= lvLast + 3; p++) LV[p] = LV[p - 1] + (LV[lvLast] - LV[lvLast - 1]);   // 곡선이 단계 수보다 길 때(윈드윙 한 칸 앞)
const perLv = Object.fromEntries(['hp', 'atk', 'def'].map(k => [k, Math.pow(curve[maxP][k] / curve[maxP - 1][k], 1 / (LV[maxP] - LV[maxP - 1]))]));
const perStage = perLv;   // (아래 문구용 이름)
function curveAt(p) {
  if (curve[p]) return { ...curve[p], how: '곡선' };
  if (p > maxP && LV[p] != null) return { how: '외삽', ...Object.fromEntries(['hp', 'atk', 'def'].map(k => [k, curve[maxP][k] * Math.pow(perLv[k], LV[p] - LV[maxP])])) };
  return null;
}

// 곡선 표: 위치마다 각 보스의 몇 단계에 해당하는지 함께 (위치 = 기준 보스의 단계 번호)
const pMin = known[0], pMax = Math.max(...bosses.map(b => b.stages + b.offset));
writeFileSync(`${DIR}/boss-curve.csv`, csv([
  [`곡선 위치 (= ${ref.name} 단계)`, ...bosses.map(b => `${b.name} 단계`), `체력 (${base.name} = 배율 1)`, `공격력 (${base.name} = 배율 1)`, '방어력 (공통)', '출처'],
  ...Array.from({ length: pMax - pMin + 1 }, (_, i) => pMin + i).map(p => {
    const c = curveAt(p);
    return [p, ...bosses.map(b => { const s = p - b.offset; return s >= 1 && s <= b.stages ? s : ''; }), c ? Math.round(c.hp) : '', c ? Math.round(c.atk) : '', c ? Math.round(c.def) : '', c ? (c.how === '곡선' ? c.from : `외삽 (Lv${LV[maxP]} 뒤 레벨당 ×${perLv.hp.toFixed(4)})`) : ''];
  }),
]));
const mulNote = bosses.map(b => `${b.name}: 체력 ×${b.mul.hp.toFixed(3)} · 공격력 ×${b.mul.atk.toFixed(3)} · 어긋남 ${b.offset}${b.special.length ? ` · 따로 조정된 단계 ${b.special.join(',')}` : ''}`);
writeFileSync(`${DIR}/boss-curve.txt`, [`곡선 위치 기준: ${ref.name} 단계 · 배율 기준: ${base.name}`, ...mulNote, `관측 위치: ${known.join(',')}`, `외삽: Lv${LV[maxP]} 뒤로 레벨당 체력 ×${perLv.hp.toFixed(4)} 공격력 ×${perLv.atk.toFixed(4)} 방어력 ×${perLv.def.toFixed(4)} (마지막 관측 구간, 5성 배율과 같음)`].join('\n') + '\n');

for (const b of bosses) {
  const rows = [['단계', '보스 레벨', ...KEYS.map(k => LABEL[k]), '체력·공격력·방어력 출처', '속도·효과저항·효과명중 출처']];
  let last = null;
  for (let s = 1; s <= b.stages; s++) {
    const o = b.obs[s];
    if (o) { last = o; rows.push([s, b.levels[s] ?? '', ...KEYS.map(k => o[k]), '관측', '관측']); continue; }
    const c = curveAt(s + b.offset);
    const v = c ? { hp: Math.round(c.hp * b.mul.hp), atk: Math.round(c.atk * b.mul.atk), def: Math.round(c.def) } : {};
    rows.push([s, b.levels[s] ?? '', v.hp ?? '', v.atk ?? '', v.def ?? '', ...['spd', 'critRate', 'critDmg', 'effRes', 'effAcc'].map(k => last?.[k] ?? ''),
      c ? (c.how === '곡선' ? `곡선 × 배율 (곡선 ${s + b.offset}단계)` : `외삽 — 레벨당 ×${perLv.hp.toFixed(4)}, 확인 필요`) : '없음', '마지막 관측값을 이어 씀 — 실제로는 계단식으로 오를 수 있음']);
  }
  writeFileSync(`${DIR}/${b.dir}/boss-stats-full.csv`, csv(rows));
  console.log(`${b.name}: 관측 ${Object.keys(b.obs).length}단계 · 곡선 어긋남 ${b.offset >= 0 ? '+' : ''}${b.offset} · 배율 체력 ${b.mul.hp.toFixed(3)} 공격력 ${b.mul.atk.toFixed(3)}${b.special.length ? ` · 따로 조정된 단계 ${b.special.join(',')}` : ''}`);
}
console.log(`공통 곡선: 관측 위치 ${known.join(',')} (기준 ${ref.name}), 그 위는 외삽`);

// 곡선이 따로인 보스: 자기 관측값만으로, 못 연 단계는 레벨 기준 — 마지막 세 구간의 레벨당 평균 배율 (몬몬 배율과 맞지 않아 평균을 씀)
// 단, 방어력만 따로이고 체력·공격력은 공통 곡선을 따르는 보스(볼트피온: 방어력 1500 고정 → 7단계 2000)는 곡선에 붙인다:
// 어긋남 후보마다 체력·공격력 ÷ 곡선이 1% 안에서 일정한 단계가 (관측 수 − 2) 이상이면 그 어긋남·배율을 쓰고, 방어력은 마지막 관측값을 이어 씀
function fitHpAtk(b) {
  let best = null;
  for (let off = -3; off <= 3; off++) {
    const ss = Object.keys(b.obs).map(Number).filter(s => curve[s + off]);
    if (ss.length < 3) continue;
    const mul = {}, special = new Set();
    for (const k of ['hp', 'atk']) {
      const r = ss.map(s => [s, b.obs[s][k] / curve[s + off][k]]);
      mul[k] = median(r.map(x => x[1]));
      for (const [s, v] of r) if (Math.abs(v / mul[k] - 1) > 0.01) special.add(s);
    }
    if (special.size <= 2 && (!best || special.size < best.special.size)) best = { off, mul, special, n: ss.length };
  }
  return best;
}
for (const b of alone.slice()) {
  const fit = fitHpAtk(b);
  if (!fit) continue;
  alone.splice(alone.indexOf(b), 1);
  const rows = [['단계', '보스 레벨', ...KEYS.map(k => LABEL[k]), '체력·공격력 출처', '방어력 출처', '속도·효과저항·효과명중 출처']];
  let last = null;
  for (let s = 1; s <= b.stages; s++) {
    const o = b.obs[s];
    if (o) { last = o; rows.push([s, b.levels[s] ?? '', ...KEYS.map(k => o[k]), '관측', '관측', '관측']); continue; }
    const c = curveAt(s + fit.off);
    rows.push([s, b.levels[s] ?? '', c ? Math.round(c.hp * fit.mul.hp) : '', c ? Math.round(c.atk * fit.mul.atk) : '', last.def, ...['spd', 'critRate', 'critDmg', 'effRes', 'effAcc'].map(k => last[k]),
      c ? (c.how === '곡선' ? `곡선 × 배율 (곡선 ${s + fit.off}단계)` : `외삽 — 레벨당 ×${perLv.hp.toFixed(4)}, 확인 필요`) : '없음',
      '자기 고정값 — 마지막 관측값을 이어 씀 (구간이 바뀔 때 계단식으로 오름, 확인 필요)', '마지막 관측값을 이어 씀 — 실제로는 계단식으로 오를 수 있음']);
  }
  writeFileSync(`${DIR}/${b.dir}/boss-stats-full.csv`, csv(rows));
  const sp = [...fit.special].sort((x, y) => x - y);
  const note = `${b.name}: 체력 ×${(fit.mul.hp).toFixed(3)} · 공격력 ×${(fit.mul.atk).toFixed(3)} · 어긋남 ${fit.off}${sp.length ? ` · 따로 조정된 단계 ${sp.join(',')}` : ''} · 방어력은 자기 고정값 (${[...new Set(Object.values(b.obs).map(o => o.def))].join(' → ')})`;
  appendFileSync(`${DIR}/boss-curve.txt`, note + '\n');
  console.log(`${b.name}: 방어력만 따로, 체력·공격력은 공통 곡선 · 관측 ${Object.keys(b.obs).length}단계 · 어긋남 ${fit.off >= 0 ? '+' : ''}${fit.off} · 배율 체력 ${fit.mul.hp.toFixed(3)} 공격력 ${fit.mul.atk.toFixed(3)}${sp.length ? ` · 따로 조정된 단계 ${sp.join(',')}` : ''}`);
}
for (const b of alone) {
  const ss = Object.keys(b.obs).map(Number).sort((x, y) => x - y), t = ss.slice(-4);
  const L = b.levels, dl = (L[t[t.length - 1]] ?? 0) - (L[t[0]] ?? 0);
  const per = Object.fromEntries(['hp', 'atk', 'def'].map(k => [k, Math.pow(b.obs[t[t.length - 1]][k] / b.obs[t[0]][k], 1 / dl)]));
  const rows = [['단계', '보스 레벨', ...KEYS.map(k => LABEL[k]), '체력·공격력·방어력 출처', '속도·효과저항·효과명중 출처']];
  const lastS = ss[ss.length - 1], last = b.obs[lastS];
  for (let s = 1; s <= b.stages; s++) {
    const o = b.obs[s];
    if (o) { rows.push([s, b.levels[s] ?? '', ...KEYS.map(k => o[k]), '관측', '관측']); continue; }
    rows.push([s, b.levels[s] ?? '', ...['hp', 'atk', 'def'].map(k => Math.round(last[k] * Math.pow(per[k], (b.levels[s] ?? 0) - (b.levels[lastS] ?? 0)))), ...['spd', 'critRate', 'critDmg', 'effRes', 'effAcc'].map(k => last[k]),
      `외삽 — 자기 곡선 레벨당 체력 ×${per.hp.toFixed(4)}, 확인 필요`, '마지막 관측값을 이어 씀 — 실제로는 계단식으로 오를 수 있음']);
  }
  writeFileSync(`${DIR}/${b.dir}/boss-stats-full.csv`, csv(rows));
  console.log(`${b.name}: 공통 곡선과 방어력이 안 맞음 → 따로 (관측 ${ss.length}단계, 나머지는 자기 곡선으로 외삽)`);
}
