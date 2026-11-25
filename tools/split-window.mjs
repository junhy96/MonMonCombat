// 문항 2 분열 보스 — "첫 분열체가 쓰러진 뒤 부활 1턴 안에 남은 3마리를 다 잡나" 근사 비교 (열쇠 있음·없음)
// 실제 전투 엔진이 아니라 사용자 관측값만 쓴 창(1턴) 계산. 가정은 docs/q2-split-boss-data.md 와 아래 주석.
//   단위 = 그 단계 몬몬 스킬 1방 피해 (사용자 관측: 스킬 ≈ 4,000, 평타 ≈ 120 → 평타 1방 = 0.03)
//   1턴 동안 몬몬 1명: 평타 10번(=0.3) + 스킬 1번이 확률 P_SKILL 로 들어옴 (사용자: "0.9~1번")
//   분열체 1마리 체력 = k (스킬 몇 방), 창이 열릴 때 남은 3마리는 체력 가득 (AI가 가까운 적부터 하나씩 잡는다고 봄)
//   단일 대상 피해는 남은 분열체에 차례로 몰아넣는다고 봄 (넘친 피해는 다음 분열체로 — 낙관적)
//   광역 스킬 1방은 남은 분열체 각각에 a 만큼. 사용자 관측: 평타 대비 광역(대상 1명당) 23~30방 vs 단일 예시 33방 → a ≈ 0.7~0.9 (0.7 / 0.8 / 0.9)
//   톡찌리 스킬 = 10회, 타격마다 무작위 분열체, 1회 = 0.1. ★5 [부활 차단]: 맞은 적마다 15% (A) 또는 타격마다 15% (B)
//   [부활 차단]이 걸린 분열체는 1턴 제한에서 빠짐 (부활하는 순간 차단이 남아 있으면 막힘 — 사용자 결정)
//   반격: 광역을 쓴 몬몬이 [은신]이 아니면 광역 1번당 1번 맞음 (피해량은 모름 → 횟수만 셈)
// 실행: node tools/split-window.mjs
import { mulberry32 } from '../src/lib/rng.js';

const P_SKILL = 0.9, BASIC = 0.3, N = 20000;
const PARTIES = [
  { key: 'N', name: '일반 파티 (단일 대상 5명)', team: ['single', 'single', 'single', 'single', 'single'] },
  { key: 'A', name: '광역 2 + 단일 3 (은신 없음)', team: ['aoe', 'aoe', 'single', 'single', 'single'] },
  { key: 'S', name: '열쇠: 촛동 + 광역 2 + 단일 2 (은신으로 반격 막음)', team: ['support', 'aoe', 'aoe', 'single', 'single'], stealth: true },
  { key: 'TA', name: '열쇠: 톡찌리★5 + 단일 4 (차단 A: 맞은 적마다 15%)', team: ['tok', 'single', 'single', 'single', 'single'], block: 'A' },
  { key: 'TB', name: '열쇠: 톡찌리★5 + 단일 4 (차단 B: 타격마다 15%)', team: ['tok', 'single', 'single', 'single', 'single'], block: 'B' },
];

function trial(p, k, a, rnd) {
  const hp = [k, k, k], blocked = [false, false, false];
  let pool = 0, counters = 0;
  for (const role of p.team) {
    if (role === 'support') { pool += BASIC; continue; }   // 촛동: 피해 스킬 없음, 평타만
    pool += BASIC;
    if (rnd() >= P_SKILL) continue;
    if (role === 'single') pool += 1;
    else if (role === 'aoe') { for (let i = 0; i < 3; i++) hp[i] -= a; if (!p.stealth) counters++; }
    else if (role === 'tok') {
      const hit = [0, 0, 0];
      for (let h = 0; h < 10; h++) { const i = Math.floor(rnd() * 3); hp[i] -= 0.1; hit[i]++; }
      for (let i = 0; i < 3; i++) {
        if (!hit[i]) continue;
        const pBlock = p.block === 'A' ? 0.15 : 1 - Math.pow(0.85, hit[i]);
        if (rnd() < pBlock) blocked[i] = true;
      }
    }
  }
  // 차단 안 된 분열체만 창 안에 쓰러져야 함 — 단일 대상 피해 풀로 남은 체력을 채움
  const need = hp.reduce((s, h, i) => s + (blocked[i] ? 0 : Math.max(0, h)), 0);
  return { ok: need <= pool + 1e-9, counters, blocked: blocked.filter(Boolean).length };
}

const KS = [1.5, 2, 2.5, 3];
const rows = [];
for (const a of [0.7, 0.8, 0.9]) for (const p of PARTIES) {
  if (a !== 0.8 && !["A", "S"].includes(p.key)) continue;   // 광역 배율은 광역 파티에만 의미
  const rnd = mulberry32(12345);
  const res = KS.map(k => {
    let ok = 0, c = 0, b = 0;
    for (let n = 0; n < N; n++) { const r = trial(p, k, a, rnd); ok += r.ok; c += r.counters; b += r.blocked; }
    return { k, rate: ok / N, counters: c / N, blocked: b / N };
  });
  rows.push({ p, a, res });
}

const pct = (x) => `${Math.round(x * 100)}%`;
console.log(`| 파티 | ${KS.map(k => `k=${k}`).join(' | ')} | 창 1번에 반격 | 창 1번에 차단 |`);
console.log(`|---|${KS.map(() => '--:').join('|')}|--:|--:|`);
for (const { p, a, res } of rows) {
  const tag = ['A', 'S'].includes(p.key) ? ` (광역 배율 ${a})` : '';
  console.log(`| ${p.name}${tag} | ${res.map(r => pct(r.rate)).join(' | ')} | ${res[0].counters.toFixed(1)} | ${res[0].blocked.toFixed(2)} |`);
}

// ── 반사 열쇠 ──────────────────────────────────────────────
// 반사 = 아군이 받은 피해의 30%를 때린 분열체에게 되돌림. 남은 3마리가 고르게 아군을 때린다고 보면 반사 피해도 3마리에 고르게 감
// D = 그 1턴 동안 분열체들이 아군에게 넣는 피해 합 (스킬 1방 단위 — 모름 → 여러 값). 쓰러질수록 강해지므로 D는 뒤로 갈수록 큼
// 열쇠 파티: 몽실벌(스킬: 단일 5회 = 1, 아군 전체 2턴 [피해 반사 30%]) + 단일 4, 반사는 그 1턴 내내 켜져 있다고 봄(낙관)
// 비교: 같은 D에서 일반 파티(단일 5명)
function trialReflect(k, D, reflect, rnd) {
  let pool = 0;
  const hp = [k, k, k];
  for (let i = 0; i < 5; i++) { pool += BASIC; if (rnd() < P_SKILL) pool += 1; }
  if (reflect) for (let i = 0; i < 3; i++) hp[i] -= 0.3 * D / 3;
  return hp.reduce((s, h) => s + Math.max(0, h), 0) <= pool + 1e-9;
}
const DS = [0, 2, 4, 6, 8, 10, 12];
console.log('\n반사 열쇠 — 1턴 안에 남은 3마리를 다 잡을 확률 (D = 그 1턴에 분열체들이 아군에게 넣는 피해, 스킬 1방 단위)');
console.log(`| 분열체 체력 | 파티 | ${DS.map(d => `D=${d}`).join(' | ')} |`);
console.log(`|---|---|${DS.map(() => '--:').join('|')}|`);
for (const k of [2, 2.5, 3]) for (const reflect of [false, true]) {
  const rnd = mulberry32(777);
  const cells = DS.map(D => { let ok = 0; for (let n = 0; n < N; n++) ok += trialReflect(k, D, reflect, rnd); return pct(ok / N); });
  console.log(`| k=${k} | ${reflect ? '열쇠: 몽실벌 반사 30% + 단일 4' : '일반 파티 (단일 5)'} | ${cells.join(' | ')} |`);
}
