// 과제 초안 슬라이드 — 사용자 서식(서식_수정.pptx)의 양식을 따라 pptxgenjs 로 만듦
//   서식: 13.33×7.5in, 위쪽 보라 띠(615BAE, 번호 · 구분), 왼쪽 보라 막대 + 20pt 제목, 연회색(F8F8FB) 카드에 보라 머리말,
//         글꼴 "프리젠테이션 4 Regular / 5 Medium / 6 SemiBold / 7 Bold", 본문 2A2740, 보조 70707A
// 참고 기획서(마왕성 주식회사 v2)에서 가져온 구성: 아래 바닥줄(선 · 과제명 · 출처 · 쪽 번호), 「한 줄 결론」 상자, 흐름 상자 + 화살표,
//   큰 숫자 + 강조 막대 3칸(결과), 도넛 링(클리어율), 강조 카드 테두리 — 색은 서식의 보라 그대로
// 그래프 다듬기 (막대 굵기·간격, 누적 클리어 곡선 마크·색·선 옆 이름): 만든 뒤 python tools/deck-chart-style.py docs/deck/monmon-assignment-draft.pptx
// 데이터: docs/split-report/*.json, data/dungeons/split-boss/boss-stats.csv
// 실행: NODE_PATH=<pptxgenjs 설치 폴더>/node_modules DECK_IMG=<잘라 둔 이미지 폴더> node tools/build-deck.cjs
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const ROOT = path.resolve(__dirname, '..');
const IMG = process.env.DECK_IMG;
const OUT = path.join(ROOT, 'docs/deck/monmon-assignment-draft.pptx');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')).rows;

const F = { r: '프리젠테이션 4 Regular', m: '프리젠테이션 5 Medium', s: '프리젠테이션 6 SemiBold', b: '프리젠테이션 7 Bold' };
const C = { purple: '615BAE', deep: '3E3973', ink: '2A2740', sub: '70707A', mute: '888892', card: 'F8F8FB', line: 'DDDDE6', white: 'FFFFFF',
  blue: '5B7FB0', teal: '3E7E92', olive: '8A7A33', red: 'B5423A', green: '4A8556', gray: 'EFEFF2', lilac: 'E9E7F6', tint: 'F3F2FA', edge: 'D9D6F0', soft: 'B9B6CF', concl: 'E4E1F5' };

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = '전현영';
pres.title = '몬몬 마스터즈 레벨 디자인 과제 — 초안';
pres.theme = { headFontFace: F.b, bodyFontFace: F.r };

// ── 공통 틀 ────────────────────────────────────────────────
function header(slide, no, label) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.47, fill: { color: C.purple }, line: { color: C.purple, width: 0 } });
  slide.addShape(pres.shapes.LINE, { x: 0.54, y: 0, w: 0, h: 0.47, line: { color: 'A9A4DA', width: 0.75 } });
  slide.addText(no, { x: 0.62, y: 0.07, w: 0.45, h: 0.34, fontFace: F.b, fontSize: 16, color: C.white, margin: 0, isTextBox: true });
  slide.addText(label, { x: 1.11, y: 0.07, w: 6, h: 0.34, fontFace: F.m, fontSize: 14, color: C.white, margin: 0, isTextBox: true });
  // 바닥줄 (참고 기획서): 선 · 과제명 | 작성자 · 쪽 번호. 출처 · 각주는 note() 가 가운데 오른쪽에
  slide.addShape(pres.shapes.LINE, { x: 0.5, y: 6.82, w: 12.33, h: 0, line: { color: C.edge, width: 1 } });
  slide.addText('몬몬 마스터즈 레벨 디자인 과제  |  전현영', { x: 0.5, y: 6.9, w: 3.2, h: 0.25, fontFace: F.r, fontSize: 9, color: C.mute, margin: 0, isTextBox: true });
  slide.slideNumber = { x: 12.23, y: 6.9, w: 0.6, h: 0.25, fontFace: F.s, fontSize: 9, color: C.mute, align: 'right' };
}
function title(slide, t, lead) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.04, w: 0.07, h: 0.28, fill: { color: C.purple }, line: { color: C.purple, width: 0 } });
  slide.addText(t, { x: 0.75, y: 0.93, w: 12.1, h: 0.5, fontFace: F.b, fontSize: 20, color: C.ink, margin: 0, valign: 'middle', isTextBox: true });
  if (lead) slide.addText(lead, { x: 0.75, y: 1.45, w: 12.1, h: 0.42, fontFace: F.r, fontSize: 12, color: C.sub, margin: 0, valign: 'top', isTextBox: true });
}
function sub(slide, t, x, y, w = 6) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y: y + 0.03, w: 0.07, h: 0.22, fill: { color: C.purple }, line: { color: C.purple, width: 0 } });
  slide.addText(t, { x: x + 0.17, y, w, h: 0.28, fontFace: F.s, fontSize: 13, color: C.ink, margin: 0, valign: 'middle', isTextBox: true });
}
function card(slide, x, y, w, h, head, lines, opt = {}) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.34, fill: { color: opt.color || C.purple }, line: { color: opt.color || C.purple, width: 0 } });
  slide.addText(head, { x: x + 0.12, y, w: w - 0.24, h: 0.34, fontFace: F.s, fontSize: 12, color: C.white, margin: 0, valign: 'middle', isTextBox: true });
  slide.addText(lines.map((l, i) => ({ text: l, options: { breakLine: i < lines.length - 1 } })),
    { x: x + 0.14, y: y + 0.42, w: w - 0.28, h: h - 0.5, fontFace: F.r, fontSize: opt.size || 12, color: C.ink, margin: 0, valign: 'top', paraSpaceAfter: 4, isTextBox: true });
}
function chip(slide, x, y, w, text, color, txt = C.white) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.3, rectRadius: 0.06, fill: { color }, line: { color, width: 0 } });
  slide.addText(text, { x, y, w, h: 0.3, fontFace: F.m, fontSize: 10, color: txt, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}
function note(slide, t, y = 7.05) {
  if (y >= 6.7) {   // 바닥줄 안 (출처 · 가정 자리)
    slide.addText(t, { x: 3.8, y: 6.88, w: 8.3, h: 0.42, fontFace: F.r, fontSize: 8.5, color: C.mute, margin: 0, align: 'right', valign: 'top', isTextBox: true });
    return;
  }
  slide.addText(t, { x: 0.75, y, w: 12, h: 0.3, fontFace: F.r, fontSize: 9.5, color: C.mute, margin: 0, isTextBox: true });
}
// 「한 줄 결론」 상자 (참고 기획서) — h < 0.6 이면 라벨과 글을 한 줄로
function concl(slide, text, o = {}) {
  const x = o.x ?? 0.5, y = o.y ?? 5.95, w = o.w ?? 12.33, h = o.h ?? 0.75;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: C.concl }, line: { color: C.edge, width: 0.75 } });
  if (h < 0.6) {
    slide.addText('한 줄 결론', { x: x + 0.2, y, w: 1.2, h, fontFace: F.b, fontSize: 12, color: C.deep, valign: 'middle', margin: 0, isTextBox: true });
    slide.addText(text, { x: x + 1.45, y, w: w - 1.6, h, fontFace: F.m, fontSize: 11.5, color: C.ink, valign: 'middle', margin: 0, isTextBox: true });
  } else {
    slide.addText('한 줄 결론', { x: x + 0.2, y: y + 0.08, w: 2, h: 0.3, fontFace: F.b, fontSize: 12.5, color: C.deep, margin: 0, isTextBox: true });
    slide.addText(text, { x: x + 0.2, y: y + 0.38, w: w - 0.4, h: h - 0.44, fontFace: F.m, fontSize: 11.5, color: C.ink, valign: 'top', margin: 0, isTextBox: true });
  }
}
// 흐름 화살표 (참고 기획서: 상자 사이 작은 오른쪽 화살표)
function arrow(slide, x, y) {
  slide.addShape(pres.shapes.RIGHT_ARROW, { x, y, w: 0.16, h: 0.14, fill: { color: C.purple }, line: { color: C.purple, width: 0 } });
}
// 표: rows[0] = 머리글
function table(slide, rows, opt) {
  const data = rows.map((r, i) => r.map((c) => {
    const cell = typeof c === 'object' && c !== null && 'text' in c ? c : { text: String(c ?? '') };
    const base = i === 0
      ? { bold: false, fontFace: F.s, color: C.white, fill: { color: C.purple }, align: 'center' }
      : { fontFace: F.r, color: C.ink, fill: { color: i % 2 ? C.white : C.card } };
    return { text: cell.text, options: { ...base, ...(cell.options || {}) } };
  }));
  slide.addTable(data, { x: opt.x, y: opt.y, w: opt.w, colW: opt.colW, fontSize: opt.size || 11, valign: 'middle', margin: [3, 6, 3, 6],
    border: { type: 'solid', pt: 0.5, color: C.line }, rowH: opt.rowH, autoPage: false });
}
const ok = (t) => ({ text: t, options: { color: C.green, fontFace: F.b, align: 'center' } });
const ng = (t) => ({ text: t, options: { color: C.red, align: 'center' } });
const ctr = (t, extra = {}) => ({ text: t, options: { align: 'center', ...extra } });

// ── 데이터 ─────────────────────────────────────────────────
const bands = J('docs/split-report/bands.json');
const sync = J('docs/split-report/sync.json');
const band = (o, k) => bands.find((r) => r.order === o && r.key === k);
const syncv = (o, k) => sync.find((r) => r.order === o && r.key === k).clear;
const stages = fs.readFileSync(path.join(ROOT, 'data/dungeons/split-boss/boss-stats.csv'), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).map((l) => l.split(','));
const SH = stages[0]; const si = (n) => SH.indexOf(n);
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/split-report/vars.json'), 'utf8'));   // 변수 실험 · 타임라인 (tools/split-vars.mjs)
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// ── 1. 표지 ────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.deep };
  s.addImage({ path: path.join(IMG, 'banner.jpg'), x: 0, y: 0, w: 13.333, h: 7.44, sizing: { type: 'cover', w: 13.333, h: 7.5 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: '2B2050', transparency: 22 }, line: { color: '2B2050', width: 0 } });
  s.addShape(pres.shapes.LINE, { x: 0.52, y: 0.33, w: 12.08, h: 0, line: { color: C.white, width: 0.75 } });
  s.addShape(pres.shapes.LINE, { x: 0.52, y: 7.1, w: 12.08, h: 0, line: { color: C.white, width: 0.75 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 1.19, y: 1.58, w: 2.69, h: 0.4, fill: { color: C.white }, line: { color: C.white, width: 0 } });
  s.addText('몬몬 마스터즈', { x: 1.19, y: 1.58, w: 2.69, h: 0.4, fontFace: F.b, fontSize: 18, color: C.purple, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addText([{ text: '레벨 디자인 과제', options: { breakLine: true } }, { text: '열쇠가 열쇠가 되는 던전' }],
    { x: 1.19, y: 2.17, w: 8, h: 1.5, fontFace: F.b, fontSize: 40, color: C.white, margin: 0, valign: 'top', isTextBox: true });
  s.addText([{ text: '문항 1 · 초기 던전 열쇠 진단과 재설계 — 글라틀', options: { breakLine: true } }, { text: '문항 2 · 에픽 열쇠 던전 — 분열 보스 쿼디' }],
    { x: 1.19, y: 5.25, w: 8, h: 0.8, fontFace: F.m, fontSize: 18, color: C.white, margin: 0, isTextBox: true });
  s.addText('레벨 기획 | 전현영', { x: 10.2, y: 6.55, w: 2.4, h: 0.3, fontFace: F.m, fontSize: 14, color: C.white, align: 'right', margin: 0, isTextBox: true });
  s.addNotes('초안 — 보스 그림은 사용자 제작 이미지(쿼디 배너)');
}

// ── 2. 문서 설명 ───────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '01', '문서 설명');
  title(s, '문서 설명', '초기 던전에서 열쇠 몬몬이 열쇠 역할을 못 하는 이유를 데이터로 진단하고(문항 1), 에픽 몬몬이 열쇠가 되는 새 던전을 설계해 전투 시뮬레이션으로 확인했습니다(문항 2).');
  sub(s, '작업 범위 · 방법', 0.5, 2.15);
  const cards = [
    ['데이터 수집', ['· 도감 285마리 스킬·스탯 (화면 캡처 OCR)', '· 초기 던전 보스 9종 공략·스킬', '· 단계별 보스 스탯 · 전투 관측값']],
    ['분석', ['· 보스 9종 공통 성장 곡선', '· 열쇠 효과 보유 몬몬 등급 분포', '· 보스 한 주기 타수 · 시간 계산']],
    ['전투 시뮬레이션', ['· 0.1초 단위 전용 전투 계산', '· 설정·파티마다 1,000판', '· 기본 파티와 비교해 열쇠 효과만 분리']],
    ['산출물', ['· 결과 페이지 (표·그래프)', '· 보스 공략 창 UI 목업', '· 검산 엑셀 (수식 · DB)']],
  ];
  cards.forEach(([h, l], i) => card(s, 0.5 + i * 3.12, 2.6, 2.95, 1.55, h, l));
  sub(s, '진행 순서', 0.5, 4.5);
  const steps = [['관측', '게임 화면·전투에서 값 수집'], ['진단', '열쇠가 안 먹히는 지점 찾기'], ['설계', '보스 기믹·단계 수치'], ['검증', '열쇠 있음·없음 비교']];
  steps.forEach(([h, d], i) => {
    const x = 0.5 + i * 3.12;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.95, w: 2.95, h: 1.1, rectRadius: 0.08, fill: { color: i === 3 ? C.purple : C.tint }, line: { color: i === 3 ? C.purple : C.edge, width: 0.75 } });
    s.addText(`0${i + 1}  ${h}`, { x: x + 0.2, y: 5.05, w: 2.6, h: 0.4, fontFace: F.b, fontSize: 16, color: i === 3 ? C.white : C.purple, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.2, y: 5.5, w: 2.6, h: 0.4, fontFace: F.r, fontSize: 12, color: i === 3 ? C.white : C.ink, margin: 0, isTextBox: true });
    if (i < 3) arrow(s, x + 2.955, 5.43);
  });
  note(s, '모든 수치는 관측·사용자 결정·기획값·가정·방식으로 근거를 나눠 적었습니다 (부록 「시뮬레이션 기준」).', 6.4);
}

// ── 3. 초기 던전 9종 ───────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '02', '문항 1 · 진단');
  title(s, '초기 던전 9종 — 보스 기믹과 열쇠', '보스마다 하나의 기믹 축과 그것을 푸는 열쇠 효과가 있습니다. 열쇠를 가진 몬몬 수는 도감 285마리 기준 (전설 / 에픽 / 레어 / 고급 / 일반).');
  const rows = [
    ['보스 (던전)', '기믹 축', '보스가 거는 압박', '열쇠 효과', '보유 몬몬', '등급별'],
    ['울프릭 (화이트 크리스탈)', '아군 버프 유지', '버프 없는 몬몬에 [사냥 표식]', '버프 (종류 무관)', '77', '25 / 30 / 16 / 4 / 2'],
    ['카니보 (그린 크리스탈)', '보스 회복 끊기', '스킬 전마다 최대 체력 20~50% 회복', '치유량 감소 (7단계 강)', '12 (강 9)', '1 / 5 / 3 / 3 / 0'],
    ['파이렘 (레드 크리스탈)', '아군 디버프 정화', '[화상] → [온도] → 보스 가속', '디버프 제거', '11', '1 / 4 / 3 / 3 / 0'],
    ['마리엘 (블루 크리스탈)', '보스 버프 제거', '[보호막] + 받는 피해 −70%', '버프 제거·훔치기·차단', '25', '8 / 10 / 5 / 2 / 0'],
    ['볼트피온 (퍼플 크리스탈)', '보스 디버프 유지', '디버프 없으면 [충전] → 기절·방전', '디버프 (종류 무관)', '150', '38 / 51 / 31 / 18 / 12'],
    ['윈드윙 (바람의 협곡)', '짧은 창 딜 체크', '[폭풍 흡입] 1턴 안에 체력 15%', '독 · 받는 피해 증가 등', '29 (독)', '9 / 11 / 6 / 2 / 1'],
    ['데디베어 (언데드 고성)', '아군 구출', '공격력 1위를 [악몽]에 가둠', '치유 · 보호막 · 은신', '54 (치유)', '19 / 22 / 7 / 4 / 2'],
    [{ text: '글라틀 (얼음 요새)', options: { fontFace: F.b, color: C.purple } }, { text: '타수 (맞은 횟수)', options: { fontFace: F.b, color: C.purple } }, '[얼음 등껍질] 60~90번 맞아야 깨짐', { text: '다회 피해', options: { fontFace: F.b, color: C.purple } }, '38', '7 / 10 / 6 / 9 / 6'],
    ['고블렛 (고블린 영토)', '잡몹 정리', '[고블링] 쓰러질 때마다 보스 강화', '광역 피해', '132', '40 / 43 / 31 / 11 / 7'],
  ];
  rows[8] = rows[8].map((c) => (typeof c === 'string' ? { text: c, options: { fill: { color: C.lilac } } } : { ...c, options: { ...c.options, fill: { color: C.lilac } } }));
  table(s, rows, { x: 0.5, y: 2.05, w: 12.33, colW: [2.35, 1.75, 3.2, 2.2, 1.05, 1.78], size: 11, rowH: 0.42 });
  concl(s, '글라틀은 열쇠(다회) 몬몬이 고급 · 일반에도 15마리나 있는데, 열쇠가 성장과 이어지지 않는 보스 → 문항 1 대상', { y: 6.33, h: 0.42 });
}

// ── 4. 글라틀 구조 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '02', '문항 1 · 진단');
  title(s, '글라틀 — 열쇠가 성장과 따로 노는 보스', '등껍질이 있는 동안은 피해가 거의 안 들어가고, 정해진 횟수를 맞혀야 깨집니다. 깨면 [탈진] 동안만 체력을 깎을 수 있습니다.');
  s.addImage({ path: path.join(IMG, 'glattle-guide.png'), x: 0.5, y: 2.05, w: 3.6, h: 3.6 * 808 / 674 });
  const mech = [
    ['얼음 등껍질', '받는 피해 −80% · 해로운 효과 차단 · 보스 스킬마다 다시 두름 · 1~6단계 60번, 7단계부터 70~90번 맞아야 깨짐', C.teal],
    ['빙하 분출', '못 깬 채 보스 스킬이 나가면 남은 횟수 1개당 아군 최대 체력 0.5% 피해 + 최대 체력 감소, 보스 회복', C.red],
    ['탈진', '깨면 7~8초 동안 행동 불가 · 속도와 관계없이 스킬 에너지가 참 → 이 창에서만 체력이 깎임', C.green],
    ['빙하 각성', '자신의 디버프 전부 제거 + 속도 +15% → 다음 주기가 짧아짐', C.olive],
  ];
  mech.forEach(([h, d, col], i) => {
    const y = 2.05 + i * 0.92;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.4, y, w: 8.43, h: 0.82, rectRadius: 0.06, fill: { color: C.tint }, line: { color: C.edge, width: 0.75 } });
    chip(s, 4.55, y + 0.26, 1.35, h, col);
    s.addText(d, { x: 6.05, y: y + 0.06, w: 6.65, h: 0.7, fontFace: F.r, fontSize: 12, color: C.ink, margin: 0, valign: 'middle', isTextBox: true });
  });
  const stats = [['12초', '보스 게이지 — 이 안에 등껍질을 깨야 함'], ['60 → 90번', '7단계부터 깨야 하는 횟수'], ['38마리', '다회 피해 몬몬 (고급·일반 15)']];
  stats.forEach(([n, l], i) => {
    const x = 4.4 + i * 2.85;
    s.addText(n, { x, y: 5.85, w: 2.7, h: 0.5, fontFace: F.b, fontSize: 26, color: C.purple, margin: 0, isTextBox: true });
    s.addText(l, { x, y: 6.35, w: 2.7, h: 0.3, fontFace: F.r, fontSize: 11, color: C.sub, margin: 0, isTextBox: true });
  });
}

// ── 5. 한 주기 타수 ────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '02', '문항 1 · 진단');
  title(s, '한 주기 타수 — 7단계부터는 열쇠만으로 빠듯하고, 90번은 한 주기 안에 못 깬다', '보스 스킬 한 주기 동안 파티 5명이 등껍질을 때리는 횟수 (평타도 1번씩 셈). ✔ 깸 · △ 70번이면 깸, 90번이면 못 깸 · ✘ 못 깸. 레벨 · 별로 바뀌는 칸이 없습니다.');
  const rows = [
    ['단계 (보스 속도 · 깨야 하는 수)', '한 주기 (아군 평타)', '다회 없음', '5회 다회 3명', '5회 다회 5명', '10회 다회 2명', '10회 다회 4명', '10회 다회 5명'],
    // 2026-11-26 고침: 보스 게이지 12초는 10단계(속도 100) 관측 → 1~6단계 15초 · 11단계부터 9.6초 (속도 비례), ✔ 깸 · △ 70번만 · ✘ 못 깸
    ['1~6 (80 · 60번)', ctr('9.4 (15초)'), ng('52 ✘'), ok('63 ✔'), ok('70 ✔'), ok('68 ✔'), ok('85 ✔'), ok('94 ✔')],
    ['7~10 (100 · 70~90번)', ctr('7.5 (12초)'), ng('41 ✘'), ng('50 ✘'), ng('56 ✘'), ng('55 ✘'), ng('68 ✘'), ctr('75 △', { color: C.olive })],
    ['11~ (125 · 70~90번)', ctr('6.0 (9.6초)'), ng('33 ✘'), ng('40 ✘'), ng('45 ✘'), ng('44 ✘'), ng('55 ✘'), ng('60 ✘')],
  ];
  table(s, rows, { x: 0.5, y: 2.1, w: 12.33, colW: [2.9, 1.5, 1.3, 1.35, 1.35, 1.3, 1.3, 1.33], size: 12, rowH: 0.5 });
  const pts = [
    ['1~6단계', '다회 1명(10회)이면 60번 — 실제 파티(콘센파리 10회 1명, 평균 속도 112)는 68번으로 첫 주기에 깸 (게임 관측과 같음)'],
    ['7단계부터', '70번은 10회 다회 5명(75번), 또는 실제 파티 다회 2명(61번) + 아군 [속도 +15%] ≈ 70번. 90번은 10회 5명 + 속도 +15%로도 86번 → 한 주기 안에 못 깸'],
    ['성장', '타수는 레벨·별·스킬 레벨과 무관 (스킬 레벨업은 피해량·대기시간·확률만) → 키워도 같은 벽'],
  ];
  pts.forEach(([h, d], i) => {
    const y = 4.45 + i * 0.72;
    chip(s, 0.5, y + 0.1, 1.3, h, C.purple);
    s.addText(d, { x: 2.0, y, w: 10.8, h: 0.5, fontFace: F.r, fontSize: 13, color: C.ink, margin: 0, valign: 'middle', isTextBox: true });
  });
  note(s, '가정: 5명 모두 속도 100 · 생존. 보스 게이지 10단계(속도 100) 12초 관측 → 보스 속도에 비례로 보고 1~6단계 15초 · 11단계부터 9.6초 (비례는 확인 필요). 등껍질은 보스 스킬마다 가득으로 다시 생김 (확인)', 6.85);
}

// ── 6. 문제 6가지 ──────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '02', '문항 1 · 진단');
  title(s, '진단 — 글라틀의 문제 6가지', '열쇠(다회)는 고정된 타수를 주는데, 단계는 짧아지는 창 × 늘어나는 횟수를 요구합니다.');
  const rows = [
    ['#', '문제', '숫자', '플레이어가 느끼는 것'],
    [ctr('1'), '7단계부터 열쇠만으로 빠듯, 90번은 못 엶', '70번은 10회 다회 5명(75번)이나 다회 2명 + 속도 +15%, 90번은 다회 5명 + 속도 +15%로도 86번', '다회를 늘려도 90번이 나오는 판은 안 깨짐'],
    [ctr('2'), '키워도 깨는 속도가 그대로', '타수는 레벨·별과 무관, 바꿀 수 있는 건 속도뿐', '육성해도 같은 벽'],
    [ctr('3'), '한 명만 쓰러져도 무너짐', '한 명 빠지면 한 주기 −8~15번, 못 깨면 [빙하 분출] + 보스 회복', '한 번 꼬이면 회복 불가'],
    [ctr('4'), '실패가 운처럼 보임', '스킬 16초마다 vs 창 12초 → 몬몬마다 창 안 스킬 확률 75%', '같은 파티로 깰 때와 못 깰 때가 섞임'],
    [ctr('5'), '진짜 승부는 열쇠 밖', '탈진 7~8초 피해의 약 3/4이 고화력 몬몬 스킬', '보상은 다른 몬몬이 가져감'],
    [ctr('6'), '디버프·속도로 돕는 길도 막힘', '[빙하 각성] 디버프 전부 제거 + 속도 +15%', '탈진 중 건 디버프가 바로 사라짐'],
  ];
  table(s, rows, { x: 0.5, y: 2.05, w: 12.33, colW: [0.5, 3.2, 5.0, 3.63], size: 12, rowH: 0.54 });
  concl(s, '열쇠(다회)는 레벨 · 별과 무관한 고정 타수를 주는데, 단계는 짧아지는 창 × 늘어나는 횟수를 요구합니다 → 키워도 못 여는 열쇠, 진짜 승부는 열쇠 밖.', { y: 6.0, h: 0.7 });
}

// ── 7. 재설계 방향 ─────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '02', '문항 1 · 재설계');
  title(s, '재설계 방향 (초안) — "더 많이 때려라"를 "더 키워라"로', '보스 정체성(얼음 등껍질을 두드려 깨는 보스)은 그대로 두고, 열쇠의 효과를 성장 축과 잇습니다. K · N · t · x 는 시뮬레이션으로 맞출 자리입니다.');
  const cs = [
    ['① 균열이 남는다', ['못 깬 채 스킬을 쓰면 가득이 아니라 +K만 더함 (상한 N)', '→ 한 명 쓰러져도 다음 주기에 이어서 깸'], '문제 1·3'],
    ['② 강한 타격은 2번으로', ['한 타 피해가 보스 최대 체력 t% 이상이면 2번', '7단계부터는 횟수 대신 t를 올림 → 키울수록 빨리 깸'], '문제 2'],
    ['③ 탈진 중 얼음 균열', ['탈진 동안 맞을 때마다 받는 피해 +x% (상한)', '→ 다회 몬몬이 탈진 창의 한 축이 됨'], '문제 5'],
    ['④ 빙하 각성 조정', ['속도 +15%는 등껍질을 못 깼을 때만', '→ 잘 깬 플레이는 벌받지 않음'], '문제 6'],
  ];
  cs.forEach(([h, l, fix], i) => {
    const x = 0.5 + (i % 2) * 6.2, y = 2.15 + Math.floor(i / 2) * 1.95;
    card(s, x, y, 6.03, 1.75, h, l, { size: 14 });
    chip(s, x + 4.55, y + 1.32, 1.3, `푸는 것: ${fix}`, C.teal);
  });
  concl(s, '보스 정체성(등껍질을 두드려 깨기)은 그대로 두고, 열쇠의 효과를 피해량 · 균열 누적과 이어 「키울수록 빨리 깨는」 보스로 바꿉니다.', { y: 6.0, h: 0.7 });
  note(s, '기획자 확정 전 초안 (docs/q1-glattle-redesign.md). 공략 문구 예: "강하게 때릴수록 [얼음 등껍질]이 빨리 깨져요."', 6.85);
}

// ── 8. 문항 2 설계 조건 ────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '설계 조건 — 겹치지 않는 기믹, 같은 투력이면 열쇠가 필요', '기존 9종과 다른 축으로, 에픽 몬몬이 가진 효과가 열쇠가 되는 보스를 만듭니다.');
  card(s, 0.5, 2.1, 5.9, 2.4, '조건', [
    '1. 초반(1~6단계)은 열쇠 없이도 깸 — 기믹 소개',
    '2. 같은 투력이면 열쇠 없이는 "이대로는 못 깨겠다" (중반부터)',
    '3. 적의 행동만 봐도 왜 어려운지 보임 — 예고·게이지·표식',
    '4. 열쇠가 아닌 다른 방법(2-2)도 남김',
  ], { size: 13 });
  sub(s, '이미 쓰인 기믹 축 (9종)', 6.75, 2.1);
  const used = ['버프 유지', '회복 끊기', '디버프 정화', '버프 제거', '디버프 유지', '짧은 창 딜', '치유·구출', '타수', '광역 정리'];
  used.forEach((t, i) => chip(s, 6.75 + (i % 3) * 2.0, 2.55 + Math.floor(i / 3) * 0.42, 1.85, t, C.gray, C.ink));
  sub(s, '열쇠로 안 쓰였고 에픽 비중이 높은 효과', 6.75, 3.95);
  const free = [['부활 차단', '전1 · 에2 · 레1'], ['피해 반사 (강)', '전1 · 에4 · 레1'], ['은신 (강철 은신)', '전4 · 에5'], ['효과명중 감소 (강)', '전3 · 에8'], ['스킬 에너지 증가', '전1 · 에4'], ['받는 피해 증가 (강)', '전8 · 에8']];
  free.forEach(([t, d], i) => {
    const x = 6.75 + (i % 2) * 3.05, y = 4.4 + Math.floor(i / 2) * 0.48;
    chip(s, x, y, 1.75, t, i < 3 ? C.purple : C.blue);
    s.addText(d, { x: x + 1.82, y, w: 1.2, h: 0.3, fontFace: F.r, fontSize: 10.5, color: C.sub, margin: 0, valign: 'middle', isTextBox: true });
  });
  card(s, 0.5, 4.75, 5.9, 1.95, '선택: 분열 + 부활', [
    '보스가 4마리로 나뉘고, 시간 안에 다 함께 못 쓰러뜨리면 다시 일어남',
    '→ 부활 차단 · 피해 반사 · 은신이 각각 다른 길로 열쇠가 됨',
    '→ "여러 적에게 피해를 나눠 넣는" 새 축',
  ], { size: 12.5, color: C.deep });
}

// ── 9. 쿼디 개요 ───────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '쿼디 — 넷으로 나뉘고, 함께 쓰러뜨리지 못하면 다시 일어난다', '가칭. 한 몸으로 싸우다 쓰러지면 [쿼디 조각] 4마리로 분열합니다 (단단한 조각 2 · 흐물 조각 2).');
  s.addImage({ path: path.join(IMG, 'banner.jpg'), x: 0.5, y: 2.05, w: 5.6, h: 5.6 * 1116 / 2000 });
  const skills = [
    ['skill-body.png', '젤리 몸통박치기', '기본공격 · 가까운 적 1명'],
    ['skill-shot.png', '젤리 포탄', '스킬 · 공격력 1위 적에게 큰 피해 (단단한 조각)'],
    ['skill-wave.png', '젤리 해일', '스킬 · 모든 적 + 가까운 2명 속도 −10% (흐물 조각)'],
    ['skill-split.png', '사분열 · 다시 뭉치기', '쓰러진 조각은 15초 뒤 부활, 부활마다 공격력 +10%'],
    ['skill-jelly.png', '녹지 않는 젤리', '[부활 차단]에 저항 못 함 · 광역 피해 −30% (7단계 −50%)'],
  ];
  skills.forEach(([img, n, d], i) => {
    const y = 2.05 + i * 0.86;
    s.addImage({ path: path.join(ROOT, 'docs/split-guide/art', img), x: 6.45, y, w: 0.72, h: 0.72, rounding: true });
    s.addText(n, { x: 7.35, y: y + 0.02, w: 5.5, h: 0.32, fontFace: F.s, fontSize: 13, color: C.ink, margin: 0, isTextBox: true });
    s.addText(d, { x: 7.35, y: y + 0.36, w: 5.5, h: 0.3, fontFace: F.r, fontSize: 11.5, color: C.sub, margin: 0, isTextBox: true });
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 5.35, w: 5.6, h: 1.45, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
  s.addText([
    { text: '반격 자세 ', options: { fontFace: F.b, color: C.purple } },
    { text: '(7단계부터) 조각 하나가 늘 자세를 잡고, 다수 공격을 맞으면 그 공격을 쓴 몬몬에게 바로 반격. 은신이면 빗나감', options: { breakLine: true } },
    { text: '공통 패시브 ', options: { fontFace: F.b, color: C.purple } },
    { text: '절대 면역 · 몰아붙이기 · 기회 (기존 보스와 같음)' },
  ], { x: 0.65, y: 5.45, w: 5.3, h: 1.25, fontFace: F.r, fontSize: 11.5, color: C.ink, margin: 0, valign: 'top', paraSpaceAfter: 4, isTextBox: true });
  s.addText('부활 차단이 남은 채 쓰러진 조각은 다시 일어나지 못함', { x: 6.45, y: 6.45, w: 6.4, h: 0.35, fontFace: F.m, fontSize: 12, color: C.purple, margin: 0, isTextBox: true });
}

// ── 9-2. 스킬별 기획 의도 ─────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '쿼디 스킬 — 하는 일과 기획 의도', '스킬 하나하나가 「함께 쓰러뜨려야 한다」는 한 가지 문제를 만들거나, 그 문제를 다른 길로 피하지 못하게 막습니다. (기획 의도는 초안)');
  const SK = [
    ['skill-body.png', '젤리 몸통박치기', '기본공격', '가까운 적 1명에게 피해 (10단계 45)', '평타는 약하게 — 위협은 스킬과 부활에서 오게 해 「무엇이 어려운지」가 흐려지지 않게'],
    ['skill-shot.png', '젤리 포탄', '스킬 · 단단한 조각', '공격력 1위 적에게 큰 피해 (450)', '화력 1위 한 명이 다 잡는 편성을 흔들어, 여러 몬몬이 나눠 잡게'],
    ['skill-wave.png', '젤리 해일', '스킬 · 흐물 조각', '모든 적 피해 (225) + 가까운 2명 속도 −10% (최대 2~3겹)', '느려짐이 쌓일수록 아군 스킬 타이밍이 어긋남 → 동시 처치가 점점 어려워짐 (속도 맞추기 · 정화의 가치)'],
    ['skill-split.png', '사분열', '패시브', '한 몸이 쓰러지면 조각 4마리로 나뉨', '보스의 정체성 — 한 몸을 넘기면 「넷을 함께」라는 두 번째 국면이 열림'],
    ['skill-split.png', '다시 뭉치기', '패시브', '쓰러진 조각은 15초 뒤 부활 (속도 무관) · 부활마다 공격력 +10%', '시간 제한 대신 누적 압박 — 오래 끌수록 강해져 「언젠가는 못 버팀」. 15초 창이 부활 차단의 자리'],
    ['skill-jelly.png', '녹지 않는 젤리', '패시브', '[부활 차단]에 저항 못 함 · 광역 피해 −30% (7단계부터 −50%)', '단계가 올라 효과저항이 높아져도 열쇠가 확실히 통하게 보장 · 광역 몰아치기 우회는 좁힘'],
    [null, '반격 자세', '패시브 · 7단계부터', '조각 하나가 늘 자세, 다수 공격을 맞으면 쓴 몬몬에게 바로 반격 (은신이면 빗나감)', '광역 남용에 대가를 붙여 은신(촛동)이 열쇠가 되는 이유를 만듦 · 반격 연출로 왜 아픈지 보이게 (조건 4)'],
    [null, '절대 면역 · 몰아붙이기 · 기회', '패시브 (공통)', '기절 · 실명 · 침묵 · 도발 · 속박 면역 / 이탈 1명당 피해 +10% / 이탈시키면 에너지 +25%', '기존 보스와 같은 공통 규칙 — 행동을 묶어 기믹을 건너뛰는 우회를 막음'],
  ];
  const rows = [['스킬', '종류', '하는 일', '기획 의도']].concat(SK.map(([, n, k, d, why]) => [
    { text: n, options: { fontFace: F.s, color: C.ink } }, { text: k, options: { color: C.sub } }, d, { text: why, options: { color: C.deep } }]));
  const RH = 0.52;
  table(s, rows, { x: 1.15, y: 1.95, w: 11.68, colW: [2.0, 1.55, 3.6, 4.53], size: 10.5, rowH: [0.36].concat(SK.map(() => RH)) });
  SK.forEach(([img], i) => {
    const y = 1.95 + 0.36 + i * RH + (RH - 0.44) / 2;
    if (img) s.addImage({ path: path.join(ROOT, 'docs/split-guide/art', img), x: 0.6, y, w: 0.44, h: 0.44, rounding: true });
    else {
      s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.44, h: 0.44, fill: { color: C.green }, line: { color: C.white, width: 1 } });
      s.addText('P', { x: 0.6, y, w: 0.44, h: 0.44, fontFace: F.b, fontSize: 13, color: C.white, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    }
  });
  note(s, '스킬 그림은 사용자 제작 이미지 · 수치는 10단계 기준 (단계 표 · 공략 창과 같음)', 6.85);
}

// ── 9-3. 쿼디 행동 타임라인 — 한 주기 ──────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '쿼디 행동 타임라인 ① — 9.6초 주기와 15초 부활', '속도 100 기준, 조각 4마리가 같은 때 시작했다고 놓은 예시 30초. 실제로는 조각마다 시작 게이지가 0~30% 달라 조금씩 어긋납니다.');
  const flow = ['한 몸 200,000 (10단계)', '쓰러지면 사분열 → 조각 4마리', '15초 안에 넷을 함께 쓰러뜨리기', '못 하면 부활 + 공격력 +10%'];
  flow.forEach((t, i) => {
    const x = 0.5 + i * 3.12;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.95, w: 2.95, h: 0.5, rectRadius: 0.08, fill: { color: i === 2 ? C.purple : C.tint }, line: { color: i === 2 ? C.purple : C.edge, width: 0.75 } });
    s.addText(t, { x, y: 1.95, w: 2.95, h: 0.5, fontFace: F.m, fontSize: 11.5, color: i === 2 ? C.white : C.ink, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    if (i < 3) arrow(s, x + 2.955, 2.13);
  });
  const T = 30, X0 = 2.2, X1 = 12.75, sx = (t) => X0 + (X1 - X0) * t / T;
  const rows = ['아군 (속도 100)', '단단한 조각', '흐물 조각', '반격 자세', '부활 (예시)'];
  const RY = (r) => 2.85 + r * 0.56;
  rows.forEach((lab, r) => {
    s.addText(lab, { x: 0.5, y: RY(r), w: 1.6, h: 0.4, fontFace: F.s, fontSize: 11, color: C.ink, align: 'right', valign: 'middle', margin: 0, isTextBox: true });
    s.addShape(pres.shapes.LINE, { x: X0, y: RY(r) + 0.2, w: X1 - X0, h: 0, line: { color: C.edge, width: 1 } });
  });
  for (let t = 0; t <= T; t += 5) {
    s.addShape(pres.shapes.LINE, { x: sx(t), y: RY(0) - 0.05, w: 0, h: 5 * 0.56, line: { color: 'EEEDF5', width: 0.5, dashType: 'dash' } });
    s.addText(`${t}초`, { x: sx(t) - 0.3, y: RY(5) - 0.08, w: 0.6, h: 0.22, fontFace: F.r, fontSize: 9, color: C.mute, align: 'center', margin: 0, isTextBox: true });
  }
  const dot = (t, r, col, d = 0.09) => s.addShape(pres.shapes.OVAL, { x: sx(t) - d / 2, y: RY(r) + 0.2 - d / 2, w: d, h: d, fill: { color: col }, line: { color: col, width: 0 } });
  const dia = (t, r, col, lab) => {
    s.addShape(pres.shapes.DIAMOND, { x: sx(t) - 0.11, y: RY(r) + 0.09, w: 0.22, h: 0.22, fill: { color: col }, line: { color: C.white, width: 0.75 } });
    if (lab) s.addText(lab, { x: sx(t) + 0.12, y: RY(r) - 0.06, w: 2.2, h: 0.22, fontFace: F.m, fontSize: 9.5, color: col, margin: 0, isTextBox: true });
  };
  for (let t = 1.6; t <= T; t += 1.6) dot(t, 0, C.soft, 0.07);
  dia(16, 0, C.purple, '스킬 (16초마다)');
  for (const r of [1, 2]) for (let t = 2.4; t <= T + 0.01; t += 2.4) dot(t, r, C.mute);
  for (let t = 9.6; t <= T; t += 9.6) { dia(t, 1, C.red, t < 10 ? '젤리 포탄 (공격력 1위)' : null); dia(t, 2, C.teal, t < 10 ? '젤리 해일 + 느려짐' : null); }
  [[0, 9.6, '조각 1'], [9.6, 19.2, '조각 2'], [19.2, 28.8, '조각 3'], [28.8, 30, '4']].forEach(([a, b, lab], i) => {
    s.addShape(pres.shapes.RECTANGLE, { x: sx(a) + 0.01, y: RY(3) + 0.08, w: sx(b) - sx(a) - 0.02, h: 0.24, fill: { color: i % 2 ? C.soft : C.purple }, line: { color: C.white, width: 0 } });
    s.addText(lab, { x: sx(a), y: RY(3) + 0.08, w: sx(b) - sx(a), h: 0.24, fontFace: F.m, fontSize: 9, color: C.white, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  });
  s.addShape(pres.shapes.RECTANGLE, { x: sx(3), y: RY(4) + 0.12, w: sx(18) - sx(3), h: 0.16, fill: { color: C.lilac }, line: { color: C.purple, width: 0.75 } });
  s.addText('쓰러짐 → 15초 (속도 무관) → 부활', { x: sx(3), y: RY(4) + 0.08, w: sx(18) - sx(3), h: 0.24, fontFace: F.m, fontSize: 9, color: C.deep, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addShape(pres.shapes.RECTANGLE, { x: sx(19), y: RY(4) + 0.12, w: sx(29.5) - sx(19), h: 0.16, fill: { color: 'F6E3E1' }, line: { color: C.red, width: 0.75 } });
  s.addText('[부활 차단]이 남은 채 쓰러짐 → ✕ 안 일어남', { x: sx(19), y: RY(4) + 0.08, w: sx(29.5) - sx(19), h: 0.24, fontFace: F.m, fontSize: 9, color: C.red, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  concl(s, '조각은 9.6초마다 스킬, 부활은 15초 자체 타이머 — 아군 스킬 16초 주기와 박자가 맞지 않아 「넷을 함께」가 어렵고, 젤리 해일의 느려짐이 쌓일수록 더 어긋납니다. 반격 자세 조각이 바뀌는 것도 주기로 보입니다.', { y: 5.9, h: 0.8 });
}

// ── 9-4. 쿼디 행동 타임라인 — 실제 한 판 ───────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '쿼디 행동 타임라인 ② — 시뮬레이션 한 판 (중반 10단계)', '1,000판 중 시간이 중앙값에 가까운 판을 골라 그대로 그렸습니다. 막대 = 조각이 살아 있는 시간, 빈 칸 = 쓰러져 부활을 기다리는 15초.');
  const Tm = Math.ceil(Math.max(V.traces.base.t, V.traces.tok.t) / 30) * 30;
  const X0 = 1.95, X1 = 12.75, sx = (t) => X0 + (X1 - X0) * t / Tm;
  const panel = (tr, y0, head, col) => {
    const ev = tr.ev, split = (ev.find((e) => e.type === 'split') || {}).t;
    s.addText(head, { x: 0.5, y: y0, w: 12.3, h: 0.28, fontFace: F.s, fontSize: 12, color: col, margin: 0, isTextBox: true });
    const rows = ['한 몸', '조각 1', '조각 2', '조각 3', '조각 4', '아군 쓰러짐'];
    const RY = (r) => y0 + 0.3 + r * 0.235;
    rows.forEach((lab, r) => {
      s.addText(lab, { x: 0.5, y: RY(r), w: 1.35, h: 0.24, fontFace: F.r, fontSize: 9.5, color: C.sub, align: 'right', valign: 'middle', margin: 0, isTextBox: true });
      s.addShape(pres.shapes.LINE, { x: X0, y: RY(r) + 0.12, w: sx(tr.t) - X0, h: 0, line: { color: C.edge, width: 0.75 } });
    });
    const bar = (a, b, r, c) => { if (b > a) s.addShape(pres.shapes.RECTANGLE, { x: sx(a), y: RY(r) + 0.04, w: Math.max(0.02, sx(b) - sx(a)), h: 0.16, fill: { color: c }, line: { color: c, width: 0 } }); };
    bar(0, split ?? tr.t, 0, C.deep);
    for (let i = 0; i < 4; i++) {
      let start = split, alive = split != null;
      for (const e of ev) {
        if (e.type === 'die' && !e.body && e.i === i && alive) {
          bar(start, e.t, i + 1, col); alive = false;
          if (e.perm) s.addText('✕', { x: sx(e.t) - 0.1, y: RY(i + 1) - 0.02, w: 0.2, h: 0.26, fontFace: F.b, fontSize: 12, color: C.red, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
        }
        if (e.type === 'revive' && e.i === i) { start = e.t; alive = true; s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: sx(e.t) - 0.05, y: RY(i + 1) + 0.03, w: 0.1, h: 0.1, fill: { color: C.green }, line: { color: C.green, width: 0 } }); }
      }
      if (alive) bar(start, tr.t, i + 1, col);
    }
    const deaths = ev.filter((e) => e.type === 'adeath');
    deaths.forEach((e) => s.addShape(pres.shapes.OVAL, { x: sx(e.t) - 0.05, y: RY(5) + 0.06, w: 0.1, h: 0.1, fill: { color: C.red }, line: { color: C.red, width: 0 } }));
    if (deaths.length) s.addText('쓰러진 순서: ' + deaths.map((e) => (e.n === '기본몬몬' ? '열쇠 자리' : e.n)).join(' → '), { x: X0 + 0.05, y: RY(5) + 0.01, w: 5.5, h: 0.2, fontFace: F.r, fontSize: 8.5, color: C.red, margin: 0, isTextBox: true });
    s.addShape(pres.shapes.LINE, { x: sx(tr.t), y: RY(0), w: 0, h: 6 * 0.235, line: { color: tr.win ? C.purple : C.red, width: 1.25 } });
    s.addText(tr.win ? `클리어 ${mmss(tr.t)}` : `전멸 ${mmss(tr.t)}`, { x: sx(tr.t) - 1.2, y: y0, w: 1.15, h: 0.26, fontFace: F.b, fontSize: 10.5, color: tr.win ? C.purple : C.red, align: 'right', margin: 0, isTextBox: true });
  };
  const b = V.traces.base, t = V.traces.tok;
  const perm = t.ev.filter((e) => e.type === 'die' && e.perm).length;
  panel(b, 1.9, `기본 파티 (열쇠 없음) — ${b.t}초 전멸 · 부활 ${b.revives}번`, C.mute);
  panel(t, 3.72, `톡찌리 파티 — ${t.t}초 클리어 · 부활 ${t.revives}번 · 부활 차단으로 못 일어난 조각 ${perm}번`, C.purple);
  for (let x = 0; x <= Tm; x += 30) s.addText(`${x}초`, { x: sx(x) - 0.3, y: 5.5, w: 0.6, h: 0.2, fontFace: F.r, fontSize: 8.5, color: C.mute, align: 'center', margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: 5.6, y: 1.97, w: 0.1, h: 0.1, fill: { color: C.green }, line: { color: C.green, width: 0 } });
  s.addText('부활 · ✕ 부활 차단으로 못 일어남 · ● 아군 쓰러짐', { x: 5.75, y: 1.92, w: 4.2, h: 0.2, fontFace: F.r, fontSize: 9, color: C.sub, margin: 0, isTextBox: true });
  concl(s, `한 몸은 두 파티 모두 약 ${Math.round(((b.ev.find((e) => e.type === 'split') || {}).t + (t.ev.find((e) => e.type === 'split') || {}).t) / 2)}초에 쓰러집니다. 차이는 분열 뒤 — 기본 파티는 조각이 번갈아 쓰러지고 다시 일어나며(${b.revives}번) 강해져 아군이 차례로 무너지고, 톡찌리 파티는 부활 차단으로 한 마리를 지워 넷을 함께 잡는 창이 생깁니다.`, { y: 5.92, h: 0.8 });
}

// ── 10. 공략 창 UI — 탭 · 구간별로 자른 캡처 (docs/split-guide/shots, tools/split-guide-shots.py) ──
const SHOT = (f) => path.join(ROOT, 'docs/split-guide/shots', f);
const shotW = (f, h) => { const d = require('image-size').imageSize(fs.readFileSync(SHOT(f))); return h * d.width / d.height; };
function shotRow(s, items, x0, gap, h, y = 2.0) {   // items: [파일, 라벨, 색] → 라벨 칩 + 이미지, 끝 x 반환
  let x = x0;
  items.forEach(([f, lab, col]) => {
    const w = shotW(f, h);
    chip(s, x, y, Math.min(w, 2.1), lab, col);
    s.addImage({ path: SHOT(f), x, y: y + 0.4, w, h, altText: `쿼디 공략 창 — ${lab}` });
    x += w + gap;
  });
  return x - gap;
}
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '보스 공략 창 ① 공략 포인트 — 구간 버튼마다 바뀌는 안내', '게임의 보스 공략 창과 같은 구성. 초반 · 중반 · 후반 버튼을 누르면 「보스 패턴 / 이렇게 풀어요」가 그 구간 내용으로 바뀝니다.');
  const end = shotRow(s, [['02-points-early.png', '초반 1~6', C.green], ['03-points-mid.png', '중반 7~15', C.purple], ['04-points-late.png', '후반 16~20', C.red]], 0.5, 0.3, 4.3);
  const x0 = end + 0.4, w0 = 12.83 - x0;
  const pts = [
    ['초반 1~6', '기믹 소개 — 반격 · 느려짐 없음, 광역 피해 감소 30%. 열쇠 없이도 깸', C.green],
    ['중반 7~15', '[반격 자세] · 느려짐 2겹 · 광역 감소 50% → 같은 투력이면 열쇠가 필요', C.purple],
    ['후반 16~20', '느려짐 3겹 · 조각 체력↑ → 열쇠 2명 권장', C.red],
  ];
  sub(s, '구간마다 바뀌는 것', x0, 2.0, w0);
  pts.forEach(([hh, d, col], i) => {
    const y = 2.5 + i * 1.35;
    chip(s, x0, y, 1.4, hh, col);
    s.addText(d, { x: x0, y: y + 0.38, w: w0, h: 0.9, fontFace: F.r, fontSize: 12, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  });
  s.addText('「내 구간」 표시는 지금 도전 중인 단계의 구간', { x: x0, y: 6.3, w: w0, h: 0.4, fontFace: F.r, fontSize: 10, color: C.mute, margin: 0, valign: 'top', isTextBox: true });
}
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '보스 공략 창 ② 필요한 효과 · 보스 스킬', '필요한 효과에 열쇠 몬몬과 편성 버튼이 뜨고, 보스 스킬 탭은 쿼디의 기본공격 · 스킬 · 패시브 10개를 보여 줍니다.');
  const end = shotRow(s, [['05-needed.png', '필요한 효과', C.teal], ['06-skills-1.png', '보스 스킬 ① 1~5', C.purple], ['07-skills-2.png', '보스 스킬 ② 6~10', C.purple]], 0.5, 0.3, 4.3);
  const x0 = end + 0.45, w0 = 12.83 - x0;
  const pts = [
    ['필요한 효과', '① 부활 차단 ② 피해 반사 ③ 은신 — 효과마다 열쇠 몬몬 아이콘과 편성 버튼'],
    ['예고가 보이게', '반격 자세 조각 · 부활까지 남은 시간 · 공격력 증가를 전투 화면에 표시'],
    ['스킬 그림', '젤리 몸통박치기 · 포탄 · 해일 · 사분열 · 녹지 않는 젤리는 제작 이미지'],
    ['반격 자세 잠금', '7단계부터 열리는 패시브는 자물쇠 + 「7단계부터」 표시'],
  ];
  pts.forEach(([hh, d], i) => {
    const y = 2.0 + i * 1.2;
    chip(s, x0, y, 1.6, hh, C.purple);
    s.addText(d, { x: x0, y: y + 0.38, w: w0, h: 0.75, fontFace: F.r, fontSize: 12, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  });
}

// ── 11. 열쇠 몬몬 ──────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '열쇠 몬몬 — 같은 보스를 세 갈래로 연다', '열쇠 효과마다 푸는 방식이 다릅니다. 시뮬레이션은 같은 자리에 같은 능력치 · 열쇠 효과만 없는 몬몬을 둔 기본 파티와 비교했습니다.');
  const keys = [   // [번호, 이름, 열쇠 효과, 효과 아이콘, 핵심 스킬, 칸, 핵심 효과 문구, 설명, 색]
    ['099', '톡찌리 (에픽)', '부활 차단', 'DB_REVIVE_BLOCK', '영혼 쪼아먹기', '★5 패시브', '스킬 피해를 입은 적에게 각각 15% [부활 차단]', ['스킬 「맹독 연격」 10회가 무작위 조각에 퍼져 여러 마리에 걸림', '→ ★5로 진화해야 열쇠 완성 (성장과 연결)'], C.purple],
    ['123', '몽실벌 (에픽)', '피해 반사', 'BF_REFLECT_2', '꿀단지 쏟기', '스킬', '[4턴에 한 번] 모든 아군 2턴 [피해 반사 30%]', ['조각 넷이 함께 때릴수록 돌려주는 피해도 커짐', '→ 반사 피해도 방어력에 깎여 효과는 작음'], C.blue],
    ['081', '촛동 (에픽)', '은신', 'BF_STEALTH_2', '연막 은신', '스킬', '[4턴에 한 번] 자신 뺀 아군 2턴 [강철 은신]', ['은신 중엔 반격 · 단일 공격을 받지 않음', '→ 광역 몬몬을 마음껏 쓰게 해 줌'], C.teal],
  ];
  keys.forEach(([no, n, k, icon, skill, slot, eff, l, col], i) => {
    const x = 0.5 + i * 4.14;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.05, w: 3.95, h: 2.75, rectRadius: 0.08, fill: { color: C.tint }, line: { color: i === 0 ? C.purple : C.edge, width: i === 0 ? 1.5 : 0.75 } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: 2.17, w: 1.12, h: 1.12, fill: { color: C.white }, line: { color: col, width: 1.5 } });
    s.addImage({ path: path.join(ROOT, `docs/deck/assets/key-${no}.png`), x: x + 0.26, y: 2.23, w: 1.0, h: 1.0 });   // 배경 없이 오려 가운데 맞춤 (tools/deck-key-art.py)
    s.addText(n, { x: x + 1.45, y: 2.25, w: 2.4, h: 0.4, fontFace: F.b, fontSize: 16, color: C.ink, margin: 0, isTextBox: true });
    chip(s, x + 1.45, 2.72, 1.4, k, col);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.18, y: 3.42, w: 3.59, h: 0.62, rectRadius: 0.06, fill: { color: C.white }, line: { color: col, width: 0.75 } });
    s.addImage({ path: path.join(ROOT, `data/effects/icons/${icon}.png`), x: x + 0.27, y: 3.5, w: 0.46, h: 0.46 });
    s.addText([{ text: '핵심 스킬  ', options: { fontFace: F.s, fontSize: 9.5, color: col } }, { text: skill, options: { fontFace: F.b, fontSize: 12, color: C.ink } }, { text: `  ${slot}`, options: { fontFace: F.r, fontSize: 9.5, color: C.sub, breakLine: true } },
      { text: eff, options: { fontFace: F.r, fontSize: 9.5, color: C.ink } }], { x: x + 0.82, y: 3.45, w: 2.9, h: 0.56, margin: 0, valign: 'middle', isTextBox: true });
    s.addText(l.map((t, j) => ({ text: t, options: { breakLine: j < l.length - 1 } })), { x: x + 0.2, y: 4.12, w: 3.55, h: 0.62, fontFace: F.r, fontSize: 10.5, color: C.ink, margin: 0, valign: 'top', paraSpaceAfter: 2, isTextBox: true });
  });
  const b2 = band(2, 'base'), t2 = band(2, 'tok'), m2 = band(2, 'mong'), c2 = band(2, 'chot'), d2 = band(2, 'duo');
  const stats = [[b2.clear, '기본 파티', '열쇠 효과 없음', C.red], [t2.clear, '톡찌리', '부활 차단', C.purple], [m2.clear, '몽실벌', '피해 반사', C.blue], [c2.clear, '촛동', '은신', C.teal], [d2.clear, '톡찌리 + 몽실벌', '열쇠 2명', C.deep]];
  sub(s, '중반(7~15) 클리어율', 0.5, 4.98);
  stats.forEach(([v, l, k, col], i) => {
    const x = 0.5 + i * 2.48, y = 5.33;
    s.addChart(pres.charts.DOUGHNUT, [{ name: l, labels: ['클리어', '실패'], values: [v, Math.max(0, 100 - v)] }],
      { x, y, w: 1.42, h: 1.42, holeSize: 66, chartColors: [col, C.lilac], showLegend: false, showValue: false, showPercent: false, showLabel: false, showTitle: false, dataBorder: { pt: 0.5, color: 'FFFFFF' } });
    s.addText(`${Math.round(v)}%`, { x, y: y + 0.5, w: 1.42, h: 0.42, fontFace: F.b, fontSize: 16, color: col, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText([{ text: l, options: { fontFace: F.s, fontSize: 12, color: C.ink, breakLine: true } }, { text: k, options: { fontFace: F.r, fontSize: 10.5, color: C.sub } }],
      { x: x + 1.48, y: y + 0.38, w: 0.98, h: 0.7, margin: 0, valign: 'middle', isTextBox: true });
  });
  note(s, '1,000판 · 부활 차단 보유: 전설 1 · 에픽 2 · 레어 1 / 피해 반사 (강): 전설 1 · 에픽 4 · 레어 1', 6.8);
}

// ── 12. 단계별 설계 ────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '단계별 설계 — 초반 소개 · 중반 열쇠 · 후반 열쇠 2명', '기존 보스 9종에서 뽑은 공통 성장 곡선(글라틀 위치)에 배율을 곱해 1~20단계 체력·공격력이 함께 오릅니다.');
  const st = stages.slice(1);
  s.addChart(pres.charts.LINE, [
    { name: '쿼디 전체 체력 (한 몸 + 4마리)', labels: st.map((r) => `${r[0]}`), values: st.map((r) => +r[si('전체 체력 (한 몸 + 4마리)')]) },
    { name: '글라틀 체력', labels: st.map((r) => `${r[0]}`), values: st.map((r) => +r[si('글라틀 체력 (비교)')]) },
  ], { x: 0.5, y: 2.0, w: 6.4, h: 4.6, chartColors: [C.purple, C.mute], lineSize: 2, lineDataSymbolSize: 5,
    valAxisLogScaleBase: 10, valAxisLabelFormatCode: '#,##0', valAxisLabelFontFace: F.r, catAxisLabelFontFace: F.r, valAxisLabelFontSize: 9, catAxisLabelFontSize: 9,
    valAxisLabelColor: C.sub, catAxisLabelColor: C.sub, valGridLine: { color: 'E6E6EE', size: 0.5 }, catGridLine: { style: 'none' },
    showLegend: true, legendPos: 'b', legendFontFace: F.r, legendFontSize: 10, legendColor: C.ink,
    showTitle: true, title: '단계별 체력 (로그 눈금)', titleFontFace: F.s, titleFontSize: 12, titleColor: C.ink, catAxisTitle: '단계', showCatAxisTitle: true, catAxisTitleFontSize: 9, catAxisTitleColor: C.sub });
  const rows = [
    ['구간', '분열체', '광역 감소', '반격', '느려짐'],
    ['초반 1~6', ctr('×0.104'), ctr('30%'), ctr('없음'), ctr('없음')],
    ['중반 7~15', ctr('×0.121'), ctr('50%'), ctr('있음'), ctr('2명 −10% ×2')],
    ['후반 16~20', ctr('×0.130'), ctr('50%'), ctr('있음'), ctr('2명 −10% ×3')],
  ];
  table(s, rows, { x: 7.25, y: 2.05, w: 5.58, colW: [1.3, 0.95, 1.0, 0.8, 1.53], size: 11.5, rowH: 0.42 });
  const r10 = st[9];
  card(s, 7.25, 4.0, 5.58, 2.6, '10단계 (중반) 기준값', [
    `한 몸 ${(+r10[si('한 몸 체력')]).toLocaleString('en-US')} → 분열체 ${(+r10[si('분열체 체력 (1마리)')]).toLocaleString('en-US')} × 4`,
    `방어력 ${(+r10[si('방어력')]).toLocaleString('en-US')} · 속도 100 · 효과저항 ${r10[si('효과저항')]}`,
    `피해: 평타 ${r10[si('분열체 평타 피해')]} · 단일 ${r10[si('단일 스킬 피해')]} · 모든 적 ${r10[si('모든 적 스킬 피해')]} · 반격 ${(+r10[si('반격 피해')]).toLocaleString('en-US')}`,
    '부활 15초(속도 무관) · 부활마다 공격력 +10%',
  ], { size: 12 });
}

// ── 12-2. 시뮬레이션 방식 (몬테카를로) — 코드를 안 열어도 계산 방식을 알 수 있게 ──
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 검증');
  title(s, '시뮬레이션 방식 — 전투 1판을 0.1초씩 끝까지, 1,000판 돌려 확률로', '게임 엔진이 아니라 관측값과 기획 규칙으로 만든 전용 전투 계산입니다. 무작위가 섞인 전투를 1,000번 돌려 「몇 번 이기는지」로 봅니다.');
  sub(s, '한 판의 흐름', 0.5, 2.0);
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 2.4, w: 6.9, h: 0.38, fill: { color: C.lilac }, line: { color: C.lilac, width: 0 } });
  s.addText('준비  아군 게이지 0 · 첫 평타 시점만 무작위, 보스는 한 몸 200,000', { x: 0.62, y: 2.4, w: 6.7, h: 0.38, fontFace: F.m, fontSize: 11.5, color: C.deep, margin: 0, valign: 'middle', isTextBox: true });
  const flow = [
    ['아군 행동', '속도만큼 평타 1.6초 · 스킬 16초 (속도 100). 단일은 맨 앞 조각, 광역은 조각 전부 (−50%)'],
    ['분열', '한 몸이 쓰러지면 조각 4마리 (단단한 2 · 흐물 2)'],
    ['부활', '쓰러지고 15초 뒤 부활 (속도 무관), 부활마다 공격력 ×1.1 · [부활 차단]이 남아 있으면 못 일어남'],
    ['조각 공격', '평타 2.4초 · 스킬 9.6초 — 맨 앞 1명 450 / 전체 225 + 가까운 2명 느려짐'],
    ['반격', '반격 자세 조각이 다수 공격을 맞으면 쓴 몬몬에게 1,500 (은신이면 빗나감)'],
    ['판정', '조각 4마리가 다 쓰러지면 클리어 · 아군 전멸이나 600초면 실패'],
  ];
  const fy = 2.88, fh = 0.6;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: fy, w: 0.55, h: flow.length * fh - 0.08, rectRadius: 0.1, fill: { color: C.purple }, line: { color: C.purple, width: 0 } });
  s.addText('0.1초마다 반복 ↺', { x: 0.5, y: fy, w: 0.55, h: flow.length * fh - 0.08, fontFace: F.b, fontSize: 11, color: C.white, align: 'center', valign: 'middle', vert: 'eaVert', margin: 0, isTextBox: true });
  flow.forEach(([hh, d], i) => {
    const y = fy + i * fh;
    s.addShape(pres.shapes.RECTANGLE, { x: 1.15, y, w: 6.25, h: fh - 0.08, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
    s.addText(`${i + 1}  ${hh}`, { x: 1.25, y, w: 1.35, h: fh - 0.08, fontFace: F.s, fontSize: 12, color: C.purple, valign: 'middle', margin: 0, isTextBox: true });
    s.addText(d, { x: 2.6, y, w: 4.7, h: fh - 0.08, fontFace: F.r, fontSize: 10.5, color: C.ink, valign: 'middle', margin: 0, isTextBox: true });
  });
  card(s, 7.75, 2.0, 5.08, 1.75, '판마다 달라지는 것 (무작위 요소)', [
    '· 첫 평타 시점 — 아군 0~1.6초 · 조각 0~2.4초',
    '· 치명타 — 딸랑귀 28% · 쥐강이 37% (3,216 → 5,000)',
    '· 톡찌리 타격 대상 무작위 + 타격마다 [부활 차단] 15%',
    '· 딸랑귀 약화 75% (받는 피해 +25%)',
  ], { size: 11.5 });
  card(s, 7.75, 3.95, 5.08, 1.35, '1,000판 집계', [
    '· 클리어율 = 이긴 판 ÷ 1,000',
    '· 클리어 시간 = 이긴 판들의 중앙값',
    '· 시드 4242 고정 → 다시 돌려도 같은 결과, 파티끼리 같은 난수로 비교',
  ], { size: 11.5, color: C.teal });
  s.addText('±3.1%p', { x: 7.75, y: 5.55, w: 2.0, h: 0.6, fontFace: F.b, fontSize: 28, color: C.purple, margin: 0, isTextBox: true });
  s.addText('1,000판 클리어율의 95% 오차 (최대, 50%일 때). 기본 파티 32% vs 톡찌리 96% 차이 64%p는 우연이 아님', { x: 9.8, y: 5.5, w: 3.03, h: 0.75, fontFace: F.r, fontSize: 10.5, color: C.ink, margin: 0, valign: 'middle', isTextBox: true });
  note(s, '전체 규칙과 몬몬별 스킬 처리: 엑셀 「시뮬레이션 방식」 시트 · 코드 tools/split-sim.mjs', 6.85);
}

// ── 13. 시뮬레이션 결과 ────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 검증');
  title(s, '시뮬레이션 — 같은 투력이면 열쇠 없이는 대부분 실패', '10단계 투력으로 정규화, 모든 몬몬이 빈 게이지로 시작, 구간·파티마다 1,000판. 기본 파티 = 쥐강이 자리에 열쇠 몬몬과 같은 체력·속도·화력의 몬몬, 열쇠 효과만 없음.');
  // 참고 기획서 16쪽 방식: 구간마다 큰 숫자 + 강조 막대 (열쇠 파티만 진하게), 지금 구간(중반)은 테두리 강조
  const ks = [['base', '기본'], ['tok', '톡찌리'], ['mong', '몽실벌'], ['chot', '촛동'], ['duo', '톡+몽']];
  const BAND = [[1, '초반 1~6', '기믹 소개 — 모두 약 2분에 깸'], [2, '중반 7~15', ''], [3, '후반 16~20', '느려짐 3겹 — 열쇠 2명 권장']];
  BAND.forEach(([o, lab, msg], i) => {
    const x = 0.5 + i * 4.17, y = 2.0, w = 3.99, h = 3.75;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: C.tint }, line: { color: o === 2 ? C.purple : C.edge, width: o === 2 ? 1.5 : 0.75 } });
    const b0 = band(o, 'base'), bt = band(o, 'tok');
    s.addText(lab, { x, y: y + 0.12, w, h: 0.3, fontFace: F.s, fontSize: 12.5, color: C.purple, align: 'center', margin: 0, isTextBox: true });
    s.addText([{ text: `${Math.round(b0.clear)}%`, options: { color: C.red } }, { text: '  →  ', options: { color: C.soft, fontSize: 18 } }, { text: `${Math.round(bt.clear)}%`, options: { color: C.purple } }],
      { x, y: y + 0.42, w, h: 0.58, fontFace: F.b, fontSize: 28, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addText('기본 파티  →  톡찌리', { x, y: y + 1.0, w, h: 0.24, fontFace: F.r, fontSize: 10, color: C.sub, align: 'center', margin: 0, isTextBox: true });
    s.addChart(pres.charts.BAR, [{ name: lab, labels: ks.map((k) => k[1]), values: ks.map(([k]) => band(o, k).clear) }], {
      x: x + 0.12, y: y + 1.27, w: w - 0.24, h: 1.85, barDir: 'col', barGapWidthPct: 55,
      chartColors: [C.mute, C.purple, C.soft, C.soft, C.deep], valAxisMaxVal: 100, valAxisMinVal: 0, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelFontFace: F.s, dataLabelColor: C.ink, dataLabelFormatCode: '0',
      catAxisLabelFontFace: F.r, catAxisLabelFontSize: 9, catAxisLabelColor: C.sub, catAxisLineShow: true, showLegend: false, showTitle: false });
    const line = msg || `이긴 판 — 기본 파티 ${mmss(b0.time)} · 톡찌리 ${mmss(bt.time)} (목표 2:30~3:00)`;
    s.addText(line, { x: x + 0.15, y: y + 3.17, w: w - 0.3, h: 0.5, fontFace: F.r, fontSize: 10.5, color: C.ink, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  });
  const m = band(2, 'base'), t = band(2, 'tok'), l0 = band(3, 'base'), l1 = band(3, 'tok');
  concl(s, `같은 능력치에서 열쇠 효과만 바꿔도 중반 ${Math.round(m.clear)}% → ${Math.round(t.clear)}%, 후반 ${Math.round(l0.clear)}% → ${Math.round(l1.clear)}%. 열쇠 없는 파티는 다시 일어날 때마다 강해지는 조각에 무너지고, 톡찌리는 부활을 막아 이긴 판 ${mmss(t.time)}에 깹니다.`, { y: 5.92, h: 0.78 });
  note(s, '막대: 기본 · 톡찌리 · 몽실벌 · 촛동 · 톡찌리 + 몽실벌 클리어율 (%), 1,000판 · 몽실벌 · 촛동은 연하게', 6.85);
}

// ── 13-2. 몬테카를로 변수 ① 속도 버프 · 게이지 감소 ─────────
const vrow = (g, o, k) => V.rows.find((r) => r.group === g && r.order === o && r.key === k);
const CHART_BASE = {
  barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 55, chartColors: [C.mute, C.purple], valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelFormatCode: '0"%"',
  showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 8.5, dataLabelFontFace: F.s, dataLabelColor: C.ink, dataLabelFormatCode: '0',
  valAxisLabelFontFace: F.r, catAxisLabelFontFace: F.r, valAxisLabelFontSize: 8.5, catAxisLabelFontSize: 9, valAxisLabelColor: C.sub, catAxisLabelColor: C.ink,
  valGridLine: { color: 'E6E6EE', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: true, legendPos: 'b', legendFontFace: F.r, legendFontSize: 9.5, legendColor: C.ink,
  showTitle: true, titleFontFace: F.s, titleFontSize: 11.5, titleColor: C.ink,
};
function varChart(s, group, labels, x, y, w, h, ttl) {
  const n = labels.length;
  s.addChart(pres.charts.BAR, [['base', '기본 파티'], ['tok', '톡찌리']].map(([k, nm]) => ({ name: nm, labels, values: Array.from({ length: n }, (_, i) => vrow(group, i + 1, k).clear) })),
    { ...CHART_BASE, x, y, w, h, title: ttl });
}
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 검증');
  title(s, '몬테카를로 변수 ① — 속도 버프를 누가 받나, 조각 게이지를 깎으면', '중반 10단계 결과와 같은 설정에서 한 가지만 바꿔 1,000판씩. 1,000판 클리어율 오차는 ±3%p 안팎이라 그보다 작은 차이는 같은 값으로 봅니다.');
  const sb = (o) => vrow('속도 버프 대상', o, 'base').clear, gb = (o) => vrow('조각 게이지 감소', o, 'base').clear;
  card(s, 0.5, 1.95, 6.05, 0.82, '속도 버프 — 콘센파리 「전류 동조」 [4턴에 한 번] 모든 아군 2턴 [속도 +15%]', ['실제는 모든 아군. 1명에게만 들어간다면 누구냐에 따라 얼마나 바뀌는지'], { size: 10.5 });
  varChart(s, '속도 버프 대상', ['없음', '모든 아군\n(실제)', '콜리킹만', '열쇠 자리만', '파이온만\n(광역)'], 0.5, 2.85, 6.05, 3.0, '속도 버프를 받는 아군별 클리어율 (%)');
  card(s, 6.78, 1.95, 6.05, 0.82, '조각 게이지 감소 — 조각 스킬(포탄 · 해일)이 늦게 나오게', ['딸랑귀 평타 「4% 확률로 스킬 에너지 −20%」는 실제 효과 (지금 결과엔 빠짐)'], { size: 10.5, color: C.teal });
  varChart(s, '조각 게이지 감소', ['없음\n(지금)', '딸랑귀 평타\n4% −20%', '스킬마다\n전체 −15%', '둘 다', '스킬마다\n전체 −30%'], 6.78, 2.85, 6.05, 3.0, '조각 게이지를 깎는 몬몬이 있을 때 클리어율 (%)');
  concl(s, `속도 버프는 「누가 받느냐」가 승률을 가릅니다 — 광역 딜러(파이온)만 빨라지면 기본 파티 ${sb(2)}% → ${sb(5)}%, 열쇠 자리만이면 ${sb(4)}%. 게이지 감소는 −15%로는 오차 안(${gb(3)}%)이고, −30%쯤 되면 ${gb(5)}%로 열쇠 없이 깨는 우회가 됩니다 → 2-2 대응 후보: 조각 게이지 감소에 상한.`, { y: 5.95, h: 0.78 });
  note(s, '1명에게만 / −15 · 30% 는 「만약」 실험 (콜리킹 자리 몬몬에 북치기 · 윙빗 ★3 같은 효과를 붙임)', 6.85);
}

// ── 13-3. 몬테카를로 변수 ② 치명타 ───────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 검증');
  title(s, '몬테카를로 변수 ② — 치명타가 터지면 승패가 바뀌나', '딸랑귀 28% · 쥐강이 자리 37% 확률로 스킬 3,216 → 5,000. 같은 1,000판을 판마다 「터진 치명 ÷ 치명이 날 수 있던 스킬 수」로 나눠 봤습니다.');
  varChart(s, '치명타', ['치명 없음', '확률대로\n(지금 결과)', '스킬마다 치명'], 0.5, 1.95, 5.2, 3.85, '치명타 조건별 클리어율 (%)');
  const cb = (k) => V.crit.filter((r) => r.key === k && r.bin !== '평균');
  s.addChart(pres.charts.BAR, ['base', 'tok'].map((k) => ({ name: k === 'base' ? '기본 파티' : '톡찌리', labels: cb('base').map((r) => r.bin.replace(' (', '\n(')), values: cb(k).map((r) => r.clear) })),
    { ...CHART_BASE, x: 5.95, y: 1.95, w: 4.6, h: 3.85, title: '판마다 치명 비율별 클리어율 (%)' });
  const avg = (k) => V.crit.find((r) => r.key === k && r.bin === '평균');
  const ab = avg('base'), at = avg('tok');
  const pc = (v) => `${(v * 100).toFixed(1)}%`;
  card(s, 10.75, 1.95, 2.08, 3.85, '평균 치명 비율', [
    '기본 파티', `이긴 판 ${pc(ab.winRate)}`, `진 판 ${pc(ab.loseRate)}`, '', '톡찌리', `이긴 판 ${pc(at.winRate)}`, `진 판 ${pc(at.loseRate)}`, '', '판 수: ' + cb('base').map((r) => r.runs).join(' · '),
  ], { size: 10.5 });
  const lo = Math.min(...cb('base').map((r) => r.clear)), hi = Math.max(...cb('base').map((r) => r.clear));
  concl(s, `기본 파티는 이긴 판과 진 판의 치명 비율이 같습니다(${pc(ab.winRate)} · ${pc(ab.loseRate)}) — 「몇 번」보다 「언제」 터지느냐(창 안에 넷을 함께 잡는지)가 승패를 가르고, 운에 따라 ${lo}~${hi}%를 오가도 절반을 못 넘습니다. 스킬마다 치명(스킬 피해 +55%)처럼 크게 강해지면 ${vrow('치명타', 3, 'base').clear}% — 같은 투력이면 열쇠가 필요합니다.`, { y: 5.92, h: 0.8 });
  note(s, '치명 비율 구간별 판 수가 적은 칸(100판 안팎)은 오차가 ±10%p까지 커짐', 6.85);
}

// ── 13-4. 전투 업타임별 클리어 확률 ───────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 검증');
  title(s, '전투 업타임별 클리어 확률 — 같은 기준에서 시간이 지나면', '중반 10단계, 파티마다 1,000판. 「t초 안에 깬 판 ÷ 1,000」 누적 곡선 — 곡선이 멈추는 높이가 최종 클리어율입니다.');
  const U = V.uptime, keysU = ['base', 'tok', 'mong', 'chot', 'duo'];
  s.addChart(pres.charts.LINE, keysU.map((k) => ({ name: V.upName[k], labels: U.map((r) => (r.t % 30 === 0 ? `${r.t}` : '')), values: U.map((r) => r[k]) })), {
    x: 0.5, y: 1.95, w: 8.6, h: 3.85, chartColors: [C.mute, C.purple, C.blue, C.teal, C.deep], lineSize: 2, lineDataSymbol: 'none',
    valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelFormatCode: '0"%"', valAxisLabelFontFace: F.r, valAxisLabelFontSize: 9, valAxisLabelColor: C.sub,
    catAxisLabelFontFace: F.r, catAxisLabelFontSize: 9, catAxisLabelColor: C.sub, catAxisLabelFrequency: 3, catAxisTitle: '전투 시간 (초)', showCatAxisTitle: true, catAxisTitleFontSize: 9, catAxisTitleColor: C.sub,
    valGridLine: { color: 'E6E6EE', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: true, legendPos: 'b', legendFontFace: F.r, legendFontSize: 9.5, legendColor: C.ink,
    showTitle: true, title: '누적 클리어 확률 (%)', titleFontFace: F.s, titleFontSize: 11.5, titleColor: C.ink });
  const at = (sec, k) => (U.find((r) => r.t === sec) || {})[k];
  const rows = [['파티', '2:30', '3:00', '4:00', '최종']].concat(keysU.map((k) => [V.upName[k], ctr(`${at(150, k)}%`), ctr(`${at(180, k)}%`), ctr(`${at(240, k)}%`), ctr(`${at(360, k)}%`, { fontFace: F.b })]));
  table(s, rows, { x: 9.35, y: 1.95, w: 3.48, colW: [1.28, 0.55, 0.55, 0.55, 0.55], size: 9.5, rowH: 0.36 });
  s.addText('목표 클리어 시간 2:30~3:00 (150~180초)', { x: 9.35, y: 4.2, w: 3.48, h: 0.3, fontFace: F.m, fontSize: 10, color: C.purple, margin: 0, isTextBox: true });
  s.addText('한 몸(200,000)을 깎는 약 100초 동안은 아무도 못 깨고, 분열 뒤 15초 창마다 곡선이 계단처럼 오릅니다.', { x: 9.35, y: 4.5, w: 3.48, h: 1.0, fontFace: F.r, fontSize: 10, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
  concl(s, `톡찌리 파티는 목표 구간 3:00까지 ${at(180, 'tok')}%가 깨고, 기본 파티는 3:00에 ${at(180, 'base')}% · 4:00에 ${at(240, 'base')}%로 멈춥니다 — 오래 버틴다고 더 깨지지 않습니다 (부활마다 강해지는 조각에 결국 무너짐). 조건 3 「이대로는 못 깬다」가 시간 축에서도 보입니다.`, { y: 5.92, h: 0.8 });
}

// ── 14. 2-2 다른 해법 ──────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 다른 해법');
  title(s, '2-2 다른 해법 — 열쇠 없이 깨는 길과 막는 기믹', '현재 도감의 몬몬·스킬로 가능한 우회를 찾고, 기믹을 무력화하는 것만 막았습니다.');
  const groups = [['원래 속도', 1], ['전원 110', 2], ['전원 120', 3]];
  s.addChart(pres.charts.BAR, [['base', '기본 파티'], ['tok', '톡찌리']].map(([k, n]) => ({ name: n, labels: groups.map((g) => g[0]), values: groups.map((g) => syncv(g[1], k)) })), {
    x: 0.5, y: 2.05, w: 4.9, h: 4.4, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 70, chartColors: [C.mute, C.purple],
    valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelFormatCode: '0"%"', showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 8, dataLabelFontFace: F.r, dataLabelColor: C.ink, dataLabelFormatCode: '0',
    valAxisLabelFontFace: F.r, catAxisLabelFontFace: F.m, valAxisLabelFontSize: 9, catAxisLabelFontSize: 10.5, valAxisLabelColor: C.sub, catAxisLabelColor: C.ink,
    valGridLine: { color: 'E6E6EE', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: true, legendPos: 'b', legendFontFace: F.r, legendFontSize: 10, legendColor: C.ink,
    showTitle: true, title: '속도를 맞춘 파티 (중반, 분열체 14,000)', titleFontFace: F.s, titleFontSize: 12, titleColor: C.ink });
  const rows = [
    ['다른 해법', '쓰는 몬몬', '처리'],
    ['속도를 맞춰 일제 사격', '속도가 비슷한 몬몬끼리 · 속도 세트', { text: '허용 (2-2 답)', options: { color: C.green, fontFace: F.b } }],
    ['고르게 맞히는 다회', '붕붕쥐 (무작위 10회) · 안테니', { text: '허용', options: { color: C.green, fontFace: F.b } }],
    ['독으로 동시에 쓰러뜨리기', '화끈이 · 코릴 · 비커링', '조각이 쓰러지면 남은 조각 디버프 제거 (빙하 각성 선례)'],
    ['광역 + 아군 부활로 버티기', '지직이 · 눈방울 · 뽀송이', '반격이 보호막·불사 무시 (대분화·방전 선례)'],
    ['부활을 처치 보상 농사로', '입질범 · 쫑긋이 · 비커링', '부활마다 공격력 +10%가 쌓임'],
    ['조각 행동 막기', '기절 · 도발 · 스킬 에너지 감소', '[절대 면역] · 부활 타이머는 속도 무관'],
  ];
  table(s, rows, { x: 5.7, y: 2.05, w: 7.13, colW: [2.05, 2.3, 2.78], size: 10.5, rowH: 0.5 });
  concl(s, '기믹을 이해한 우회(속도 맞춰 일제 사격)는 2-2 답으로 남기고, 기믹 자체를 무력화하는 길(독 · 부활 농사 · 행동 막기)만 막습니다.', { x: 5.7, y: 5.72, w: 7.13, h: 0.78 });
  note(s, `전원 110은 원래 평균 속도(약 112)와 거의 같아 총 화력은 그대로 — 스킬이 같이 터지는 효과만으로 기본 파티 ${syncv(1, 'base')}% → ${syncv(2, 'base')}%`, 6.75);
}

// ── 15. 시뮬레이션 기준 (부록) ─────────────────────────────
{
  const s = pres.addSlide();
  header(s, '04', '부록');
  title(s, '시뮬레이션 기준', '근거 — 관측: 게임에서 본 값 · 사용자 결정: 기획자가 정한 규칙 · 기획값: 시뮬레이션으로 고른 후보 · 가정: 확인 못 한 값 · 방식: 계산 방법');
  const crit = J('docs/split-report/criteria.json');
  const pick = ['계산', '판 수', '클리어 / 실패', '기본 파티', '파티', '피해', '딸랑귀 피해', '시간', '시작 게이지', '열쇠 몬몬', '체력', '반격', '부활', '부활 차단', '느려짐'];
  const col = { '관측': C.green, '사용자 결정': C.ink, '기획값': C.olive, '가정': C.red, '방식': C.mute };
  const rows = [['구분', '항목', '값', '근거']].concat(pick.map((p) => crit.find((r) => r.item === p)).filter(Boolean).map((r) => [r.group, r.item, r.value, { text: r.basis, options: { color: col[r.basis], fontFace: F.s, align: 'center' } }]));
  table(s, rows, { x: 0.5, y: 1.95, w: 12.33, colW: [1.55, 1.35, 8.33, 1.1], size: 9, rowH: 0.3 });
}

// ── 16. 한계와 확인할 것 ───────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '04', '부록');
  title(s, '한계와 확인할 것', '시뮬레이션은 게임 엔진이 아니라 관측값으로 만든 전용 계산입니다. 아래 항목이 확정되면 다시 돌립니다.');
  card(s, 0.5, 2.05, 6.0, 3.3, '가정으로 둔 것', [
    '· 딸랑귀 피해 — 관측이 없어 쥐강이 값으로 대신',
    '· 열쇠 몬몬(톡찌리·몽실벌·촛동) 수치 — 계정에 없어 쥐강이 화력',
    '· 피해 공식 — 없어서 분열체 피해는 "아군이 받는 값"으로 기획',
    '· 시작 게이지 모두 0 — 결과가 거의 한 흐름이라 체력 ±500에 크게 흔들림 → 체력 범위 평균으로 판단',
    '· 클리어 시간은 보스전만 (잡몹 웨이브 빠짐)',
    '· 빠진 실제 효과 — 몽실벌 ★5 「다시 윙윙」(쓰러진 아군 50% 부활), 딸랑귀 평타 게이지 −20% (4%, 변수 실험에서만)',
  ], { color: C.red, size: 13.5 });
  card(s, 6.83, 2.05, 6.0, 3.3, '게임에서 확인할 규칙', [
    '· 톡찌리 [부활 차단] 15%가 맞은 적마다인지 타격마다인지',
    '· [독] 피해가 들어가는 시점 (분열체 자기 턴 / 타이머)',
    '· 글라틀 등껍질이 보스 스킬 때 가득으로 다시 생기는지 (문항 1)',
    '· 보스 게이지가 속도에 비례하는지',
    '· 반사 피해가 방어력에 깎이는 비율 (지금 추정 0.16)',
  ], { color: C.teal, size: 13.5 });
  sub(s, '다음 단계', 0.5, 5.7);
  ['문항 1 재설계 수치 확정 (K · N · t · x)', '쿼디 스킬 이름 · 문구 확정', '열쇠 몬몬 실측 후 재시뮬레이션'].forEach((t, i) => chip(s, 0.5 + i * 4.14, 6.12, 3.95, t, C.lilac, C.deep));
  note(s, '검산: docs/split-report/split-boss-sim.xlsx (입력값 → 수식) · 시뮬레이션: tools/split-sim.mjs · 결과 페이지: 분열 보스 시뮬레이션 결과', 6.85);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
// 클라우드 동기화에서 안 열리는 폴더 항목을 빼고 다시 묶음
pres.write({ outputType: 'nodebuffer' }).then(async (buf) => {
  const JSZip = require('jszip');
  const src = await JSZip.loadAsync(buf), out = new JSZip();
  for (const [name, e] of Object.entries(src.files)) if (!e.dir) out.file(name, await e.async('nodebuffer'), { createFolders: false });
  fs.writeFileSync(OUT, await out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('wrote', OUT);
});
