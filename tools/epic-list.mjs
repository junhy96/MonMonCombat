// 에픽 몬몬 목록 (문항 2: 에픽 열쇠 던전) — data/monmon/json → data/monmon/epic/
//   epics.csv        : 에픽 78마리 한 줄씩 (스탯 + 스킬 이름 + 가진 효과 + 다회/광역 여부)
//   epic-skills.csv  : 에픽 스킬 한 줄씩 (설명 전문)
//   effects-by-grade.csv : 효과마다 (모든 효과) 등급별 보유 몬몬 수 + 에픽 비중 (에픽만/에픽 위주 효과 찾기)
// 실행: node tools/epic-list.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';

const SRC = 'data/monmon/json', OUT = 'data/monmon/epic';
const GRADES = ['전설', '에픽', '레어', '고급', '일반'];
const all = readdirSync(SRC).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(`${SRC}/${f}`, 'utf8')));
const csv = (rows) => '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';

const hits = (d) => Math.max(0, ...[...(d || '').matchAll(/(\d+)\s*(회|번)\s*(연쇄되는\s*)?(공격으로\s*)?피해/g)].map(m => +m[1]));
const aoe = (d) => /모든 적|전방 범위|범위 내 적/.test(d || '');
const effectsOf = (m) => [...new Set(m.skills.flatMap(s => s.effects.map(e => e.name)))];

const epics = all.filter(m => m.grade === '에픽').sort((a, b) => a.no.localeCompare(b.no));
mkdirSync(OUT, { recursive: true });

writeFileSync(`${OUT}/epics.csv`, csv([
  ['번호', '이름', '별', '최대 레벨', '역할', '거리', '속성', '체력', '공격력', '방어력', '속도', '치명확률', '치명피해', '효과저항', '효과명중',
    '기본공격', '스킬', '패시브(★3)', '패시브(★5)', '최대 타수', '광역', '가진 효과'],
  ...epics.map(m => {
    const sk = (i) => (m.skills[i]?.name ?? '').replace(/\s*Level.*$/, '');
    return [m.no, m.name, m.stars, m.maxLevel, m.role, m.range, m.element, ...['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effRes', 'effAcc'].map(k => m.stats[k]),
      sk(0), sk(1), sk(2), sk(3), Math.max(0, ...m.skills.map(s => hits(s.desc))) || '', m.skills.some(s => aoe(s.desc)) ? 'O' : '', effectsOf(m).join(' / ')];
  }),
]));

writeFileSync(`${OUT}/epic-skills.csv`, csv([
  ['번호', '이름', '칸', '스킬 이름', '대기(턴)', '피해량 기반', '효과', '설명 (화면)'],
  ...epics.flatMap(m => m.skills.map((s, i) => [m.no, m.name, i < 2 ? s.slot : `패시브(★${i === 2 ? 3 : 5})`, s.name, s.cooldownTurns ?? '', s.damageBase ?? '',
    s.effects.map(e => `${e.name}${e.turns ? ` ${e.turns}턴` : ''}`).join(' / '), s.desc])),
]));

// 효과별 등급 분포
const byEff = new Map();
for (const m of all) for (const e of effectsOf(m)) {
  if (!byEff.has(e)) byEff.set(e, Object.fromEntries(GRADES.map(g => [g, []])));
  byEff.get(e)[m.grade]?.push(m.name);
}
const rows = [...byEff].map(([e, g]) => {
  const total = GRADES.reduce((n, k) => n + g[k].length, 0);
  return { e, g, total, share: g['에픽'].length / total };
}).sort((a, b) => b.share - a.share || b.g['에픽'].length - a.g['에픽'].length);
writeFileSync(`${OUT}/effects-by-grade.csv`, csv([
  ['효과', '전체', ...GRADES, '에픽 비중', '레어 이하 보유', '에픽 보유 몬몬'],
  ...rows.map(r => [r.e, r.total, ...GRADES.map(k => r.g[k].length), `${Math.round(r.share * 100)}%`,
    r.g['레어'].length + r.g['고급'].length + r.g['일반'].length, r.g['에픽'].join(' ')]),
]));

// 요약
const count = (key) => Object.entries(epics.reduce((o, m) => (o[m[key]] = (o[m[key]] || 0) + 1, o), {})).sort((a, b) => b[1] - a[1]);
console.log(`에픽 ${epics.length}마리`);
console.log('별:', count('stars').map(([k, v]) => `${k}★ ${v}`).join(' · '));
console.log('역할:', count('role').map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('거리:', count('range').map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('속성:', count('element').map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('에픽 위주 효과 (레어 이하 0):');
for (const r of rows.filter(r => r.g['에픽'].length && r.g['레어'].length + r.g['고급'].length + r.g['일반'].length === 0)) console.log(`  ${r.e}: 에픽 ${r.g['에픽'].length} · 전설 ${r.g['전설'].length} — ${r.g['에픽'].join(' ')}`);
