// 과제 초안 슬라이드 — 사용자 서식(서식_수정.pptx)의 양식을 따라 pptxgenjs 로 만듦
//   서식: 13.33×7.5in, 위쪽 보라 띠(615BAE, 번호 · 구분), 왼쪽 보라 막대 + 20pt 제목, 연회색(F8F8FB) 카드에 보라 머리말,
//         글꼴 "프리젠테이션 4 Regular / 5 Medium / 6 SemiBold / 7 Bold", 본문 2A2740, 보조 70707A
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
  blue: '5B7FB0', teal: '3E7E92', olive: '8A7A33', red: 'B5423A', green: '4A8556', gray: 'EFEFF2', lilac: 'E9E7F6' };

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
  slide.addText(t, { x: 0.75, y, w: 12, h: 0.3, fontFace: F.r, fontSize: 9.5, color: C.mute, margin: 0, isTextBox: true });
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
    ['전투 시뮬레이션', ['· 0.1초 단위 전용 전투 계산', '· 설정·파티마다 1,000판', '· 대조군으로 열쇠 효과만 분리']],
    ['산출물', ['· 결과 페이지 (표·그래프)', '· 보스 공략 창 UI 목업', '· 검산 엑셀 (수식 · DB)']],
  ];
  cards.forEach(([h, l], i) => card(s, 0.5 + i * 3.12, 2.6, 2.95, 1.55, h, l));
  sub(s, '진행 순서', 0.5, 4.5);
  const steps = [['관측', '게임 화면·전투에서 값 수집'], ['진단', '열쇠가 안 먹히는 지점 찾기'], ['설계', '보스 기믹·단계 수치'], ['검증', '열쇠 있음·없음 비교']];
  steps.forEach(([h, d], i) => {
    const x = 0.5 + i * 3.12;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.95, w: 2.95, h: 1.1, rectRadius: 0.08, fill: { color: i === 3 ? C.purple : C.lilac }, line: { color: C.purple, width: 0.75 } });
    s.addText(`0${i + 1}  ${h}`, { x: x + 0.2, y: 5.05, w: 2.6, h: 0.4, fontFace: F.b, fontSize: 16, color: i === 3 ? C.white : C.purple, margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.2, y: 5.5, w: 2.6, h: 0.4, fontFace: F.r, fontSize: 12, color: i === 3 ? C.white : C.ink, margin: 0, isTextBox: true });
    if (i < 3) s.addText('›', { x: x + 2.95, y: 5.2, w: 0.17, h: 0.5, fontFace: F.b, fontSize: 20, color: C.purple, align: 'center', margin: 0, isTextBox: true });
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
  note(s, '글라틀은 열쇠 몬몬이 고급·일반에도 넉넉한데(15마리) 열쇠가 성장과 이어지지 않는 보스 → 문항 1 대상으로 선정', 6.45);
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
    const y = 2.05 + i * 1.02;
    s.addShape(pres.shapes.RECTANGLE, { x: 4.4, y, w: 8.43, h: 0.9, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
    chip(s, 4.55, y + 0.3, 1.35, h, col);
    s.addText(d, { x: 6.05, y: y + 0.08, w: 6.65, h: 0.74, fontFace: F.r, fontSize: 12, color: C.ink, margin: 0, valign: 'middle', isTextBox: true });
  });
  const stats = [['12초', '보스 게이지 — 이 안에 등껍질을 깨야 함'], ['60 → 90번', '7단계부터 깨야 하는 횟수'], ['38마리', '다회 피해 몬몬 (고급·일반 15)']];
  stats.forEach(([n, l], i) => {
    const x = 4.4 + i * 2.85;
    s.addText(n, { x, y: 6.2, w: 2.7, h: 0.5, fontFace: F.b, fontSize: 26, color: C.purple, margin: 0, isTextBox: true });
    s.addText(l, { x, y: 6.7, w: 2.7, h: 0.3, fontFace: F.r, fontSize: 11, color: C.sub, margin: 0, isTextBox: true });
  });
}

// ── 5. 한 주기 타수 ────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '02', '문항 1 · 진단');
  title(s, '한 주기 타수 — 7단계부터는 열쇠만으로 못 깬다', '보스 스킬 한 주기 동안 파티 5명이 등껍질을 때리는 횟수 (평타도 1번씩 셈). 레벨·별로 바뀌는 칸이 없습니다.');
  const rows = [
    ['단계 (보스 속도 · 깨야 하는 수)', '한 주기 (아군 평타)', '다회 없음', '5회 다회 3명', '5회 다회 5명', '10회 다회 2명', '10회 다회 4명', '10회 다회 5명'],
    ['1~6 (80 · 60번)', ctr('7.5'), ng('41 ✘'), ng('50 ✘'), ng('56 ✘'), ng('55 ✘'), ok('68 ✔'), ok('75 ✔')],
    ['7~10 (100 · 70~90번)', ctr('6'), ng('33 ✘'), ng('40 ✘'), ng('45 ✘'), ng('44 ✘'), ng('55 ✘'), ng('60 ✘')],
    ['11~ (125 · 70~90번)', ctr('4.8'), ng('26 ✘'), ng('32 ✘'), ng('36 ✘'), ng('35 ✘'), ng('44 ✘'), ng('48 ✘')],
  ];
  table(s, rows, { x: 0.5, y: 2.1, w: 12.33, colW: [2.9, 1.5, 1.3, 1.35, 1.35, 1.3, 1.3, 1.33], size: 12, rowH: 0.5 });
  const pts = [
    ['1~6단계', '다회 몬몬 스킬 타수 합 30 이상이면 60번을 넘김 → 열쇠가 통하는 구간'],
    ['7단계부터', '10회 다회 5명이어도 60번 < 70번 → 열쇠를 갖고도 실패. 아군 [속도 증가]나 운(스킬 타이밍)에 기대야 함'],
    ['성장', '타수는 레벨·별·스킬 레벨과 무관 (스킬 레벨업은 피해량·대기시간·확률만) → 키워도 같은 벽'],
  ];
  pts.forEach(([h, d], i) => {
    const y = 4.45 + i * 0.72;
    chip(s, 0.5, y + 0.1, 1.3, h, C.purple);
    s.addText(d, { x: 2.0, y, w: 10.8, h: 0.5, fontFace: F.r, fontSize: 13, color: C.ink, margin: 0, valign: 'middle', isTextBox: true });
  });
  note(s, '가정: 5명 모두 속도 100·생존, 보스 게이지는 속도에 비례 (속도 120 보스 한 주기 = 아군 평타 약 5번 관측), 등껍질은 보스 스킬마다 가득으로 다시 생김', 6.85);
}

// ── 6. 문제 6가지 ──────────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '02', '문항 1 · 진단');
  title(s, '진단 — 글라틀의 문제 6가지', '열쇠(다회)는 고정된 타수를 주는데, 단계는 짧아지는 창 × 늘어나는 횟수를 요구합니다.');
  const rows = [
    ['#', '문제', '숫자', '플레이어가 느끼는 것'],
    [ctr('1'), '열쇠가 있어도 7단계부터 못 엶', '10회 다회 5명 60번 < 70번, 90번은 전설 20회가 있어야', '공략대로 다회를 늘려도 안 깨짐'],
    [ctr('2'), '키워도 깨는 속도가 그대로', '타수는 레벨·별과 무관, 바꿀 수 있는 건 속도뿐', '육성해도 같은 벽'],
    [ctr('3'), '한 명만 쓰러져도 무너짐', '한 명 빠지면 한 주기 −8~15번, 못 깨면 [빙하 분출] + 보스 회복', '한 번 꼬이면 회복 불가'],
    [ctr('4'), '실패가 운처럼 보임', '스킬 16초마다 vs 창 12초 → 몬몬마다 창 안 스킬 확률 75%', '같은 파티로 깰 때와 못 깰 때가 섞임'],
    [ctr('5'), '진짜 승부는 열쇠 밖', '탈진 7~8초 피해의 약 3/4이 고화력 몬몬 스킬', '보상은 다른 몬몬이 가져감'],
    [ctr('6'), '디버프·속도로 돕는 길도 막힘', '[빙하 각성] 디버프 전부 제거 + 속도 +15%', '탈진 중 건 디버프가 바로 사라짐'],
  ];
  table(s, rows, { x: 0.5, y: 2.05, w: 12.33, colW: [0.5, 3.2, 5.0, 3.63], size: 12, rowH: 0.62 });
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
  const end = shotRow(s, [['02-points-early.png', '초반 1~6', C.green], ['03-points-mid.png', '중반 7~15', C.purple], ['04-points-late.png', '후반 16~20', C.red]], 0.5, 0.3, 4.75);
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
  s.addText('「내 구간」 표시는 지금 도전 중인 단계의 구간', { x: x0, y: 6.6, w: w0, h: 0.5, fontFace: F.r, fontSize: 10, color: C.mute, margin: 0, valign: 'top', isTextBox: true });
}
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 에픽 열쇠 던전');
  title(s, '보스 공략 창 ② 필요한 효과 · 보스 스킬', '필요한 효과에 열쇠 몬몬과 편성 버튼이 뜨고, 보스 스킬 탭은 쿼디의 기본공격 · 스킬 · 패시브 10개를 보여 줍니다.');
  const end = shotRow(s, [['05-needed.png', '필요한 효과', C.teal], ['06-skills-1.png', '보스 스킬 ① 1~5', C.purple], ['07-skills-2.png', '보스 스킬 ② 6~10', C.purple]], 0.5, 0.3, 4.75);
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
  title(s, '열쇠 몬몬 — 같은 보스를 세 갈래로 연다', '열쇠 효과마다 푸는 방식이 다릅니다. 시뮬레이션은 쥐강이 자리에 넣고 화력을 같게 둔 대조군과 비교했습니다.');
  const keys = [
    ['099.png', '톡찌리 (에픽)', '부활 차단', ['스킬 10회가 무작위 조각에 퍼짐', '★5 패시브: 맞은 타격마다 15% [부활 차단]', '→ 진화해야 열쇠가 완성 (성장과 연결)'], C.purple],
    ['123.png', '몽실벌 (에픽)', '피해 반사', ['4턴마다 아군 전체 [피해 반사 30%]', '반사는 조각에 고르게 들어감', '→ 반사 피해도 방어력에 깎여 효과는 작음'], C.blue],
    ['081.png', '촛동 (에픽)', '은신', ['4턴마다 자신 제외 아군 [강철 은신]', '은신 중엔 반격을 받지 않음', '→ 광역 몬몬을 마음껏 쓰게 해 줌'], C.teal],
  ];
  keys.forEach(([ic, n, k, l, col], i) => {
    const x = 0.5 + i * 4.14;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 2.05, w: 3.95, h: 3.4, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
    s.addImage({ path: path.join(IMG, `key-${ic}`), x: x + 0.2, y: 2.2, w: 1.0, h: 1.0 });
    s.addText(n, { x: x + 1.35, y: 2.25, w: 2.5, h: 0.4, fontFace: F.b, fontSize: 16, color: C.ink, margin: 0, isTextBox: true });
    chip(s, x + 1.35, 2.75, 1.4, k, col);
    s.addText(l.map((t, j) => ({ text: t, options: { breakLine: j < l.length - 1 } })), { x: x + 0.2, y: 3.4, w: 3.55, h: 1.9, fontFace: F.r, fontSize: 12.5, color: C.ink, margin: 0, valign: 'top', paraSpaceAfter: 6, isTextBox: true });
  });
  const b2 = band(2, 'ctrl'), t2 = band(2, 'tok'), m2 = band(2, 'mong'), c2 = band(2, 'chot'), d2 = band(2, 'duo');
  const stats = [[`${b2.clear}%`, '대조군 (열쇠 없음)'], [`${t2.clear}%`, '톡찌리'], [`${m2.clear}%`, '몽실벌'], [`${c2.clear}%`, '촛동'], [`${d2.clear}%`, '톡찌리 + 몽실벌']];
  stats.forEach(([v, l], i) => {
    const x = 0.5 + i * 2.48;
    s.addText(v, { x, y: 5.7, w: 2.3, h: 0.6, fontFace: F.b, fontSize: 30, color: i === 0 ? C.red : C.purple, margin: 0, isTextBox: true });
    s.addText(l, { x, y: 6.3, w: 2.3, h: 0.3, fontFace: F.r, fontSize: 11.5, color: C.sub, margin: 0, isTextBox: true });
  });
  note(s, '중반(7~15) 클리어율, 1,000판 · 부활 차단 보유: 전설 1 · 에픽 2 · 레어 1 / 피해 반사 (강): 전설 1 · 에픽 4 · 레어 1', 6.8);
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

// ── 13. 시뮬레이션 결과 ────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 검증');
  title(s, '시뮬레이션 — 같은 투력이면 열쇠 없이는 대부분 실패', '10단계 투력으로 정규화, 모든 몬몬이 빈 게이지로 시작, 구간·파티마다 1,000판. 대조군 = 열쇠 몬몬과 같은 체력·속도·화력, 열쇠 효과만 없음.');
  const ks = [['base', '기준 파티'], ['ctrl', '대조군'], ['tok', '톡찌리'], ['mong', '몽실벌'], ['chot', '촛동'], ['duo', '톡찌리 + 몽실벌']];
  s.addChart(pres.charts.BAR, ks.map(([k, n]) => ({ name: n, labels: ['초반 1~6', '중반 7~15', '후반 16~20'], values: [1, 2, 3].map((o) => band(o, k).clear) })), {
    x: 0.5, y: 2.05, w: 8.2, h: 4.7, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60,
    chartColors: ['B9B6CF', C.mute, C.purple, C.blue, C.teal, C.deep], valAxisMaxVal: 100, valAxisMinVal: 0, valAxisLabelFormatCode: '0"%"',
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 8, dataLabelFontFace: F.r, dataLabelColor: C.ink, dataLabelFormatCode: '0',
    valAxisLabelFontFace: F.r, catAxisLabelFontFace: F.m, valAxisLabelFontSize: 9, catAxisLabelFontSize: 11, valAxisLabelColor: C.sub, catAxisLabelColor: C.ink,
    valGridLine: { color: 'E6E6EE', size: 0.5 }, catGridLine: { style: 'none' }, showLegend: true, legendPos: 'b', legendFontFace: F.r, legendFontSize: 10, legendColor: C.ink,
    showTitle: true, title: '구간별 클리어율 (%)', titleFontFace: F.s, titleFontSize: 12, titleColor: C.ink });
  const c = band(2, 'ctrl'), t = band(2, 'tok'), d = band(2, 'duo');
  const big = [[`${c.clear}%`, `중반 대조군 · 이긴 판 ${mmss(c.time)}`, C.red], [`${t.clear}%`, `중반 톡찌리 · ${mmss(t.time)}`, C.purple], [`${d.clear}%`, `중반 열쇠 2명 · ${mmss(d.time)}`, C.deep]];
  big.forEach(([v, l, col], i) => {
    const y = 2.1 + i * 1.25;
    s.addShape(pres.shapes.RECTANGLE, { x: 9.0, y, w: 3.83, h: 1.1, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
    s.addText(v, { x: 9.2, y: y + 0.08, w: 3.5, h: 0.6, fontFace: F.b, fontSize: 30, color: col, margin: 0, isTextBox: true });
    s.addText(l, { x: 9.2, y: y + 0.68, w: 3.5, h: 0.3, fontFace: F.r, fontSize: 11.5, color: C.sub, margin: 0, isTextBox: true });
  });
  s.addText(`열쇠 없는 파티는 다시 일어날 때마다 강해지는 조각에 무너지고, 톡찌리 파티는 부활을 막아 이긴 판 기준 ${mmss(t.time)}에 깹니다 (목표 2:30~3:00).`, { x: 9.0, y: 5.95, w: 3.83, h: 0.85, fontFace: F.r, fontSize: 11, color: C.ink, margin: 0, valign: 'top', isTextBox: true });
}

// ── 14. 2-2 다른 해법 ──────────────────────────────────────
{
  const s = pres.addSlide();
  header(s, '03', '문항 2 · 다른 해법');
  title(s, '2-2 다른 해법 — 열쇠 없이 깨는 길과 막는 기믹', '현재 도감의 몬몬·스킬로 가능한 우회를 찾고, 기믹을 무력화하는 것만 막았습니다.');
  const groups = [['원래 속도', 1], ['전원 110', 2], ['전원 120', 3]];
  s.addChart(pres.charts.BAR, [['base', '기준 파티'], ['ctrl', '대조군'], ['tok', '톡찌리']].map(([k, n]) => ({ name: n, labels: groups.map((g) => g[0]), values: groups.map((g) => syncv(g[1], k)) })), {
    x: 0.5, y: 2.05, w: 4.9, h: 4.4, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 70, chartColors: ['B9B6CF', C.mute, C.purple],
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
  table(s, rows, { x: 5.7, y: 2.05, w: 7.13, colW: [2.05, 2.3, 2.78], size: 10.5, rowH: 0.56 });
  note(s, `전원 110은 원래 평균 속도(약 112)와 거의 같아 총 화력은 그대로 — 스킬이 같이 터지는 효과만으로 기준 파티 ${syncv(1, 'base')}% → ${syncv(2, 'base')}%`, 6.75);
}

// ── 15. 시뮬레이션 기준 (부록) ─────────────────────────────
{
  const s = pres.addSlide();
  header(s, '04', '부록');
  title(s, '시뮬레이션 기준', '근거 — 관측: 게임에서 본 값 · 사용자 결정: 기획자가 정한 규칙 · 기획값: 시뮬레이션으로 고른 후보 · 가정: 확인 못 한 값 · 방식: 계산 방법');
  const crit = J('docs/split-report/criteria.json');
  const pick = ['계산', '판 수', '클리어 / 실패', '대조군', '파티', '피해', '딸랑귀 피해', '시간', '시작 게이지', '열쇠 몬몬', '체력', '반격', '부활', '부활 차단', '느려짐'];
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
