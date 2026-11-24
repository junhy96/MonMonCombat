// 보스 공략 OCR 글자(tools/ocr/guide.py 결과) → 보스 표
// 실행: node tools/ocr/bossguide.mjs <캡처 폴더> <출력 폴더>
//   입력: info-early.txt, info-mid.txt, info-late.txt, skills.txt, stages.txt
//   출력: guide.json, boss-stages.csv(단계 1~N), boss-skills.csv
// 끌어 내리며 찍은 장이 겹쳐 같은 구역이 두 번 나오면 **나중 것**을 쓴다(앞 장 아래쪽은 잘려 있어서).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const [IN, OUT] = process.argv.slice(2);
if (!IN || !OUT) { console.error('node tools/ocr/bossguide.mjs <캡처 폴더> <출력 폴더>'); process.exit(1); }
const read = (f) => (existsSync(`${IN}/${f}`) ? readFileSync(`${IN}/${f}`, 'utf8') : '');
// 자주 나오는 OCR 오타 (같힌→갇힌 등)
const TYPO = [[/같힌/g, '갇힌'], [/같혀/g, '갇혀'], [/뜯다\./g, '뜬다.'], [/불길한영혼/g, '불길한 영혼']];
const clean = (l) => TYPO.reduce((s, [a, b]) => s.replace(a, b), l).replace(/\s*\(\?0\.\d+\)/g, '').replace(/^[·•\s]+/, '').split(' | ').join(' ').replace(/\s+/g, ' ').replace(/\s*([,\]])/g, '$1').replace(/,(?=\S)/g, ', ').replace(/\](?=[가-힣])/g, '] ').trim();
const lines = (t) => t.split(/\r?\n/).map(clean).filter(Boolean);

/** 머리 줄(head) 뒤부터 다음 머리 줄 전까지 — 마지막으로 나온 구역 */
function section(ls, head, stops) {
  let at = -1;
  ls.forEach((l, i) => { if (l.replace(/\s/g, '') === head.replace(/\s/g, '')) at = i; });
  if (at < 0) return [];
  const out = [];
  for (let i = at + 1; i < ls.length; i++) {
    if (stops.some(s => ls[i].replace(/\s/g, '').startsWith(s.replace(/\s/g, '')))) break;
    out.push(ls[i]);
  }
  return out;
}
const HEADS = ['이 보스는', '공략 포인트', '내 구간', '보스 패턴', '이렇게 풀어요', '필요한 효과', '종족 강점 몬몬', '초반', '1~6'];
const joinText = (arr) => arr.filter(l => !/^(미보유|내\s*몬몬으로)/.test(l)).join(' ').replace(/\s+/g, ' ').trim();
/** 문장 단위 목록 ("• " 줄머리가 OCR 에 없어서 마침표·"요." 로 끊음) */
const sentences = (t) => t.split(/(?<=[.요])\s+/).map(s => s.trim()).filter(Boolean);

// 구간 경계: 공략 정보의 구간 탭 줄("1~6 | 7~11 | 12~20", "1~6 | 7~20", 고블린 "1~4 | 5~8 | 9~15")에서 읽는다 → 단계 수 N
const tabRow = lines(read('info-early.txt')).map(l => [...l.matchAll(/(\d+)\s*~\s*(\d+)/g)].map(m => [Number(m[1]), Number(m[2])])).find(r => r.length >= 2 && r[0][0] === 1) || [[1, 6], [7, 15], [16, 20]];
const N = tabRow[tabRow.length - 1][1];

const info = {};
for (const band of ['early', 'mid', 'late']) {
  const ls = lines(read(`info-${band}.txt`));
  if (!ls.length) continue;
  info[band] = {
    pattern: sentences(joinText(section(ls, '보스 패턴', HEADS))),
    solve: sentences(joinText(section(ls, '이렇게 풀어요', HEADS))),
  };
  if (!info.name) {
    info.name = ls[0];
    info.island = ls[1];
    const r = ls.findIndex(l => /(^|\s)종족$/.test(l));   // "* 종족" 처럼 아이콘 조각이 붙기도
    info.race = r >= 0 ? ls[r + 1] : null;
    info.intro = joinText(section(ls, '이 보스는', HEADS));
    const need = section(ls, '필요한 효과', HEADS);
    info.needed = need.filter(l => !/^(미보유|내\s*몬몬으로|\d+$|보유한 몬몬이 없어요)/.test(l)).filter((l, i, a) => a.findIndex(x => x.replace(/\s/g, '') === l.replace(/\s/g, '')) === i);
    info.raceNote = joinText(section(ls, '종족 강점 몬몬', HEADS));
  }
}

// 스킬: "이름" 다음 줄이 종류(기본공격/스킬/패시브)인 곳이 블록 시작. 같은 이름은 나중 블록으로
const KINDS = ['기본공격', '스킬', '패시브'];
const sl = lines(read('skills.txt')).filter(l => !/자세히\s*보기/.test(l));
const blocks = new Map();
for (let i = 0; i < sl.length; i++) {
  if (!KINDS.includes(sl[i + 1]) || KINDS.includes(sl[i])) continue;
  if (/[[\],%.]/.test(sl[i]) || sl[i].length > 14) continue;   // 설명 줄이 이름 자리로 잡힌 것
  const name = sl[i], kind = sl[i + 1], desc = [];
  let j = i + 2;
  for (; j < sl.length && !(KINDS.includes(sl[j + 1]) && !KINDS.includes(sl[j])) && !KINDS.includes(sl[j]); j++) desc.push(sl[j]);
  const key = name.replace(/\s/g, ''), text = desc.join(' ').replace(/\s+/g, ' ').trim();
  if (!text && blocks.has(key)) continue;   // 아래가 잘린 블록
  const squashText = text.replace(/\s/g, '');
  const twin = [...blocks.entries()].find(([k, b]) => k !== key && squashText && b.desc.replace(/\s/g, '') === squashText);
  if (twin) continue;   // 같은 설명이 이름만 잘못 읽혀 또 나옴 → 먼저 읽힌 이름
  blocks.delete(key);
  blocks.set(key, { name, kind, desc: text });
}
const skills = [...blocks.values()];

// 단계: "스테이지 N" 뒤에 처음 나오는 "Lv.X". OCR 이 "스테이지: 113" 처럼 읽으면 100 을 뺀다
const stageLv = {};
let cur = null;
for (const l of lines(read('stages.txt'))) {
  const s = /스테이지\D{0,3}(\d{1,3})/.exec(l);
  if (s) { let n = Number(s[1]); if (n > N) n %= 100; cur = n >= 1 && n <= N ? n : null; }
  const v = /L[Vv][.:]?\s*(\d+)/.exec(l);   // "Lv.50", "Lv:50"
  if (v && cur) stageLv[cur] = Number(v[1]);   // 여러 번 읽히면 마지막 값 (앞 장 끝은 줄이 어긋나기 쉬움)
}

// --ref <guide.json>: 못 읽은 단계 레벨을 다른 보스(같은 던전 종류) 값으로 채운다 — 읽힌 값이 모두 같을 때만
const refArg = process.argv.indexOf('--ref');
const filled = [];
if (refArg > 0) {
  const ref = JSON.parse(readFileSync(process.argv[refArg + 1], 'utf8')).stageLevels || {};
  // 앞자리만 읽힌 값("1C"→1, "120"→12)은 기준 값의 앞자리와 같으면 잘린 것으로 보고 기준 값으로
  // 뒤에 글자가 붙어 읽힌 값("27"→"274")도 같은 식으로
  for (const [k, v] of Object.entries(stageLv)) if (ref[k] != null && ref[k] !== v && (String(ref[k]).startsWith(String(v)) || String(v).startsWith(String(ref[k])))) delete stageLv[k];
  const clash = Object.entries(stageLv).filter(([k, v]) => ref[k] != null && ref[k] !== v);
  if (clash.length) console.log(`기준과 다른 단계 레벨이 있어 채우지 않음: ${clash.map(([k, v]) => `${k}단계 ${v}/${ref[k]}`).join(', ')}`);
  else for (let st = 1; st <= N; st++) if (stageLv[st] == null && ref[st] != null) { stageLv[st] = ref[st]; filled.push(st); }
}
info.stageLevelsFilledFromRef = filled;

const BANDS = tabRow.length === 2 ? { early: tabRow[0], late: tabRow[1] } : { early: tabRow[0], mid: tabRow[1], late: tabRow[2] };
info.bands = BANDS;
const band = (st) => Object.keys(BANDS).find(k => st >= BANDS[k][0] && st <= BANDS[k][1]);
const NAMES = { early: '초반', mid: '중반', late: '후반' };
const BAND_LABEL = Object.fromEntries(Object.entries(BANDS).map(([k, [a, b]]) => [k, `${NAMES[k]} ${a}~${b}`]));
const csv = (rs) => '﻿' + rs.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/guide.json`, JSON.stringify({ ...info, stageLevels: stageLv, skills }, null, 2) + '\n');
writeFileSync(`${OUT}/boss-stages.csv`, csv([
  ['단계', '구간', '보스 레벨', '보스 패턴 (화면)', '이렇게 풀어요 (화면)', '비고'],
  ...Array.from({ length: N }, (_, k) => k + 1).map(st => {
    const b = band(st), first = st === BANDS[b][0];
    return [st, BAND_LABEL[b], stageLv[st] ?? '', first ? (info[b]?.pattern || []).join(' / ') : '', first ? (info[b]?.solve || []).join(' / ') : '', filled.includes(st) ? '레벨 못 읽음 — 같은 던전 종류 다른 보스 값' : ''];
  }),
]));
writeFileSync(`${OUT}/boss-skills.csv`, csv([['스킬', '종류', '설명 (화면)'], ...skills.map(s => [s.name, s.kind, s.desc])]));
const miss = Array.from({ length: N }, (_, k) => k + 1).filter(st => stageLv[st] == null);
console.log(`${info.name} (${info.island}, ${info.race}) · 스킬 ${skills.length}개 · 단계 레벨 ${N - miss.length}/${N}${miss.length ? ` (빠짐: ${miss.join(',')})` : ''} → ${OUT}`);
