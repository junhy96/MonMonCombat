// 아래가 잘린 스킬 팝업(레벨 줄이 하나도 안 보임 = 설명·효과가 더 있을 수 있음) 목록 → data/monmon/raw/cut-list.txt
// 한 줄에 "<번호> <칸(1부터)> <그 몬몬의 스킬 수>" — tools/capture/scrollshots.ps1 이 읽는다.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const DIR = 'data/monmon';
const lines = [];
for (const f of readdirSync(`${DIR}/json`).filter(f => /^\d{3}\.json$/.test(f)).sort()) {
  const m = JSON.parse(readFileSync(`${DIR}/json/${f}`, 'utf8'));
  m.skills.forEach((s, i) => { if (!s.levels.length) lines.push(`${m.no} ${i + 1} ${m.skills.length}`); });
}
writeFileSync(`${DIR}/raw/cut-list.txt`, lines.join('\n') + '\n');
console.log(`잘린 팝업 ${lines.length}개 → ${DIR}/raw/cut-list.txt`);
