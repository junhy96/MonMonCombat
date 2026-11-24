// 효과 목록(버프·디버프) — 게임 효과 설명 캡처(data/effects/source/)에서 아이콘을 잘라 내고, 약/강을 나눈 효과 테이블을 만든다.
// 실행: node tools/effect-icons.mjs
// 출력: data/effects/icons/<ID>.png, effects.csv(엑셀용 BOM), effects.json, README.md(아이콘이 보이는 표)
//
// 아이콘 찾기: 캡처 왼쪽 160px에서 아이콘 바탕색(버프 = 밝은 파랑, 디버프 = 빨강) 덩어리를 찾아, 같은 줄(y 20px 안)끼리 묶고
//             x 순서로 → 왼쪽 = 약, 오른쪽 = 강. 한 아이콘이 둘로 갈라져 잡히면 x가 겹치는 것끼리 합친다. 검은 테두리까지 4px 여유.
//             줄 수·아이콘 수가 목록과 하나라도 다르면 멈춘다.
// 설명·수치는 캡처 문구를 그대로 옮겼다. "엔진" 열은 src/combat/engine.js에 지금 있는지(있음/부분/없음)이며 게임 규칙 추측이 아니다.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { decodePNG, encodePNG, crop } from '../src/lib/png.js';

const DIR = 'data/effects';
const COLOR = {
  blue: (r, g, b) => b > 200 && r < 90 && g > 100 && g < 200,
  red: (r, g, b) => r > 190 && g < 90 && b < 100,
};
const GROUPS = [
  { kind: '버프', prefix: 'BF_', color: 'blue', source: 'buff' },
  { kind: '디버프', prefix: 'DB_', color: 'red', source: 'debuff' },
];

// 캡처별 줄 순서대로. img = source/<그룹>-<img>.png, values: [약, 강] 또는 [값] / [] (단계 없음)
const LIST = {
  버프: [
    { img: 1, key: 'REFLECT', name: '피해 반사', values: [15, 30], unit: '%', desc: '받은 피해의 {v}%를 공격자에게 되돌려 줍니다.', engine: '없음', note: '' },
    { img: 1, key: 'STEALTH', name: '은신', values: [5, 10], unit: '%', desc: '적의 단일 대상 공격을 받지 않고, 광역 공격으로 받는 피해가 {v}% 줄어듭니다. 혼자 남으면 공격 대상이 됩니다.', engine: '없음', note: '타겟팅 제외 + 광역 피해 감소' },
    { img: 1, key: 'REVIVE', name: '부활', values: [30], unit: '%', desc: '전투에서 이탈하면 최대 체력의 {v}%로 다시 전투에 참여합니다.', engine: '부분', note: '엔진의 부활은 쓰러진 아군을 살리는 스킬 — 미리 걸어 두는 자기 부활 버프는 없음' },
    { img: 2, key: 'ATK_UP', name: '공격력 증가', values: [25, 50], unit: '%', desc: '공격력이 {v}% 올라갑니다.', engine: '있음', note: '버프 · 공격력 · 곱(%)' },
    { img: 2, key: 'DEF_UP', name: '방어력 증가', values: [30, 60], unit: '%', desc: '방어력이 {v}% 올라갑니다.', engine: '있음', note: '버프 · 방어력 · 곱(%)' },
    { img: 2, key: 'SPD_UP', name: '속도 증가', values: [15, 30], unit: '%', desc: '속도가 {v}% 올라가 스킬 에너지가 더 빨리 차고 기본공격도 빨라집니다.', engine: '있음', note: '버프 · 속도 · 곱(%) — 게이지·평타 둘 다 빨라짐(엔진과 같음)' },
    { img: 2, key: 'CRIT_RATE_UP', name: '치명확률 증가', values: [15, 30], unit: '%', desc: '치명확률이 {v}% 올라가 치명타가 더 자주 터집니다.', engine: '있음', note: '합연산으로 적용: 치명 확률 +15%p (다른 게임 관례 기준, 게임에서 확인 전)' },
    { img: 2, key: 'CRIT_DMG_UP', name: '치명피해 증가', values: [15, 30], unit: '%', desc: '치명피해가 {v}% 올라가 치명타 피해가 더 커집니다.', engine: '있음', note: '합연산으로 적용: 치명 배율 +0.15 (150% → 165%, 다른 게임 관례 기준, 게임에서 확인 전)' },
    { img: 3, key: 'RES_UP', name: '효과저항 증가', values: [25, 50], unit: '%', desc: '효과저항이 {v}% 올라가 디버프에 잘 걸리지 않습니다.', engine: '없음', note: '엔진에 효과저항·효과명중 스탯 없음 (효과는 발동 확률만)' },
    { img: 3, key: 'EFF_ACC_UP', name: '효과명중 증가', values: [25, 50], unit: '%', desc: '효과명중이 {v}% 올라가 적에게 디버프를 더 잘 겁니다.', engine: '없음', note: '효과저항과 함께 들어가야 함' },
    { img: 3, key: 'DMG_TAKEN_DOWN', name: '받는 피해량 감소', values: [15, 25], unit: '%', desc: '받는 피해량이 {v}% 줄어듭니다.', engine: '있음', note: '버프 · 받는 피해' },
    { img: 3, key: 'HEAL_UP', name: '치유량 증가', values: [50, 100], unit: '%', desc: '받는 치유량이 {v}% 늘어납니다.', engine: '없음', note: '받는 회복 배율' },
    { img: 3, key: 'REGEN', name: '지속 치유', values: [7.5, 15], unit: '%', desc: '매 턴 최대 체력의 {v}%만큼 치유됩니다. (여러 개 부여 가능)', engine: '없음', note: '받은 몬몬의 턴마다 (게임 확인) · 중첩 가능' },
    { img: 4, key: 'SHIELD', name: '보호막', values: [], unit: '', desc: '피해를 일정량 막아 주는 보호막을 생성합니다.', engine: '있음', note: '양은 스킬마다 — 무엇에 비례하는지 미확인 (엔진은 시전자 공격력 %)' },
    { img: 4, key: 'EVADE', name: '회피', values: [15], unit: '%', desc: '{v}% 확률로 상대 공격을 피합니다.', engine: '부분', note: '엔진은 명중−회피 스탯 공식 — 고정 15% 회피 확률은 없음' },
    { img: 4, key: 'BLOCK', name: '피해 차단', values: [], unit: '', desc: '피해를 입지 않습니다.', engine: '없음', note: '무적' },
    { img: 4, key: 'UNDYING', name: '불사', values: [], unit: '', desc: '지속되는 동안, 체력이 0이 될 만큼 큰 피해를 받아도 체력이 1 밑으로 내려가지 않습니다.', engine: '없음', note: '' },
    { img: 4, key: 'GUARD', name: '아군 보호', values: [25, 50], unit: '%', desc: '이 효과를 받은 아군이 받는 피해의 {v}%를, 효과를 건 아군이 대신 받습니다.', engine: '없음', note: '피해 나눠 받기 (건 쪽이 쓰러지면?) 미확인' },
    { img: 4, key: 'DEBUFF_IMMUNE', name: '디버프 차단', values: [], unit: '', desc: '새로 걸리는 디버프를 모두 막습니다.', engine: '없음', note: '이미 걸린 디버프는 남는 것으로 읽힘' },
  ],
  디버프: [
    { img: 1, key: 'ATK_DOWN', name: '공격력 감소', values: [25, 50], unit: '%', desc: '공격력이 {v}% 내려갑니다.', engine: '있음', note: '디버프 · 공격력 · 곱(%)' },
    { img: 1, key: 'DEF_DOWN', name: '방어력 감소', values: [30, 60], unit: '%', desc: '방어력이 {v}% 내려갑니다.', engine: '있음', note: '디버프 · 방어력 · 곱(%)' },
    { img: 1, key: 'SPD_DOWN', name: '속도 감소', values: [15, 30], unit: '%', desc: '속도가 {v}% 내려가 스킬 에너지가 더 느리게 차고 기본공격도 느려집니다.', engine: '있음', note: '디버프 · 속도 · 곱(%) — 게이지·평타 둘 다 느려짐' },
    { img: 1, key: 'CRIT_RATE_DOWN', name: '치명확률 감소', values: [15, 30], unit: '%', desc: '치명확률이 {v}% 내려가 치명타가 덜 터집니다.', engine: '있음', note: '합연산으로 적용: 치명 확률 −15%p (증가와 같은 기준, 게임에서 확인 전)' },
    { img: 1, key: 'CRIT_DMG_DOWN', name: '치명피해 감소', values: [15, 25], unit: '%', desc: '치명피해가 {v}% 내려가 치명타 피해가 작아집니다.', engine: '있음', note: '합연산으로 적용: 치명 배율 −0.15 (증가와 같은 기준, 게임에서 확인 전) · 강이 25% (증가는 30%)' },
    { img: 2, key: 'RES_DOWN', name: '효과저항 감소', values: [25, 50], unit: '%', desc: '효과저항이 {v}% 내려가 디버프에 잘 걸립니다.', engine: '없음', note: '엔진에 효과저항·효과명중 스탯 없음' },
    { img: 2, key: 'EFF_ACC_DOWN', name: '효과명중 감소', values: [25, 50], unit: '%', desc: '효과명중이 {v}% 내려가 적에게 디버프를 잘 걸지 못합니다.', engine: '없음', note: '' },
    { img: 2, key: 'DMG_TAKEN_UP', name: '받는 피해량 증가', values: [15, 25], unit: '%', desc: '받는 피해량이 {v}% 늘어납니다.', engine: '있음', note: '디버프 · 받는 피해' },
    { img: 2, key: 'HEAL_DOWN', name: '치유량 감소', values: [50, 100], unit: '%', desc: '받는 치유량이 {v}% 줄어듭니다.', engine: '없음', note: '강(100%)이면 회복을 전혀 못 받음' },
    { img: 2, key: 'POISON', name: '독', values: [2.5, 5], unit: '%', desc: '매 턴 최대 체력의 {v}%만큼 피해를 입습니다. (여러 개 부여 가능)', engine: '부분', note: '엔진의 지속 피해는 건 쪽 공격력 % — 받는 쪽 최대 체력 %로 바꿔야 함 · 받은 몬몬의 턴마다 · 중첩 가능' },
    { img: 2, key: 'BUFF_BLOCK', name: '버프 차단', values: [], unit: '', desc: '새로 걸리는 버프를 모두 막습니다.', engine: '없음', note: '' },
    { img: 3, key: 'SHIELD_BLOCK', name: '보호막 버프 차단', values: [], unit: '', desc: '새로 걸리는 보호막 버프를 막습니다.', engine: '없음', note: '' },
    { img: 3, key: 'UNDYING_BLOCK', name: '불사 버프 차단', values: [], unit: '', desc: '새로 걸리는 불사 버프를 막습니다.', engine: '없음', note: '' },
    { img: 3, key: 'REVIVE_BLOCK', name: '부활 차단', values: [], unit: '', desc: '부활 효과를 막고, 이 전투에서는 다시 부활할 수 없습니다.', engine: '없음', note: '' },
    { img: 3, key: 'TAUNT', name: '도발', values: [15], unit: '%', desc: '도발한 몬몬만 공격하게 됩니다. (기본공격, 적 1명 대상 스킬) 이 공격의 피해는 {v}% 감소합니다.', engine: '부분', note: '엔진의 도발은 거는 쪽의 상태 + "도발 우선" 타겟팅일 때만 — 걸린 적이 도발한 몬몬만 노리는 디버프와 피해 15% 감소는 없음' },
    { img: 3, key: 'SILENCE', name: '침묵', values: [], unit: '', desc: '스킬을 사용할 수 없습니다.', engine: '없음', note: '침묵 중 게이지가 차면 어떻게 되는지 미확인 (기절처럼 턴 소모?)' },
    { img: 3, key: 'BLIND', name: '실명', values: [], unit: '', desc: '모든 공격이 빗나갑니다.', engine: '없음', note: '스킬 피해도 빗나가는지, 스킬의 버프·디버프는 걸리는지 미확인' },
    { img: 4, key: 'STUN', name: '기절', values: [], unit: '', desc: '아무 행동도 할 수 없습니다.', engine: '있음', note: '게이지가 차면 스킬 없이 턴 소모 (게임 확인)' },
    { img: 4, key: 'BURN', name: '화상', values: [3], unit: '%', desc: '매 턴, 화상에 걸린 대상과 같은 편 전원이 각자 최대 체력의 {v}%만큼 피해를 입습니다.', engine: '없음', note: '"매 턴"이 화상에 걸린 몬몬의 턴인지 미확인 · 같은 편 전원에게 퍼지는 피해' },
    { img: 4, key: 'BIND', name: '속박', values: [], unit: '', desc: '움직일 수 없습니다.', engine: '없음', note: '자동 전투에서 "움직일 수 없음"이 무엇을 막는지 미확인 (평타? 기절과 차이?)' },
  ],
};

/** 캡처 → 줄별 아이콘 상자 [[{x,y,w,h}…]…] (위 → 아래, 줄 안은 왼 → 오) */
function findIcons(img, isIcon) {
  const { width: W, height: H, data } = img, X = Math.min(W, 160);
  const hit = (p) => isIcon(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
  const seen = new Uint8Array(W * H), comps = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < X; x++) {
    const p = y * W + x;
    if (seen[p] || !hit(p)) continue;
    const st = [p]; seen[p] = 1;
    let x0 = x, x1 = x, y0 = y, y1 = y, n = 0;
    while (st.length) {
      const q = st.pop(), qx = q % W, qy = (q - qx) / W; n++;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= X || ny >= H) continue;
        const r = ny * W + nx;
        if (!seen[r] && hit(r)) { seen[r] = 1; st.push(r); }
      }
    }
    if (n > 150) comps.push({ x0, x1, y0, y1 });
  }
  const merged = [];
  for (const c of comps) {
    const m = merged.find(o => c.x0 <= o.x1 && o.x0 <= c.x1 && c.y0 <= o.y1 + 8 && o.y0 <= c.y1 + 8);
    if (m) { m.x0 = Math.min(m.x0, c.x0); m.x1 = Math.max(m.x1, c.x1); m.y0 = Math.min(m.y0, c.y0); m.y1 = Math.max(m.y1, c.y1); } else merged.push({ ...c });
  }
  // 아이콘 크기(약 37×35)보다 작은 조각은 캡처 끝에서 잘린 것 → 버림
  const boxes = merged.filter(b => b.y1 - b.y0 >= 28 && b.x1 - b.x0 >= 28).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const rows = [];
  for (const b of boxes) { const r = rows.find(rr => Math.abs(rr[0].y0 - b.y0) < 20); if (r) r.push(b); else rows.push([b]); }
  return rows.map(r => r.sort((a, b) => a.x0 - b.x0).map(b => ({ x: b.x0 - 4, y: b.y0 - 4, w: b.x1 - b.x0 + 9, h: b.y1 - b.y0 + 9 })));
}

rmSync(`${DIR}/icons`, { recursive: true, force: true });
mkdirSync(`${DIR}/icons`, { recursive: true });
const out = [];
for (const g of GROUPS) {
  const list = LIST[g.kind];
  for (const n of [...new Set(list.map(b => b.img))]) {
    const file = `source/${g.source}-${n}.png`;
    const img = decodePNG(readFileSync(`${DIR}/${file}`));
    const rows = findIcons(img, COLOR[g.color]), part = list.filter(b => b.img === n);
    if (rows.length !== part.length) throw new Error(`${file}: 아이콘 줄 ${rows.length}개, ${g.kind} ${part.length}개 — 맞지 않음`);
    part.forEach((b, i) => {
      const levels = b.values.length === 2 ? [['약', b.values[0]], ['강', b.values[1]]] : [['', b.values[0]]];
      if (rows[i].length !== levels.length) throw new Error(`${b.name}: 아이콘 ${rows[i].length}개, 단계 ${levels.length}개`);
      levels.forEach(([lv, v], k) => {
        const id = `${g.prefix}${b.key}${lv ? (lv === '약' ? '_1' : '_2') : ''}`;
        const box = rows[i][k];
        writeFileSync(`${DIR}/icons/${id}.png`, encodePNG(crop(img, box.x, box.y, box.w, box.h)));
        out.push({
          id, kind: g.kind, name: lv ? `${b.name} (${lv})` : b.name, effect: b.name, level: lv || '단일', value: v ?? '', unit: v != null ? b.unit : '',
          desc: v != null ? b.desc.replace('{v}', v) : b.desc, engine: b.engine, note: b.note, icon: `icons/${id}.png`,
          source: `${file} @ ${box.x},${box.y} ${box.w}×${box.h}`,
        });
      });
    });
  }
}

// 버프·디버프 목록 이미지에 없지만 몬몬 스킬 팝업 효과 칸에 나오는 효과 (아이콘은 따로 자르지 않음).
// 설명은 팝업 문장에서 옮김 — 개수·확률·양은 스킬마다 달라 수치를 두지 않는다.
const OTHERS = [
  { id: 'IN_BUFF_REMOVE', kind: '즉시', name: '버프 제거', desc: '대상의 [버프]를 제거한다. 개수·확률은 스킬마다 (예: 75% 확률로 1개, 2개).', engine: '없음', note: '예: 꼬뿔·뼈꼬미·라이젤 — 몬몬 7마리', ex: '꼬뿔 「전방 범위 내 적에게 75% 확률로 [버프] 1개를 제거한다.」' },
  { id: 'IN_BUFF_STEAL', kind: '즉시', name: '버프 훔치기', desc: '대상의 [버프]를 가져온다. 개수·확률은 스킬마다.', engine: '없음', note: '가져온 버프가 누구에게 몇 턴 붙는지 미확인 — 몬몬 5마리', ex: '소닉벗 「피해를 입은 적에게 각각 75% 확률로 [버프] 1개를 훔치고」' },
  { id: 'IN_DEBUFF_REMOVE', kind: '즉시', name: '디버프 제거', desc: '아군의 [디버프]를 제거한다. 대상·개수는 스킬마다.', engine: '없음', note: '몬몬 11마리', ex: '토실 「자신과 [디버프]를 보유한 무작위 아군 1명의 [디버프] 1개를 제거한다.」' },
  { id: 'IN_DEBUFF_MOVE', kind: '즉시', name: '디버프 이전', desc: '자신의 [디버프]를 적에게 옮긴다.', engine: '없음', note: '몬몬 1마리', ex: '뭉치뿔 「공격력이 가장 높은 적 1명에게 75% 확률로 자신의 모든 [디버프]를 이전한다.」' },
  { id: 'IN_HEAL', kind: '즉시', name: '치유', desc: '체력을 회복한다. 양은 스킬마다 (시전자 최대 체력의 %).', engine: '부분', note: '엔진 회복은 시전자 공격력 비례 — 최대 체력 비례는 없음 · 몬몬 15마리', ex: '아울링 「모든 아군을 자신 최대 체력의 10%만큼 치유한다.」' },
  { id: 'IN_ENERGY_UP', kind: '즉시', name: '스킬 에너지 증가', desc: '스킬 에너지(게이지)를 채운다. 양은 스킬마다 (%).', engine: '없음', note: '"%"가 게이지 최대치 기준인지 미확인 · 몬몬 7마리', ex: '뿔뎅이 「디버프 상태의 적 1명당 모든 아군의 스킬 에너지를 5%씩 증가시킨다.」' },
  { id: 'IN_ENERGY_DOWN', kind: '즉시', name: '스킬 에너지 감소', desc: '대상의 스킬 에너지(게이지)를 줄인다. 양은 스킬마다 (%).', engine: '없음', note: '"%"가 게이지 최대치 기준인지 미확인 · 몬몬 9마리', ex: '초롱이 「피해를 입은 적에게 스킬 에너지를 20% 감소시킨다.」' },
  { id: 'IN_BUFF_TIME_UP', kind: '즉시', name: '버프 지속시간 증가', desc: '대상의 모든 [버프]의 남은 턴을 늘린다.', engine: '없음', note: '몬몬 2마리', ex: '꽃핀부리 「모든 아군의 모든 [버프]의 남은 턴을 1턴 증가시킨다.」' },
  { id: 'IN_BUFF_TIME_DOWN', kind: '즉시', name: '버프 지속시간 감소', desc: '대상의 모든 [버프]의 남은 턴을 줄인다.', engine: '없음', note: '몬몬 1마리', ex: '뿌뿌 「피해를 입은 적에게 각각 모든 [버프]의 남은 턴을 1턴 감소시킨다.」' },
  { id: 'IN_DEBUFF_TIME_UP', kind: '즉시', name: '디버프 지속시간 증가', desc: '대상의 모든 [디버프]의 남은 턴을 늘린다.', engine: '없음', note: '몬몬 2마리', ex: '스멀이 「75% 확률로 모든 [디버프]의 남은 턴을 1턴 증가시킨다.」' },
  { id: 'IN_DEBUFF_TIME_DOWN', kind: '즉시', name: '디버프 지속시간 감소', desc: '대상의 모든 [디버프]의 남은 턴을 줄인다.', engine: '없음', note: '몬몬 1마리', ex: '당그미 「모든 아군의 모든 [디버프]의 남은 턴을 1턴 감소시킨다.」' },
  { id: 'BF_STEEL_STEALTH', kind: '버프 (목록 밖)', name: '강철 은신', desc: '스킬 팝업에 "[강철 은신] 버프를 부여한다"로 나오는 버프. 효과 내용은 버프 목록 이미지에 없음.', engine: '없음', note: '은신과 무엇이 다른지 미확인 · 몬몬 10마리', ex: '지직이 「모든 아군에게 각각 2턴 간 [강철 은신] 버프를 부여한다.」' },
];
for (const o of OTHERS) out.push({ id: o.id, kind: o.kind, name: o.name, effect: o.name, level: '단일', value: '', unit: '', desc: o.desc, engine: o.engine, note: `${o.note} · ${o.ex}`, icon: '', source: '몬몬 스킬 팝업 (아이콘 없음)' });

const COLS = [['id', 'ID'], ['kind', '구분'], ['name', '이름'], ['effect', '효과'], ['level', '단계'], ['value', '수치'], ['unit', '단위'], ['desc', '효과 설명'], ['engine', '엔진'], ['note', '메모'], ['icon', '아이콘'], ['source', '아이콘 출처']];
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
writeFileSync(`${DIR}/effects.csv`, '﻿' + [COLS.map(c => c[1]), ...out.map(r => COLS.map(c => r[c[0]]))].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
writeFileSync(`${DIR}/effects.json`, JSON.stringify(out, null, 2) + '\n');

const md = (s) => String(s ?? '').replace(/\|/g, '\\|');
const table = (kind) => [
  `## ${kind} (${new Set(out.filter(r => r.kind === kind).map(r => r.effect)).size}종 · ${out.filter(r => r.kind === kind).length}개)`,
  '',
  '| 아이콘 | ID | 이름 | 수치 | 효과 설명 | 엔진 | 메모 |',
  '|:-:|---|---|--:|---|:-:|---|',
  ...out.filter(r => r.kind === kind).map(r => `| ${r.icon ? `![](${r.icon})` : '—'} | \`${r.id}\` | ${md(r.name)} | ${r.value !== '' ? `${r.value}${r.unit}` : '—'} | ${md(r.desc)} | ${r.engine} | ${md(r.note)} |`),
  '',
];
const all = [...LIST.버프.map(b => ({ ...b, kind: '버프' })), ...LIST.디버프.map(b => ({ ...b, kind: '디버프' }))];
const doc = [
  '# 효과 목록 (버프 · 디버프 · 즉시 효과)',
  '',
  '게임 효과 설명 캡처(`source/`)를 옮긴 표입니다. 수치가 두 개인 효과는 낮은 값 = **약**, 높은 값 = **강**으로 나눴습니다. 스킬·패시브 데이터는 이 ID(이름)를 기준으로 효과를 적습니다.',
  '',
  '- 다시 만들기: `node tools/effect-icons.mjs` (아이콘 자르기 + `effects.csv`·`effects.json`·이 문서)',
  '- **엔진** 열: 지금 `src/combat/engine.js`에 있는지 — 있음 / 부분 / 없음. 게임 규칙을 추측한 값이 아닙니다.',
  '- **턴**: 1턴 = 몬몬이 스킬을 한 번 쓸 때. 지속 시간은 효과를 받은 몬몬의 턴으로, 대기시간은 효과를 쓴 몬몬의 턴으로 셉니다. 지속은 턴으로 표시됩니다 (게임에서 확인).',
  '- **즉시 효과**: 버프·디버프 목록 이미지에는 없고 몬몬 스킬 팝업 효과 칸에만 나오는 효과(버프 제거·버프 훔치기 등). 아이콘 없이 팝업 문장으로 설명을 적었고, 개수·확률·양은 스킬마다 다릅니다.',
  '- **치명확률·치명피해**: 증가·감소 모두 합연산으로 적용합니다 (다른 게임의 일반적인 방식 기준, 게임에서 확인 전).',
  '',
  ...table('버프'),
  ...table('디버프'),
  ...table('즉시'),
  ...table('버프 (목록 밖)'),
  '## 확인이 필요한 점',
  '',
  ...all.filter(b => /미확인|확인 전/.test(b.note)).map(b => `- **${b.name}** (${b.kind}): ${b.note}`),
  '',
];
writeFileSync(`${DIR}/README.md`, doc.join('\n'));
console.log(`버프 ${LIST.버프.length}종 · 디버프 ${LIST.디버프.length}종 · 즉시·기타 ${OTHERS.length}개 → ${out.length}행, 아이콘 ${out.filter(r => r.icon).length}개`);
