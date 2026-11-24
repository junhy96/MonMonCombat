// data/monmon/json/*.json(몬몬별 받아쓰기)을 검사하고 표로 합친다.
// 실행: node tools/ocr/merge.mjs
// 출력: data/monmon/monmon.json, monmon.csv(몬몬 1행, 레벨당 스탯 상승 칸은 비워 둠 — 직접 입력), skills.csv(스킬 1행),
//       skill-levels.csv(팝업의 "LV n …" 줄), check.txt(문제 목록)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { OTHER_EFFECTS } from './parse.mjs';

const DIR = 'data/monmon';
const EFFECTS = new Set([...JSON.parse(readFileSync('data/effects/effects.json', 'utf8')).map(e => e.name), ...OTHER_EFFECTS]);
const files = readdirSync(`${DIR}/json`).filter(f => /^\d{3}\.json$/.test(f)).sort();
const all = [], problems = [];
for (const f of files) {
  let m;
  try { m = JSON.parse(readFileSync(`${DIR}/json/${f}`, 'utf8')); } catch (e) { problems.push(`${f}: JSON 오류 ${e.message}`); continue; }
  const p = (msg) => problems.push(`${m.no ?? f} ${m.name ?? ''}: ${msg}`);
  for (const k of ['name', 'grade', 'role', 'range', 'element']) if (!m[k]) p(`${k} 없음`);
  for (const k of ['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effRes', 'effAcc']) if (!Number.isFinite(m.stats?.[k])) p(`스탯 ${k} 없음`);
  // 레어는 대개 3개지만 패시브가 둘인 레어(키키위·올챙잉·파이어냥)도 있다
  const need = { 전설: [4], 에픽: [4], 레어: [3, 4], 고급: [2], 일반: [2] }[m.grade];
  if (!Array.isArray(m.skills) || (need && !need.includes(m.skills.length))) p(`스킬 ${m.skills?.length ?? 0}개 (${m.grade} ${need?.join('·') ?? '?'}개여야 함)`);
  for (const s of m.skills || []) {
    if (!s.name) p(`${s.slot} 스킬 이름 없음`);
    for (const e of s.effects || []) if (!EFFECTS.has(e.name)) p(`${s.name}: 효과 목록에 없는 이름 "${e.name}"`);
  }
  for (const i of m.issues || []) p(`받아쓰기 메모 — ${i}`);
  all.push(m);
}
// 같은 이름이 두 번(한 바퀴 넘게 돎) → 앞의 것만
const seen = new Set(), list = all.filter(m => (seen.has(m.name) ? (problems.push(`${m.no} ${m.name}: 이름 중복 — 뺌`), false) : seen.add(m.name)));

const csv = (rows) => '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';
writeFileSync(`${DIR}/monmon.json`, JSON.stringify(list, null, 2) + '\n');
writeFileSync(`${DIR}/monmon.csv`, csv([
  ['번호', '이름', '등급', '별', '최대 레벨', '역할', '거리', '속성', '체력', '공격력', '방어력', '속도', '치명확률(%)', '치명피해(%)', '효과저항', '효과명중', '레벨당 체력 (입력)', '레벨당 공격력 (입력)', '레벨당 방어력 (입력)', '레벨당 속도 (입력)', '기본공격', '스킬', '패시브(★3)', '패시브(★5)', '메인 이미지'],
  ...list.map(m => [m.no, m.name, m.grade, m.stars, m.maxLevel, m.role, m.range, m.element, ...['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effRes', 'effAcc'].map(k => m.stats?.[k]), '', '', '', '', ...[0, 1, 2, 3].map(i => m.skills?.[i]?.name), `art/${m.no}.png`]),
]));
const SLOT = ['기본공격', '스킬', '패시브(★3)', '패시브(★5)'];
writeFileSync(`${DIR}/skills.csv`, csv([
  ['몬몬', '칸', '종류', '스킬 이름', '대기시간(턴)', '피해량 기반', '그 밖의 기반', '설명', ...[1, 2, 3, 4].flatMap(k => [`효과${k}`, `효과${k} 턴`, `효과${k} 대기(턴)`])],
  ...list.flatMap(m => (m.skills || []).map((s, i) => [m.name, SLOT[i], s.slot, s.name, s.cooldownTurns, s.damageBase, (s.otherBases || []).join(' / '), s.desc, ...[0, 1, 2, 3].flatMap(k => [s.effects?.[k]?.name, s.effects?.[k]?.turns, s.effects?.[k]?.cooldownTurns])])),
]));
writeFileSync(`${DIR}/skill-levels.csv`, csv([
  ['몬몬', '칸', '스킬 이름', '레벨', '내용'],
  ...list.flatMap(m => (m.skills || []).flatMap((s, i) => (s.levels || []).map(l => { const mm = /^LV\s*(\d+)\s*(.*)$/.exec(l) || []; return [m.name, SLOT[i], s.name, mm[1] ?? '', mm[2] ?? l]; }))),
]));
writeFileSync(`${DIR}/check.txt`, problems.join('\n') + '\n');
console.log(`몬몬 ${list.length}개 · 스킬 ${list.reduce((a, m) => a + (m.skills?.length ?? 0), 0)}개 · 확인할 점 ${problems.length}개`);
