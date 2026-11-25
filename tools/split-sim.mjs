// 문항 2 분열 보스 — 처음부터 끝까지 전투 시뮬레이션 (시간 0.1초 단위, 시드 고정 몬테카를로)
// 전투 엔진(src/combat)이 아니라 사용자 관측값·결정만으로 만든 전용 계산. 가정은 docs/q2-split-boss-data.md 「전체 전투 시뮬레이션」.
// 실행: node tools/split-sim.mjs
import { mulberry32 } from '../src/lib/rng.js';

// ── 시간 규칙 (사용자 관측) ─────────────────────────────
const BASIC_T = 1.6;          // 속도 100 몬몬 평타 간격(초) — 보스 게이지 12초 ≈ 평타 7.5번
const SKILL_T = 16;           // 속도 100 몬몬 스킬 주기 = 평타 10번
const PIECE_BASIC_T = 2.4;    // 속도 100 보스: 평타 4번 뒤 스킬, 한 주기 ≈ 아군 평타 6번(9.6초)
const PIECE_SKILL_T = 9.6;
const REVIVE_T = +(process.env.REVIVE ?? 15);          // 부활 자체 타이머 1턴 ≈ 속도 100 스킬 0.9~1번 (14.4~16초)
const BUFF_T = 30;            // "2턴" 아군 버프 ≈ 받은 몬몬 스킬 2번 ≈ 30초 근사
const DT = 0.1, MAX_T = 600;

// ── 아군 (사용자 계정: 체력 = 기본 + 초록, 피해 = 글라틀 10단계에서 본 값) ──
const ALLY = {
  콜리킹: { hp: 12451, spd: 119, basic: 124, kind: 'shieldSelf' },
  딸랑귀: { hp: 14182, spd: 102, basic: 117, skill: 3216, crit: 0.28, critSkill: 5000, kind: 'aoeDebuff' },   // 피해 모름 → 관측한 쥐강이 값으로 대신 (사용자), 대상은 딸랑귀 스킬대로 주변 범위
  쥐강이: { hp: 9650, spd: 110, basic: 117, skill: 3216, crit: 0.37, critSkill: 5000, kind: 'single' },
  파이온: { hp: 16630, spd: 102, basic: 318, skill: 7470, kind: 'aoe' },
  콘센파리: { hp: 13026, spd: 127, basic: 120, skill: 2900, kind: 'singleSpeedBuff' },
  // 열쇠 후보 — 사용자 계정에 없음 → 쥐강이와 같은 화력 가정
  톡찌리: { hp: 12000, spd: 100, basic: 117, skill: 3876, kind: 'tok' },
  몽실벌: { hp: 12000, spd: 100, basic: 117, skill: 3876, kind: 'reflect' },   // 패시브 [달콤한 보답]: 아군이 반사한 뒤 그 아군을 몽실벌 최대 체력 1% 치유
  촛동: { hp: 13000, spd: 100, basic: 117, kind: 'stealth' },
  대조군: { hp: 12000, spd: 100, basic: 117, skill: 3876, kind: 'single' },   // 열쇠 몬몬과 같은 체력·속도·화력, 열쇠 효과만 없음 — 열쇠 효과는 이것과 비교
};

// ── 분열체 (기획 후보값 — docs 「분열체 시작값 제안」) ──
const E = process.env;
const PD = +(E.PDMG ?? 1);   // 분열체 피해 배율 (기획값 조정용)
const PIECE = { basic: +(E.PBASIC ?? 150) * PD, singleSkill: 1500 * PD, aoeSkill: 750 * PD, counter: +(E.PCOUNTER ?? 1250) * PD, ramp: +(E.RAMP ?? 0.25), aoeCut: +(E.AOECUT ?? 0.3) };
const START = +(E.START ?? 1);   // 아군 시작 게이지 = 0 ~ START 사이 무작위. 게임: 몬몬마다 다름(사용자 확인), 값은 모름 → 기본 0~100%
const SYNC = E.SYNC ? +E.SYNC : 0;
const PCT = E.PCT === '1';   // 분열체 피해를 맞는 몬몬 최대 체력 % 로 (고정 피해 대신)
const PCTV = { basic: +(E.PCT_BASIC ?? 1), singleSkill: +(E.PCT_SINGLE ?? 11), aoeSkill: +(E.PCT_AOE ?? 6), counter: +(E.PCT_COUNTER ?? 38) };   // % — 고정 후보값(150·1,500·750·5,000) ÷ 파티 평균 체력 약 13,200
const NOREFLPCT = E.NOREFLPCT === '1';
const SLOW = +(E.SLOW ?? 0) / 100, SLOWN = +(E.SLOWN ?? 2), SLOWMAX = +(E.SLOWMAX ?? 1);   // 모든 적형 스킬에 [속도 감소]: 가까운 SLOWN 명, 한 겹당 SLOW%, 최대 SLOWMAX 겹(쌓일수록 점점 느려짐), 2턴 ≈ 30초
const REFLMUL = +(E.REFLMUL ?? 0.16);   // 반사 피해도 공격한 분열체의 방어력에 깎임 (사용자 확인). 깎이는 비율은 관측 평타 ÷ 공격력(파이온 0.125·쥐강이 0.096·콘센파리 0.20·콜리킹 0.22)의 중앙값 약 0.16으로 추정   // % 피해는 반사되지 않음 (게임 규칙 모름 → 두 경우)   // >0: 아군 전원 속도를 이 값으로 맞춤 (속도 세트 등으로 속도를 맞춘 파티)
const R4 = E.R4 === '1';   // [4턴에 한 번] 효과가 4번째 스킬에서 처음 나감 (기본: 첫 스킬부터)   // 아군 시작 게이지 0~START (1이면 게이지가 제각각 = 분열이 전투 중간에 일어난 상황)
if (E.DAL) ALLY.딸랑귀.skill = +E.DAL;
const SPLIT = +(E.SPLIT ?? 0);   // >0: 처음엔 한 몸(체력 SPLIT)으로 싸우다 쓰러지면 4마리로 분열 — 첫 일제 사격을 한 몸이 받음
const INSTANT = E.INSTANT === '1';
const CTARGET = E.CTARGET ?? 'user';   // user: 다수 공격을 쓴 그 몬몬 1명을 때림(단일 — 은신이면 안 맞음, 맞으면 바로) / all: 아군 전체 (이전 방식)   // 반격 자세인 분열체가 다수 공격을 맞으면 그 자리에서 바로 반격 (기본: 자세 턴이 끝날 때)
const HS = E.HS ? E.HS.split(",").map(Number) : [8000, 9500, 11000, 13000];

function simulate(team, H, rnd) {
  const allies = team.map(n => ({ n, ...ALLY[n], ...(SYNC ? { spd: SYNC } : {}), max: ALLY[n].hp, alive: true, shield: 0, gauge: rnd() * START, bt: rnd() * BASIC_T, casts: 0 }));
  const mk = (i) => ({ i, type: i % 2 ? 'aoe' : 'single', hp: H, alive: true, deadAt: 0, blockUntil: -1, vuln: -1, gauge: rnd() * 0.3, bt: rnd() * PIECE_BASIC_T, perm: false });
  let body = SPLIT > 0 ? { i: 0, type: 'single', hp: SPLIT, alive: true, deadAt: 0, blockUntil: -1, vuln: -1, gauge: rnd() * 0.3, bt: rnd() * PIECE_BASIC_T, perm: true, body: true } : null;
  let pieces = body ? [body] : [0, 1, 2, 3].map(mk);
  let t = 0, revives = 0, counters = 0, stance = 0, stanceEnd = PIECE_SKILL_T, aoeInStance = false;
  let speedUntil = -1, reflectUntil = -1, stealthUntil = -1;
  const mult = () => Math.pow(1 + PIECE.ramp, revives);
  const aliveA = () => allies.filter(a => a.alive);
  const aliveP = () => pieces.filter(p => p.alive);
  const spd = (a) => a.spd * (t < speedUntil ? 1.15 : 1) * (t < (a.slowUntil ?? -1) ? Math.max(0.1, 1 - SLOW * a.slowStacks) : 1);

  const ed = (kind, a, m) => (PCT ? PCTV[kind] / 100 * a.max : PIECE[kind]) * m;   // 분열체가 a 에게 주는 피해
  function hitAlly(a, dmg, src, single) {
    if (!a.alive) return;
    if (t < stealthUntil && a.n !== '촛동' && !single) dmg *= 0.9;   // 은신: 광역 피해 −10%
    const s = Math.min(a.shield, dmg); a.shield -= s; dmg -= s;
    a.hp -= dmg;
    if (t < reflectUntil && src?.alive && dmg > 0 && !(PCT && NOREFLPCT)) { hitPiece(src, dmg * 0.3 * REFLMUL, false); const mb = allies.find(x => x.n === '몽실벌' && x.alive); if (mb && a.alive) a.hp = Math.min(a.max, a.hp + mb.max * 0.01); }   // 반사 30% — 다수 공격 아님
    if (a.hp <= 0) a.alive = false;
  }
  function pickAlly() {
    const live = aliveA();   // 파티 배열 순서 = 앞줄부터 (분열체 단일 공격은 앞에서부터)
    const vis = live.filter(a => !(t < stealthUntil && a.n !== '촛동'));
    return (vis.length ? vis : live)[0];
  }
  function hitPiece(p, dmg, aoe) {
    if (!p.alive) return;
    if (aoe && !p.body) { dmg *= 1 - PIECE.aoeCut; aoeInStance = true; }
    if (t < p.vuln) dmg *= 1.25;
    p.hp -= dmg;
    if (p.hp <= 0) { p.alive = false; p.deadAt = t; p.perm = t <= p.blockUntil; }
  }
  const frontPiece = () => aliveP()[0];

  function allyBasic(a) { const p = frontPiece(); if (p) hitPiece(p, a.basic, false); }
  function allySkill(a) {
    a.casts++;
    const every4 = R4 ? a.casts % 4 === 0 : (a.casts - 1) % 4 === 0;
    if (a.kind === 'single' || a.kind === 'singleSpeedBuff') {
      const p = frontPiece();
      const d = a.crit && rnd() < a.crit ? a.critSkill : a.skill;
      if (p) hitPiece(p, d, false);
      if (a.kind === 'singleSpeedBuff' && every4) speedUntil = t + BUFF_T;
    } else if (a.kind === 'aoe' || a.kind === 'aoeDebuff') {
      const d = a.crit && rnd() < a.crit ? a.critSkill : a.skill;
      const hitStance = !body && pieces[stance]?.alive;
      for (const p of aliveP()) { hitPiece(p, d, true); if (a.kind === 'aoeDebuff' && every4 && rnd() < 0.75) p.vuln = t + 2 * PIECE_SKILL_T; }
      if (CTARGET === 'user' && hitStance) { counters++; const stealthed = t < stealthUntil && a.n !== '촛동'; if (!stealthed) hitAlly(a, ed('counter', a, mult()), pieces[stance], true); aoeInStance = false; nextStance(); }   // 다수 공격을 쓴 몬몬에게 바로 단일 반격 (은신이면 빗나감)
      else if (INSTANT && hitStance) { doCounter(pieces[stance]); aoeInStance = false; nextStance(); }   // 아군 전체 반격을 맞은 자리에서 바로
    } else if (a.kind === 'shieldSelf') { a.shield = a.max * 0.15; }
    else if (a.kind === 'tok') {
      for (let h = 0; h < 10; h++) { const live = aliveP(); if (!live.length) break; const p = live[Math.floor(rnd() * live.length)]; hitPiece(p, a.skill / 10, false); if (p.alive && rnd() < 0.15) p.blockUntil = t + p.gaugeLeft(); }
    } else if (a.kind === 'reflect') { const p = frontPiece(); if (p) hitPiece(p, a.skill, false); if (every4) reflectUntil = t + BUFF_T; }
    else if (a.kind === 'stealth') { for (const b of aliveA()) if (b !== a) b.shield = Math.max(b.shield, a.max * 0.12); if (every4) stealthUntil = t + BUFF_T; }
  }
  const withGauge = (p) => { p.gaugeLeft = () => (1 - p.gauge) * PIECE_SKILL_T; return p; };   // 다음 자기 턴까지 남은 시간 → [부활 차단] 1턴이 줄어드는 시점
  pieces.forEach(withGauge);
  function doCounter(sp) { counters++; const m = mult(); for (const a of aliveA()) hitAlly(a, ed('counter', a, m), sp, false); }
  function nextStance() { stanceEnd = t + PIECE_SKILL_T; const live = aliveP(); const cur = pieces[stance]; if (live.length) stance = live[(live.indexOf(cur) + 1) % live.length]?.i ?? live[0].i; }

  while (t < MAX_T) {
    t += DT;
    // 아군
    for (const a of aliveA()) {
      const s = spd(a) / 100;
      a.bt -= DT * s; if (a.bt <= 0) { a.bt += BASIC_T; allyBasic(a); }
      if (a.kind !== undefined) { a.gauge += DT * s / SKILL_T; if (a.gauge >= 1) { a.gauge -= 1; allySkill(a); } }
    }
    if (body && !body.alive) { body = null; pieces = [0, 1, 2, 3].map(mk).map(withGauge); stance = 0; stanceEnd = t + PIECE_SKILL_T; aoeInStance = false; }   // 한 몸이 쓰러지면 4마리로 분열
    if (!aliveP().length) return { win: true, t, revives, counters, deaths: allies.filter(a => !a.alive).length };
    // 부활 (자체 타이머, 속도 무관)
    for (const p of pieces) if (!p.alive && !p.perm && t - p.deadAt >= REVIVE_T) {
      if (!aliveP().length) break;
      p.alive = true; p.hp = H; revives++; p.blockUntil = -1;
    }
    if (pieces.every(p => !p.alive)) return { win: true, t, revives, counters, deaths: allies.filter(a => !a.alive).length };
    // 분열체 공격
    const m = mult();
    for (const p of aliveP()) {
      p.bt -= DT; if (p.bt <= 0) { p.bt += PIECE_BASIC_T; const a = pickAlly(); if (a) hitAlly(a, ed('basic', a, m), p, true); }
      p.gauge += DT / PIECE_SKILL_T;
      if (p.gauge >= 1) {
        p.gauge -= 1;
        if (p.type === 'single') { const a = pickAlly(); if (a) hitAlly(a, ed('singleSkill', a, m), p, true); }
        else {
          for (const a of aliveA()) hitAlly(a, ed('aoeSkill', a, m), p, false);
          if (SLOW > 0) for (const a of aliveA().slice(0, SLOWN)) { a.slowStacks = t < (a.slowUntil ?? -1) ? Math.min(SLOWMAX, (a.slowStacks || 0) + 1) : 1; a.slowUntil = t + BUFF_T; }
        }
      }
    }
    // 반격 자세: 한 마리가 늘 자세, 그 턴(9.6초)이 끝날 때 다수 공격을 맞았으면 아군 전체 반격
    const sp = pieces[stance];
    if (!body && (!sp.alive || t >= stanceEnd)) {
      if (CTARGET === 'all' && sp.alive && aoeInStance) doCounter(sp);
      aoeInStance = false; nextStance();
    }
    if (!aliveA().length) return { win: false, t, revives, counters, deaths: allies.length };
  }
  return { win: false, t: MAX_T, revives, counters, deaths: allies.filter(a => !a.alive).length, timeout: true };
}

const PARTIES = [
  ['기준 파티 (열쇠 없음)', ['콜리킹', '딸랑귀', '쥐강이', '파이온', '콘센파리']],
  ['열쇠: 톡찌리 (쥐강이 대신)', ['콜리킹', '딸랑귀', '톡찌리', '파이온', '콘센파리']],
  ['열쇠: 몽실벌 반사 (쥐강이 대신)', ['콜리킹', '딸랑귀', '몽실벌', '파이온', '콘센파리']],
  ['열쇠: 촛동 은신 (쥐강이 대신)', ['콜리킹', '딸랑귀', '촛동', '파이온', '콘센파리']],
  ['대조군: 같은 화력, 열쇠 효과 없음 (쥐강이 대신)', ['콜리킹', '딸랑귀', '대조군', '파이온', '콘센파리']],
  ['열쇠 2명: 몽실벌 (콜리킹 대신) + 톡찌리 (쥐강이 대신)', ['몽실벌', '딸랑귀', '톡찌리', '파이온', '콘센파리']],
];
const N = +(E.N ?? 1000);
const KEYS = ['base', 'tok', 'mong', 'chot', 'ctrl', 'duo'];
if (E.JSON === '1') {   // tools/split-report.mjs 가 읽는 기계용 출력
  const out = [];
  for (const [pi, [name, team]] of PARTIES.entries()) for (const H of HS) {
    const rnd = mulberry32(4242);
    const rs = Array.from({ length: N }, () => simulate(team, H, rnd));
    const wins = rs.filter(r => r.win), times = wins.map(r => r.t).sort((a, b) => a - b);
    const avg = (k) => +(rs.reduce((s, r) => s + r[k], 0) / N).toFixed(2);
    out.push({ key: KEYS[pi], party: name, hp: H, clear: +(wins.length / N * 100).toFixed(1), time: times.length ? Math.round(times[times.length >> 1]) : null, revives: avg('revives'), counters: avg('counters'), deaths: avg('deaths') });
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
console.log(`반격: ${CTARGET === 'user' ? '다수 공격을 쓴 몬몬에게 바로 (단일)' : (INSTANT ? '아군 전체, 바로' : '아군 전체, 자세 끝')} · 한 몸 ${SPLIT || '없음'}
시작 게이지 0~${START} · 딸랑귀 스킬 ${ALLY.딸랑귀.skill} · 4턴 효과 ${R4 ? '4번째 스킬부터' : '첫 스킬부터'}
분열체: 평타 ${PIECE.basic} · 단일형 스킬 ${PIECE.singleSkill} · 모든 적형 스킬 ${PIECE.aoeSkill} · 반격 ${PIECE.counter} · 부활마다 +${PIECE.ramp * 100}% · 다수 공격 피해 −${PIECE.aoeCut * 100}%`);
console.log(`| 파티 | 분열체 체력 | 클리어 | 클리어 시간(중앙) | 부활 횟수 | 반격 | 쓰러진 아군 |`);
console.log('|---|--:|--:|--:|--:|--:|--:|');
for (const [name, team] of PARTIES) for (const H of HS) {
  const rnd = mulberry32(4242);
  const rs = Array.from({ length: N }, () => simulate(team, H, rnd));
  const wins = rs.filter(r => r.win), times = wins.map(r => r.t).sort((a, b) => a - b);
  const avg = (k) => (rs.reduce((s, r) => s + r[k], 0) / N).toFixed(1);
  console.log(`| ${name} | ${H.toLocaleString()} | ${Math.round(wins.length / N * 100)}% | ${times.length ? Math.round(times[times.length >> 1]) + '초' : '-'} | ${avg('revives')} | ${avg('counters')} | ${avg('deaths')} |`);
}
