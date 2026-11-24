// 전투 데이터 입력 템플릿(.xlsx) 만들기 — 게임에서 모은 캐릭터·몬스터·스킬·던전·파티·관찰 기록을 한 파일에 적게 한다.
// 실행: node tools/combat-data-template.mjs [출력 경로]  (기본: templates/combat-data-template.xlsx)
//
// 규칙
// - 1행 = 머리글(주황 = 필수), 2행 = 적는 법, 3행부터 데이터. "(예시)"로 시작하는 행은 가져올 때 건너뛴다.
// - 시트끼리는 이름으로 잇는다 (스킬 이름, 몬스터 이름, 캐릭터 이름이 정확히 같아야 함). 여러 개는 | 로 구분.
// - 모르는 칸은 비우거나 ? — 가져오는 쪽에서 추측해 채우지 않고 목록으로 되묻는다.
// - 스킬·패시브의 효과는 "버프" 시트(data/buffs/buffs.json에서 만듦)의 이름을 드롭다운에서 고른다. 약/강이 이름에 들어 있어 수치는 버프가 정한다.
//   목록에 없는 효과(디버프·정화·게이지 증감 등)는 "기타"로 두고 메모에 설명 → 엔진에 넣을지 따로 정한다.
// - 관찰 시트(피해·스킬 주기·전투 결과)는 데미지 공식·게이지 속도를 추측하지 않고 맞추기 위한 것이고, 시뮬레이션이 실제와 맞는지 확인하는 기준이다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { makeZip } from '../src/lib/zip.js';
import { ROLES, ROWS, TARGETS, AREAS, TRIGGERS } from '../src/data/schema.js';

const out = process.argv[2] || 'templates/combat-data-template.xlsx';
// 버프 목록 (node tools/buff-icons.mjs가 만든 것) — 마지막에 "기타"를 붙여 드롭다운 한 범위로 쓴다
const BUFFS = JSON.parse(readFileSync(new URL('../data/buffs/buffs.json', import.meta.url), 'utf8'));
const BUFF_SHEET = '버프';
const EFFECT_RANGE = `'${BUFF_SHEET}'!$B$3:$B$${3 + BUFFS.length}`; // 버프 이름 + 기타

// ── 선택지 (드롭다운) ──
const first = (o) => Object.values(o).map(l => l.split(' ')[0]);
const L = {
  role: first(ROLES), row: first(ROWS), target: first(TARGETS), area: first(AREAS),
  yesno: ['예', '아니오'], kind: ['액티브', '패시브'],
  effTarget: ['자신', '아군 단일', '아군 전체', '적 단일', '적 전체'],
  trigger: Object.values(TRIGGERS),
  result: ['클리어', '실패', '시간 초과'],
  hit: ['평타', '스킬'],
};

// ── 시트 정의: [머리글, 적는 법, 너비, 필수?, 선택지?] ──
const C = (label, hint, width = 12, req = false, list = null) => ({ label, hint, width, req, list });
const effectCols = (n) => [
  C(`효과${n}`, '버프 시트의 이름 (약/강 포함), 없으면 기타', 17, false, EFFECT_RANGE),
  C(`효과${n} 대상`, '비우면 스킬 대상과 같음', 10, false, L.effTarget),
  C(`효과${n} 수치`, '보호막 양처럼 버프에 수치가 없을 때만', 10),
  C(`효과${n} 지속(턴)`, '받은 몬몬이 스킬을 쓸 때마다 1턴, 비우면 전투 끝까지', 10),
  C(`효과${n} 확률(%)`, '비우면 100', 9),
];
const STAT_COLS = [
  C('체력', '', 9, true), C('공격력', '', 9, true), C('방어력', '', 9, true), C('속도', '', 8, true),
  C('치명타 확률(%)', '없으면 비움', 9), C('치명타 배율', '예: 1.5', 9), C('명중', '없으면 비움', 8), C('회피', '없으면 비움', 8),
];

const SHEETS = [
  {
    name: '캐릭터', desc: '아군으로 쓰는 몬몬. 스탯은 "기준 레벨"에서 실제 화면에 보이는 값',
    cols: [
      C('이름', '도감 이름 그대로', 14, true), C('등급', '게임 표기 그대로 (예: 에픽)', 9), C('속성', '게임 표기 그대로', 8),
      C('역할', '탱커·딜러·힐러·버퍼·디버퍼', 9, false, L.role),
      C('기준 레벨', '아래 스탯을 읽은 레벨', 8, true), ...STAT_COLS,
      C('레벨당 체력', '알면 (레벨 1 차이 스탯 차)', 9), C('레벨당 공격력', '', 9), C('레벨당 방어력', '', 9), C('레벨당 속도', '', 9),
      C('액티브 스킬', '스킬 시트의 이름', 16), C('패시브 스킬', '여러 개면 | 로 구분', 22),
      C('시작 게이지', '전투 시작 때 게이지 (모르면 비움)', 9), C('메모', '', 24),
    ],
    example: ['(예시) 불꽃여우', '에픽', '화', '딜러', 30, 4200, 610, 180, 120, 15, 1.5, '', '', 90, 14, 4, '', '여우불', '불씨 축적|위기 각성', 0, '스탯은 30레벨 상세 화면'],
  },
  {
    name: '몬스터', desc: '던전에 나오는 적과 보스. 스킬은 게이지가 찰 때마다 쓰는 순서대로',
    cols: [
      C('이름', '던전에서 보이는 이름 (단계마다 다르면 이름에 단계 표시)', 16, true), C('보스', '예/아니오', 6, false, L.yesno),
      C('속성', '', 8), ...STAT_COLS,
      C('스킬 (순서대로)', '게이지가 찰 때마다 이 순서로, | 구분', 24), C('패시브 스킬', '| 구분', 18),
      C('시작 게이지', '', 9), C('게이지 최대', '아군과 다르면', 9), C('스킬 주기 관찰(초)', '스킬이 몇 초마다 나오는지 재 본 값', 11),
      C('페이즈', '체력%=스킬|스킬; … 예: 50=광폭화|화염폭풍', 22), C('그로기 최대', '흐트러짐 게이지가 있으면', 9), C('메모', '', 24),
    ],
    example: ['(예시) 고블린 족장 (3단계)', '예', '토', 52000, 900, 300, 90, '', '', '', '', '내려찍기|전원 돌격', '분노', 0, '', 12, '30=광폭화', '', '15초쯤 전원 돌격이 파티를 거의 전멸시킴'],
  },
  {
    name: '스킬', desc: '캐릭터·몬스터 시트에 적은 모든 스킬. 게임 설명을 그대로 붙여 넣고, 아는 만큼 수치로 나눠 적기',
    cols: [
      C('스킬 이름', '캐릭터·몬스터 시트와 같게', 14, true), C('사용자', '누구 스킬인지', 12), C('게임 설명 원문', '게임 문구 그대로 복사', 36),
      C('종류', '액티브/패시브', 8, false, L.kind), C('대상', '적·아군·자신', 7, false, L.target), C('범위', '단일·광역', 7, false, L.area),
      C('피해 배율(%)', '공격력의 몇 %, 피해 없으면 0', 9), C('타격 수', '여러 번 때리면', 7), C('그로기', '', 7),
      ...effectCols(1), ...effectCols(2), ...effectCols(3),
      C('패시브 발동 조건', '패시브만', 16, false, L.trigger), C('패시브 확률(%)', '비우면 100', 9), C('패시브 N(체력%)', '체력 N% 이하 조건일 때', 9),
      C('메모', '기타 효과 설명, 확인 못 한 점', 28),
    ],
    example: ['(예시) 불꽃 함성', '불꽃여우', '적 전체에게 공격력의 180% 피해를 주고, 2턴 동안 자신의 공격력이 25% 올라갑니다.', '액티브', '적', '광역', 180, 1, '', '공격력 증가 (약)', '자신', '', 2, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  },
  {
    name: '던전', desc: '한 행 = 몬스터 한 마리. 같은 던전·단계·웨이브의 행을 모아 적기',
    cols: [
      C('던전', '예: 진화 크리스탈 던전(불)', 20, true), C('단계', '난이도 단계 번호', 6, true), C('웨이브', '1부터', 6, true), C('슬롯', '1부터', 5),
      C('몬스터 이름', '몬스터 시트의 이름', 18, true), C('배치', '이 던전에서 선 자리', 8, false, L.row), C('시작 게이지', '이 던전에서만 다르면', 9),
      C('제한 시간(초)', '단계마다 한 번만 적어도 됨', 9), C('권장·열쇠 캐릭터', '던전이 안내하는 캐릭터, | 구분', 18),
      C('클리어 보상', '주요 성장 재료와 수량', 20), C('입장 조건', '해금 레벨·이전 단계 등', 14), C('메모', '', 24),
    ],
    example: ['(예시) 고블린 영토', 3, 3, 1, '고블린 족장 (3단계)', '전열', '', 90, '불꽃여우', '골드 12000, 진화석 3', '2단계 클리어', ''],
  },
  {
    name: '내 파티', desc: '플레이어 상태별 파티. 실제 내 계정과, 상상한 다른 상태(신규·중반 등)를 함께',
    cols: [
      C('상태 이름', '예: 내 계정 / 신규 3일차 / 중반 막힘', 16, true), C('슬롯', '1부터', 5), C('캐릭터 이름', '캐릭터 시트의 이름', 14, true),
      C('레벨', '', 6, true), C('배치', '이 파티에서 둔 자리', 8, true, L.row), C('장비·강화 메모', '스탯에 이미 반영됐는지도', 22),
      C('깬 최고 단계', '이 상태로 실제로 깬 던전·단계 (아는 것만)', 22), C('메모', '', 24),
    ],
    example: ['(예시) 내 계정', 1, '불꽃여우', 30, '후열', '스탯에 반영됨', '고블린 영토 2단계', ''],
  },
  {
    name: '관찰_피해', desc: '데미지 공식을 추측하지 않고 맞추기 위한 기록. 같은 공격자로 방어력이 다른 대상 여러 개면 가장 좋음',
    cols: [
      C('공격자', '', 14, true), C('공격자 공격력', '상세 화면 값', 9, true), C('평타/스킬', '', 8, false, L.hit), C('스킬 이름', '스킬이면', 12),
      C('대상', '', 14, true), C('대상 방어력', '알면', 9), C('속성 관계', '유리/불리/보통', 9), C('표시된 피해', '숫자 그대로', 9, true),
      C('치명타', '예/아니오', 7, false, L.yesno), C('버프·디버프 중', '걸려 있던 효과', 16), C('메모', '', 20),
    ],
    example: ['(예시) 불꽃여우', 610, '평타', '', '고블린', 120, '보통', 512, '아니오', '', ''],
  },
  {
    name: '관찰_스킬주기', desc: '게이지 속도를 맞추기 위한 기록. 전투 시작부터 초를 재기 (녹화 후 확인하면 정확)',
    cols: [
      C('유닛', '캐릭터 또는 몬스터', 14, true), C('속도', '상세 화면 값', 7, true), C('첫 스킬(초)', '전투 시작부터', 9, true),
      C('두 번째 스킬(초)', '', 9), C('세 번째 스킬(초)', '', 9), C('웨이브', '몇 웨이브에서 잰 값인지', 7),
      C('기절·흐트러짐 있었나', '있었다면 언제', 14), C('메모', '', 24),
    ],
    example: ['(예시) 불꽃여우', 120, 8.3, 16.6, 25.0, 1, '', ''],
  },
  {
    name: '관찰_전투결과', desc: '시뮬레이션이 실제와 맞는지 비교하는 기준. 실패한 판일수록 귀중함',
    cols: [
      C('던전', '', 18, true), C('단계', '', 6, true), C('파티 상태', '내 파티 시트의 상태 이름', 14, true), C('결과', '', 9, true, L.result),
      C('걸린 시간(초)', '', 9), C('도달 웨이브', '', 7), C('먼저 쓰러진 캐릭터', '순서대로 | 구분', 18),
      C('실패 원인 (보이는 대로)', '예: 15초 전원 돌격에 힐러 사망', 30), C('열쇠 스킬은 언제 나갔나', '초 또는 "위협보다 늦게" 등', 20), C('메모', '', 20),
    ],
    example: ['(예시) 고블린 영토', 3, '내 파티', '실패', 41, 3, '숲요정|불꽃여우', '보스 전원 돌격 2번째에 전멸', '보스 웨이브 9초 (돌격은 12초)', ''],
  },
  {
    name: '규칙 확인', desc: '아직 확인 안 된 전투 규칙. 답 칸만 채우기 (모르면 비움)', rules: true,
    cols: [C('질문', '', 52), C('답', '', 30), C('어떻게 확인했나', '', 30)],
    rows: [
      ['기절·흐트러짐 중에 게이지가 가득 차면 스킬이 바로 나가나요, 풀린 뒤에 나가나요?'],
      ['기절 중에도 게이지가 차나요?'],
      ['같은 순간 여러 명의 게이지가 차면 누가 먼저 쓰나요? (아군 먼저 / 속도 순 / 슬롯 순)'],
      ['웨이브가 넘어갈 때 버프·디버프·보호막이 남나요?'],
      ['웨이브가 넘어갈 때 평타 타이밍이 새로 시작하나요?'],
      ['보스 게이지는 속도로 차나요, 정해진 시간으로 차나요?'],
      ['명중·회피가 있나요? (빗나감 표시가 뜨나요)'],
      ['치명타가 있나요? 배율은?'],
      ['속성 상성 배율은? (유리 ×? / 불리 ×?) — 아래 "속성 상성" 시트에'],
      ['힐·보호막 수치는 무엇에 비례하나요? (시전자 공격력 / 최대 체력 / 고정)'],
      ['스킬 연출 중 정말로 모든 시간(지속 피해·버프 시간 포함)이 멈추나요?'],
      ['죽은 캐릭터의 버프(오라)는 사라지나요?'],
    ],
  },
  {
    name: '속성 상성', desc: '행 = 공격 속성, 열 = 방어 속성. A2·B1부터 속성 이름을 적고 배율 입력 (보통 1)', matrix: true,
  },
];

// ── OOXML ──
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (c) => { let s = ''; for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
// 스타일 번호 (아래 styles.xml cellXfs 순서)
const S = { head: 1, headReq: 2, hint: 3, example: 4, title: 5, wrap: 6, input: 7, matrixHead: 8 };
const cell = (r, c, v, s) => {
  const ref = `${colName(c)}${r}`;
  if (v === '' || v == null) return s ? `<c r="${ref}" s="${s}"/>` : '';
  if (typeof v === 'number') return `<c r="${ref}" s="${s || 0}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${s || 0}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
};
function sheetXml({ rows, widths, validations = [], freeze = 0, heights = {}, merges = [] }) {
  const o = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'];
  o.push(freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>');
  o.push('<sheetFormatPr defaultRowHeight="16.5"/>');
  if (widths.length) o.push('<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>');
  o.push('<sheetData>');
  for (const [r, cells] of rows) o.push(`<row r="${r}"${heights[r] ? ` ht="${heights[r]}" customHeight="1"` : ''}>${cells.join('')}</row>`);
  o.push('</sheetData>');
  if (merges.length) o.push(`<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`);
  if (validations.length) o.push(`<dataValidations count="${validations.length}">` + validations.map(([ref, list]) => `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${ref}"><formula1>${typeof list === 'string' ? esc(list) : `"${esc(list.join(','))}"`}</formula1></dataValidation>`).join('') + '</dataValidations>');
  o.push('</worksheet>');
  return o.join('');
}

const DATA_ROWS = 400;
function tableSheet(sh) {
  if (sh.matrix) {
    const rows = [[1, [cell(1, 1, '공격 ＼ 방어', S.matrixHead), ...[2, 3, 4, 5, 6, 7].map(c => cell(1, c, '', S.matrixHead))]]];
    for (let r = 2; r <= 7; r++) rows.push([r, [cell(r, 1, '', S.matrixHead), ...[2, 3, 4, 5, 6, 7].map(c => cell(r, c, '', S.input))]]);
    rows.push([9, [cell(9, 1, sh.desc, S.hint)]]);
    return sheetXml({ rows, widths: [14, 10, 10, 10, 10, 10, 10], merges: ['A9:G9'] });
  }
  const rows = [
    [1, sh.cols.map((c, i) => cell(1, i + 1, c.label + (c.req ? ' *' : ''), c.req ? S.headReq : S.head))],
    [2, sh.cols.map((c, i) => cell(2, i + 1, c.hint, S.hint))],
  ];
  if (sh.example) rows.push([3, sh.cols.map((c, i) => cell(3, i + 1, sh.example[i] ?? '', S.example))]);
  if (sh.rows) sh.rows.forEach((q, k) => rows.push([3 + k, [cell(3 + k, 1, q[0], S.wrap), cell(3 + k, 2, '', S.input), cell(3 + k, 3, '', S.input)]]));
  const validations = sh.cols.map((c, i) => (c.list ? [`${colName(i + 1)}3:${colName(i + 1)}${DATA_ROWS}`, c.list] : null)).filter(Boolean);
  return sheetXml({ rows, widths: sh.cols.map(c => c.width), validations, freeze: 2, heights: { 1: 33, 2: 30 } });
}

function guideSheet() {
  const lines = [
    ['전투 데이터 입력 템플릿', S.title],
    ['게임에서 모은 수치를 적어 두면 전투 시뮬레이터의 데이터 테이블로 옮겨 시뮬레이션합니다.', S.wrap],
    ['', 0],
    ['적는 순서 (위에서부터 필요한 만큼만)', S.head],
    ['① 던전 1개: 던전 시트에 단계별 웨이브 구성 → 몬스터 시트에 그 몬스터·보스 → 스킬 시트에 보스 스킬', S.wrap],
    ['② 그 던전의 열쇠 캐릭터와 내 파티 4~5명: 캐릭터 시트 + 스킬 시트, 내 파티 시트', S.wrap],
    ['③ 관찰 시트 세 개: 피해 몇 줄, 스킬 주기 몇 줄, 깨고 실패한 판 기록 — 시뮬레이션을 실제에 맞추는 기준', S.wrap],
    ['④ 2번 문항용 에픽 후보: 캐릭터 시트에 이름·스킬만이라도', S.wrap],
    ['', 0],
    ['적는 규칙', S.head],
    ['· 1행 주황 머리글(*)은 필수, 2행은 적는 법. 3행 "(예시)" 행은 지우지 않아도 가져올 때 건너뜁니다.', S.wrap],
    ['· 시트끼리는 이름으로 이어집니다. 스킬·몬스터·캐릭터 이름을 시트마다 똑같이 적어 주세요. 여러 개는 | 로 구분.', S.wrap],
    ['· 모르는 칸은 비우거나 ? 로. 추측해서 채우지 않고, 가져올 때 빈 칸 목록을 따로 확인합니다.', S.wrap],
    ['· 전열/후열은 캐릭터가 아니라 배치로 정해지므로 캐릭터·몬스터 시트에는 없고, 내 파티·던전 시트의 슬롯마다 적습니다.', S.wrap],
    ['· 스탯은 게임 상세 화면에 보이는 값 그대로 (장비·강화가 반영됐는지는 메모에).', S.wrap],
    ['· 피해 배율은 "공격력의 몇 %"로 (180% → 180). 지속은 턴 — 1턴 = 효과를 받은 몬몬이 스킬을 한 번 쓸 때.', S.wrap],
    ['· 스킬·패시브의 효과는 "버프" 시트의 이름을 드롭다운에서 고릅니다 (예: 공격력 증가 (약)). 약/강에 따라 수치가 정해져 있어 따로 적지 않아도 됩니다.', S.wrap],
    ['· 목록에 없는 효과(디버프, 정화, 게이지 증감 등)는 "기타"를 고르고 메모에 설명해 주세요. 효과는 스킬마다 3개까지.', S.wrap],
    ['· 스킬 설명은 게임 문구를 그대로 붙여 넣어 주세요. 캡처 이미지만 있어도 괜찮습니다.', S.wrap],
  ];
  const rows = lines.map(([t, s], i) => [i + 1, [cell(i + 1, 1, t, s)]]);
  return sheetXml({ rows, widths: [120], heights: { 1: 26 } });
}

/** 버프 시트: 스킬 효과 드롭다운의 원본. 이름 열(B)을 범위로 참조한다 */
function buffSheet() {
  const head = ['ID', '효과 이름', '버프', '단계', '수치', '효과 설명', '엔진'];
  const hint = ['', '스킬 시트에서 고르는 이름', '', '약·강·단일', '', '게임 설명 (수치 반영)', '시뮬레이터에 지금 있는지'];
  const rows = [
    [1, head.map((t, i) => cell(1, i + 1, t, S.head))],
    [2, hint.map((t, i) => cell(2, i + 1, t, S.hint))],
    ...BUFFS.map((b, k) => [3 + k, [b.id, b.name, b.buff, b.level, b.value !== '' ? `${b.value}${b.unit}` : '', b.desc, b.engine].map((v, i) => cell(3 + k, i + 1, v, i === 5 ? S.wrap : 0))]),
  ];
  const k = 3 + BUFFS.length;
  rows.push([k, ['OTHER', '기타', '', '', '', '목록에 없는 효과 — 스킬 시트 메모에 설명 (디버프 목록은 아직 없음)', ''].map((v, i) => cell(k, i + 1, v, i === 5 ? S.wrap : 0))]);
  return sheetXml({ rows, widths: [20, 18, 14, 6, 7, 60, 7], freeze: 2, heights: { 1: 33, 2: 30 } });
}

const ALL = [{ name: '안내', xml: guideSheet() }, ...SHEETS.flatMap(sh => [{ name: sh.name, xml: tableSheet(sh) }, ...(sh.name === '스킬' ? [{ name: BUFF_SHEET, xml: buffSheet() }] : [])])];

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="5">
<font><sz val="10"/><name val="맑은 고딕"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/><family val="2"/></font>
<font><sz val="9"/><color rgb="FF6B7280"/><name val="맑은 고딕"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="FF9CA3AF"/><name val="맑은 고딕"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="맑은 고딕"/><family val="2"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF374151"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFC2410C"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF5F5F4"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFBEB"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const files = [
  { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ALL.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
  { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
  { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${ALL.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
  { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ALL.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${ALL.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
  { name: 'xl/styles.xml', data: stylesXml },
  ...ALL.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml })),
];

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, makeZip(files));
console.log(`${out} — 시트 ${ALL.length}개: ${ALL.map(s => s.name).join(', ')}`);
