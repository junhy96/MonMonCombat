// 문항 2 분열 보스 — 처음부터 끝까지 전투 시뮬레이션 (시간 0.1초 단위, 시드 고정 몬테카를로)
// 전투 엔진(src/combat)이 아니라 사용자 관측값·결정만으로 만든 전용 계산. 가정은 docs/q2-split-boss-data.md 「전체 전투 시뮬레이션」.
// 실행: node tools/split-sim.mjs
import { mulberry32 } from '../src/lib/rng.js';

// ── 시간 규칙 (사용자 관측) ─────────────────────────────
// 2026-11-26 글라틀 10단계 검증으로 보정: 등껍질 창 27초 = 속도 100 몬몬 「평타 10번 + 스킬 1번」(1턴), 측정 파티가 70번을 24~25초에 깸
//   → 예전 평타 1.6초는 1.7배 빨랐음. 모든 시간 규칙이 「턴」 기준이라 같은 비율 K 로 늘림 (클리어율은 그대로, 시간만 실제 초로)
const K = +(process.env.TK ?? 27 / 16);   // TK=1 이면 예전 시간
const BASIC_T = 1.6 * K;      // 속도 100 몬몬 평타 간격 ≈ 2.7초
const SKILL_T = 16 * K;       // 속도 100 몬몬 스킬 주기 = 평타 10번 = 1턴 ≈ 27초
const PIECE_BASIC_T = 2.4 * K;    // 속도 100 보스: 평타 4번 뒤 스킬, 한 주기 ≈ 아군 평타 6번 (≈ 16.2초)
const PIECE_SKILL_T = 9.6 * K;
const REVIVE_T = +(process.env.REVIVE ?? 15 * K);     // 부활 자체 타이머 1턴 ≈ 속도 100 스킬 0.9~1번 (≈ 25초, 속도 무관)
const BUFF_T = 30 * K;        // "2턴" 버프 ≈ 받은 몬몬 스킬 2번 (≈ 51초)
const DT = 0.1, MAX_T = 600 * K;

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
  촛동: { hp: 13000, spd: 100, basic: 117, kind: 'stealth' },   // (2026-11-26 열쇠에서 뺌 — 자신은 다수 공격을 안 함)
  멘티삿: { hp: 12000, spd: 100, basic: 117, skill: 3876, kind: 'aoeStealth' },
  토볼트: { hp: 12000, spd: 100, basic: 117, skill: 3876, kind: 'tobolt' },   // 「번개 추적」 체력이 가장 낮은 적 3명 피해, [5턴에 한 번] 맞은 적 각각 75% 2턴 [부활 차단] (2턴 = 조각의 다음 턴 + 한 턴 더). 3명을 때리므로 다수 공격(피해 감소 · 반격). 화력은 쥐강이 값 가정   // 「맹독난무」 모든 적 피해, [4턴에 한 번] 피해 전 자신 2턴 [강철 은신]. 화력은 다른 열쇠처럼 쥐강이 값 가정 (적마다), 디버프 75%는 종류 모름 → 뺌
  기본몬몬: { hp: 12000, spd: 100, basic: 117, skill: 3876, kind: 'single' },   // 기본 파티의 쥐강이 자리 — 열쇠 몬몬과 같은 체력·속도·화력, 열쇠 효과만 없음 (열쇠 효과는 이것과 비교)
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
// ── 변수 실험용 (기본값이면 예전과 같은 결과 — 난수도 같은 순서로 뽑음) ──
const SPDTO = E.SPDTO ?? 'all';   // 콘센파리 [속도 +15%] 받는 아군: all(실제 스킬: 모든 아군) · none(끔) · slot1~slot5(그 자리 1명) · 몬몬 이름
const CRIT = E.CRIT ?? 'roll';    // roll(확률대로) · off(치명 없음) · all(스킬마다 치명)
const GCUT = +(E.GCUT ?? 0), GCUTBY = E.GCUTBY ?? '콜리킹';   // GCUTBY 가 스킬을 쓴 뒤 살아 있는 모든 조각 스킬 게이지 −GCUT (예: 북치기 · 윙빗 ★3 「스킬 발동 후 모든 적 스킬 에너지 15% 감소」)
const DALCUT = E.DALCUT === '1';  // 딸랑귀 기본공격 「4% 확률로 스킬 에너지 20% 감소」 반영 (기본: 안 넣음)
const TRACE = E.TRACE === '1';    // 한 판 기록 (몬스터 타임라인)

function simulate(team, H, rnd) {
  const allies = team.map((n, slot) => ({ n, slot, ...ALLY[n], ...(SYNC ? { spd: SYNC } : {}), max: ALLY[n].hp, alive: true, shield: 0, gauge: rnd() * START, bt: rnd() * BASIC_T, casts: 0 }));
  const ev = TRACE ? [] : null;
  const log = (type, o = {}) => { if (ev) ev.push({ t: Math.round(t * 10) / 10, type, ...o }); };
  let crits = 0, critTries = 0;
  const mk = (i) => ({ i, type: i % 2 ? 'aoe' : 'single', hp: H, alive: true, deadAt: 0, blockUntil: -1, vuln: -1, gauge: rnd() * 0.3, bt: rnd() * PIECE_BASIC_T, perm: false });
  let body = SPLIT > 0 ? { i: 0, type: 'single', hp: SPLIT, alive: true, deadAt: 0, blockUntil: -1, vuln: -1, gauge: rnd() * 0.3, bt: rnd() * PIECE_BASIC_T, perm: true, body: true } : null;
  let pieces = body ? [body] : [0, 1, 2, 3].map(mk);
  let t = 0, revives = 0, counters = 0, stance = 0, stanceEnd = PIECE_SKILL_T, aoeInStance = false;
  let speedUntil = -1, reflectUntil = -1, stealthUntil = -1;
  const hidden = (a) => (t < stealthUntil && a.n !== '촛동') || t < (a.selfStealth ?? -1);   // 촛동이 건 파티 은신 또는 자기 은신(멘티삿)
  const mult = () => Math.pow(1 + PIECE.ramp, revives);
  const aliveA = () => allies.filter(a => a.alive);
  const aliveP = () => pieces.filter(p => p.alive);
  const spdOn = (a) => SPDTO === 'all' || (SPDTO.startsWith('slot') ? a.slot === +SPDTO.slice(4) - 1 : a.n === SPDTO);
  const spd = (a) => a.spd * (t < speedUntil && spdOn(a) ? 1.15 : 1) * (t < (a.slowUntil ?? -1) ? Math.max(0.1, 1 - SLOW * a.slowStacks) : 1);

  const ed = (kind, a, m) => (PCT ? PCTV[kind] / 100 * a.max : PIECE[kind]) * m;   // 분열체가 a 에게 주는 피해
  function hitAlly(a, dmg, src, single) {
    if (!a.alive) return;
    if (hidden(a) && !single) dmg *= 0.9;   // 은신: 광역 피해 −10%
    const s = Math.min(a.shield, dmg); a.shield -= s; dmg -= s;
    a.hp -= dmg;
    if (t < reflectUntil && src?.alive && dmg > 0 && !(PCT && NOREFLPCT)) { hitPiece(src, dmg * 0.3 * REFLMUL, false); const mb = allies.find(x => x.n === '몽실벌' && x.alive); if (mb && a.alive) a.hp = Math.min(a.max, a.hp + mb.max * 0.01); }   // 반사 30% — 다수 공격 아님
    if (a.hp <= 0) { a.alive = false; log('adeath', { n: a.n }); }
  }
  function pickAlly() {
    const live = aliveA();   // 파티 배열 순서 = 앞줄부터 (분열체 단일 공격은 앞에서부터)
    const vis = live.filter(a => !hidden(a));
    return (vis.length ? vis : live)[0];
  }
  function hitPiece(p, dmg, aoe) {
    if (!p.alive) return;
    if (aoe && !p.body) { dmg *= 1 - PIECE.aoeCut; aoeInStance = true; }
    if (t < p.vuln) dmg *= 1.25;
    p.hp -= dmg;
    if (p.hp <= 0) { p.alive = false; p.deadAt = t; p.perm = t <= p.blockUntil; log('die', { i: p.i, perm: p.perm, body: !!p.body }); }
  }
  const frontPiece = () => aliveP()[0];

  function allyBasic(a) { const p = frontPiece(); if (p) { hitPiece(p, a.basic, false); if (DALCUT && a.n === '딸랑귀' && p.alive && rnd() < 0.04) { p.gauge = Math.max(0, p.gauge - 0.2); log('gcut', { by: a.n, i: p.i }); } } }
  function skillDmg(a) {   // 치명: 기본은 확률대로 (난수 순서 예전과 같음)
    if (!a.crit) return a.skill;
    critTries++;
    const c = CRIT === 'off' ? false : CRIT === 'all' ? true : rnd() < a.crit;
    if (c) crits++;
    return c ? a.critSkill : a.skill;
  }
  function allySkill(a) {
    a.casts++;
    log('askill', { n: a.n });
    const every4 = R4 ? a.casts % 4 === 0 : (a.casts - 1) % 4 === 0;
    if (a.kind === 'single' || a.kind === 'singleSpeedBuff') {
      const p = frontPiece();
      const d = skillDmg(a);
      if (p) hitPiece(p, d, false);
      if (a.kind === 'singleSpeedBuff' && every4 && SPDTO !== 'none') speedUntil = t + BUFF_T;
    } else if (a.kind === 'aoe' || a.kind === 'aoeDebuff' || a.kind === 'aoeStealth') {
      if (a.kind === 'aoeStealth' && every4 && E.NOSTEALTH !== '1') a.selfStealth = t + BUFF_T;   // NOSTEALTH=1: 은신만 끈 대조 (광역 화력은 그대로)   // 피해를 입히기 전에 은신 → 이번 반격부터 빗나감
      const d = skillDmg(a);
      const hitStance = !body && pieces[stance]?.alive;
      for (const p of aliveP()) { hitPiece(p, d, true); if (a.kind === 'aoeDebuff' && every4 && rnd() < 0.75) p.vuln = t + 2 * PIECE_SKILL_T; }
      if (CTARGET === 'user' && hitStance) { counters++; log('counter', { by: a.n, i: stance }); if (!hidden(a)) hitAlly(a, ed('counter', a, mult()), pieces[stance], true); aoeInStance = false; nextStance(); }   // 다수 공격을 쓴 몬몬에게 바로 단일 반격 (은신이면 빗나감)
      else if (INSTANT && hitStance) { doCounter(pieces[stance]); aoeInStance = false; nextStance(); }   // 아군 전체 반격을 맞은 자리에서 바로
    } else if (a.kind === 'shieldSelf') { a.shield = a.max * 0.15; }
    else if (a.kind === 'tok') {
      for (let h = 0; h < 10; h++) { const live = aliveP(); if (!live.length) break; const p = live[Math.floor(rnd() * live.length)]; hitPiece(p, a.skill / 10, false); if (p.alive && rnd() < 0.15) p.blockUntil = t + p.gaugeLeft(); }
    } else if (a.kind === 'tobolt') {
      const every5 = (a.casts - 1) % 5 === 0;   // [5턴에 한 번]도 첫 스킬부터
      const d = skillDmg(a);
      const targets = aliveP().slice().sort((x, y) => x.hp - y.hp).slice(0, 3);
      const hitStance = !body && targets.includes(pieces[stance]) && pieces[stance]?.alive;
      for (const p of targets) { hitPiece(p, d, true); if (every5 && p.alive && rnd() < 0.75) p.blockUntil = t + p.gaugeLeft() + PIECE_SKILL_T; }
      if (CTARGET === 'user' && hitStance) { counters++; log('counter', { by: a.n, i: stance }); if (!hidden(a)) hitAlly(a, ed('counter', a, mult()), pieces[stance], true); aoeInStance = false; nextStance(); }
    } else if (a.kind === 'reflect') { const p = frontPiece(); if (p) hitPiece(p, a.skill, false); if (every4) reflectUntil = t + BUFF_T; }
    else if (a.kind === 'stealth') { for (const b of aliveA()) if (b !== a) b.shield = Math.max(b.shield, a.max * 0.12); if (every4) stealthUntil = t + BUFF_T; }
    if (GCUT > 0 && a.n === GCUTBY) { for (const p of aliveP()) p.gauge = Math.max(0, p.gauge - GCUT); log('gcut', { by: a.n }); }
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
    if (body && !body.alive) { log('split'); body = null; pieces = [0, 1, 2, 3].map(mk).map(withGauge); stance = 0; stanceEnd = t + PIECE_SKILL_T; aoeInStance = false; }   // 한 몸이 쓰러지면 4마리로 분열
    if (!aliveP().length) return { win: true, t, revives, counters, crits, critTries, ev, deaths: allies.filter(a => !a.alive).length };
    // 부활 (자체 타이머, 속도 무관)
    for (const p of pieces) if (!p.alive && !p.perm && t - p.deadAt >= REVIVE_T) {
      if (!aliveP().length) break;
      p.alive = true; p.hp = H; revives++; p.blockUntil = -1; log('revive', { i: p.i, n: revives });
    }
    if (pieces.every(p => !p.alive)) return { win: true, t, revives, counters, crits, critTries, ev, deaths: allies.filter(a => !a.alive).length };
    // 분열체 공격
    const m = mult();
    for (const p of aliveP()) {
      p.bt -= DT; if (p.bt <= 0) { p.bt += PIECE_BASIC_T; const a = pickAlly(); if (a) hitAlly(a, ed('basic', a, m), p, true); }
      p.gauge += DT / PIECE_SKILL_T;
      if (p.gauge >= 1) {
        p.gauge -= 1;
        log('pskill', { i: p.i, kind: p.body ? 'body' : p.type });
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
    if (!aliveA().length) return { win: false, t, revives, counters, crits, critTries, ev, deaths: allies.length };
  }
  return { win: false, t: MAX_T, revives, counters, crits, critTries, ev, deaths: allies.filter(a => !a.alive).length, timeout: true };
}

const PARTIES = [
  ['기본 파티: 열쇠 효과 없음 (쥐강이 자리에 열쇠 몬몬과 같은 능력치)', ['콜리킹', '딸랑귀', '기본몬몬', '파이온', '콘센파리']],
  ['열쇠: 톡찌리 (쥐강이 대신)', ['콜리킹', '딸랑귀', '톡찌리', '파이온', '콘센파리']],
  ['열쇠: 멘티삿 은신 + 광역 (쥐강이 대신)', ['콜리킹', '딸랑귀', '멘티삿', '파이온', '콘센파리']],
  ['열쇠 2명: 멘티삿 (콜리킹 대신) + 톡찌리 (쥐강이 대신)', ['멘티삿', '딸랑귀', '톡찌리', '파이온', '콘센파리']],
  ['열쇠 2명: 토볼트 (콜리킹 대신) + 톡찌리 (쥐강이 대신) — 부활 차단 2명', ['토볼트', '딸랑귀', '톡찌리', '파이온', '콘센파리']],   // 2026-11-26 몽실벌 제외 (반사가 반격을 되받는다는 보장이 없음 — 사용자 결정)
];
const N = +(E.N ?? 1000);
const KEYS = ['base', 'tok', 'ment', 'duo', 'duo2'];   // duo = 톡찌리 + 멘티삿, duo2 = 톡찌리 + 토볼트   // base = 기본 파티 (열쇠 효과만 없음)
if (E.RAW === '1') {   // tools/split-vars.mjs: 판마다 승패 · 시간 · 치명 수 (TRACE=1 이면 RUNIDX 판의 기록도)
  const want = new Set((E.RUNIDX ?? '').split(',').filter(Boolean).map(Number));
  const out = [];
  for (const [pi, [name, team]] of PARTIES.entries()) for (const H of HS) {
    if (E.KEY && E.KEY.split(',').indexOf(KEYS[pi]) < 0) continue;
    const rnd = mulberry32(4242);
    const runs = Array.from({ length: N }, (_, k) => { const r = simulate(team, H, rnd); return { k, win: r.win, t: Math.round(r.t * 10) / 10, crits: r.crits, tries: r.critTries, revives: r.revives, ev: want.has(k) ? r.ev : undefined }; });
    out.push({ key: KEYS[pi], party: name, hp: H, runs });
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
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
