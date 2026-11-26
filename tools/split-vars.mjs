// 몬테카를로 변수 실험 + 몬스터 타임라인 기록 → docs/split-report/vars.json
//   1) 속도 버프를 누가 받는지  2) 조각 스킬 게이지를 깎는 몬몬이 있으면  3) 치명타가 터지면 / 안 터지면
//   4) 한 판 기록 (기본 파티 진 판 · 톡찌리 이긴 판) — 쿼디가 언제 나뉘고 쓰러지고 다시 일어나는지
// 설정은 결과와 같은 중반 10단계 (tools/split-report.mjs 의 FINAL, 분열체 13,955), 모두 빈 게이지로 시작, 1,000판 시드 4242
// 실행: node tools/split-vars.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SIM = fileURLToPath(new URL('./split-sim.mjs', import.meta.url));
const FINAL = { AOECUT: '0.5', SPLIT: '100000', PCOUNTER: '20000', CTARGET: 'user', PDMG: '0.3', RAMP: '0.1', SLOW: '10', SLOWN: '2', SLOWMAX: '2', START: '0', HS: '13955' };
const KEYS = 'base,tok,ment';
const NAME = { base: '기본 파티', tok: '톡찌리', ment: '멘티삿' };
const raw = (env) => JSON.parse(execFileSync(process.execPath, [SIM], { env: { ...process.env, RAW: '1', KEY: KEYS, ...FINAL, ...env }, encoding: 'utf8', maxBuffer: 1 << 28 }));
const sum = (runs) => {
  const w = runs.filter((r) => r.win), ts = w.map((r) => r.t).sort((a, b) => a - b);
  return { clear: +(w.length / runs.length * 100).toFixed(1), time: ts.length ? Math.round(ts[ts.length >> 1]) : null, revives: +(runs.reduce((s, r) => s + r.revives, 0) / runs.length).toFixed(2) };
};

const EXP = [
  { group: '속도 버프 대상', order: 1, label: '속도 버프 없음', note: '콘센파리 [속도 +15%] 끔', env: { SPDTO: 'none' } },
  { group: '속도 버프 대상', order: 2, label: '모든 아군 (실제 스킬)', note: '콘센파리 「전류 동조」: [4턴에 한 번] 모든 아군 2턴 [속도 +15%]', env: { SPDTO: 'all' } },
  { group: '속도 버프 대상', order: 3, label: '콜리킹만 (딜 없음)', note: '1명에게만 들어간다면', env: { SPDTO: 'slot1' } },
  { group: '속도 버프 대상', order: 4, label: '열쇠 자리만', note: '기본 파티는 기본몬몬, 톡찌리 파티는 톡찌리', env: { SPDTO: 'slot3' } },
  { group: '속도 버프 대상', order: 5, label: '파이온만 (광역 딜러)', note: '1명에게만 들어간다면', env: { SPDTO: 'slot4' } },
  { group: '조각 게이지 감소', order: 1, label: '없음 (지금 결과)', note: '', env: {} },
  { group: '조각 게이지 감소', order: 2, label: '딸랑귀 평타 4% −20%', note: '딸랑귀 「종소리 일격」 실제 효과 — 지금 결과엔 빠져 있음', env: { DALCUT: '1' } },
  { group: '조각 게이지 감소', order: 3, label: '스킬마다 모든 조각 −15%', note: '콜리킹 자리 몬몬에 북치기 · 윙빗 ★3 같은 효과를 붙임', env: { GCUT: '0.15', GCUTBY: '콜리킹' } },
  { group: '조각 게이지 감소', order: 4, label: '위 둘 다', note: '', env: { GCUT: '0.15', GCUTBY: '콜리킹', DALCUT: '1' } },
  { group: '조각 게이지 감소', order: 5, label: '스킬마다 모든 조각 −30%', note: '강한 경우 (참고)', env: { GCUT: '0.30', GCUTBY: '콜리킹' } },
  { group: '은신', order: 1, label: '멘티삿 은신 끔', note: '광역 화력은 그대로, [강철 은신]만 끔 — 은신의 몫', env: { NOSTEALTH: '1' } },
  { group: '은신', order: 2, label: '멘티삿 은신 켬 (지금 결과)', note: '', env: {} },
  { group: '치명타', order: 1, label: '치명 없음', note: '딸랑귀 · 쥐강이 자리 치명이 하나도 안 터지면', env: { CRIT: 'off' } },
  { group: '치명타', order: 2, label: '확률대로 (지금 결과)', note: '딸랑귀 28% · 쥐강이 37% (3,216 → 5,000)', env: { CRIT: 'roll' } },
  { group: '치명타', order: 3, label: '스킬마다 치명', note: '모두 터지면', env: { CRIT: 'all' } },
];

const rows = [];
let base = null;
for (const e of EXP) {
  const out = raw(e.env);
  for (const o of out) {
    rows.push({ group: e.group, order: e.order, label: e.label, note: e.note, key: o.key, party: NAME[o.key], ...sum(o.runs) });
    if (e.group === '치명타' && e.order === 2) base = base || {};
    if (e.group === '치명타' && e.order === 2) base[o.key] = o.runs;
  }
  console.log(e.group, '·', e.label, out.map((o) => `${o.key} ${sum(o.runs).clear}%`).join(' / '));
}

// 치명 비율별 승률 — 같은 설정 1,000판을 판마다 「터진 치명 ÷ 치명이 날 수 있던 스킬 수」로 나눠 봄
//   (횟수로 나누면 오래 끈 판일수록 스킬을 많이 써 치명도 많아져서, 진 판에 치명이 많아 보이는 착시가 생김)
const crit = [];
for (const k of ['tok', 'ment']) {   // 기본 파티는 반격 6,000 뒤 거의 못 이겨(1% 안팎) 이긴 판 비교가 안 됨
  const runs = base[k].map((r) => ({ ...r, rate: r.tries ? r.crits / r.tries : 0 }));
  const bins = [[0, 0.25, '25% 미만 (운 나쁨)'], [0.25, 0.35, '25~35%'], [0.35, 0.45, '35~45%'], [0.45, 1.01, '45% 이상 (운 좋음)']];
  for (const [lo, hi, lab] of bins) {
    const rs = runs.filter((r) => r.rate >= lo && r.rate < hi);
    crit.push({ key: k, party: NAME[k], bin: lab, runs: rs.length, clear: rs.length ? +(rs.filter((r) => r.win).length / rs.length * 100).toFixed(1) : null });
  }
  const w = runs.filter((r) => r.win), l = runs.filter((r) => !r.win), avg = (a, f) => a.length ? +(a.reduce((s, r) => s + f(r), 0) / a.length).toFixed(3) : null;
  crit.push({ key: k, party: NAME[k], bin: '평균', winRate: avg(w, (r) => r.rate), loseRate: avg(l, (r) => r.rate), winCount: avg(w, (r) => r.crits), loseCount: avg(l, (r) => r.crits) });
}

// 몬스터 타임라인 — 기본 파티 진 판(시간이 중앙값에 가까운 판), 톡찌리 이긴 판(중앙값에 가까운 판)
const pick = (runs, win) => { const rs = runs.filter((r) => r.win === win).sort((a, b) => a.t - b.t); return rs[rs.length >> 1]?.k; };
const kb = pick(base.base, false), kt = pick(base.tok, true);
const traces = {};
for (const [k, idx] of [['base', kb], ['tok', kt]]) {
  const out = raw({ TRACE: '1', RUNIDX: String(idx), KEY: k });
  const r = out[0].runs[idx];
  traces[k] = { party: NAME[k], run: idx, win: r.win, t: r.t, revives: r.revives, crits: r.crits, ev: r.ev };
  console.log('타임라인', k, '판', idx, r.win ? '이김' : '짐', r.t, '초, 부활', r.revives, '· 기록', r.ev.length);
}

// 전투 업타임별 누적 클리어 확률 — 같은 설정(중반 10단계)에서 「t초 안에 깬 판 ÷ 1,000」
const UP_NAME = { base: '기본 파티', tok: '톡찌리', ment: '멘티삿', duo: '톡찌리 + 멘티삿', duo2: '톡찌리 + 토볼트' };
const upRaw = raw({ KEY: 'base,tok,ment,duo,duo2' });
const uptime = [];
for (let sec = 0; sec <= 600; sec += 10) {   // 시간 보정 뒤 늦게 깨는 판까지 (최대 600초)
  const row = { t: sec };
  for (const o of upRaw) row[o.key] = +(o.runs.filter((r) => r.win && r.t <= sec).length / o.runs.length * 100).toFixed(1);
  uptime.push(row);
}
console.log('업타임', uptime.filter((r) => r.t % 60 === 0).map((r) => `${r.t}s base ${r.base} tok ${r.tok}`).join(' · '));

const meta = [
  { label: '설정', value: '중반 10단계 결과와 같음 (분열체 13,955 · 한 몸 100,000 · 모두 빈 게이지 · 1,000판 시드 4242) + 실험마다 한 가지만 바꿈' },
  { label: '파티', value: '기본 파티(쥐강이 자리에 열쇠 몬몬과 같은 능력치) · 톡찌리 파티' },
  { label: '주의', value: '속도 버프를 1명에게만 주는 것 · 게이지 −15/30% 몬몬을 콜리킹 자리에 붙이는 것은 「만약」 실험. 실제 스킬은 note 칸' },
];
writeFileSync(new URL('../docs/split-report/vars.json', import.meta.url), JSON.stringify({ rows, crit, traces, uptime, upName: UP_NAME, meta }, null, 0));
console.log('docs/split-report/vars.json', rows.length, '행');
