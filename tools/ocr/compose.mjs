// 몬몬 한 마리 캡처 5장(상세 + 스킬 팝업 4개)을 읽기 좋은 한 장으로 합치고, 메인 이미지를 잘라 낸다.
// 실행: node tools/ocr/compose.mjs [raw 폴더] [출력 폴더]   (기본: data/monmon/raw → data/monmon)
//  - sheets/<번호>.png : 위 = 이름·등급·역할·속성 + 메인 이미지, 가운데 = 스탯 8개, 아래 = 팝업 4개 (팝업은 흰 판을 찾아 그 영역만)
//  - art/<번호>.png    : 메인 이미지 (배경 포함 정사각형)
// 좌표는 창 854×1440 캡처 기준.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { decodePNG, encodePNG, crop } from '../../src/lib/png.js';

const RAW = process.argv[2] || 'data/monmon/raw', OUT = process.argv[3] || 'data/monmon';
const HEADER = { x: 88, y: 118, w: 230, h: 380 };   // 등급·이름·별·레벨 + 역할·거리·속성·상성 아이콘 줄
const NAME = { x: 88, y: 118, w: 600, h: 130 };      // 등급·이름·별·레벨 (넓게)
const ART = { x: 280, y: 300, w: 400, h: 400 };      // 메인 이미지
const STATS = { x: 130, y: 885, w: 660, h: 170 };    // 스탯 8칸
const PANEL_X0 = 150, PANEL_X1 = 770;                // 팝업 좌우 범위

/** 팝업 흰 판의 세로 범위: 밝은 픽셀이 줄의 60% 넘는 줄들 (아이콘 줄 위쪽만) */
function panelRows(img) {
  const { width: W, data } = img;
  const light = [];
  for (let y = 60; y < 770; y++) {
    let n = 0, tot = 0;
    for (let x = PANEL_X0 + 20; x < PANEL_X1 - 20; x += 3) { const i = (y * W + x) * 4; tot++; if (data[i] > 215 && data[i + 1] > 215 && data[i + 2] > 215) n++; }
    light.push(n / tot > 0.6);
  }
  let top = -1, bot = -1;
  for (let i = 0; i < light.length; i++) if (light[i]) { if (top < 0) top = i; bot = i; }
  return top < 0 ? null : { y0: 60 + top - 6, y1: 60 + bot + 6 };
}

function blank(w, h) { const d = new Uint8Array(w * h * 4); for (let i = 0; i < d.length; i += 4) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255; } return { width: w, height: h, data: d }; }
function paste(dst, src, ox, oy) { for (let y = 0; y < src.height; y++) dst.data.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), ((oy + y) * dst.width + ox) * 4); }

mkdirSync(`${OUT}/sheets`, { recursive: true });
mkdirSync(`${OUT}/art`, { recursive: true });
const ids = [...new Set(readdirSync(RAW).filter(f => /^\d{3}-0\.png$/.test(f)).map(f => f.slice(0, 3)))].sort();
const report = [];
for (const id of ids) {
  const det = decodePNG(readFileSync(`${RAW}/${id}-0.png`));
  writeFileSync(`${OUT}/art/${id}.png`, encodePNG(crop(det, ART.x, ART.y, ART.w, ART.h)));
  const parts = [crop(det, NAME.x, NAME.y, NAME.w, NAME.h), crop(det, HEADER.x, HEADER.y + NAME.h, HEADER.w, HEADER.h - NAME.h), crop(det, STATS.x, STATS.y, STATS.w, STATS.h)];
  const miss = [];
  let j = 0;   // 스킬 순번 (고급·일반은 팝업이 2·3번 파일에 있다)
  for (let k = 1; k <= 4; k++) {
    const f = `${RAW}/${id}-${k}.png`;
    if (!existsSync(f)) { miss.push(k); continue; }
    const p = decodePNG(readFileSync(f)), r = panelRows(p);
    if (!r) { miss.push(k); continue; }
    parts.push(crop(p, PANEL_X0, r.y0, PANEL_X1 - PANEL_X0, r.y1 - r.y0));
    j++;
    // 스크롤해서 다시 찍은 아래쪽 (scrollshots.ps1): <번호>-<스킬 순번>-s1.png, s2 …  바로 아래에 이어 붙인다
    for (let s = 1; existsSync(`${RAW}/${id}-${j}-s${s}.png`); s++) {
      const q = decodePNG(readFileSync(`${RAW}/${id}-${j}-s${s}.png`)), rq = panelRows(q);
      if (rq) parts.push(crop(q, PANEL_X0, rq.y0, PANEL_X1 - PANEL_X0, rq.y1 - rq.y0));
    }
  }
  const W = Math.max(...parts.map(p => p.width)), gap = 8;
  const H = parts.reduce((a, p) => a + p.height + gap, 0);
  const sheet = blank(W, H);
  let y = 0;
  for (const p of parts) { paste(sheet, p, 0, y); y += p.height + gap; }
  writeFileSync(`${OUT}/sheets/${id}.png`, encodePNG(sheet));
  report.push(`${id}${miss.length ? ` 팝업 없음: ${miss.join(',')}` : ''}`);
}
console.log(`${ids.length}개 → ${OUT}/sheets, ${OUT}/art`);
const bad = report.filter(r => r.includes('없음'));
if (bad.length) console.log(bad.join('\n'));
