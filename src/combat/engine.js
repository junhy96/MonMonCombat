// 전투 시뮬레이터 엔진 — 데이터 테이블을 읽어 1:1과 파티(N:N, N:보스)를 같은 규칙으로 돌린다 (DOM 없음).
// 데미지 계산 순서: ① 기본 공식(스탯 버프·디버프가 반영된 공격력·방어력) × 스킬 배율 → ② 속성 상성 → ③ 치명타
//                   → ④ 받는 피해 증감(취약 등, 합/곱) → ⑤ 그로기(흐트러짐) 배율 → 보호막 → 체력
// 전투 방식: 턴제 = 라운드마다 양 진영 전원을 속도 순으로 한 번씩, 실시간 = 초 단위 사건(행동·지속 피해·만료) 순서.
import { unitFrom, elementMult, parseUnitRef } from '../data/tables.js';
import { mulberry32, seedMix } from '../lib/rng.js';

// ── 규칙 선택지 ─────────────────────────────────────────
/** 데미지 공식: f(공격력, 방어력, 규칙) → 스킬 배율을 곱하기 전 기본 데미지 */
export const FORMULAS = {
  const: { label: '방어력 상수 감소형', expr: '공 × K ÷ (K + 방)', f: (a, d, R) => a * R.K / (R.K + Math.max(0, d)), params: ['K'],
    use: '방어가 올라도 데미지가 0이 되지 않고 완만하게 줄어듦. 방어 = K일 때 절반. 대부분의 RPG 기본형.' },
  sub: { label: '단순 차감형', expr: 'max(공 − 방, 공 × 최소%)', f: (a, d, R) => Math.max(a - Math.max(0, d), a * R.minPct / 100), params: ['minPct'],
    use: '수치가 직관적이지만 방어가 공격에 가까워지면 데미지가 급격히 줄어 최소 데미지 하한이 필요. 고전 JRPG형.' },
  ratio: { label: '비율 감소형', expr: '공 × 공 ÷ (공 + 방)', f: (a, d) => (a + Math.max(0, d) > 0 ? a * a / (a + Math.max(0, d)) : 0), params: [],
    use: '공격과 방어의 비율만 중요 — 둘이 같은 배율로 성장하면 데미지 비율이 유지됨. 인플레이션이 큰 성장형 게임에 맞음.' },
  mult: { label: '곱연산형 (방어율)', expr: '공 × (1 − min(방, 상한) ÷ 100)', f: (a, d, R) => a * (1 - Math.min(Math.max(0, d), R.defCap) / 100), params: ['defCap'],
    use: '방어력을 "받는 피해 감소 %"로 직접 쓰는 형태. 수치가 곧 감소율이라 읽기 쉽고 상한으로 무적을 막음.' },
};
export const FORMULA_PARAMS = {
  K: { label: '방어 상수 K', min: 1, tip: 'f.K' },
  minPct: { label: '최소 데미지 (공격력의 %)', min: 0, max: 100, tip: 'f.minPct' },
  defCap: { label: '방어율 상한 (%)', min: 0, max: 100, tip: 'f.defCap' },
};
export const MODES = { turn: '턴제', realtime: '실시간' };
export const BUFF_STACK = { add: '합연산', mul: '곱연산' };
export const HIT_MODES = { diff: '명중 − 회피', ratio: '명중 ÷ (명중 + 회피) × 100', always: '항상 명중' };
export const TARGETING = { front: '전열 우선', random: '랜덤', lowhp: '체력 낮은 대상 우선', taunt: '도발(어그로) 우선' };
export const ALLY_RULES = { lowhp: '체력 비율 최저 아군', random: '랜덤 아군', atk: '공격력 최고 아군' };
export const ROUNDS = { floor: '내림', round: '반올림', none: '없음' };
// ── 스킬 게이지 (실시간 전용) ──
// 게이지는 시간으로만 차고(속도 비례 선택), 가득 차면 전투 전체가 멈춘 채 즉시 발동 → 시뮬레이션에서는 0초.
// 캐릭터는 액티브 1개(스킬 목록의 첫 액티브), 몬스터·보스는 게이지가 찰 때마다 액티브를 목록 순서대로 돌아가며.
export const SKILL_MODES = { cost: '코스트 · 쿨타임', gauge: '게이지 (가득 차면 즉시 발동)' };
export const GAUGE_FILL = { speed: '속도 비례 — 기본 충전 × 속도 ÷ 기준 속도', flat: '속도 무관 — 기본 충전' };
export const GAUGE_NEED = { max: '모든 스킬 = 최대 게이지', cost: '스킬 코스트만큼 (비우면 최대 게이지)' };
export const STUN_CAST = { wait: '기절·흐트러짐이 풀리면 즉시', cast: '기절·흐트러짐 중에도 발동' };
export const STUN_GAUGE = { fill: '기절 중에도 게이지가 참', stop: '기절 중에는 게이지 멈춤' };
export const CAST_ORDER = { ally: '아군 먼저, 슬롯 순', speed: '속도 높은 순 (같으면 아군 먼저)' };
// ── 효과 지속 (게이지 모드) ── 게임 확인: 1턴 = 몬몬이 스킬을 한 번 쓸 때. 지속은 효과를 받은 몬몬의 턴으로 셈,
// 스킬을 쓴 뒤 1 감소(그 스킬에는 적용), 자기 스킬로 자신에게 건 효과는 다음 스킬부터 감소,
// 기절 중에도 게이지가 차고 차면 스킬 대신 턴만 소모, 지속 피해·치유는 받은 몬몬의 턴마다.
export const EFFECT_DUR = { turn: '턴 — 받은 몬몬이 스킬을 쓸 때마다 1 (게임 확인)', sec: '초' };
export const DOT_TIMING = { after: '스킬 뒤', before: '스킬 앞' }; // 턴 안에서 지속 피해가 들어가는 순서 (확인 전)
// ── 웨이브 ── 전환 연출은 전투 시간에 넣지 않는다(0초). 아군 체력은 유지, 게이지는 유닛별 시작 게이지로.
export const WAVE_BUFFS = { keep: '버프·디버프·보호막 유지', clear: '모두 해제' };
export const WAVE_TIMER = { reset: '평타 주기 새로 시작 (전투 시작처럼)', keep: '이어서' };

export const DEFAULT_RULES = {
  mode: 'turn', formula: 'const', K: 100, minPct: 10, defCap: 90,
  hitMode: 'diff', hitMin: 5, hitMax: 100, crit: true, buffStack: 'add', round: 'floor',
  startRes: 40, resRegen: 20, resMax: 100,
  skillMode: 'cost', gaugeMax: 100, gaugeRate: 10, gaugeFill: 'speed', gaugeNeed: 'max',
  stunCast: 'wait', stunGauge: 'fill', castOrder: 'ally', waveBuffs: 'keep', waveTimer: 'reset',
  effectDur: 'turn', dotTiming: 'after',
  groggyGain: 1, groggyDur: 2, groggyDmg: 1.5, basicGroggy: 5,
  maxTurns: 100, maxTime: 180, speedBase: 100, healBelow: 70,
  targeting: 'front', enemyTargeting: 'front', allyRule: 'lowhp', synergy: true, revive: true,
};

const BASIC = Object.freeze({ id: 'BASIC', name: '기본 공격', target: 'enemy', area: 'single', mult: 1, cost: 0, cooldown: 0, effects: [] });

// ── 유닛 ────────────────────────────────────────────────
/** 슬롯 { unit: 'char:CH_x' | 'monster:MO_x', level, row? } → 전투용 유닛 (없으면 null) */
export function makeUnit(t, slot, side, idx) {
  const { kind, id } = parseUnitRef(slot.unit);
  const u = unitFrom(t, kind === 'monster' ? 'monster' : 'char', id, slot.level ?? 1);
  if (!u) return null;
  return {
    side, idx, uid: `${side ? 'E' : 'A'}${idx + 1}`, name: u.name, def: u, element: u.element, row: slot.row || u.row,
    role: u.role, kind: u.kind, id: u.id, stats: u.stats, maxHp: Math.max(1, u.stats.hp), boss: u.boss, groggyMax: u.groggyMax, phases: u.phases,
    baseSkills: u.skills,
    // 게이지: 슬롯의 시작 게이지(던전 설정) > 테이블의 시작 게이지 > 0. 최대·충전 배율은 몬스터(보스)만 따로 둘 수 있음
    gStart: Number.isFinite(slot.gauge) ? slot.gauge : (u.startGauge ?? 0), gMaxOwn: u.gaugeMax || 0, gMult: u.gaugeMult > 0 ? u.gaugeMult : 1,
  };
}

function freshState(u, R) {
  const gMax = u.gMaxOwn > 0 ? u.gMaxOwn : R.gaugeMax;
  Object.assign(u, {
    hp: u.maxHp, alive: true, res: R.startRes, cds: {}, ready: {}, statuses: [], shields: [], groggy: 0, groggyLeft: 0, groggyUntil: -1,
    phase: -1, skills: [...u.baseSkills], next: 0, lastT: 0, deadAt: null,
    gMax, gauge: Math.min(gMax, Math.max(0, u.gStart ?? 0)), seq: 0, hpFired: {},
    m: { dmg: 0, taken: 0, heal: 0, shield: 0, buff: 0, actions: 0, crits: 0, hits: 0, misses: 0, kills: 0, groggy: 0, life: 0, casts: 0, passives: 0 },
  });
}

// ── 스탯 (버프·디버프 반영) ─────────────────────────────
/** 실제 스탯: 기본 × (1 + Σ%) + Σ고정 (합연산) 또는 기본 × Π(1 + %) + Σ고정 (곱연산). skip(status)이면 그 상태 무시 */
export function effStat(u, k, R, skip) {
  const base = u.stats[k] ?? 0;
  let add = 0, pctSum = 0, pctProd = 1;
  for (const s of u.statuses) {
    if (s.stat !== k || (s.kind !== 'buff' && s.kind !== 'debuff') || (skip && skip(s))) continue;
    const sign = s.kind === 'debuff' ? -1 : 1;
    if (s.mode === 'mul') { const p = sign * s.value / 100; pctSum += p; pctProd *= 1 + p; } else add += sign * s.value;
  }
  let v = (R.buffStack === 'mul' ? base * pctProd : base * (1 + pctSum)) + add;
  if (k === 'cric') v = Math.min(100, v);
  if (k === 'crid') v = Math.max(1, v);
  return Math.max(0, v);
}
/** 받는 피해 배율: 디버프(취약) = +%, 버프(피해 감소) = −% */
export function takenMult(u, R, skip) {
  let sum = 0, prod = 1;
  for (const s of u.statuses) {
    if (s.stat !== 'dmgTaken' || (s.kind !== 'buff' && s.kind !== 'debuff') || (skip && skip(s))) continue;
    const p = (s.kind === 'debuff' ? 1 : -1) * s.value / 100;
    sum += p; prod *= 1 + p;
  }
  return Math.max(0, R.buffStack === 'mul' ? prod : 1 + sum);
}

export function hitChance(acc, eva, R) {
  const raw = R.hitMode === 'always' ? 100 : R.hitMode === 'ratio' ? (acc + eva > 0 ? 100 * acc / (acc + eva) : 100) : acc - eva;
  return Math.min(R.hitMax, Math.max(R.hitMin, raw)) / 100;
}
const roundDmg = (x, R) => (R.round === 'floor' ? Math.floor(x) : R.round === 'round' ? Math.round(x) : x);

/**
 * 한 대의 데미지 계산 (명중·치명은 rnd로 굴림). 반환 { miss, dmg, crit, parts }
 * parts = 단계별 값 (기획서 영역의 계산 예시용): base, element, critMult, taken, groggy
 */
export function hitDamage(t, R, att, tgt, skill, rnd, skip) {
  const acc = effStat(att, 'acc', R, skip), eva = effStat(tgt, 'eva', R, skip);
  const p = hitChance(acc, eva, R);
  if (rnd() >= p) return { miss: true, dmg: 0, crit: false, hit: p };
  const atk = effStat(att, 'atk', R, skip), def = effStat(tgt, 'def', R, skip);
  const base = FORMULAS[R.formula].f(atk, def, R) * (skill.mult ?? 1);
  const el = elementMult(t, att.element, tgt.element);
  const crit = R.crit && rnd() < effStat(att, 'cric', R, skip) / 100;
  const critMult = crit ? effStat(att, 'crid', R, skip) : 1;
  const taken = takenMult(tgt, R, skip);
  const grog = tgt.groggyLeft > 0 || tgt.groggyUntil > (tgt._now ?? -1) ? R.groggyDmg : 1;
  const raw = base * el * critMult * taken * grog;
  const dmg = raw > 0 ? Math.max(1, roundDmg(raw, R)) : 0;
  return { miss: false, dmg, crit, hit: p, parts: { atk, def, base, el, critMult, taken, grog, raw } };
}

// ── 한 판 ───────────────────────────────────────────────
/**
 * setup = { allies: [slot], enemies: [slot] }, R = 규칙, t = 테이블. opts { log, seed }
 * 반환 { winner: 0|1|null, dur (턴 또는 초), survivors, units: [{ uid, name, side, …m }], log }
 */
export function battle(t, R0, setup, { seed = 1, log = false } = {}) {
  const R = { ...DEFAULT_RULES, ...R0 };
  const rnd = mulberry32(seed);
  const sk = Object.fromEntries((t.skills || []).map(s => [s.id, s]));
  const ef = Object.fromEntries((t.effects || []).map(e => [e.id, e]));
  const units = [];
  // 웨이브: setup.waves = [[slot…], …]가 있으면 그 순서로, 없으면 enemies 한 웨이브
  const waves = (setup.waves?.length ? setup.waves : [setup.enemies || []]).map(w => (w || []).filter(s => makeUnit(t, s, 1, 0))).filter(w => w.length);
  (setup.allies || []).forEach((slot, i) => { const u = makeUnit(t, slot, 0, i); if (u) units.push(u); });
  units.forEach(u => freshState(u, R));
  const RT = R.mode === 'realtime';
  const G = RT && R.skillMode === 'gauge';
  const TD = G && R.effectDur === 'turn'; // 효과 지속을 턴(받은 몬몬의 스킬 사용)으로
  let now = 0, round = 0, waveIdx = -1, pDepth = 0, stamp = 0;
  const waveTimes = [];
  const L = [];
  const say = (o) => { if (log) L.push({ t: RT ? +now.toFixed(2) : round, ...o }); };
  const side = (s) => units.filter(u => u.side === s);
  const alive = (s) => units.filter(u => u.side === s && u.alive);
  const lastWave = () => waveIdx >= waves.length - 1;
  const over = () => !alive(0).length || (!alive(1).length && lastWave());

  function applySynergies(s, mem) {
    if (!R.synergy || !mem.length) return;
    for (const sy of t.synergies || []) {
      if (!synergyMet(sy, mem)) continue;
      say({ ev: 'synergy', actor: s ? '적 진영' : '아군 진영', text: `시너지 「${sy.name}」 발동` });
      for (const u of mem) for (const eid of sy.effects || []) if (ef[eid]) applyEffect(mem[0], u, ef[eid], { synergy: true, srcId: 'SYN' });
    }
  }
  const startTimer = (u) => { u.next = now + 1 / aps(u) * (0.9 + 0.2 * rnd()); };
  /** 다음 웨이브: 적 생성 → 아군 게이지는 시작 게이지로, 버프는 규칙대로 → 평타 주기 → 웨이브 시작 패시브 */
  function spawnWave(w) {
    waveIdx = w;
    const fresh = [];
    waves[w].forEach((slot, i) => {
      const u = makeUnit(t, slot, 1, i);
      if (!u) return;
      if (w > 0) u.uid = `W${w + 1}E${i + 1}`;
      u.wave = w + 1;
      freshState(u, R);
      units.push(u); fresh.push(u);
    });
    waveTimes.push(RT ? now : round);
    if (waves.length > 1) say({ ev: 'wave', actor: `웨이브 ${w + 1}`, text: `웨이브 ${w + 1}/${waves.length} 시작 — ${fresh.map(u => u.name).join(', ')}` });
    if (w === 0) return fresh;
    for (const u of alive(0)) {
      if (G) u.gauge = Math.min(u.gMax, Math.max(0, u.gStart ?? 0));
      if (R.waveBuffs === 'clear') { u.statuses = []; u.shields = []; }
      if (RT && R.waveTimer === 'reset') startTimer(u);
    }
    applySynergies(1, fresh);
    if (RT) fresh.forEach(startTimer);
    for (const u of [...alive(0), ...fresh]) firePassives(u, 'wave');
    return fresh;
  }
  /** 적이 전멸했고 웨이브가 남았으면 다음 웨이브 */
  function checkWave() { while (!alive(1).length && alive(0).length && !lastWave()) spawnWave(waveIdx + 1); }

  if (waves.length) spawnWave(0);
  // 시너지: 조건을 만족한 진영 전원에게 전투 시작 때 효과
  applySynergies(0, side(0)); applySynergies(1, side(1));

  /** 턴 지속: 자기 스킬(과 그 스킬에서 터진 패시브)로 자신에게 건 효과는 이번 턴 끝에 줄지 않도록 그 턴 번호를 붙여 둠 */
  function bornStamp(src, tgt) { return TD && src === tgt && src.casting ? src.castStamp : 0; }
  function addStatus(src, tgt, e, extra = {}) {
    const dur = e.duration ?? 0;
    const st = { eid: e.id, name: e.name, kind: e.kind, stat: e.stat, value: e.value ?? 0, mode: e.mode || 'add', src: src.uid, srcSide: src.side,
      rem: dur > 0 ? dur : Infinity, until: dur > 0 && !TD ? now + dur : Infinity, born: bornStamp(src, tgt), ...extra };
    const same = tgt.statuses.find(x => x.eid === e.id && !e.stack);
    if (same) { Object.assign(same, { rem: st.rem, until: st.until, born: st.born, src: st.src, srcSide: st.srcSide, dot: st.dot ?? same.dot }); return same; }
    tgt.statuses.push(st);
    return st;
  }
  function applyEffect(src, tgt, e, { synergy = false, srcId } = {}) {
    if (!synergy && rnd() * 100 >= (e.chance ?? 100)) return false;
    const atk = effStat(src, 'atk', R);
    switch (e.kind) {
      case 'heal': { const amt = atk * (e.value ?? 0) / 100, got = Math.min(tgt.maxHp - tgt.hp, amt); tgt.hp += got; src.m.heal += got; say({ ev: 'heal', actor: src.name, target: tgt.name, value: Math.round(got), text: `${e.name} +${Math.round(got)}` }); return true; }
      case 'shield': { const amt = atk * (e.value ?? 0) / 100; const dur = e.duration ?? 0; tgt.shields.push({ amt, rem: dur > 0 ? dur : Infinity, until: dur > 0 && !TD ? now + dur : Infinity, born: bornStamp(src, tgt) }); src.m.shield += amt; say({ ev: 'status', actor: src.name, target: tgt.name, value: Math.round(amt), text: `${e.name} ${Math.round(amt)} 획득` }); return true; }
      case 'revive': return false; // 부활은 대상 선택 단계에서 처리
      case 'dot': addStatus(src, tgt, e, { dot: atk * (e.value ?? 0) / 100 }); break;
      default: addStatus(src, tgt, e, srcId ? { src: srcId } : {});
    }
    if (!synergy) say({ ev: 'status', actor: src.name, target: tgt.name, text: `${tgt.name}: ${e.name}${e.kind === 'stun' ? ' (행동 불가)' : ''} 적용${e.duration ? ` · ${e.duration}${RT ? '초' : '턴'}` : ''}` });
    return true;
  }

  function damage(src, tgt, amt, { dot = false } = {}) {
    let left = amt;
    for (const sh of tgt.shields) { const use = Math.min(sh.amt, left); sh.amt -= use; left -= use; if (!left) break; }
    tgt.shields = tgt.shields.filter(s => s.amt > 1e-9);
    const real = Math.min(tgt.hp, left);
    tgt.hp -= real;
    if (src) src.m.dmg += amt;
    tgt.m.taken += amt;
    if (tgt.hp <= 1e-9 && tgt.alive) {
      tgt.alive = false; tgt.hp = 0; tgt.deadAt = RT ? now : round;
      if (src) src.m.kills++;
      say({ ev: 'death', actor: tgt.name, text: `${tgt.name} 쓰러짐${dot ? ' (지속 피해)' : ''}` });
      for (const a of alive(tgt.side)) firePassives(a, 'onAllyDeath');
      if (src?.alive && src.side !== tgt.side) firePassives(src, 'onKill');
    } else { checkPhase(tgt); firePassives(tgt, 'hpBelow'); }
  }
  function checkPhase(u) {
    if (!u.phases?.length) return;
    const pct = u.hp / u.maxHp * 100;
    let k = -1; u.phases.forEach((p, i) => { if (pct <= p.hp) k = i; });
    if (k > u.phase) {
      u.phase = k; u.skills = [...u.phases[k].skills]; u.cds = {}; u.ready = {}; u.seq = 0;
      say({ ev: 'phase', actor: u.name, text: `페이즈 ${k + 2} 진입 (체력 ${u.phases[k].hp}% 이하) → ${u.skills.map(id => sk[id]?.name ?? id).join(', ')}` });
    }
  }
  function addGroggy(src, tgt, amount) {
    if (!(tgt.groggyMax > 0) || !tgt.alive || amount <= 0 || tgt.groggyLeft > 0 || tgt.groggyUntil > now) return;
    tgt.groggy += amount * R.groggyGain;
    if (tgt.groggy >= tgt.groggyMax) {
      tgt.groggy = tgt.groggyMax;
      if (RT) tgt.groggyUntil = now + R.groggyDur; else tgt.groggyLeft = R.groggyDur;
      src.m.groggy++;
      say({ ev: 'groggy', actor: tgt.name, text: `${tgt.name} 흐트러짐! ${R.groggyDur}${RT ? '초' : '턴'} 행동 불가 · 받는 피해 ×${R.groggyDmg}` });
    }
  }

  // ── 대상 고르기 ──
  const isTaunting = (u) => u.statuses.some(s => s.kind === 'taunt');
  function pickEnemy(u) {
    const foes = alive(1 - u.side);
    if (!foes.length) return null;
    const rule = u.side === 0 ? R.targeting : R.enemyTargeting;
    const rand = (arr) => arr[Math.floor(rnd() * arr.length)];
    if (rule === 'taunt') { const tt = foes.filter(isTaunting); if (tt.length) return rand(tt); }
    if (rule === 'random') return rand(foes);
    if (rule === 'lowhp') return foes.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
    const front = foes.filter(f => f.row === 'front');
    return rand(front.length ? front : foes);
  }
  function pickAlly(u, rule = R.allyRule) {
    const al = alive(u.side);
    if (rule === 'random') return al[Math.floor(rnd() * al.length)];
    if (rule === 'atk') return al.reduce((a, b) => (effStat(b, 'atk', R) > effStat(a, 'atk', R) ? b : a));
    return al.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
  }
  const effectsOf = (s) => (s.effects || []).map(id => ef[id]).filter(Boolean);
  const dead = (u) => units.filter(x => x.side === u.side && !x.alive);

  /** 쓸 스킬: 목록 앞쪽부터, 쿨타임·코스트·상황(회복할 아군, 부활할 아군, 이미 걸린 영구 효과)을 보고 */
  function choose(u) {
    for (const id of u.skills) {
      const s = sk[id];
      if (!s || s.kind === 'passive') continue;
      const cdOk = RT ? (u.ready[id] ?? 0) <= now + 1e-9 : !(u.cds[id] > 0);
      if (!cdOk || u.res < (s.cost ?? 0)) continue;
      const es = effectsOf(s);
      if (es.some(e => e.kind === 'revive')) { if (R.revive && dead(u).length) return s; continue; }
      if (s.target === 'ally' && es.some(e => e.kind === 'heal')) { if (alive(u.side).some(a => a.hp / a.maxHp * 100 < R.healBelow)) return s; continue; }
      if (s.target === 'self' || s.target === 'ally') {
        const pool = s.target === 'self' ? [u] : s.area === 'all' ? alive(u.side) : [pickAlly(u)];
        const useless = es.length && es.every(e => (e.duration ?? 0) === 0 && !e.stack && pool.every(p => p.statuses.some(x => x.eid === e.id)))
          || (es.length && es.every(e => e.kind === 'taunt') && isTaunting(u));
        if (useless) continue;
      }
      return s;
    }
    return BASIC;
  }

  /** 행동 한 번: forced가 있으면 그 스킬(게이지 발동), 게이지 모드의 평소 행동은 기본 공격, 아니면 코스트·쿨타임으로 고름 */
  function act(u, forced) {
    const s = forced ?? (G ? BASIC : choose(u));
    u.m.actions++;
    if (s !== BASIC && !G) { u.res -= s.cost ?? 0; if (RT) u.ready[s.id] = now + (s.cooldown ?? 0); else u.cds[s.id] = (s.cooldown ?? 0) + 1; }
    useSkill(u, s);
    if (s !== BASIC && u.alive) firePassives(u, 'onSkill');
  }

  // ── 패시브: 스킬 테이블의 종류 = 패시브, 발동 조건·확률(%)·N(체력 %) ──
  // 대상은 그 스킬의 대상·범위와 타겟팅 규칙으로 고름. 패시브로 생긴 피해·처치는 다른 패시브를 다시 부르지 않음(연쇄 방지).
  function passivesOf(u, trig) {
    const ids = new Set([...u.baseSkills, ...u.skills]);
    return [...ids].map(id => sk[id]).filter(s => s && s.kind === 'passive' && s.trigger === trig);
  }
  function firePassives(u, trig) {
    if (pDepth > 0 || !u.alive) return;
    const list = passivesOf(u, trig);
    if (!list.length) return;
    pDepth++;
    try {
      for (const p of list) {
        if (!u.alive) break;
        if (trig === 'hpBelow') {
          if (u.hpFired[p.id] || u.hp / u.maxHp * 100 > (p.threshold ?? 50)) continue;
          u.hpFired[p.id] = true;
        }
        if (rnd() * 100 >= (p.chance ?? 100)) continue;
        u.m.passives++;
        say({ ev: 'passive', actor: u.name, skill: p.name, text: `${u.name} 패시브 「${p.name}」 발동` });
        useSkill(u, p);
      }
    } finally { pDepth--; }
  }

  /** 스킬 효과 적용 (대상 고르기 → 피해·효과). 비용·쿨타임은 act에서 */
  function useSkill(u, s) {
    const es = effectsOf(s);
    let targets;
    if (es.some(e => e.kind === 'revive')) {
      const d = dead(u)[0];
      const e = es.find(x => x.kind === 'revive');
      if (d && rnd() * 100 < (e.chance ?? 100)) {
        freshState(d, R); d.hp = d.maxHp * (e.value ?? 30) / 100; d.res = 0;
        if (RT) d.next = now + 1 / aps(d);
        u.m.heal += d.hp;
        say({ ev: 'revive', actor: u.name, skill: s.name, target: d.name, text: `${s.name}: ${d.name} 부활 (체력 ${Math.round(d.hp)})` });
      }
      return;
    }
    if (s.target === 'self') targets = [u];
    else if (s.target === 'ally') targets = s.area === 'all' ? alive(u.side) : [pickAlly(u, es.some(e => e.kind === 'heal' || e.kind === 'shield') ? 'lowhp' : R.allyRule)];
    else targets = s.area === 'all' ? alive(1 - u.side) : [pickEnemy(u)].filter(Boolean);
    for (const tg of targets) {
      if (s.target === 'enemy') {
        tg._now = now;
        const r = hitDamage(t, R, u, tg, s, rnd);
        if (r.miss) { u.m.misses++; say({ ev: 'miss', actor: u.name, skill: s.name, target: tg.name, text: `${s.name} → ${tg.name} 빗나감` }); continue; }
        u.m.hits++; if (r.crit) u.m.crits++;
        // 버프·디버프 기여 추정: 다른 아군이 건 버프와, 대상에게 우리 진영이 건 디버프를 빼고 다시 계산한 데미지와의 차이
        const ext = (st) => st.src !== u.uid && st.srcSide === u.side;
        if (u.statuses.some(ext) || tg.statuses.some(ext)) {
          const frozen = { ...r.parts };
          const atk0 = effStat(u, 'atk', R, ext), def0 = effStat(tg, 'def', R, ext);
          const base0 = FORMULAS[R.formula].f(atk0, def0, R) * (s.mult ?? 1);
          const raw0 = base0 * frozen.el * frozen.critMult * takenMult(tg, R, ext) * frozen.grog;
          const extra = Math.max(0, r.dmg - (raw0 > 0 ? Math.max(1, roundDmg(raw0, R)) : 0));
          if (extra > 0) {
            const srcs = [...new Set([...u.statuses, ...tg.statuses].filter(ext).map(x => x.src))];
            for (const id of srcs) { const b = units.find(x => x.uid === id); if (b) b.m.buff += extra / srcs.length; }
          }
        }
        say({ ev: 'attack', actor: u.name, skill: s.name, target: tg.name, value: r.dmg, crit: r.crit, text: `${s.name} → ${tg.name} ${r.dmg}${r.crit ? ' (치명타)' : ''}` });
        damage(u, tg, r.dmg);
        addGroggy(u, tg, s === BASIC ? R.basicGroggy : (s.groggy ?? 0));
        if (tg.alive) for (const e of es) applyEffect(u, tg, e);
        if (s === BASIC) firePassives(u, 'onAttack');
        if (tg.alive) firePassives(tg, 'onHit');
      } else {
        if (es.length === 0) continue;
        say({ ev: 'skill', actor: u.name, skill: s.name, target: tg.name, text: `${s.name} → ${tg.name}` });
        for (const e of es) applyEffect(u, tg, e);
      }
    }
  }

  /** 실시간: 만료된 상태·보호막을 지금 시각 기준으로 정리 (1초 틱 사이에 끝난 효과가 다음 행동에 남지 않게) */
  function purge() {
    for (const u of units) {
      const gone = u.statuses.filter(s => s.until <= now + 1e-9);
      if (gone.length) { u.statuses = u.statuses.filter(s => s.until > now + 1e-9); for (const g of gone) say({ ev: 'expire', actor: u.name, text: `${u.name}: ${g.name} 해제` }); }
      u.shields = u.shields.filter(s => s.until > now + 1e-9 && s.amt > 0);
      if (u.groggyUntil > 0 && u.groggyUntil <= now + 1e-9) { u.groggyUntil = -1; u.groggy = 0; say({ ev: 'expire', actor: u.name, text: `${u.name} 흐트러짐 해제 · 게이지 초기화` }); }
    }
  }
  const aps = (u) => Math.max(0.05, effStat(u, 'spd', R) / R.speedBase);
  const cannotAct = (u) => u.groggyLeft > 0 || u.groggyUntil > now + 1e-9 || u.statuses.some(s => s.kind === 'stun' && (RT ? s.until > now + 1e-9 : s.rem > 0));

  // ── 턴제 ──
  function tickTurnStart(u) {
    for (const s of u.statuses) if (s.dot > 0 && u.alive) { const d = Math.max(1, roundDmg(s.dot * takenMult(u, R), R)); const src = units.find(x => x.uid === s.src); say({ ev: 'dot', actor: s.name, target: u.name, value: d, text: `${s.name}: ${u.name} ${d}` }); damage(src, u, d, { dot: true }); }
    u.res = Math.min(R.resMax, u.res + R.resRegen);
    for (const k of Object.keys(u.cds)) u.cds[k]--;
  }
  function tickTurnEnd(u) {
    const before = u.statuses.length;
    u.statuses.forEach(s => { s.rem--; });
    const gone = u.statuses.filter(s => s.rem <= 0);
    u.statuses = u.statuses.filter(s => s.rem > 0);
    for (const g of gone) say({ ev: 'expire', actor: u.name, text: `${u.name}: ${g.name} 해제` });
    u.shields.forEach(s => { s.rem--; }); u.shields = u.shields.filter(s => s.rem > 0 && s.amt > 0);
    void before;
  }

  // ── 게이지 (실시간 · 게이지 모드) ──
  const activeOf = (u) => {
    const acts = u.skills.map(id => sk[id]).filter(s => s && s.kind !== 'passive');
    if (!acts.length) return null;
    return u.kind === 'char' ? acts[0] : acts[u.seq % acts.length];
  };
  const needOf = (u, s) => Math.min(u.gMax, R.gaugeNeed === 'cost' && s.cost > 0 ? s.cost : u.gMax);
  const groggyNow = (u) => u.groggyLeft > 0 || u.groggyUntil > now + 1e-9;
  const gRate = (u) => (!TD && R.stunGauge === 'stop' && cannotAct(u) ? 0
    : R.gaugeRate * u.gMult * (R.gaugeFill === 'speed' ? effStat(u, 'spd', R) / R.speedBase : 1));
  /** dt초 동안 게이지를 채움 (구간 안에서 충전 속도가 바뀌지 않도록 상태 만료도 사건으로 끊음). 다음 스킬 필요량에서 멈춤 */
  function advanceGauges(dt) {
    if (!(dt > 0)) return;
    for (const u of units) {
      if (!u.alive) continue;
      const s = activeOf(u);
      if (s) u.gauge = Math.min(needOf(u, s), u.gauge + gRate(u) * dt);
    }
  }
  function nextGaugeFull() {
    let t = Infinity, who = null;
    for (const u of units) {
      if (!u.alive) continue;
      const s = activeOf(u);
      if (!s) continue;
      const need = needOf(u, s), r = gRate(u);
      if (u.gauge >= need - 1e-9 || r <= 0) continue;
      const tt = now + (need - u.gauge) / r;
      if (tt < t) { t = tt; who = u; }
    }
    return { t, who };
  }
  function nextExpiry() {
    let t = Infinity;
    const later = (x) => { if (x > now + 1e-9 && x < t) t = x; };
    for (const u of units) {
      if (!u.alive) continue;
      for (const s of u.statuses) later(s.until);
      for (const s of u.shields) later(s.until);
      later(u.groggyUntil);
    }
    return t;
  }
  /** 게이지가 가득 찬 유닛이 있으면 전투를 멈춘 채(시간 0) 한 명씩 발동 — 발동 결과로 다른 유닛이 쓰러지거나 웨이브가 넘어갈 수 있어 매번 다시 확인 */
  function castReady() {
    for (let guard = 0; guard < 500; guard++) {
      checkWave();
      if (over()) return;
      const ready = units.filter(u => {
        if (!u.alive) return false;
        const s = activeOf(u);
        // 턴 지속: 기절이어도 차면 턴을 소모(아래), 흐트러짐(그로기)만 풀릴 때까지 기다림
        return s && u.gauge >= needOf(u, s) - 1e-6 && (TD ? !groggyNow(u) : R.stunCast === 'cast' || !cannotAct(u));
      });
      if (!ready.length) return;
      ready.sort((a, b) => (R.castOrder === 'speed' ? effStat(b, 'spd', R) - effStat(a, 'spd', R) : 0) || a.side - b.side || a.idx - b.idx);
      const u = ready[0], s = activeOf(u), need = needOf(u, s);
      u.gauge = Math.max(0, u.gauge - need);
      if (!TD) {
        say({ ev: 'cast', actor: u.name, skill: s.name, text: `${u.name} 게이지 ${Math.round(need)} 가득 → 「${s.name}」 (전투 정지 · 즉시 발동)` });
        u.seq++; u.m.casts++;
        act(u, s);
        continue;
      }
      // ── 턴: 스킬(또는 기절이면 턴만 소모) → 지속 피해 → 내 효과 지속 1 감소 ──
      u.castStamp = ++stamp;
      if (cannotAct(u)) {
        say({ ev: 'skip', actor: u.name, text: `${u.name} 기절 — 게이지 가득, 스킬 없이 턴 소모` });
        dotTick(u);
      } else {
        if (R.dotTiming === 'before') dotTick(u);
        if (u.alive) {
          say({ ev: 'cast', actor: u.name, skill: s.name, text: `${u.name} 게이지 ${Math.round(need)} 가득 → 「${s.name}」 (전투 정지 · 즉시 발동)` });
          u.seq++; u.m.casts++;
          u.casting = true;
          try { act(u, s); } finally { u.casting = false; }
        }
        if (R.dotTiming !== 'before') dotTick(u);
      }
      if (u.alive) endTurn(u);
    }
  }
  /** 턴 지속: 받은 몬몬의 턴마다 지속 피해 */
  function dotTick(u) {
    for (const s of [...u.statuses]) {
      if (!(s.dot > 0) || !u.alive) continue;
      const d = Math.max(1, roundDmg(s.dot * takenMult(u, R), R)), src = units.find(x => x.uid === s.src);
      say({ ev: 'dot', actor: s.name, target: u.name, value: d, text: `${s.name}: ${u.name} ${d}` });
      damage(src, u, d, { dot: true });
    }
  }
  /** 턴 지속: 이번 턴에 자신에게 건 것 빼고 효과·보호막 지속 1 감소, 0이면 해제. 기절이 풀리면 평타도 다시 */
  function endTurn(u) {
    const stunnedBefore = cannotAct(u);
    for (const s of u.statuses) if (s.born !== u.castStamp) s.rem--;
    const gone = u.statuses.filter(s => s.rem <= 0);
    u.statuses = u.statuses.filter(s => s.rem > 0);
    for (const g of gone) say({ ev: 'expire', actor: u.name, text: `${u.name}: ${g.name} 해제 (턴 종료)` });
    for (const sh of u.shields) if (sh.born !== u.castStamp) sh.rem--;
    u.shields = u.shields.filter(sh => sh.rem > 0 && sh.amt > 0);
    if (stunnedBefore && !cannotAct(u)) u.next = Math.min(u.next, now + 1 / aps(u));
  }

  // 전투 시작 패시브 → 웨이브 시작 패시브 (첫 웨이브 포함)
  for (const u of [...units]) firePassives(u, 'start');
  for (const u of [...units]) firePassives(u, 'wave');

  if (!RT) {
    while (!over() && round < R.maxTurns) {
      round++;
      const order = units.filter(u => u.alive).sort((a, b) => effStat(b, 'spd', R) - effStat(a, 'spd', R) || a.side - b.side || a.idx - b.idx);
      for (const u of order) {
        if (!u.alive) continue;
        tickTurnStart(u);
        checkWave();
        if (!u.alive || over()) break;
        if (u.groggyLeft > 0) {
          u.groggyLeft--; say({ ev: 'skip', actor: u.name, text: `${u.name} 흐트러짐 — 행동 불가` });
          if (u.groggyLeft === 0) { u.groggy = 0; say({ ev: 'expire', actor: u.name, text: `${u.name} 흐트러짐 해제 · 게이지 초기화` }); }
        } else if (cannotAct(u)) say({ ev: 'skip', actor: u.name, text: `${u.name} 기절 — 행동 불가` });
        else act(u);
        tickTurnEnd(u);
        checkWave();
        if (over()) break;
      }
      for (const u of units) if (u.alive) u.m.life++;
    }
  } else {
    // ── 실시간: 사건 = 유닛 행동(1 ÷ 초당 행동), 1초마다 지속 피해·자원 회복, (게이지 모드) 게이지가 차는 순간·상태 만료 ──
    for (const u of units) { startTimer(u); u.lastT = 0; }
    let nextTick = 1;
    while (!over() && now < R.maxTime) {
      if (G) castReady(); else checkWave();
      if (over()) break;
      const actors = units.filter(u => u.alive);
      const nu = actors.reduce((a, b) => (b.next < a.next ? b : a));
      const gf = G ? nextGaugeFull() : { t: Infinity, who: null };
      const tEv = G ? Math.min(gf.t, nextExpiry()) : Infinity;
      if (G) advanceGauges(Math.min(nextTick, nu.next, tEv) - now);
      if (nextTick <= nu.next && nextTick <= tEv) {
        now = nextTick; nextTick += 1;
        purge();
        for (const u of units) {
          if (!u.alive) continue;
          u.res = Math.min(R.resMax, u.res + R.resRegen);
          if (!TD) for (const s of u.statuses) if (s.dot > 0 && s.until >= now - 1e-9 && u.alive) { const d = Math.max(1, roundDmg(s.dot * takenMult(u, R), R)); const src = units.find(x => x.uid === s.src); say({ ev: 'dot', actor: s.name, target: u.name, value: d, text: `${s.name}: ${u.name} ${d}` }); damage(src, u, d, { dot: true }); }
          const gone = u.statuses.filter(s => s.until <= now + 1e-9);
          u.statuses = u.statuses.filter(s => s.until > now + 1e-9);
          for (const g of gone) say({ ev: 'expire', actor: u.name, text: `${u.name}: ${g.name} 해제` });
          u.shields = u.shields.filter(s => s.until > now + 1e-9 && s.amt > 0);
          if (u.groggyUntil > 0 && u.groggyUntil <= now + 1e-9) { u.groggyUntil = -1; u.groggy = 0; say({ ev: 'expire', actor: u.name, text: `${u.name} 흐트러짐 해제 · 게이지 초기화` }); }
          if (u.alive) u.m.life++;
        }
        continue;
      }
      if (tEv <= nu.next) {
        // 게이지가 차는 순간(같은 시각이면 평타보다 먼저) 또는 상태 만료 — 발동은 다음 바퀴 맨 앞 castReady에서
        now = tEv;
        if (gf.who && gf.t <= tEv + 1e-12) { const s = activeOf(gf.who); if (s) gf.who.gauge = needOf(gf.who, s); }
        purge();
        continue;
      }
      now = nu.next;
      purge();
      if (cannotAct(nu)) {
        const stunEnd = Math.max(nu.groggyUntil, ...nu.statuses.filter(s => s.kind === 'stun').map(s => s.until));
        say({ ev: 'skip', actor: nu.name, text: `${nu.name} ${nu.groggyUntil > now ? '흐트러짐' : '기절'} — 행동 불가` });
        nu.next = Math.max(now + 0.1, Math.min(stunEnd, now + R.maxTime));
        continue;
      }
      act(nu);
      nu.next = now + 1 / aps(nu);
    }
  }

  const winner = !alive(1).length && alive(0).length ? 0 : !alive(0).length && alive(1).length ? 1 : null;
  return {
    winner, dur: RT ? now : round, survivors: alive(0).length,
    wave: Math.max(0, waveIdx + 1), waves: waves.length, waveTimes,
    units: units.map(u => ({ uid: u.uid, name: u.name, side: u.side, role: u.role, wave: u.wave ?? 0, alive: u.alive, hp: u.hp, maxHp: u.maxHp, gauge: u.gauge, ...u.m })),
    log: L,
  };
}

/** 시너지 조건: 같은 속성 N명 / 역할군 조합 / 특정 캐릭터 */
export function synergyMet(sy, mem) {
  const keys = String(sy.key ?? '').split(/[|;,]/).map(s => s.trim()).filter(Boolean);
  if (sy.cond === 'element') return mem.filter(u => u.element === String(sy.key).trim()).length >= (sy.count ?? 1);
  if (sy.cond === 'role') return keys.length > 0 && keys.every(r => mem.some(u => u.role === r));
  if (sy.cond === 'chars') return keys.length > 0 && keys.every(id => mem.some(u => u.kind === 'char' && u.id === id));
  return false;
}

// ── 여러 판 ─────────────────────────────────────────────
/**
 * runs번 돌려 요약. 반환 { runs, win, lose, draw, clear: [승리한 판의 턴/초], mean, survivors, dps, taken, units: [평균 기여], log }
 * 같은 seed면 같은 결과 (조합 비교는 같은 seed를 넘겨 공정하게).
 */
export function simulate(t, R, setup, { runs = 300, seed, logFirst = true } = {}) {
  let win = 0, lose = 0, draw = 0, surv = 0, dps = 0, taken = 0, nWaves = 0;
  const reach = [], waveStart = [];
  const clear = [], durs = [];
  const sums = new Map();
  let log = [];
  for (let i = 0; i < runs; i++) {
    const r = battle(t, R, setup, { seed: seedMix(seed, 1009 + i * 7919), log: logFirst && i === 0 });
    if (i === 0) log = r.log;
    nWaves = Math.max(nWaves, r.waves);
    for (let w = 0; w < r.wave; w++) { reach[w] = (reach[w] || 0) + 1; (waveStart[w] ||= []).push(r.waveTimes[w]); }
    if (r.winner === 0) { win++; clear.push(r.dur); } else if (r.winner === 1) lose++; else draw++;
    durs.push(r.dur);
    surv += r.survivors;
    const allyDmg = r.units.filter(u => u.side === 0).reduce((a, u) => a + u.dmg, 0);
    dps += r.dur > 0 ? allyDmg / r.dur : 0;
    taken += r.units.filter(u => u.side === 0).reduce((a, u) => a + u.taken, 0);
    for (const u of r.units) {
      const s = sums.get(u.uid) || { uid: u.uid, name: u.name, side: u.side, role: u.role, wave: u.wave, appear: 0, casts: 0, passives: 0, dmg: 0, taken: 0, heal: 0, shield: 0, buff: 0, life: 0, actions: 0, crits: 0, hits: 0, misses: 0, kills: 0, groggy: 0, survived: 0, durSum: 0 };
      for (const k of ['dmg', 'taken', 'heal', 'shield', 'buff', 'life', 'actions', 'crits', 'hits', 'misses', 'kills', 'groggy', 'casts', 'passives']) s[k] += u[k] ?? 0;
      s.survived += u.alive ? 1 : 0; s.durSum += r.dur; s.appear++;
      sums.set(u.uid, s);
    }
  }
  const units = [...sums.values()].map(s => {
    const o = { ...s };
    for (const k of ['dmg', 'taken', 'heal', 'shield', 'buff', 'life', 'actions', 'crits', 'hits', 'misses', 'kills', 'groggy', 'casts', 'passives', 'survived']) o[k] = s[k] / runs;
    o.dps = s.durSum > 0 ? s.dmg / s.durSum : 0;
    o.critRate = s.hits ? s.crits / s.hits : 0;
    delete o.durSum;
    return o;
  });
  const sorted = Float64Array.from(clear).sort();
  return {
    runs, win: win / runs, lose: lose / runs, draw: draw / runs, winCount: win,
    clear: sorted, durations: Float64Array.from(durs).sort(),
    meanClear: clear.length ? clear.reduce((a, b) => a + b, 0) / clear.length : NaN,
    survivors: surv / runs, dps: dps / runs, taken: taken / runs, units, log,
    // 웨이브: reach[k] = 웨이브 k+1에 도달한 판 비율, waveStart[k] = 도달한 판들의 그 웨이브 시작 시각 평균
    waves: nWaves, reach: Array.from({ length: nWaves }, (_, k) => (reach[k] || 0) / runs),
    waveStart: Array.from({ length: nWaves }, (_, k) => (waveStart[k]?.length ? waveStart[k].reduce((a, b) => a + b, 0) / waveStart[k].length : NaN)),
  };
}

/** 슬롯 목록에서 유효한 유닛 수 (없는 ID 등은 빠짐) */
export const validSlots = (t, list) => (list || []).filter(s => makeUnit(t, s, 0, 0));
