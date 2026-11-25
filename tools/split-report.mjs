// 분열 보스 결과 페이지용 데이터 — tools/split-sim.mjs 를 설정별로 돌려 docs/split-report/*.json 으로 저장
//   clear = 클리어율(%, 소수 1자리) · 파티 key: base 기준 / ctrl 대조군(같은 화력, 열쇠 효과 없음) / tok / mong / chot
//   sweep.json : 최종 설정에서 분열체 체력 8,000~16,000 × 파티 5종
//   steps.json : 분열체 REF_HP에서 설정을 하나씩 더해 가며 파티 5종
//   sync.json  : 분열체 REF_HP에서 아군 속도 원래 / 전원 110 / 전원 120 × 파티 5종 (속도를 맞춘 파티 = 다른 해법)
// 시작 게이지: 모두 0에서 시작 (사용자 결정, 2026-11-25) · 반사 피해는 분열체 방어력에 깎임(split-sim 기본 ×0.16)
// 각 파일 = { rows, meta } (meta 에 시뮬레이션 코드·설정을 그대로 담음)
// 실행: node tools/split-report.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SIM = 'tools/split-sim.mjs';
const run = (env) => JSON.parse(execFileSync(process.execPath, [SIM], { env: { ...process.env, JSON: '1', START: '0', ...env }, encoding: 'utf8', maxBuffer: 1 << 24 }));
const code = readFileSync(SIM, 'utf8');
const OUT = 'docs/split-report';
const REF_HP = '15000';
mkdirSync(OUT, { recursive: true });
const codeMeta = { label: 'split-sim.mjs', value: code, type: 'code', lang: 'javascript' };
const START_NOTE = { label: '시작 게이지', value: '모두 0에서 시작 (사용자 결정)' };

const FINAL = { AOECUT: '0.5', SPLIT: '30000', PCOUNTER: '5000', CTARGET: 'user' };
const sweep = run({ ...FINAL, HS: '8000,9000,10000,11000,12000,13000,14000,15000,16000' });
writeFileSync(`${OUT}/sweep.json`, JSON.stringify({
  rows: sweep,
  meta: [
    { label: '설정', value: 'AOECUT=0.5 SPLIT=30000 PCOUNTER=5000 CTARGET=user (다수 공격 피해 −50%, 한 몸 30,000 뒤 분열, 다수 공격을 쓴 몬몬에게 바로 단일 반격 5,000)' },
    START_NOTE,
    { label: '판 수', value: '설정·파티·체력마다 1,000판, 시드 4242' },
    codeMeta,
  ],
}));

const STEPS = [
  { step: 1, setting: '다수 공격 피해 −30%, 반격은 자세 끝에 아군 전체', env: { AOECUT: '0.3', CTARGET: 'all' } },
  { step: 2, setting: '피해 감소 −50%로', env: { AOECUT: '0.5', CTARGET: 'all' } },
  { step: 3, setting: '+ 맞는 즉시 반격', env: { AOECUT: '0.5', CTARGET: 'all', INSTANT: '1' } },
  { step: 4, setting: '+ 한 몸 30,000으로 시작해 중간 분열', env: { AOECUT: '0.5', CTARGET: 'all', INSTANT: '1', SPLIT: '30000' } },
  { step: 5, setting: '반격을 다수 공격 쓴 몬몬 단일 5,000으로 (최종)', env: FINAL },
];
const steps = STEPS.flatMap(s => run({ ...s.env, HS: REF_HP }).map(r => ({ step: s.step, setting: s.setting, key: r.key, party: r.party, clear: r.clear })));
writeFileSync(`${OUT}/steps.json`, JSON.stringify({
  rows: steps,
  meta: [
    { label: '설정', value: STEPS.map(s => `${s.step}. ${s.setting}: ${Object.entries(s.env).map(([k, v]) => `${k}=${v}`).join(' ')}`).join('\n') },
    { label: '분열체 체력', value: REF_HP }, START_NOTE, codeMeta,
  ],
}));

const SYNCS = [{ sync: '원래 속도', env: {} }, { sync: '전원 110', env: { SYNC: '110' } }, { sync: '전원 120', env: { SYNC: '120' } }];
const sync = SYNCS.flatMap((s, i) => run({ ...FINAL, ...s.env, HS: REF_HP }).map(r => ({ order: i + 1, sync: s.sync, key: r.key, party: r.party, clear: r.clear })));
writeFileSync(`${OUT}/sync.json`, JSON.stringify({
  rows: sync,
  meta: [
    { label: '설정', value: '최종 설정 + SYNC (아군 전원 속도를 같은 값으로). 원래 속도: 콜리킹 119 · 딸랑귀 102 · 쥐강이 110 · 파이온 102 · 콘센파리 127 (열쇠 몬몬·대조군 100), 평균 약 112' },
    { label: '분열체 체력', value: REF_HP }, START_NOTE, codeMeta,
  ],
}));
console.log(`sweep ${sweep.length}행, steps ${steps.length}행, sync ${sync.length}행 → ${OUT}`);
