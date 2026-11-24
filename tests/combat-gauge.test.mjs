// 전투 시뮬레이터 — 스킬 게이지(실시간), 웨이브, 패시브
// 확인된 규칙: 게이지는 시간으로만 차고 속도에 따라 빨라짐 / 가득 차면 전투 전체가 멈추고 즉시 발동(0초)
//             캐릭터는 액티브 1개, 보스는 게이지가 찰 때마다 스킬 목록 순서대로 / 웨이브: 체력 유지, 게이지는 유닛별 시작값으로
// 확인 전 규칙(선택지): 기절 중 발동·충전, 동시 발동 순서, 웨이브 사이 버프 유지, 평타 주기 재시작
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTables } from '../src/data/tables.js';
import { DEFAULT_RULES, battle, simulate } from '../src/combat/engine.js';
import { validateTables } from '../src/data/tables.js';

const G = { ...DEFAULT_RULES, mode: 'realtime', skillMode: 'gauge', gaugeMax: 100, gaugeRate: 10, gaugeFill: 'speed', speedBase: 100, maxTime: 35, hitMode: 'always', crit: false, synergy: false };
const GS = { ...G, effectDur: 'sec' }; // 효과 지속을 초로 (예전 방식)

function tables() {
  const t = defaultTables();
  const cls = { role: 'dealer', row: 'front', hp: 1000, atk: 100, def: 0, spd: 100, cric: 0, crid: 1, acc: 100, eva: 0, skills: [] };
  t.classes.push({ id: 'CL_G', name: '게이지', ...cls });
  t.skills.push(
    { id: 'SK_G1', name: '일격', target: 'enemy', area: 'single', mult: 1, effects: [] },
    { id: 'SK_G2', name: '이격', target: 'enemy', area: 'single', mult: 1, effects: [] },
    { id: 'SK_STUNALL', name: '전체 기절', target: 'enemy', area: 'all', mult: 0, effects: ['EF_STUN5'] },
    { id: 'SK_P_START', name: '전투 시작 공버프', kind: 'passive', trigger: 'start', target: 'self', area: 'single', mult: 0, effects: ['EF_ATK50'] },
    { id: 'SK_P_LOW', name: '위기 보호막', kind: 'passive', trigger: 'hpBelow', threshold: 50, target: 'self', area: 'single', mult: 0, effects: ['EF_SH'] },
    { id: 'SK_P_HIT', name: '평타 추가타', kind: 'passive', trigger: 'onAttack', chance: 100, target: 'enemy', area: 'single', mult: 1, effects: [] },
    { id: 'SK_ATKUP_ALL', name: '전체 공버프', target: 'ally', area: 'all', mult: 0, effects: ['EF_ATK25_2T'] },
    { id: 'SK_SELF_ATK', name: '자기 공버프', target: 'self', area: 'single', mult: 0, effects: ['EF_ATK25_1T'] },
    { id: 'SK_STUN1ALL', name: '전체 1턴 기절', target: 'enemy', area: 'all', mult: 0, effects: ['EF_STUN1T'] },
    { id: 'SK_DOTHIT', name: '독 찌르기', target: 'enemy', area: 'single', mult: 0, effects: ['EF_DOT2T'] },
  );
  t.effects.push(
    { id: 'EF_STUN5', name: '긴 기절', kind: 'stun', chance: 100, duration: 5, stack: false },
    { id: 'EF_ATK50', name: '공격 +50%', kind: 'buff', stat: 'atk', value: 50, mode: 'mul', chance: 100, duration: 0, stack: false },
    { id: 'EF_SH', name: '보호막', kind: 'shield', value: 100, chance: 100, duration: 0, stack: false },
    { id: 'EF_ATK25_2T', name: '공격 +25% (2턴)', kind: 'buff', stat: 'atk', value: 25, mode: 'mul', chance: 100, duration: 2, stack: false },
    { id: 'EF_ATK25_1T', name: '공격 +25% (1턴)', kind: 'buff', stat: 'atk', value: 25, mode: 'mul', chance: 100, duration: 1, stack: false },
    { id: 'EF_STUN1T', name: '기절 1턴', kind: 'stun', chance: 100, duration: 1, stack: false },
    { id: 'EF_DOT2T', name: '독', kind: 'dot', value: 10, chance: 100, duration: 2, stack: false },
  );
  const ch = (id, o = {}) => t.characters.push({ id, name: id, classId: 'CL_G', element: '무', modMode: 'add', skills: ['SK_G1'], ...o });
  ch('CH_G'); ch('CH_G2'); ch('CH_GFAST', { spd: 100 }); ch('CH_GHALF', { startGauge: 50 });
  ch('CH_GTWO', { skills: ['SK_G1', 'SK_G2'] });
  ch('CH_GSLOW', { spd: -50, skills: ['SK_ATKUP_ALL'] }); ch('CH_GSELF', { skills: ['SK_SELF_ATK'] }); ch('CH_GDOT', { skills: ['SK_DOTHIT'] });
  ch('CH_GSTART', { skills: ['SK_G1', 'SK_P_START'] }); ch('CH_GLOW', { skills: ['SK_P_LOW'] }); ch('CH_GHIT', { skills: ['SK_P_HIT'] });
  const mo = (id, o = {}) => t.monsters.push({ id, name: id, element: '무', row: 'front', hp: 1e9, atk: 0, def: 0, spd: 100, cric: 0, crid: 1, acc: 100, eva: 0, skills: [], boss: false, ...o });
  mo('MO_DUMMY'); mo('MO_BOSS', { boss: true, skills: ['SK_G1', 'SK_G2'], gaugeMult: 2 });
  mo('MO_STUNNER', { skills: ['SK_STUNALL'], startGauge: 100, spd: 1 });
  mo('MO_STUNNER1', { skills: ['SK_STUN1ALL'], startGauge: 100, spd: 1 });
  mo('MO_WEAK', { hp: 150 }); mo('MO_HITTER', { atk: 100, spd: 100 });
  return t;
}
// 로그 시각은 소수 둘째 자리로 반올림됨
const casts = (r, who) => r.log.filter(l => l.ev === 'cast' && (!who || l.actor === who));
const run = (t, R, setup, seed = 1) => battle(t, R, setup, { seed, log: true });

test('테스트 데이터가 테이블 검증을 통과 (새 열: 종류·발동 조건·시작 게이지·게이지 최대·충전 배율)', () => {
  const bad = validateTables(tables()).issues.filter(i => i.level === 'error');
  assert.deepEqual(bad, []);
});

test('게이지: 기본 충전 × 속도 ÷ 기준 속도 → 속도 100이면 10초마다, 200이면 5초마다, 속도 무관이면 10초', () => {
  const t = tables();
  const r = run(t, G, { allies: [{ unit: 'char:CH_G', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  assert.deepEqual(casts(r).map(l => l.t), [10, 20, 30]);
  const f = run(t, { ...G, maxTime: 33 }, { allies: [{ unit: 'char:CH_GFAST', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  assert.deepEqual(casts(f).map(l => l.t), [5, 10, 15, 20, 25, 30]);
  const flat = run(t, { ...G, gaugeFill: 'flat' }, { allies: [{ unit: 'char:CH_GFAST', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  assert.deepEqual(casts(flat).map(l => l.t), [10, 20, 30]);
});

test('게이지 모드의 평소 행동은 기본 공격, 스킬은 게이지로만 (코스트·쿨타임 무시)', () => {
  const t = tables();
  const r = run(t, G, { allies: [{ unit: 'char:CH_G', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  const atk = r.log.filter(l => l.ev === 'attack' && l.actor === 'CH_G');
  assert.equal(atk.filter(l => l.skill === '일격').length, 3);
  assert.ok(atk.filter(l => l.skill === '기본 공격').length >= 30);
});

test('시작 게이지: 테이블 값, 슬롯 값(던전 설정)이 우선', () => {
  const t = tables();
  const half = run(t, G, { allies: [{ unit: 'char:CH_GHALF', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  assert.deepEqual(casts(half).map(l => l.t).slice(0, 2), [5, 15]);
  const slot = run(t, G, { allies: [{ unit: 'char:CH_GHALF', level: 1, gauge: 90 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  assert.deepEqual(casts(slot).map(l => l.t).slice(0, 2), [1, 11]);
  const full = run(t, G, { allies: [{ unit: 'char:CH_G', level: 1, gauge: 100 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  assert.equal(casts(full)[0].t, 0); // 가득 찬 채로 시작하면 0초에 발동
});

test('발동은 전투 정지(0초) — 같은 순간 여럿이면 아군 먼저·슬롯 순, 또는 속도 순', () => {
  const t = tables();
  const setup = { allies: [{ unit: 'char:CH_G', level: 1 }, { unit: 'char:CH_G2', level: 1 }], enemies: [{ unit: 'monster:MO_BOSS', gauge: 80 }] };
  // 보스 충전 배율 2 → 20 남은 게이지를 1초에 채움. 아군 둘은 10초에 동시
  const r = run(t, { ...G, maxTime: 10.5 }, setup);
  const at10 = casts(r).filter(l => l.t === 10).map(l => l.actor);
  assert.deepEqual(at10.slice(0, 2), ['CH_G', 'CH_G2']);
  // 속도 100(10초마다)과 속도 200(5초마다)이 10초에 겹침: 아군 먼저·슬롯 순이면 슬롯 1 먼저, 속도 순이면 빠른 쪽 먼저
  const two = { allies: [{ unit: 'char:CH_G', level: 1 }, { unit: 'char:CH_GFAST', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] };
  const by = (R) => casts(run(t, { ...G, maxTime: 10.5, ...R }, two)).filter(l => l.t === 10).map(l => l.actor);
  assert.deepEqual(by({}), ['CH_G', 'CH_GFAST']);
  assert.deepEqual(by({ castOrder: 'speed' }), ['CH_GFAST', 'CH_G']);
});

test('캐릭터는 첫 액티브 하나만, 보스는 게이지가 찰 때마다 스킬 목록 순서대로 돌아감', () => {
  const t = tables();
  const c = run(t, G, { allies: [{ unit: 'char:CH_GTWO', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  assert.deepEqual(casts(c).map(l => l.skill), ['일격', '일격', '일격']);
  const b = run(t, { ...G, maxTime: 21 }, { allies: [{ unit: 'char:CH_G', level: 1 }], enemies: [{ unit: 'monster:MO_BOSS' }] });
  const boss = casts(b, 'MO_BOSS');
  assert.deepEqual(boss.map(l => l.skill).slice(0, 4), ['일격', '이격', '일격', '이격']);
  assert.deepEqual(boss.map(l => l.t).slice(0, 4), [5, 10, 15, 20]); // 충전 배율 2
});

test('(지속 = 초) 기절 중 발동: 풀리면 즉시 / 기절 중에도 발동 / 기절 중 게이지 멈춤', () => {
  const t = tables();
  const setup = { allies: [{ unit: 'char:CH_G', level: 1, gauge: 70 }], enemies: [{ unit: 'monster:MO_STUNNER' }] };
  // 0초: 기절 몬스터가 가득 찬 게이지로 전체 기절 5초. 아군은 3초에 게이지가 참
  const wait = run(t, { ...GS, maxTime: 6 }, setup);
  assert.deepEqual(casts(wait, 'CH_G').map(l => l.t), [5]);
  const cast = run(t, { ...GS, maxTime: 6, stunCast: 'cast' }, setup);
  assert.deepEqual(casts(cast, 'CH_G').map(l => l.t), [3]);
  const stop = run(t, { ...GS, maxTime: 9, stunGauge: 'stop' }, setup);
  assert.deepEqual(casts(stop, 'CH_G').map(l => l.t), [8]); // 0~5초 멈춤 → 5초부터 30 더 채움
});

test('웨이브: 적 전멸 → 다음 웨이브 바로, 아군 체력 유지 · 게이지는 시작 게이지로', () => {
  const t = tables();
  const setup = { allies: [{ unit: 'char:CH_GHALF', level: 1 }], waves: [[{ unit: 'monster:MO_WEAK' }], [{ unit: 'monster:MO_HITTER' }, { unit: 'monster:MO_DUMMY' }]] };
  const r = run(t, { ...G, maxTime: 30 }, setup);
  assert.equal(r.waves, 2);
  assert.equal(r.wave, 2);
  assert.equal(r.waveTimes.length, 2);
  const t2 = r.waveTimes[1];
  // 웨이브 1 몬스터(체력 150)는 평타 2번에 쓰러짐 → 2초 안쪽에 웨이브 2
  assert.ok(t2 > 0 && t2 < 3, String(t2));
  // 웨이브 2가 시작되면 게이지가 50으로 돌아가 5초 뒤 발동
  const first = casts(r, 'CH_GHALF').find(l => l.t > t2);
  assert.ok(Math.abs(first.t - (t2 + 5)) < 0.011, `${first.t} vs ${t2 + 5}`);
  assert.equal(r.winner, 1); // 체력 1000, 초당 100 → 30초 안에 짐 (웨이브 2의 몬스터는 체력 1e9)
  assert.ok(r.units.some(u => u.uid === 'W2E1' && u.wave === 2));
});

test('웨이브 사이 버프: 유지(기본) / 해제', () => {
  const t = tables();
  const setup = { allies: [{ unit: 'char:CH_GSTART', level: 1 }], waves: [[{ unit: 'monster:MO_WEAK' }], [{ unit: 'monster:MO_DUMMY' }]] };
  const dmgAfter = (R) => { const r = run(t, { ...R, maxTime: 8 }, setup); const t2 = r.waveTimes[1]; return r.log.find(l => l.ev === 'attack' && l.actor === 'CH_GSTART' && l.t > t2 + 0.01 && l.skill === '기본 공격').value; };
  assert.equal(dmgAfter(G), 150); // 전투 시작 공버프 +50% 유지
  assert.equal(dmgAfter({ ...G, waveBuffs: 'clear' }), 100);
});

test('패시브: 전투 시작 버프, 체력 N% 이하 1회, 평타 적중 시 추가타(연쇄 없음)', () => {
  const t = tables();
  const s = run(t, { ...G, maxTime: 2 }, { allies: [{ unit: 'char:CH_GSTART', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  assert.equal(s.log.filter(l => l.ev === 'passive').length, 1);
  assert.equal(s.log.find(l => l.ev === 'attack' && l.actor === 'CH_GSTART' && l.skill === '기본 공격').value, 150);

  const low = run(t, { ...G, maxTime: 20 }, { allies: [{ unit: 'char:CH_GLOW', level: 1 }], enemies: [{ unit: 'monster:MO_HITTER' }] });
  const fired = low.log.filter(l => l.ev === 'passive' && l.skill === '위기 보호막');
  assert.equal(fired.length, 1); // 체력 50% 이하는 한 번만
  assert.ok(fired[0].t >= 4.5 && fired[0].t < 6.2, String(fired[0].t));

  const hit = run(t, { ...G, maxTime: 3 }, { allies: [{ unit: 'char:CH_GHIT', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  const basics = hit.log.filter(l => l.ev === 'attack' && l.actor === 'CH_GHIT' && l.skill === '기본 공격').length;
  const extra = hit.log.filter(l => l.ev === 'attack' && l.skill === '평타 추가타').length;
  assert.equal(extra, basics); // 추가타가 또 추가타를 부르지 않음
});

test('여러 판 요약: 웨이브 도달률과 웨이브 시작 시각, 유닛별 발동 횟수', () => {
  const t = tables();
  const setup = { allies: [{ unit: 'char:CH_G', level: 1 }], waves: [[{ unit: 'monster:MO_WEAK' }], [{ unit: 'monster:MO_DUMMY' }]] };
  const s = simulate(t, { ...G, maxTime: 25 }, setup, { runs: 20, seed: 3 });
  assert.equal(s.waves, 2);
  assert.deepEqual(s.reach, [1, 1]);
  assert.ok(s.waveStart[1] > 0 && s.waveStart[1] < 3);
  assert.ok(s.units.find(u => u.uid === 'A1').casts >= 2);
});

test('코스트 모드·턴제는 예전 그대로이고, 턴제에서도 웨이브가 이어짐', () => {
  const t = tables();
  const setup = { allies: [{ unit: 'char:CH_G', level: 1 }], waves: [[{ unit: 'monster:MO_WEAK' }], [{ unit: 'monster:MO_WEAK' }]] };
  const r = battle(t, { ...DEFAULT_RULES, hitMode: 'always', crit: false }, setup, { seed: 1 });
  assert.equal(r.winner, 0);
  assert.equal(r.wave, 2);
});

// ── 효과 지속 = 턴 (게임 확인): 받은 몬몬의 스킬 사용마다 1, 스킬 뒤 감소, 자기에게 건 건 다음 스킬부터, 기절은 턴 소모 ──
const basicDmg = (r, who, from, to) => r.log.filter(l => l.ev === 'attack' && l.actor === who && l.skill === '기본 공격' && l.t > from && l.t < to).map(l => l.value);

test('턴 지속: 2턴 버프는 받은 몬몬의 스킬 2번에 적용되고, 두 번째 스킬 뒤에 해제', () => {
  const t = tables();
  // 느린 버퍼(속도 50, 시작 75): 5초·25초에 아군 전체 공 +25% 2턴 / 딜러(속도 100): 10·20·30초에 스킬
  const r = run(t, G, { allies: [{ unit: 'char:CH_G', level: 1 }, { unit: 'char:CH_GSLOW', level: 1, gauge: 75 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  const skill = r.log.filter(l => l.ev === 'attack' && l.actor === 'CH_G' && l.skill === '일격');
  assert.deepEqual(skill.map(l => [l.t, l.value]).slice(0, 2), [[10, 125], [20, 125]]);
  assert.ok(basicDmg(r, 'CH_G', 5.05, 19.95).every(v => v === 125));
  assert.ok(basicDmg(r, 'CH_G', 20.05, 24.95).every(v => v === 100) && basicDmg(r, 'CH_G', 20.05, 24.95).length >= 3);
  assert.ok(r.log.some(l => l.ev === 'expire' && l.actor === 'CH_G' && l.t === 20));
});

test('턴 지속: 자기 스킬로 자신에게 건 1턴 버프는 그 스킬에서 줄지 않고 다음 스킬까지 유지', () => {
  const t = tables();
  const r = run(t, { ...G, maxTime: 19 }, { allies: [{ unit: 'char:CH_GSELF', level: 1 }], enemies: [{ unit: 'monster:MO_DUMMY' }] });
  const after = basicDmg(r, 'CH_GSELF', 10.05, 19);
  assert.ok(after.length >= 7 && after.every(v => v === 125), String(after));
  assert.ok(basicDmg(r, 'CH_GSELF', 0, 9.95).every(v => v === 100));
});

test('턴 지속: 기절 중에도 게이지가 차고, 차면 스킬 없이 턴을 소모해 기절이 풀림', () => {
  const t = tables();
  // 0초: 기절 몬스터가 전체 1턴 기절. 아군은 게이지 70 → 3초에 가득 → 스킬 대신 턴 소모(기절 해제) → 13초에 스킬
  const r = run(t, { ...G, maxTime: 14 }, { allies: [{ unit: 'char:CH_G', level: 1, gauge: 70 }], enemies: [{ unit: 'monster:MO_STUNNER1' }] });
  assert.deepEqual(casts(r, 'CH_G').map(l => l.t), [13]);
  assert.ok(r.log.some(l => l.ev === 'skip' && l.actor === 'CH_G' && l.t === 3 && /턴 소모/.test(l.text)));
  assert.equal(basicDmg(r, 'CH_G', 0, 2.99).length, 0); // 기절 동안 평타 없음
  assert.ok(basicDmg(r, 'CH_G', 3, 5).length >= 1); // 풀리고 바로 평타
});

test('턴 지속: 지속 피해는 받은 몬몬의 턴마다 (1초마다가 아님)', () => {
  const t = tables();
  // 아군이 1초에 독 2턴 → 보스(충전 ×2) 턴 5·10초에 한 번씩, 그 뒤 해제
  const r = run(t, { ...G, maxTime: 16 }, { allies: [{ unit: 'char:CH_GDOT', level: 1, gauge: 90 }], enemies: [{ unit: 'monster:MO_BOSS' }] });
  const dots = r.log.filter(l => l.ev === 'dot' && l.target === 'MO_BOSS');
  assert.deepEqual(dots.map(l => [l.t, l.value]).slice(0, 2), [[5, 10], [10, 10]]);
  // 11초에 아군이 다시 독을 걸어 15초에 또 들어감 — 1초 틱으로는 들어가지 않음
  assert.ok(dots.every(l => [5, 10, 15].includes(l.t)), JSON.stringify(dots.map(l => l.t)));
});
