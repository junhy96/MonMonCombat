// 버프 목록 — 게임 버프 설명 캡처(data/buffs/source/1~4.png)에서 아이콘을 잘라 내고, 약/강을 나눈 버프 테이블을 만든다.
// 실행: node tools/buff-icons.mjs
// 출력: data/buffs/icons/<ID>.png, data/buffs/buffs.csv(엑셀용 BOM), data/buffs/buffs.json, data/buffs/README.md(아이콘이 보이는 표)
//
// 아이콘 찾기: 캡처 왼쪽 160px에서 밝은 파랑(아이콘 바탕) 덩어리를 찾아, 같은 줄(y 20px 안)끼리 묶고 x 순서로 → 왼쪽 = 약, 오른쪽 = 강.
//             한 아이콘이 둘로 갈라져 잡히면(그림 때문에 파랑이 끊김) x가 겹치는 것끼리 합친다. 검은 테두리까지 4px 여유.
// 버프 설명·수치는 캡처 문구를 그대로 옮겼다. "엔진" 열은 src/combat/engine.js에 지금 있는지(있음/부분/없음)이며 게임 규칙 추측이 아니다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodePNG, encodePNG, crop } from '../src/lib/png.js';

const DIR = 'data/buffs';
// 캡처별 줄 순서대로. values: [약, 강] 또는 [값] / [] (단계 없음)
const BUFFS = [
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
  { img: 3, key: 'REGEN', name: '지속 치유', values: [7.5, 15], unit: '%', desc: '매 턴 최대 체력의 {v}%만큼 치유됩니다. (여러 개 부여 가능)', engine: '없음', note: '1턴 = 몬몬이 스킬을 한 번 쓸 때, 지속은 효과를 받은 몬몬의 턴으로 셈 (게임에서 확인) · 치유가 나가는 시점도 받은 몬몬의 턴인지 미확인 · 중첩 가능' },
  { img: 4, key: 'SHIELD', name: '보호막', values: [], unit: '', desc: '피해를 일정량 막아 주는 보호막을 생성합니다.', engine: '있음', note: '양은 스킬마다 — 무엇에 비례하는지 미확인 (엔진은 시전자 공격력 %)' },
  { img: 4, key: 'EVADE', name: '회피', values: [15], unit: '%', desc: '{v}% 확률로 상대 공격을 피합니다.', engine: '부분', note: '엔진은 명중−회피 스탯 공식 — 고정 15% 회피 확률은 없음' },
  { img: 4, key: 'BLOCK', name: '피해 차단', values: [], unit: '', desc: '피해를 입지 않습니다.', engine: '없음', note: '무적' },
  { img: 4, key: 'UNDYING', name: '불사', values: [], unit: '', desc: '지속되는 동안, 체력이 0이 될 만큼 큰 피해를 받아도 체력이 1 밑으로 내려가지 않습니다.', engine: '없음', note: '' },
  { img: 4, key: 'GUARD', name: '아군 보호', values: [25, 50], unit: '%', desc: '이 효과를 받은 아군이 받는 피해의 {v}%를, 효과를 건 아군이 대신 받습니다.', engine: '없음', note: '피해 나눠 받기 (건 쪽이 쓰러지면?) 미확인' },
  { img: 4, key: 'DEBUFF_IMMUNE', name: '디버프 차단', values: [], unit: '', desc: '새로 걸리는 디버프를 모두 막습니다.', engine: '없음', note: '이미 걸린 디버프는 남는 것으로 읽힘' },
];

/** 캡처 → 줄별 아이콘 상자 [[{x,y,w,h}…]…] (위 → 아래, 줄 안은 왼 → 오) */
function findIcons(img) {
  const { width: W, height: H, data } = img, X = Math.min(W, 160);
  const blue = (p) => { const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2]; return b > 200 && r < 90 && g > 100 && g < 200; };
  const seen = new Uint8Array(W * H), comps = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < X; x++) {
    const p = y * W + x;
    if (seen[p] || !blue(p)) continue;
    const st = [p]; seen[p] = 1;
    let x0 = x, x1 = x, y0 = y, y1 = y, n = 0;
    while (st.length) {
      const q = st.pop(), qx = q % W, qy = (q - qx) / W; n++;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= X || ny >= H) continue;
        const r = ny * W + nx;
        if (!seen[r] && blue(r)) { seen[r] = 1; st.push(r); }
      }
    }
    if (n > 150) comps.push({ x0, x1, y0, y1 });
  }
  // 갈라진 아이콘 합치기: x 범위가 겹치고 y가 붙어 있으면 하나
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

mkdirSync(`${DIR}/icons`, { recursive: true });
const rowsOut = [];
for (const n of [1, 2, 3, 4]) {
  const img = decodePNG(readFileSync(`${DIR}/source/${n}.png`));
  const rows = findIcons(img), list = BUFFS.filter(b => b.img === n);
  if (rows.length !== list.length) throw new Error(`캡처 ${n}: 아이콘 줄 ${rows.length}개, 버프 ${list.length}개 — 맞지 않음`);
  list.forEach((b, i) => {
    const levels = b.values.length === 2 ? [['약', b.values[0]], ['강', b.values[1]]] : [['', b.values[0]]];
    if (rows[i].length !== levels.length) throw new Error(`${b.name}: 아이콘 ${rows[i].length}개, 단계 ${levels.length}개`);
    levels.forEach(([lv, v], k) => {
      const id = `BF_${b.key}${lv ? (lv === '약' ? '_1' : '_2') : ''}`;
      const box = rows[i][k];
      writeFileSync(`${DIR}/icons/${id}.png`, encodePNG(crop(img, box.x, box.y, box.w, box.h)));
      rowsOut.push({
        id, name: lv ? `${b.name} (${lv})` : b.name, buff: b.name, level: lv || '단일', value: v ?? '', unit: v != null ? b.unit : '',
        desc: v != null ? b.desc.replace('{v}', v) : b.desc, engine: b.engine, note: b.note, icon: `icons/${id}.png`,
        source: `source/${n}.png @ ${box.x},${box.y} ${box.w}×${box.h}`,
      });
    });
  });
}

const COLS = [['id', 'ID'], ['name', '이름'], ['buff', '버프'], ['level', '단계'], ['value', '수치'], ['unit', '단위'], ['desc', '효과 설명'], ['engine', '엔진'], ['note', '메모'], ['icon', '아이콘'], ['source', '아이콘 출처']];
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
writeFileSync(`${DIR}/buffs.csv`, '﻿' + [COLS.map(c => c[1]), ...rowsOut.map(r => COLS.map(c => r[c[0]]))].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
writeFileSync(`${DIR}/buffs.json`, JSON.stringify(rowsOut, null, 2) + '\n');

const md = (s) => String(s ?? '').replace(/\|/g, '\\|');
const doc = [
  '# 버프 목록',
  '',
  '게임 버프 설명 캡처(`source/`)를 옮긴 표입니다. 수치가 두 개인 버프는 낮은 값 = **약**, 높은 값 = **강**으로 나눴습니다. 스킬·패시브 데이터는 이 ID를 기준으로 효과를 적습니다.',
  '',
  '- 다시 만들기: `node tools/buff-icons.mjs` (아이콘 자르기 + `buffs.csv`·`buffs.json`·이 문서)',
  '- **엔진** 열: 지금 `src/combat/engine.js`에 있는지 — 있음 / 부분 / 없음. 게임 규칙을 추측한 값이 아닙니다.',
  '- **턴**: 1턴 = 몬몬이 스킬을 한 번 쓸 때. 지속 시간은 효과를 받은 몬몬의 턴으로, 대기시간은 효과를 쓴 몬몬의 턴으로 셉니다. 지속은 턴으로 표시됩니다 (게임에서 확인).',
  '- **치명확률·치명피해**: 합연산으로 적용합니다 (다른 게임의 일반적인 방식 기준, 게임에서 확인 전).',
  '',
  '| 아이콘 | ID | 이름 | 수치 | 효과 설명 | 엔진 | 메모 |',
  '|:-:|---|---|--:|---|:-:|---|',
  ...rowsOut.map(r => `| ![](${r.icon}) | \`${r.id}\` | ${md(r.name)} | ${r.value !== '' ? `${r.value}${r.unit}` : '—'} | ${md(r.desc)} | ${r.engine} | ${md(r.note)} |`),
  '',
  '## 확인이 필요한 점',
  '',
  ...BUFFS.filter(b => /미확인|확인 전/.test(b.note)).map(b => `- **${b.name}**: ${b.note}`),
  '',
];
writeFileSync(`${DIR}/README.md`, doc.join('\n'));
console.log(`버프 ${BUFFS.length}종 → ${rowsOut.length}행, 아이콘 ${rowsOut.length}개`);
