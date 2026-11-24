// OCR 글자(data/monmon/ocr/<번호>.txt, rapid.py 가 만든 것) → 받아쓰기 JSON(data/monmon/json/<번호>.json, TRANSCRIBE.md 모양).
// 실행: node tools/ocr/parse.mjs
//  - 별 개수는 글자가 아니라 시트 그림(sheets/<번호>.png) 머리의 노란 별을 센다.
//  - 스탯은 시트 OCR 숫자를 쓰고, 칸별 OCR(ocr/<번호>.stats.txt, stats.py)로 빠지거나 끼어든 칸을 고른다.
// OCR 줄 모양: 같은 높이의 조각을 " | " 로 이음, 확신이 낮은 조각은 뒤에 "(?0.62)".
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { decodePNG } from '../../src/lib/png.js';

const DIR = 'data/monmon';
// 버프·디버프 표(effects.json)에 없지만 팝업 효과 목록에 나오는 즉시 효과 이름 — merge.mjs 도 이 목록을 받아 준다
export const OTHER_EFFECTS = ['강철 은신', '치유', '버프 제거', '디버프 제거', '버프 훔치기', '디버프 이전', '스킬 에너지 감소', '스킬 에너지 증가',
  '버프 지속시간 증가', '버프 지속시간 감소', '디버프 지속시간 증가', '디버프 지속시간 감소'];
/** 글자 하나 틀림까지 (OCR 오타: "치명확를") */
function near1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
const EFFECTS = JSON.parse(readFileSync('data/effects/effects.json', 'utf8')).map(e => e.name);
const squash = (s) => s.replace(/\s+/g, '');
const EFFECT_BY_KEY = new Map([...EFFECTS, ...OTHER_EFFECTS].map(n => [squash(n), n]));
const SLOTS = ['기본공격', '스킬', '패시브'];
const LOW = /\s*\(\?(0\.\d+)\)$/;
// 효과 줄의 숫자 칸: 시계(지속 턴)·모래시계(대기시간) 아이콘이 글자로 읽혀 앞에 붙는다 — "02", "83", "e1", "오5", "84"
// → 아이콘 글자 한 개 + 숫자 한 자리로 보고 끝자리만 쓴다 (10턴 이상은 없다고 보고, 있으면 틀림)
const TURN = /^\S?\d$/;
const turnOf = (t) => Number(t.slice(-1));
// rapid.py 가 숫자 칸을 따로 읽어 "T2"(시계 = 지속 턴) / "C5"(모래시계 = 대기시간) 로 넣는다. 없으면 자리 순서로 (첫째 = 지속, 둘째 = 대기)
function turnsOf(nums) {
  const T = nums.find(t => /^Td$/.test(t)), C = nums.find(t => /^Cd$/.test(t));
  if (T || C) return { turns: T ? turnOf(T) : null, cooldownTurns: C ? turnOf(C) : null };
  if (nums.length >= 3 && nums[0].length === 1) nums = nums.slice(1);   // 시계 아이콘이 따로 숫자로 읽힘 ("8 | 3 | 85")
  return { turns: nums[0] != null ? turnOf(nums[0]) : null, cooldownTurns: nums[1] != null ? turnOf(nums[1]) : null };
}

/** 조각 → 효과 이름. 아이콘이 앞에 붙어 읽힌 것("그회피")은 뒤쪽이 맞으면 인정 */
function effectName(t) {
  const k = squash(t);
  if (EFFECT_BY_KEY.has(k)) return EFFECT_BY_KEY.get(k);
  for (const [key, n] of EFFECT_BY_KEY) if (key.length >= 2 && k.length - key.length <= 2 && k.endsWith(key)) return n;
  const close = [...EFFECT_BY_KEY].filter(([key]) => key.length >= 5 && near1(k, key));
  if (close.length === 1) return close[0][1];
  return null;
}

/** 시트 머리(이름 줄 아래)의 노란 별: 노란 세로줄이 이어진 덩어리 수 */
function countStars(img) {
  const { width: W, data } = img, col = [];
  for (let x = 0; x < 260; x++) { let n = 0; for (let y = 70; y < 130; y++) { const i = (y * W + x) * 4; if (data[i] > 200 && data[i + 1] > 150 && data[i + 2] < 120) n++; } col.push(n >= 4); }
  let runs = 0, w = 0;
  for (const c of [...col, false]) { if (c) w++; else { if (w >= 8) runs++; w = 0; } }
  return runs;
}

function tokens(row) { return row.split(' | ').map(t => { const m = LOW.exec(t); return { text: t.replace(LOW, '').trim(), low: m ? Number(m[1]) : null }; }); }
const isNum = (t) => /^[\d,]+%?$/.test(t);
const num = (t) => Number(t.replace(/[,%]/g, ''));

/** 스탯 맞추기. 시트 전체 OCR: 체력(쉼표 있는 큰 숫자)은 정확하지만 작은 '0'을 놓치거나 아이콘을 숫자로 읽음.
 *  칸별 OCR(stats.py): 공격력~효과명중 7칸은 정확하지만 체력은 하트 아이콘 탓에 자주 틀림.
 *  → 체력 = 시트의 첫 숫자, 나머지 = 칸별 값 (못 읽은 칸만 시트 값). 시트가 8개로 맞게 읽혔는데 칸별과 다르면 적어 둔다. */
function reconcile(sheet, cells, issues) {
  const c = (cells || []).map(v => (v === '?' ? null : Number(v)));
  if (c.length !== 8) { if (sheet.length !== 8) issues.push(`스탯 숫자가 ${sheet.length}개로 읽힘 (${sheet.join(', ')})`); return sheet; }
  const out = [sheet[0] ?? c[0], ...c.slice(1).map((v, k) => v ?? (sheet.length === 8 ? sheet[k + 1] : null))];
  if (sheet.length === 8) {
    const diff = [1, 2, 3, 4, 5, 6, 7].filter(k => c[k] != null && c[k] !== sheet[k]);
    if (diff.length && !(sheet.slice(4).join() !== c.slice(4).join() && sheet.slice(5).join() === c.slice(4, 7).join()))   // 아이콘이 숫자로 끼어든 경우는 무시
      issues.push(`스탯 두 번 읽은 값이 다름 — 칸별 값 씀 (${diff.map(k => `${k + 1}번째 시트 ${sheet[k]}/칸 ${c[k]}`).join(', ')})`);
  }
  if (out.some(v => v == null)) issues.push(`스탯 못 읽은 칸 있음 (${out.join(', ')})`);
  return out;
}

/** scrolled: 스크롤해서 끝까지 다시 찍은 스킬 순번(1부터) 집합 */
function parse(no, text, stars, cells, scrolled = new Set()) {
  const rows = text.split(/\r?\n/).filter(r => r.trim());
  const issues = [];
  const m = { no, name: null, grade: null, stars, maxLevel: null, role: null, range: null, element: null, stats: {}, skills: [], issues };
  let i = 0;
  // ① 등급 | 이름
  const head = tokens(rows[i++] || '');
  if (head.length >= 2) { m.grade = head[0].text; m.name = head.slice(1).map(t => t.text).join(' '); } else { m.name = head[0]?.text ?? null; issues.push('등급·이름 줄을 나누지 못함'); }
  // 레벨 줄
  const lv = /\/\s*(\d+)/.exec(rows[i] || '');
  if (lv) { m.maxLevel = Number(lv[1]); i++; } else issues.push('최대 레벨 못 읽음');
  // ② 역할·거리·속성: 스탯 줄(숫자 3개 이상) 전까지의 한글 조각 (확신 낮은 조각은 상성 아이콘 줄의 잡음)
  const stat0 = rows.findIndex((r, k) => k >= i && tokens(r).filter(t => isNum(t.text)).length >= 3);
  const words = rows.slice(i, stat0 < 0 ? i : stat0).flatMap(tokens).filter(t => /^[가-힣]+$/.test(t.text) && (t.low == null || t.low >= 0.8)).map(t => t.text);
  [m.role, m.range, m.element] = [words[0] ?? null, words[1] ?? null, words[2] ?? null];
  if (words.length < 3) issues.push(`역할·거리·속성 칸이 ${words.length}개로 읽힘 (${words.join(', ')})`);
  // ③ 스탯 8개
  const nums = [];
  for (i = stat0; i >= 0 && i < rows.length && !SLOTS.includes(tokens(rows[i])[0].text); i++) for (const t of tokens(rows[i])) if (isNum(t.text)) nums.push(num(t.text));
  const st = reconcile(nums, cells, issues);
  ['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effRes', 'effAcc'].forEach((k, j) => { m.stats[k] = st[j] ?? null; });
  // ④ 스킬 팝업
  let s = null;
  const finish = () => {
    if (!s) return;
    s.desc = s._desc.join(' ').replace(/,(?=\S)/g, ', ').replace(/\s+/g, ' ').trim() || null;
    s.damageBase = s._base.length ? s._base.join(' / ') : null;
    // 레벨 줄이 하나도 없으면 아래가 잘렸을 수 있다 — 단, 스크롤해서 끝까지 본 팝업은 원래 레벨 줄이 없는 것
    if (!s.levels.length && !scrolled.has(m.skills.length + 1)) issues.push(`${s.name} 아래 잘림 — 레벨 줄이 안 보임 (설명·효과가 더 있을 수 있음)`);
    for (const e of s.effects) if (e.turns == null && EFFECTS.includes(e.name)) issues.push(`${s.name}: ${e.name} 지속 턴 못 읽음`);
    delete s._desc; delete s._base; delete s._seen;
    m.skills.push(s);
  };
  for (; i < rows.length; i++) {
    const tk = tokens(rows[i]), first = tk[0].text;
    if (SLOTS.includes(first) && (tk.some(t => /간략|상세/.test(t.text)) || /Level/i.test(rows[i + 1] || ''))) {
      const nameRow = rows[i + 1] || '';
      // "전격충전 | Level.1" 처럼 조각으로 나뉘어도 이름만
      const nm = tokens(nameRow).map(t => t.text).filter(t => !/^Level\s*[.,]?\s*\d*$/i.test(t)).join(' ').replace(/\s*L(e(v(e(l)?)?)?)?\s*[.,]?\s*\d*\s*$/, '').replace(/[^가-힣0-9)]+$/, '').trim();   // "처형L", "방벽[ !" 처럼 끝에 붙은 잡음도
      i++;
      if (s && s.slot === first && (squash(nm) === squash(s.name) || (squash(nm).length >= 3 && near1(squash(nm), squash(s.name))))) continue;   // 스크롤 캡처가 같은 팝업 머리를 다시 보여 줌 → 이어 쓴다
      finish();
      s = { slot: first, name: nm, cooldownTurns: null, desc: null, damageBase: null, otherBases: [], effects: [], levels: [], _desc: [], _base: [], _seen: new Set() };
      if (!/Level/i.test(nameRow)) issues.push(`${s.name}: 이름 줄에 Level 이 안 보임 (이름 확인 필요)`);
      continue;
    }
    if (!s) continue;
    const line = tk.map(t => t.text).join(' ');
    if (s._seen.has(squash(line))) continue;   // 스크롤 캡처와 겹친 줄
    s._seen.add(squash(line));
    const cd = /대기시간\s*(\d+)\s*턴/.exec(line);
    if (cd && line.replace(/\s/g, '').length <= 8) { s.cooldownTurns = Number(cd[1]); continue; }
    if (/^LV\s*\d+/.test(first)) { s.levels.push(first.replace(/^LV\s*(\d+)\s*/, 'LV $1 ')); continue; }
    // "피해량 기반: [자신의 공격력]" → damageBase,  "보호막 기반: […]" 같은 다른 기반 → otherBases
    const base = /^([가-힣]+)\s*기반[\s:]*\[?(.+?)\]?$/.exec(line);
    if (base) { if (base[1] === '피해량') s._base.push(base[2].trim()); else s.otherBases.push(`${base[1]}: ${base[2].trim()}`); continue; }
    // 효과 줄: [아이콘 조각] 이름 | 시계 숫자(지속 턴) [| 모래시계 숫자(이 효과의 대기시간)]
    const ti = tk.findIndex((t, k) => k > 0 && TURN.test(t.text));
    const cand = (ti > 0 ? tk.slice(0, ti) : tk).filter(t => effectName(t.text) || !(t.text.length <= 1 || (t.low != null && t.text.length <= 2)));
    // 이름이 조각으로 나뉘어 읽힌 것("방어력 | 감소(약)")은 이어 붙여서 먼저 맞춰 본다
    const joined = { text: cand.map(t => t.text).join(' '), low: null };
    const nameTok = (cand.length > 1 && effectName(joined.text) ? joined : null) || cand.find(t => effectName(t.text)) || cand[cand.length - 1] || tk[0];
    const known = effectName(nameTok.text);
    if ((known && (ti > 0 || tk.length === 1)) || (ti > 0 && /^[가-힣 ()]{2,16}$/.test(nameTok.text))) {
      let nums = ti > 0 ? tk.slice(ti).filter(t => TURN.test(t.text)).map(t => t.text) : [];
      if (!nums.length && i + 1 < rows.length) {   // 숫자만 다음 줄로 떨어짐 ("2 | 4")
        const nx = tokens(rows[i + 1]).map(t => t.text);
        if (nx.length <= 3 && nx.every(t => TURN.test(t))) { nums = nx; i++; }
      }
      const e = { name: known ?? nameTok.text, ...turnsOf(nums) };
      // 스크롤 캡처와 겹쳐 같은 효과가 또 나옴 → 빈 칸만 채운다
      const same = s.effects.find(x => x.name === e.name && (x.turns == null || e.turns == null || x.turns === e.turns));
      if (same) { same.turns ??= e.turns; same.cooldownTurns ??= e.cooldownTurns; } else s.effects.push(e);
      if (!known) issues.push(`${s.name}: 효과 목록에 없는 이름 "${nameTok.text}"`);
      continue;
    }
    // 숫자만 있는 줄 ("2 | 5"): 숫자를 못 받은 앞 효과의 것 (스크롤 겹침으로 몇 줄 뒤에 떨어짐)
    const lone = tk.map(t => t.text);
    if (lone.length <= 3 && lone.every(t => TURN.test(t))) {
      const e = [...s.effects].reverse().find(x => x.turns == null);
      if (e) { const t = turnsOf(lone); e.turns = t.turns; e.cooldownTurns ??= t.cooldownTurns; }
      continue;
    }
    // 소제목 ("4턴에 한 번" 같은 짧은 줄) → [ ]
    if (line.length <= 14 && !/[.,[\]%]/.test(line)) { s._desc.push(`[${line}]`); continue; }
    for (const t of tk) if (t.low != null && t.low < 0.7 && t.text.length > 1) issues.push(`${s.name}: 글자 확신 낮음 "${t.text}" (${t.low})`);
    s._desc.push(tk.filter(t => !(t.low != null && t.text.length <= 1)).map(t => t.text).join(' '));
  }
  finish();
  return m;
}

function main() {
  mkdirSync(`${DIR}/json`, { recursive: true });
  // 스크롤해서 끝까지 다시 찍은 팝업 (scrollshots.ps1 기록: "<번호> 칸 <스킬 순번> 스크롤 <n> 장")
  const log = `${DIR}/raw/scroll-log.txt`;
  const SCROLLED = existsSync(log) ? [...readFileSync(log, 'utf8').matchAll(/^(\d{3}) 칸 (\d+) 스크롤/gm)].map(x => [x[1], Number(x[2])]) : [];
  const files = readdirSync(`${DIR}/ocr`).filter(f => /^\d{3}\.txt$/.test(f)).sort();
  for (const f of files) {
    const no = f.slice(0, 3);
    const stars = countStars(decodePNG(readFileSync(`${DIR}/sheets/${no}.png`)));
    const cf = `${DIR}/ocr/${no}.stats.txt`;
    const cells = existsSync(cf) ? readFileSync(cf, 'utf8').trim().split(/\s+/) : null;
    const scrolled = new Set(SCROLLED.filter(([n]) => n === no).map(([, k]) => k));
    writeFileSync(`${DIR}/json/${no}.json`, JSON.stringify(parse(no, readFileSync(`${DIR}/ocr/${f}`, 'utf8'), stars, cells, scrolled), null, 2) + '\n');
  }
  console.log(`${files.length}개 → ${DIR}/json`);
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').replace(/^.*?tools\//, 'tools/'))) main();
