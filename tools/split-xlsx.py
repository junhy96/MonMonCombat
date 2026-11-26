"""분열 보스 시뮬레이션 검산용 엑셀 — docs/split-report/split-boss-sim.xlsx
입력값(이름 붙은 셀) → 수식으로 보스 단계표·아군 화력·1턴 창·전투 시간을 다시 계산하고,
몬테카를로 결과(tools/split-sim.mjs)는 DB 시트로 넣어 INDEX/MATCH·SUMIFS·AVERAGEIFS 로 요약.
실행: node tools/split-report.mjs && node tools/split-criteria.mjs && python tools/split-xlsx.py
맨 앞 「대시보드」: 드롭다운 · ☑/☐ 칸을 바꾸면 카드 · 그래프가 수식으로 바로 바뀜. 머리글마다 메모, 이름 붙은 범위는 시트 옆 범례 + 「이름 목록」.
"""
from xlsx_notes import NOTES  # 머리글 메모 문구 (tools/xlsx_notes.py)
import csv
import json
import re
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.text import RichText, Text
from openpyxl.chart.title import Title
from openpyxl.drawing.text import CharacterProperties, Paragraph, ParagraphProperties, RegularTextRun
from openpyxl.formatting.rule import FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.table import Table, TableStyleInfo

ROOT = Path(__file__).resolve().parent.parent
REP = ROOT / "docs/split-report"
OUT = REP / "split-boss-sim.xlsx"

F = "맑은 고딕"
F_BODY = Font(name=F, size=10)
F_IN = Font(name=F, size=10, color="0000FF")          # 입력값 (파란 글씨)
F_LINK = Font(name=F, size=10, color="008000")        # 다른 시트에서 가져온 값 (초록)
F_HEAD = Font(name=F, size=10, bold=True, color="FFFFFF")
F_TITLE = Font(name=F, size=14, bold=True)
F_NOTE = Font(name=F, size=9, italic=True, color="666666")
F_BOLD = Font(name=F, size=10, bold=True)
FILL_HEAD = PatternFill("solid", fgColor="2E2A5A")
FILL_IN = PatternFill("solid", fgColor="FFF7D6")
FILL_KEY = PatternFill("solid", fgColor="E8F3E8")
THIN = Side(style="thin", color="D0D4E2")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")


NAMES = []        # (이름, 시트, 범위, 뜻) — 범례 · 이름 목록에 씀
MISSING = set()   # 메모 문구가 없는 머리글 (빌드 때 경고)


def memo(cell, text):
    c = Comment(text, "기획")
    c.width, c.height = 330, 40 + 18 * (len(text) // 26 + text.count(chr(10)) + 1)
    cell.comment = c


def head(ws, row, cols, widths=None, col0=1):
    for i, h in enumerate(cols, col0):
        c = ws.cell(row, i, h)
        c.font, c.fill, c.border = F_HEAD, FILL_HEAD, BOX
        note = NOTES.get((ws.title, h)) or NOTES.get(h)
        if note:
            memo(c, note)
        else:
            MISSING.add((ws.title, h))
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 32
    if widths:
        for i, w in enumerate(widths, col0):
            ws.column_dimensions[get_column_letter(i)].width = w


def put(ws, r, c, v, font=F_BODY, fmt=None, fill=None, wrap=False):
    cell = ws.cell(r, c, v)
    cell.font, cell.border = font, BOX
    if fmt:
        cell.number_format = fmt
    if fill:
        cell.fill = fill
    if wrap:
        cell.alignment = WRAP
    return cell


def name(wb, nm, ref, desc=""):
    wb.defined_names[nm] = DefinedName(nm, attr_text=ref)
    sh, rng = ref.rsplit("!", 1)
    NAMES.append((nm, sh.strip("'"), rng.replace("$", ""), desc))


def table(ws, ref, nm):
    t = Table(displayName=nm, ref=ref)
    t.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True)
    ws.add_table(t)


# ── 몬스터 · 몬몬 · 대시보드 ──────────────────────────────
DUNGEONS = ["white-crystal", "green-crystal", "red-crystal", "blue-crystal", "purple-crystal", "wind-canyon", "undead-castle", "ice-fortress", "goblin-territory"]
PARTIES = [("base", "기준 파티"), ("ctrl", "대조군"), ("tok", "톡찌리"), ("mong", "몽실벌"), ("chot", "촛동"), ("duo", "톡찌리 + 몽실벌")]
BANDS = ["초반 1~6", "중반 7~15", "후반 16~20"]
GRADES = ["전설", "에픽", "레어", "고급", "일반"]
FILL_SEL = PatternFill("solid", fgColor="FFF2B3")
PURPLE = "615BAE"


def rows_of(p):
    return list(csv.DictReader((ROOT / p).open(encoding="utf-8-sig")))


def build_monsters(wb):
    # 보스 스탯 DB (긴 표: 보스 × 단계)
    ws = wb.create_sheet("보스 스탯 DB")
    cols = ["보스", "단계", "보스 레벨", "체력", "공격력", "방어력", "속도", "효과저항", "효과명중", "출처"]
    head(ws, 1, cols, [10, 6, 8, 12, 9, 9, 7, 8, 8, 46])
    r = 2
    for d in DUNGEONS:
        boss = rows_of(f"data/dungeons/{d}/boss-stats.csv")[0]["보스"]
        for x in rows_of(f"data/dungeons/{d}/boss-stats-full.csv"):
            vals = [boss, int(x["단계"]), int(x["보스 레벨"]), int(x["체력"]), int(x["공격력"]), int(x["방어력"]), int(x["속도"]), int(x["효과저항"]), int(x["효과명중"]), x.get("체력·공격력·방어력 출처") or x.get("체력·공격력 출처", "")]
            for j, v in enumerate(vals, 1):
                put(ws, r, j, v, font=F_IN if 4 <= j <= 9 else F_BODY, fmt="#,##0" if j in (4, 5, 6) else None)
            r += 1
    for s in range(1, 21):   # 쿼디는 보스 단계표에서 수식으로 (전체 체력 = 한 몸 + 4마리)
        M = f"MATCH(B{r},'보스 단계표'!$A:$A,0)"
        put(ws, r, 1, "쿼디")
        put(ws, r, 2, s)
        for j, col in [(3, "B"), (4, "J"), (5, "K"), (6, "F")]:
            put(ws, r, j, f"=INDEX('보스 단계표'!${col}:${col},{M})", font=F_LINK, fmt="#,##0")
        put(ws, r, 7, 100)
        put(ws, r, 8, f"=INDEX('보스 단계표'!$L:$L,{M})", font=F_LINK)
        put(ws, r, 9, 0)
        put(ws, r, 10, "기획값 — 체력은 전체 체력(한 몸 + 4마리), 공격력은 분열체 스탯 후보")
        r += 1
    last = bl = r - 1   # SUMIFS 합계 범위는 B_NAME 과 같은 크기여야 함
    table(ws, f"A1:J{last}", "보스스탯")
    name(wb, "B_NAME", f"'보스 스탯 DB'!$A$2:$A${last}", "보스 이름")
    name(wb, "B_STAGE", f"'보스 스탯 DB'!$B$2:$B${last}", "단계 (1~20)")
    name(wb, "B_HP", f"'보스 스탯 DB'!$D$2:$D${last}", "체력 (쿼디는 전체 체력)")
    ws.conditional_formatting.add(f"A2:J{last}", FormulaRule(formula=["$A2=SEL_BOSS"], fill=FILL_SEL))
    ws.freeze_panes = "A2"

    # 몬스터 DB (보스 10종) — 보스 스탯 DB 앞에 둠
    ws = wb.create_sheet("몬스터 DB", wb.sheetnames.index("보스 스탯 DB"))
    cols = ["보스", "던전", "속성", "기믹 축", "보스가 거는 압박", "해결 기믹 (열쇠)", "열쇠 효과", "열쇠를 막는 장치", "소환", "단계가 오르면",
            "1단계 체력", "10단계 체력", "20단계 체력", "10단계 공격력", "10단계 방어력", "10단계 속도", "자료 단계 수"]
    head(ws, 1, cols, [10, 18, 8, 16, 44, 40, 24, 34, 18, 30, 11, 11, 12, 10, 10, 9, 9])
    gd = json.loads((ROOT / "data/dungeons/split-boss/guide.json").read_text(encoding="utf-8"))
    recs = []
    for g in rows_of("data/dungeons/boss-gimmicks.csv"):
        nm, el = re.match(r"(.+?) \((.+)\)", g["보스 (속성)"]).groups()
        recs.append([nm, g["던전"], el, g["기믹 축"], g["보스가 거는 압박"], g["해결 기믹 (열쇠)"], g["공략이 지목한 열쇠 효과"], g["보스가 열쇠를 막는 장치"], g["소환"], g["단계가 오르면"]])
    recs.append(["쿼디", gd["island"], gd["race"], "분열 + 부활 (함께 쓰러뜨리기)",
                 "쓰러지면 [쿼디 조각] 4마리로 분열, 15초(속도 무관) 안에 다 못 쓰러뜨리면 부활하며 공격력 +10%. 7단계부터 반격 자세 · 느려짐",
                 "[부활 차단]으로 부활을 막거나, 피해 반사 · 은신으로 버티며 조각을 함께 쓰러뜨린다",
                 "부활 차단 · 피해 반사 (강) · 은신", "다수 공격엔 반격 (은신이면 빗나감) · 다수 공격 피해 감소 30~50% · 부활 타이머는 속도 무관",
                 "쿼디 조각 4 (단단한 2 · 흐물 2)", "7단계 반격 · 느려짐 2겹, 16단계 느려짐 3겹 · 조각 체력 배율↑"])
    for i, rec in enumerate(recs, 2):
        for j, v in enumerate(rec, 1):
            put(ws, i, j, v, wrap=j >= 4)
        for j, st, col in [(11, 1, "D"), (12, 10, "D"), (13, 20, "D"), (14, 10, "E"), (15, 10, "F"), (16, 10, "G")]:
            put(ws, i, j, f"=IF(COUNTIFS(B_NAME,$A{i},B_STAGE,{st})=0,\"\",SUMIFS('보스 스탯 DB'!${col}$2:${col}${bl},B_NAME,$A{i},B_STAGE,{st}))", font=F_LINK, fmt="#,##0")
        put(ws, i, 17, f"=COUNTIF(B_NAME,$A{i})", font=F_LINK)
        ws.row_dimensions[i].height = 62
    last = len(recs) + 1
    table(ws, f"A1:Q{last}", "몬스터")
    name(wb, "BOSS_LIST", f"'몬스터 DB'!$A$2:$A${last}", "보스 10종 이름 — 대시보드 「보스 비교」 드롭다운 목록")
    ws.conditional_formatting.add(f"A2:Q{last}", FormulaRule(formula=["$A2=SEL_BOSS"], fill=FILL_SEL))
    ws.cell(last + 2, 1, "기믹은 data/dungeons/boss-gimmicks.csv (공략 창 정리), 쿼디는 문항 2 기획값. 체력 · 공격력 등은 「보스 스탯 DB」에서 SUMIFS. 노란 줄 = 대시보드에서 고른 보스.").font = F_NOTE
    ws.freeze_panes = "B2"


def build_monmon(wb):
    mons = rows_of("data/monmon/monmon.csv")
    sk = {}
    for x in rows_of("data/monmon/skills.csv"):
        sk.setdefault(x["몬몬"], []).append(x)
    eff_of, hits_of, aoe_of = {}, {}, {}
    for m in mons:
        es, hits, aoe = [], 0, False
        for x in sk.get(m["이름"], []):
            for k in range(1, 5):
                e = x.get(f"효과{k}", "")
                if e and e not in es:
                    es.append(e)
            if x["종류"] in ("기본공격", "스킬"):
                for h in re.findall(r"(\d+)\s*회", x["설명"]):
                    hits = max(hits, int(h))
                aoe = aoe or "모든 적" in x["설명"]
        eff_of[m["이름"]], hits_of[m["이름"]], aoe_of[m["이름"]] = es, hits, aoe

    def tokens(nm):
        t = []
        if hits_of[nm] >= 2:
            t.append("다회 공격")
        if aoe_of[nm]:
            t.append("모든 적 공격")
        for e in eff_of[nm]:
            b = re.sub(r" \((강|약)\)$", "", e)
            for v in (b, e):
                if v not in t:
                    t.append(v)
        return t

    # 효과 목록 순서: 다회 · 모든 적 → 기본 이름(보유 몬몬 많은 순) → (강) (약)
    cnt = {}
    for m in mons:
        for t in tokens(m["이름"]):
            cnt[t] = cnt.get(t, 0) + 1
    bases = sorted({re.sub(r" \((강|약)\)$", "", t) for t in cnt if t not in ("다회 공격", "모든 적 공격")}, key=lambda b: (-cnt.get(b, 0), b))
    order = ["다회 공격", "모든 적 공격"]
    for b in bases:
        order.append(b)
        order += [v for v in (f"{b} (강)", f"{b} (약)") if v in cnt]

    ws = wb.create_sheet("몬몬 DB")
    cols = ["번호", "이름", "등급", "역할", "거리", "속성", "체력", "공격력", "방어력", "속도", "치명확률(%)", "치명피해(%)", "효과저항", "효과명중",
            "기본공격", "스킬", "패시브(★3)", "패시브(★5)", "최대 타수", "모든 적 공격", "효과 수", "효과 (검색용)", "선택 효과 순번"]
    head(ws, 1, cols, [6, 10, 6, 6, 7, 7, 8, 8, 8, 6, 8, 8, 8, 8, 13, 13, 13, 13, 8, 8, 7, 60, 9])
    for i, m in enumerate(mons, 2):
        nm = m["이름"]
        vals = [m["번호"], nm, m["등급"], m["역할"], m["거리"], m["속성"]] + [int(m[k]) for k in ("체력", "공격력", "방어력", "속도", "치명확률(%)", "치명피해(%)", "효과저항", "효과명중")] \
            + [m["기본공격"], m["스킬"], m["패시브(★3)"], m["패시브(★5)"], hits_of[nm] or "", "O" if aoe_of[nm] else "", len(eff_of[nm]), "· " + " · ".join(tokens(nm)) + " ·"]
        for j, v in enumerate(vals, 1):
            put(ws, i, j, v, font=F_IN if 7 <= j <= 14 else F_BODY, fmt="#,##0" if 7 <= j <= 9 else None)
        put(ws, i, 23, f'=IF(ISNUMBER(SEARCH("· "&SEL_EFFECT&" ·",V{i})),MAX(W$1:W{i - 1})+1,"")')
    last = len(mons) + 1
    table(ws, f"A1:W{last}", "몬몬")
    name(wb, "M_NAME", f"'몬몬 DB'!$B$2:$B${last}", "몬몬 이름")
    name(wb, "M_GRADE", f"'몬몬 DB'!$C$2:$C${last}", "등급 (전설 · 에픽 · 레어 · 고급 · 일반)")
    name(wb, "M_EFF", f"'몬몬 DB'!$V$2:$V${last}", "몬몬이 가진 효과 목록 (「· 효과 ·」 형태, COUNTIFS 검색용)")
    name(wb, "M_ORDER", f"'몬몬 DB'!$W$2:$W${last}", "대시보드에서 고른 효과를 가진 몬몬의 순번 (1, 2, 3 …)")
    ws.conditional_formatting.add(f"A2:W{last}", FormulaRule(formula=['$W2<>""'], fill=FILL_SEL))
    ws.cell(last + 2, 1, "효과 (검색용) = 스킬 · 패시브의 효과1~4 (강/약을 뗀 이름도 함께) + 「다회 공격」(설명에 N회 피해, 2회 이상) + 「모든 적 공격」(기본공격 · 스킬 설명에 모든 적). 노란 줄 = 대시보드에서 고른 효과를 가진 몬몬. 출처 data/monmon/monmon.csv · skills.csv (도감 OCR)").font = F_NOTE
    ws.freeze_panes = "C2"

    ws = wb.create_sheet("효과 목록")
    head(ws, 1, ["효과", "보유 몬몬 수"] + GRADES, [20, 11, 7, 7, 7, 7, 7])
    for i, e in enumerate(order, 2):
        put(ws, i, 1, e, font=F_BODY if re.search(r"\((강|약)\)$", e) else F_BOLD)
        crit = f'"*· "&$A{i}&" ·*"'
        put(ws, i, 2, f"=COUNTIFS(M_EFF,{crit})")
        for j, g in enumerate(GRADES, 3):
            put(ws, i, j, f'=COUNTIFS(M_EFF,{crit},M_GRADE,"{g}")')
    last = len(order) + 1
    table(ws, f"A1:G{last}", "효과")
    name(wb, "EFFECT_LIST", f"'효과 목록'!$A$2:$A${last}", "효과 이름 목록 — 대시보드 「열쇠 효과」 드롭다운 목록")
    ws.conditional_formatting.add(f"A2:G{last}", FormulaRule(formula=["$A2=SEL_EFFECT"], fill=FILL_SEL))
    ws.cell(last + 2, 1, "굵은 글씨 = 강/약을 합친 이름. 숫자는 몬몬 DB에서 COUNTIFS 로 셈. 노란 줄 = 대시보드에서 고른 효과.").font = F_NOTE
    ws.freeze_panes = "B2"


def build_dash(wb):
    calc = wb.create_sheet("대시보드 계산")
    ws = wb.create_sheet("대시보드", 0)
    D = "'대시보드'!"
    controls = [  # (행, 라벨, 기본값, 목록, 이름, 뜻)
        (5, "구간", "중반 7~15", '"' + ",".join(BANDS) + '"', "SEL_BAND", "고른 구간 (초반 · 중반 · 후반)"),
        (6, "열쇠 파티", "톡찌리", '"톡찌리,몽실벌,촛동,톡찌리 + 몽실벌"', "SEL_KEY", "카드에서 대조군과 비교할 열쇠 파티"),
        (7, "단계", 10, '"' + ",".join(str(i) for i in range(1, 21)) + '"', "SEL_STAGE", "고른 단계 (1~20)"),
        (8, "보스 비교", "글라틀", "=BOSS_LIST", "SEL_BOSS", "체력을 쿼디와 비교하고 기믹을 볼 보스"),
        (9, "열쇠 효과", "부활 차단", "=EFFECT_LIST", "SEL_EFFECT", "보유 몬몬을 셀 효과"),
    ]
    ws.sheet_view.showGridLines = False
    for col, w in {"A": 2, "B": 17, "C": 34, "D": 3}.items():
        ws.column_dimensions[col].width = w
    for c in range(5, 19):
        ws.column_dimensions[get_column_letter(c)].width = 9.5
    ws["B2"] = "분열 보스(쿼디) 시뮬레이션 대시보드"
    ws["B2"].font = Font(name=F, size=18, bold=True, color="2A2740")
    ws["B3"] = "노란 칸을 바꾸면 카드 · 그래프가 바로 바뀝니다 — 드롭다운(▼)으로 고르고, 파티 표시는 ☑ 켜기 / ☐ 끄기"
    ws["B3"].font = Font(name=F, size=10, color="70707A")
    fill_p = PatternFill("solid", fgColor=PURPLE)

    def band(r, text):
        ws.merge_cells(f"B{r}:C{r}")
        ws[f"B{r}"] = text
        ws[f"B{r}"].font, ws[f"B{r}"].fill = F_HEAD, fill_p

    band(4, "조작")
    for r, lab, v, lst, nm, desc in controls:
        put(ws, r, 2, lab, font=F_BOLD)
        c = put(ws, r, 3, v, font=Font(name=F, size=11, bold=True, color="0000FF"), fill=FILL_IN)
        dv = DataValidation(type="list", formula1=lst, allow_blank=False)
        dv.promptTitle, dv.prompt, dv.showInputMessage = lab, desc, True
        ws.add_data_validation(dv)
        dv.add(c)
        name(wb, nm, f"{D}$C${r}", desc)
        memo(ws.cell(r, 2), f"{desc}. 오른쪽 노란 칸에서 ▼ 로 고름.\n수식 이름: {nm}")
    band(11, "파티 표시 (☑ / ☐)")
    chk = DataValidation(type="list", formula1='"☑,☐"', allow_blank=False)
    chk.promptTitle, chk.prompt, chk.showInputMessage = "파티 표시", "☑ = 그래프에 보임, ☐ = 숨김", True
    ws.add_data_validation(chk)
    for i, (k, p) in enumerate(PARTIES):
        r = 12 + i
        put(ws, r, 2, p)
        c = put(ws, r, 3, "☑", font=Font(name=F, size=13, bold=True, color=PURPLE), fill=FILL_IN)
        c.alignment = Alignment(horizontal="center")
        chk.add(c)
    name(wb, "SHOW_PARTY", f"{D}$C$12:$C$17", "파티 표시 칸 6개 (☑/☐) — 위에서부터 기준 파티 · 대조군 · 톡찌리 · 몽실벌 · 촛동 · 톡찌리 + 몽실벌")
    memo(ws["B11"], "☑/☐ 를 바꾸면 클리어율 · 클리어 시간 · 체력별 · 속도 그래프에서 그 파티가 보이거나 사라짐.\n수식 이름: SHOW_PARTY")

    # ── 계산 시트 ──
    C = "'대시보드 계산'!"
    calc["A1"] = "대시보드가 쓰는 계산 — 여기는 고치지 말고 대시보드의 노란 칸을 바꾸세요"
    calc["A1"].font = F_BOLD
    head(calc, 3, ["구간 목록", "구간 순서"], [16, 14, 14, 13, 13, 14, 14])
    for i, b in enumerate(BANDS, 4):
        put(calc, i, 1, b)
        put(calc, i, 2, i - 3)
    put(calc, 8, 1, "선택 구간 순서", font=F_BOLD)
    put(calc, 8, 2, "=SUMPRODUCT(($A$4:$A$6=SEL_BAND)*$B$4:$B$6)")  # MATCH 는 「~」를 와일드카드로 읽어 못 씀
    put(calc, 9, 1, "선택 열쇠 파티 키", font=F_BOLD)
    put(calc, 9, 2, "=INDEX($A$12:$A$17,MATCH(SEL_KEY,$B$12:$B$17,0))")
    name(wb, "SEL_ORDER", f"{C}$B$8", "고른 구간의 순서 번호 (1 초반 · 2 중반 · 3 후반)")
    name(wb, "SEL_KEYK", f"{C}$B$9", "고른 열쇠 파티의 키 (tok · mong · chot · duo)")
    head(calc, 11, ["파티 키", "파티", "표시", "클리어율 (%)", "클리어 시간 (초)", "그래프: 클리어율 (%)", "그래프: 클리어 시간 (초)"])
    for i, (k, p) in enumerate(PARTIES):
        r = 12 + i
        put(calc, r, 1, k)
        put(calc, r, 2, p)
        put(calc, r, 3, f'={D}$C${r}="☑"')
        put(calc, r, 4, f'=SUMIFS(R_CLEAR,R_TABLE,"구간",R_ORDER,SEL_ORDER,R_KEY,$A{r})', fmt="0.0")
        put(calc, r, 5, f'=SUMIFS(R_TIME,R_TABLE,"구간",R_ORDER,SEL_ORDER,R_KEY,$A{r})', fmt="0")
        put(calc, r, 6, f"=IF($C{r},D{r},NA())", fmt="0.0")
        put(calc, r, 7, f"=IF($C{r},E{r},NA())", fmt="0")
    hps = sorted({int(x["hp"]) for x in json.loads((REP / "sweep.json").read_text(encoding="utf-8"))["rows"]})
    head(calc, 20, ["분열체 체력"] + [p for _, p in PARTIES])
    for i, hp in enumerate(hps, 21):
        put(calc, i, 1, hp, fmt="#,##0")
        for j, (k, _) in enumerate(PARTIES):
            put(calc, i, 2 + j, f'=IF($C${12 + j},SUMIFS(R_CLEAR,R_TABLE,"체력별",R_HP,$A{i},R_KEY,"{k}"),NA())', fmt="0.0")
    hp_last = 20 + len(hps)
    SY = 29
    head(calc, SY, ["속도 설정"] + [p for _, p in PARTIES])
    for i, lab in enumerate(["원래 속도", "전원 110", "전원 120"], 1):
        r = SY + i
        put(calc, r, 1, lab)
        for j, (k, _) in enumerate(PARTIES):
            put(calc, r, 2 + j, f'=IF(COUNTIFS(R_TABLE,"속도",R_ORDER,{i},R_KEY,"{k}")*$C${12 + j}=0,NA(),SUMIFS(R_CLEAR,R_TABLE,"속도",R_ORDER,{i},R_KEY,"{k}"))', fmt="0.0")
    ST = 35
    head(calc, ST, ["단계", "쿼디 전체 체력", "선택 보스 체력", "선택 단계 (쿼디)", "선택 단계 (보스)"])
    for s in range(1, 21):
        r = ST + s
        put(calc, r, 1, s)
        put(calc, r, 2, f"=INDEX('보스 단계표'!$J:$J,MATCH(A{r},'보스 단계표'!$A:$A,0))", fmt="#,##0")
        put(calc, r, 3, f"=IF(COUNTIFS(B_NAME,SEL_BOSS,B_STAGE,A{r})=0,NA(),SUMIFS(B_HP,B_NAME,SEL_BOSS,B_STAGE,A{r}))", fmt="#,##0")
        put(calc, r, 4, f"=IF(A{r}=SEL_STAGE,B{r},NA())", fmt="#,##0")
        put(calc, r, 5, f"=IF(A{r}=SEL_STAGE,C{r},NA())", fmt="#,##0")
    EG = 58
    head(calc, EG, ["등급", "선택 효과 보유 몬몬 수", "등급 전체 몬몬 수", "비율"])
    for i, g in enumerate(GRADES, EG + 1):
        put(calc, i, 1, g)
        put(calc, i, 2, f'=COUNTIFS(M_GRADE,$A{i},M_EFF,"*· "&SEL_EFFECT&" ·*")')
        put(calc, i, 3, f"=COUNTIF(M_GRADE,$A{i})")
        put(calc, i, 4, f"=IF(C{i}=0,0,B{i}/C{i})", fmt="0%")

    # ── 카드 ──
    def card(c1, c2, label, value, fmt, sub, note):
        for r in (5, 6, 7):
            ws.merge_cells(f"{c1}{r}:{c2}{r}")
            for cc in range(ws[f"{c1}{r}"].column, ws[f"{c2}{r}"].column + 1):
                ws.cell(r, cc).fill = PatternFill("solid", fgColor="F3F2FA")
        a, b, s = ws[f"{c1}5"], ws[f"{c1}6"], ws[f"{c1}7"]
        a.value, a.font = label, Font(name=F, size=10, bold=True, color="70707A")
        b.value, b.number_format, b.font = value, fmt, Font(name=F, size=22, bold=True, color=PURPLE)
        s.value, s.font = sub, Font(name=F, size=9, color="70707A")
        for x in (a, b, s):
            x.alignment = Alignment(horizontal="center", vertical="center")
        memo(a, note)

    ws.row_dimensions[6].height = 34
    ctrl = 'SUMIFS(R_CLEAR,R_TABLE,"구간",R_ORDER,SEL_ORDER,R_KEY,"ctrl")'
    keyv = 'SUMIFS(R_CLEAR,R_TABLE,"구간",R_ORDER,SEL_ORDER,R_KEY,SEL_KEYK)'
    card("E", "G", "대조군 클리어율", f"={ctrl}/100", "0.0%", '=SEL_BAND&" · 열쇠 효과 없음"', "같은 화력 · 열쇠 효과만 없는 파티의 클리어율 (1,000판)")
    card("H", "J", '=SEL_KEY&" 클리어율"', f"={keyv}/100", "0.0%", "=SEL_BAND", "고른 열쇠 파티의 클리어율 (1,000판)")
    card("K", "M", "열쇠 효과 (대조군 대비)", f"={keyv}-{ctrl}", '+0.0"%p";-0.0"%p"', "같은 화력에서 열쇠 효과만 다름", "열쇠 파티 클리어율 − 대조군 클리어율 (%p)")
    card("N", "P", '=SEL_KEY&" 클리어 시간"', '=TEXT(SUMIFS(R_TIME,R_TABLE,"구간",R_ORDER,SEL_ORDER,R_KEY,SEL_KEYK)/86400,"m:ss")', "@", "목표 2:30~3:00 · 이긴 판 중앙값", "이긴 판의 클리어 시간 중앙값 (분:초)")

    # ── 왼쪽 정보 카드 ──
    def info(r0, title, items, h=None):
        band(r0, title)
        for i, (lab, f_, fmt) in enumerate(items, r0 + 1):
            put(ws, i, 2, lab, font=F_BOLD)
            put(ws, i, 3, f_, font=F_LINK, fmt=fmt, wrap=bool(h))
            if h:
                ws.row_dimensions[i].height = h

    M = "MATCH(SEL_STAGE,'보스 단계표'!$A:$A,0)"
    st = [("구간", f"=INDEX('보스 단계표'!$C:$C,{M})", None), ("한 몸 체력", f"=INDEX('보스 단계표'!$H:$H,{M})", "#,##0"),
          ("분열체 체력 (1마리)", f"=INDEX('보스 단계표'!$I:$I,{M})", "#,##0"), ("전체 체력", f"=INDEX('보스 단계표'!$J:$J,{M})", "#,##0"),
          ("단일 스킬 피해", f"=INDEX('보스 단계표'!$R:$R,{M})", "#,##0"), ("모든 적 스킬 피해", f"=INDEX('보스 단계표'!$S:$S,{M})", "#,##0"),
          ("반격 피해", f"=INDEX('보스 단계표'!$T:$T,{M})", "#,##0"), ("느려짐 최대 겹", f"=INDEX('보스 단계표'!$O:$O,{M})", "0"),
          ("선택 보스 체력", "=IF(COUNTIFS(B_NAME,SEL_BOSS,B_STAGE,SEL_STAGE)=0,\"자료 없음\",SUMIFS(B_HP,B_NAME,SEL_BOSS,B_STAGE,SEL_STAGE))", "#,##0"),
          ("쿼디 ÷ 선택 보스", "=IFERROR(C23/C28,\"\")", '0.00"배"')]
    info(19, "선택 단계 — 쿼디", st)
    memo(ws["B19"], "「단계」에서 고른 단계의 쿼디 스탯 (보스 단계표에서 INDEX/MATCH) + 같은 단계 「보스 비교」 보스의 체력")
    B = "MATCH(SEL_BOSS,'몬스터 DB'!$A:$A,0)"
    bi = [("던전", f"=INDEX('몬스터 DB'!$B:$B,{B})", None), ("기믹 축", f"=INDEX('몬스터 DB'!$D:$D,{B})", None),
          ("보스가 거는 압박", f"=INDEX('몬스터 DB'!$E:$E,{B})", None), ("열쇠 효과", f"=INDEX('몬스터 DB'!$G:$G,{B})", None),
          ("열쇠를 막는 장치", f"=INDEX('몬스터 DB'!$H:$H,{B})", None)]
    info(31, "선택 보스", bi, h=58)
    memo(ws["B31"], "「보스 비교」에서 고른 보스의 기믹 (몬스터 DB에서 INDEX/MATCH)")
    band(38, "선택 효과 보유 몬몬")
    memo(ws["B38"], "「열쇠 효과」에서 고른 효과를 가진 몬몬 (몬몬 DB 순서, 15마리까지). 전체는 몬몬 DB 의 노란 줄")
    put(ws, 39, 2, "보유 몬몬 수", font=F_BOLD)
    put(ws, 39, 3, '=COUNTIFS(M_EFF,"*· "&SEL_EFFECT&" ·*")&"마리"', font=F_LINK)
    put(ws, 40, 2, "이름", font=F_HEAD, fill=fill_p)
    put(ws, 40, 3, "등급 · 역할", font=F_HEAD, fill=fill_p)
    for k in range(1, 16):
        r = 40 + k
        put(ws, r, 2, f'=IFERROR(INDEX(M_NAME,MATCH({k},M_ORDER,0)),"")')
        put(ws, r, 3, f"=IFERROR(INDEX(M_GRADE,MATCH({k},M_ORDER,0))&\" · \"&INDEX('몬몬 DB'!$D$2:$D$300,MATCH({k},M_ORDER,0)),\"\")")

    # ── 그래프 ──
    def style(ch, title, ytitle=None):
        cp = CharacterProperties(sz=1100, b=True)
        ch.title = Title(tx=Text(rich=RichText(p=[Paragraph(pPr=ParagraphProperties(defRPr=cp), r=[RegularTextRun(rPr=cp, t=title)])])), overlay=False)
        ch.style, ch.width, ch.height = 10, 13.2, 7.6
        ch.y_axis.number_format = "0"
        ch.x_axis.delete = False
        ch.y_axis.delete = False
        if ytitle:
            ch.y_axis.title = ytitle
        ch.legend.position = "b"
        return ch

    ch = style(BarChart(), "선택 구간 · 파티별 클리어율 (%)", "%")
    ch.add_data(Reference(calc, min_col=6, min_row=11, max_row=17), titles_from_data=True)
    ch.set_categories(Reference(calc, min_col=2, min_row=12, max_row=17))
    ch.y_axis.scaling.min, ch.y_axis.scaling.max = 0, 100
    ch.legend = None
    ch.series[0].graphicalProperties.solidFill = PURPLE
    ws.add_chart(ch, "E9")
    ch = style(BarChart(), "선택 구간 · 클리어 시간 (초, 이긴 판 중앙값)", "초")
    ch.add_data(Reference(calc, min_col=7, min_row=11, max_row=17), titles_from_data=True)
    ch.set_categories(Reference(calc, min_col=2, min_row=12, max_row=17))
    ch.legend = None
    ch.series[0].graphicalProperties.solidFill = "3E7E92"
    ws.add_chart(ch, "L9")
    ch = style(LineChart(), "분열체 체력별 클리어율 (중반 설정, %)", "%")
    ch.add_data(Reference(calc, min_col=2, max_col=7, min_row=20, max_row=hp_last), titles_from_data=True)
    ch.set_categories(Reference(calc, min_col=1, min_row=21, max_row=hp_last))
    ch.y_axis.scaling.min, ch.y_axis.scaling.max = 0, 100
    for se in ch.series:
        se.smooth = False
        se.marker.symbol = "circle"
    ws.add_chart(ch, "E25")
    ch = style(BarChart(), "속도를 맞춘 파티 클리어율 (중반, %)", "%")
    ch.add_data(Reference(calc, min_col=2, max_col=7, min_row=SY, max_row=SY + 3), titles_from_data=True)
    ch.set_categories(Reference(calc, min_col=1, min_row=SY + 1, max_row=SY + 3))
    ch.y_axis.scaling.min, ch.y_axis.scaling.max = 0, 100
    ws.add_chart(ch, "L25")
    ch = style(LineChart(), "단계별 체력 — 쿼디 전체 vs 선택 보스 (로그 눈금)")
    ch.add_data(Reference(calc, min_col=2, max_col=5, min_row=ST, max_row=ST + 20), titles_from_data=True)
    ch.set_categories(Reference(calc, min_col=1, min_row=ST + 1, max_row=ST + 20))
    ch.y_axis.scaling.logBase = 10
    ch.y_axis.scaling.min = 10000
    ch.y_axis.number_format = "#,##0"
    for sidx, color in enumerate([PURPLE, "888892", PURPLE, "888892"]):
        se = ch.series[sidx]
        se.smooth = False
        se.graphicalProperties.line.solidFill = color
        se.graphicalProperties.line.width = 28000 if sidx < 2 else 12700
        if sidx >= 2:   # 선택 단계에만 큰 점
            se.marker.symbol, se.marker.size = "circle", 11
            se.marker.graphicalProperties.solidFill = "F2B705" if sidx == 2 else "B5423A"
            se.marker.graphicalProperties.line.solidFill = "2A2740"
            se.graphicalProperties.line.noFill = True
        else:
            se.marker.symbol = "none"
    ws.add_chart(ch, "E37")
    ch = style(BarChart(), "선택 효과 보유 몬몬 — 등급별 (마리)", "마리")
    ch.add_data(Reference(calc, min_col=2, min_row=EG, max_row=EG + 5), titles_from_data=True)
    ch.set_categories(Reference(calc, min_col=1, min_row=EG + 1, max_row=EG + 5))
    ch.legend = None
    ch.series[0].graphicalProperties.solidFill = "8A7A33"
    ws.add_chart(ch, "L37")
    ws.freeze_panes = "A4"
    ws.page_setup.orientation = "landscape"
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 1
    ws.print_area = "A1:R56"


def finish_names(wb):
    """이름 붙은 범위: 머리글 메모에 이름 덧붙이기 + 시트 오른쪽 범례 + 「이름 목록」 시트"""
    by = {}
    for nm, sh, rng, desc in NAMES:
        by.setdefault(sh, []).append((nm, rng, desc))
        m = re.fullmatch(r"([A-Z]+)2:\1(\d+)", rng)
        if m:   # 열 하나에 붙은 이름이면 그 열 머리글 메모에도 적음
            c = wb[sh][f"{m.group(1)}1"]
            if c.comment:
                memo(c, c.comment.text + f"\n수식 이름: {nm}")
    LEG_COL = {"대시보드": 20}
    for sh, items in by.items():
        ws = wb[sh]
        c0 = LEG_COL.get(sh, ws.max_column + 2)
        t = ws.cell(1, c0, "이 시트의 이름 (수식에서 쓰는 범위)" if sh != "입력값" else "이 시트의 이름 — B열 값마다 E열 이름이 붙어 있음")
        t.font = Font(name=F, size=10, bold=True, color=PURPLE)
        head(ws, 2, ["이름", "범위", "뜻"], [14, 12, 52], col0=c0)
        for i, (nm, rng, desc) in enumerate(items, 3):
            put(ws, i, c0, nm, font=F_BOLD)
            cell = put(ws, i, c0 + 1, rng, font=F_LINK)
            cell.hyperlink = f"#'{sh}'!{rng.split(':')[0]}"
            put(ws, i, c0 + 2, desc, wrap=True)
    ws = wb.create_sheet("이름 목록")
    ws["A1"] = "수식에서 쓰는 이름 전체 — 「범위」를 누르면 그 칸으로 이동"
    ws["A1"].font = F_TITLE
    head(ws, 3, ["이름", "시트", "범위", "뜻"], [16, 14, 14, 90])
    for i, (nm, sh, rng, desc) in enumerate(NAMES, 4):
        put(ws, i, 1, nm, font=F_BOLD)
        put(ws, i, 2, sh)
        c = put(ws, i, 3, rng, font=Font(name=F, size=10, color="0563C1", underline="single"))
        c.hyperlink = f"#'{sh}'!{rng.split(':')[0]}"
        put(ws, i, 4, desc, wrap=True)
    table(ws, f"A3:D{len(NAMES) + 3}", "이름")
    ws.freeze_panes = "A4"


def main():
    wb = Workbook()

    # ── 읽는 법 ───────────────────────────────────────────
    ws = wb.active
    ws.title = "읽는 법"
    ws["A1"] = "분열 보스(쿼디) 전투 시뮬레이션 — 검산용 엑셀"
    ws["A1"].font = F_TITLE
    lines = [
        ("이 파일로 할 수 있는 것", "시뮬레이션에 넣은 값(입력값)과 그 값으로 계산되는 것(보스 단계표, 아군 화력, 1턴 창, 전투 시간)을 수식으로 다시 확인. 입력값 시트의 파란 숫자를 바꾸면 수식 시트가 따라 바뀜."),
        ("엑셀로 못 하는 것", "치명타·톡찌리 무작위 타격·부활 차단 확률이 섞인 1,000판 전투(몬테카를로)는 tools/split-sim.mjs 로 돌리고, 그 결과를 「결과 DB」 시트에 넣었음. 결과 요약은 그 DB에서 수식(SUMIFS·AVERAGEIFS·INDEX/MATCH)으로 뽑음."),
        ("대시보드 (맨 앞)", "노란 칸의 드롭다운(구간 · 열쇠 파티 · 단계 · 보스 · 효과)과 ☑/☐ 칸(파티 표시)을 바꾸면 카드와 그래프 6개가 바로 바뀜. 계산은 「대시보드 계산」 시트."),
        ("시트 순서", "대시보드 → 읽는 법 → 입력값 → 공통곡선 → 보스 단계표 → 아군 DB → 1턴 창 → 전투 시간 → 결과 DB → 결과 요약 → 시뮬레이션 기준 → 몬스터 DB → 보스 스탯 DB → 몬몬 DB → 효과 목록 → 대시보드 계산 → 이름 목록"),
        ("메모 · 범례", "머리글 칸의 빨간 삼각형에 마우스를 올리면 그 열이 무엇인지 메모가 뜸. 수식에서 쓰는 이름(예: C_HP, R_CLEAR)은 각 시트 오른쪽 「이 시트의 이름」 범례와 「이름 목록」 시트(바로가기)에 정리."),
        ("글자 색", "파란 글씨 = 입력값(바꿔도 됨) · 검은 글씨 = 수식 · 초록 글씨 = 다른 시트에서 가져온 값 · 노란 칸 = 입력 칸"),
        ("근거 구분", "관측(게임에서 본 값) · 사용자 결정(기획자가 정한 규칙) · 기획값(시뮬레이션으로 고른 후보) · 가정(확인 못 한 값) · 방식(계산 방법)"),
        ("다시 만들기", "node tools/split-report.mjs → node tools/split-criteria.mjs → python tools/split-xlsx.py"),
    ]
    for i, (k, v) in enumerate(lines, 3):
        ws.cell(i, 1, k).font = F_BOLD
        c = ws.cell(i, 2, v)
        c.font, c.alignment = F_BODY, WRAP
        ws.row_dimensions[i].height = 46
    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 110

    # ── 입력값 ───────────────────────────────────────────
    ws = wb.create_sheet("입력값")
    head(ws, 1, ["항목", "값", "단위", "근거", "이름 (수식에서 씀)", "설명"], [26, 12, 8, 12, 18, 70])
    P = [
        ("평타 간격 (속도 100)", 1.6, "초", "관측", "BASIC_T", "보스 게이지 12초 ≈ 아군 평타 7.5번"),
        ("스킬 1번까지 평타 수", 10, "번", "관측", "SKILL_BASICS", "속도 100이면 평타 10번 뒤 스킬"),
        ("스킬 주기 (속도 100)", "=BASIC_T*SKILL_BASICS", "초", "관측", "SKILL_T", "평타 간격 × 평타 수"),
        ("분열체 평타 간격", 2.4, "초", "관측", "PIECE_BASIC_T", "속도 120 보스 한 주기 = 아군 평타 5번 → 속도 100 보스 = 평타 6번 시간(9.6초), 그 사이 평타 4번"),
        ("분열체 스킬 주기", 9.6, "초", "관측", "PIECE_SKILL_T", "보스는 평타 4번 뒤 스킬"),
        ("부활 시간", 15, "초", "사용자 결정", "REVIVE_T", "속도와 무관한 자체 타이머 1턴 ≈ 속도 100 스킬 0.9~1번"),
        ("버프 \"2턴\"", 30, "초", "가정", "BUFF_T", "받은 몬몬 스킬 2번 ≈ 30초"),
        ("한 몸 체력 배율", 1.734, "×곡선", "기획값", "BODY_MUL", "10단계 200,000 ÷ 곡선 115,332"),
        ("분열체 배율 초반", 0.104, "×곡선", "기획값", "PIECE_EARLY", "1~6단계"),
        ("분열체 배율 중반", 0.121, "×곡선", "기획값", "PIECE_MID", "7~15단계 (10단계 13,955)"),
        ("분열체 배율 후반", 0.130, "×곡선", "기획값", "PIECE_LATE", "16~20단계"),
        ("분열체 수", 4, "마리", "사용자 결정", "PIECES", "단일형 2 · 모든 적형 2"),
        ("분열체 공격력 스탯 배율", 0.15, "×곡선", "기획값", "ATK_MUL", "피해 공식이 없어 스탯은 후보값"),
        ("기준 단계", 10, "단계", "방식", "REF_STAGE", "아군 관측 피해가 글라틀 10단계 기준"),
        ("분열체 평타 피해 (10단계)", 45, "피해", "기획값", "DMG_BASIC", "아군이 받는 값 (처음 후보 150의 0.3배)"),
        ("단일 스킬 피해 (10단계)", 450, "피해", "기획값", "DMG_SINGLE", ""),
        ("모든 적 스킬 피해 (10단계)", 225, "피해", "기획값", "DMG_AOE", ""),
        ("반격 피해 (10단계)", 1500, "피해", "기획값", "DMG_COUNTER", "다수 공격을 쓴 몬몬 1명에게, 은신이면 빗나감"),
        ("부활마다 공격력", 0.10, "+비율", "기획값", "RAMP", "부활할 때마다 모든 분열체"),
        ("다수 공격 피해 감소 (초반)", 0.30, "비율", "사용자 결정", "AOECUT_EARLY", ""),
        ("다수 공격 피해 감소 (중·후반)", 0.50, "비율", "사용자 결정", "AOECUT", "다회 공격은 다수 공격 아님"),
        ("느려짐 한 겹", 0.10, "비율", "기획값", "SLOW", "모든 적 스킬이 가까운 몬몬에게"),
        ("느려짐 대상 수", 2, "명", "기획값", "SLOWN", ""),
        ("느려짐 최대 겹 (중반)", 2, "겹", "기획값", "SLOWMAX_MID", ""),
        ("느려짐 최대 겹 (후반)", 3, "겹", "기획값", "SLOWMAX_LATE", ""),
        ("피해 반사", 0.30, "비율", "관측", "REFLECT", "몽실벌 [피해 반사 30%]"),
        ("톡찌리 부활 차단 확률", 0.15, "타격마다", "가정", "BLOCK", "★5 패시브, 문구상 맞은 적마다/타격마다 갈림 → 타격마다로 둠"),
        ("판 수", 1000, "판", "방식", "N_RUNS", "설정·파티·체력마다, 시드 4242"),
    ]
    for i, (k, v, u, basis, nm, note) in enumerate(P, 2):
        put(ws, i, 1, k)
        is_formula = isinstance(v, str) and v.startswith("=")
        c = put(ws, i, 2, v, font=F_BODY if is_formula else F_IN, fill=None if is_formula else FILL_IN)
        c.number_format = "0.000" if isinstance(v, float) and v < 1 else "#,##0.###"
        put(ws, i, 3, u)
        put(ws, i, 4, basis)
        put(ws, i, 5, nm)
        put(ws, i, 6, note, wrap=True)
        name(wb, nm, f"'입력값'!$B${i}", f"{k} ({u})" + (f" — {note}" if note else ""))
    last_in = len(P) + 1
    ws.freeze_panes = "B2"

    # ── 공통곡선 ─────────────────────────────────────────
    ws = wb.create_sheet("공통곡선")
    head(ws, 1, ["곡선 위치 (= 글라틀 단계)", "체력 (카니보 = 1)", "공격력 (카니보 = 1)", "방어력", "출처", "글라틀 체력 (관측·외삽)"], [16, 16, 16, 12, 32, 18])
    rows = list(csv.reader((ROOT / "data/dungeons/boss-curve.csv").open(encoding="utf-8-sig")))
    h = rows[0]
    ih, ia, idf, isrc = 8, 9, 10, 11
    gl = {int(r[0]): int(r[2]) for r in list(csv.reader((ROOT / "data/dungeons/ice-fortress/boss-stats-full.csv").open(encoding="utf-8-sig")))[1:]}
    for i, r in enumerate(rows[1:], 2):
        pos = int(r[0])
        put(ws, i, 1, pos, font=F_IN)
        put(ws, i, 2, float(r[ih]), font=F_IN, fmt="#,##0")
        put(ws, i, 3, float(r[ia]), font=F_IN, fmt="#,##0")
        put(ws, i, 4, float(r[idf]), font=F_IN, fmt="#,##0")
        put(ws, i, 5, r[isrc])
        put(ws, i, 6, gl.get(pos), font=F_IN, fmt="#,##0")
    cl = len(rows)
    ws.cell(cl + 2, 1, "출처: data/dungeons/boss-curve.csv (기존 보스 9종 단계별 스탯에서 뽑은 공통 곡선, 12단계부터 외삽) · 글라틀: ice-fortress/boss-stats-full.csv").font = F_NOTE
    table(ws, f"A1:F{cl}", "곡선")
    name(wb, "C_POS", f"'공통곡선'!$A$2:$A${cl}", "곡선 위치 (= 단계) — MATCH 로 찾는 열")
    name(wb, "C_HP", f"'공통곡선'!$B$2:$B${cl}", "단계별 공통 곡선 체력")
    name(wb, "C_ATK", f"'공통곡선'!$C$2:$C${cl}", "단계별 공통 곡선 공격력")
    name(wb, "C_DEF", f"'공통곡선'!$D$2:$D${cl}", "단계별 공통 곡선 방어력")
    name(wb, "C_GL", f"'공통곡선'!$F$2:$F${cl}", "글라틀 단계별 체력 (비교용)")
    ws.freeze_panes = "A2"

    # ── 보스 단계표 ───────────────────────────────────────
    ws = wb.create_sheet("보스 단계표")
    cols = ["단계", "보스 레벨", "구간", "곡선 체력", "곡선 공격력", "방어력", "분열체 배율", "한 몸 체력", "분열체 체력 (1마리)", "전체 체력 (한 몸 + 4마리)",
            "분열체 공격력 (스탯 후보)", "효과저항", "다수 공격 피해 감소", "반격", "느려짐 최대 겹", "공격 배율 (÷10단계)", "분열체 평타 피해", "단일 스킬 피해", "모든 적 스킬 피해", "반격 피해", "글라틀 체력", "전체 ÷ 글라틀"]
    head(ws, 1, cols, [6, 8, 11, 11, 10, 9, 9, 11, 12, 13, 12, 8, 10, 7, 9, 10, 10, 10, 10, 10, 11, 9])
    LV = [5, 7, 9, 11, 16, 22, 27, 40, 50, 60, 85, 95, 120, 145, 165, 185, 200, 220, 240, 260]
    for s in range(1, 21):
        r = s + 1
        A = f"A{r}"
        put(ws, r, 1, s, font=F_IN)
        put(ws, r, 2, LV[s - 1], font=F_IN)
        put(ws, r, 3, f'=IF({A}<=6,"초반 1~6",IF({A}<=15,"중반 7~15","후반 16~20"))')
        put(ws, r, 4, f"=INDEX(C_HP,MATCH({A},C_POS,0))", font=F_LINK, fmt="#,##0")
        put(ws, r, 5, f"=INDEX(C_ATK,MATCH({A},C_POS,0))", font=F_LINK, fmt="#,##0")
        put(ws, r, 6, f"=INDEX(C_DEF,MATCH({A},C_POS,0))", font=F_LINK, fmt="#,##0")
        put(ws, r, 7, f"=IF({A}<=6,PIECE_EARLY,IF({A}<=15,PIECE_MID,PIECE_LATE))", fmt="0.000")
        put(ws, r, 8, f"=ROUND(D{r}*BODY_MUL,0)", fmt="#,##0")
        put(ws, r, 9, f"=ROUND(D{r}*G{r},0)", fmt="#,##0")
        put(ws, r, 10, f"=H{r}+PIECES*I{r}", fmt="#,##0")
        put(ws, r, 11, f"=ROUND(E{r}*ATK_MUL,0)", fmt="#,##0")
        put(ws, r, 12, f"=IF({A}>=10,75,IF({A}>=7,50,IF({A}>=4,35,30)))")
        put(ws, r, 13, f"=IF({A}<=6,AOECUT_EARLY,AOECUT)", fmt="0%")
        put(ws, r, 14, f'=IF({A}<=6,"없음","있음")')
        put(ws, r, 15, f"=IF({A}<=6,0,IF({A}<=15,SLOWMAX_MID,SLOWMAX_LATE))")
        put(ws, r, 16, f"=E{r}/INDEX(C_ATK,MATCH(REF_STAGE,C_POS,0))", fmt="0.000")
        put(ws, r, 17, f"=ROUND(DMG_BASIC*P{r},0)", fmt="#,##0")
        put(ws, r, 18, f"=ROUND(DMG_SINGLE*P{r},0)", fmt="#,##0")
        put(ws, r, 19, f"=ROUND(DMG_AOE*P{r},0)", fmt="#,##0")
        put(ws, r, 20, f'=IF(N{r}="있음",ROUND(DMG_COUNTER*P{r},0),0)', fmt="#,##0")
        put(ws, r, 21, f"=INDEX(C_GL,MATCH({A},C_POS,0))", font=F_LINK, fmt="#,##0")
        put(ws, r, 22, f"=J{r}/U{r}", fmt="0.00")
    ws.cell(23, 1, "한 몸·분열체 체력 = 곡선 체력 × 배율 (ROUND) · 피해 = 10단계 후보값 × (그 단계 곡선 공격력 ÷ 10단계 곡선 공격력) · 효과저항 = 기존 보스 공통 단계 · 저장소의 data/dungeons/split-boss/boss-stats.csv 와 같은 값이 나와야 함").font = F_NOTE
    table(ws, "A1:V21", "단계표")
    ws.freeze_panes = "B2"

    # ── 아군 DB ──────────────────────────────────────────
    ws = wb.create_sheet("아군 DB")
    cols = ["몬몬", "자리 (앞부터)", "구분", "체력", "공격력", "속도", "치명확률", "평타 피해", "스킬 피해", "치명 스킬 피해", "스킬 대상", "근거",
            "평타 간격 (초)", "스킬 주기 (초)", "스킬 기대 피해", "초당 단일 피해", "초당 광역 피해 (분열체 1마리, 감소 후)", "평타 ÷ 공격력"]
    head(ws, 1, cols, [10, 8, 9, 9, 9, 7, 8, 9, 9, 10, 12, 12, 9, 9, 10, 10, 14, 9])
    A_ = [
        ("콜리킹", 1, "기준", 12451, 566, 119, 0.21, 124, 0, None, "없음", "관측"),
        ("딸랑귀", 2, "기준", 14182, 1576, 102, 0.28, 117, 3216, 5000, "주변 범위", "가정 (쥐강이 값)"),
        ("쥐강이", 3, "기준", 9650, 1215, 110, 0.37, 117, 3216, 5000, "단일", "관측"),
        ("파이온", 4, "기준", 16630, 2542, 102, 0.19, 318, 7470, None, "모든 적", "관측"),
        ("콘센파리", 5, "기준", 13026, 600, 127, 0.42, 120, 2900, None, "단일 10회", "관측"),
        ("톡찌리", 3, "열쇠", 12000, None, 100, None, 117, 3876, None, "무작위 10회", "가정"),
        ("몽실벌", 3, "열쇠", 12000, None, 100, None, 117, 3876, None, "단일 + 반사", "가정"),
        ("촛동", 3, "열쇠", 13000, None, 100, None, 117, 0, None, "없음 (은신)", "가정"),
        ("대조군", 3, "대조군", 12000, None, 100, None, 117, 3876, None, "단일", "방식"),
    ]
    for i, row in enumerate(A_, 2):
        for j, v in enumerate(row, 1):
            put(ws, i, j, v, font=F_IN if j in (4, 5, 6, 7, 8, 9, 10) else F_BODY, fmt="#,##0" if j in (4, 5, 8, 9, 10) else ("0%" if j == 7 else None))
        put(ws, i, 13, f"=BASIC_T*100/F{i}", fmt="0.00")
        put(ws, i, 14, f"=SKILL_T*100/F{i}", fmt="0.0")
        put(ws, i, 15, f'=IF(J{i}="",I{i},I{i}*(1-G{i})+J{i}*G{i})', fmt="#,##0")
        put(ws, i, 16, f'=H{i}/M{i}+IF(OR(K{i}="모든 적",K{i}="주변 범위",K{i}="없음",K{i}="없음 (은신)"),0,O{i}/N{i})', fmt="#,##0")
        put(ws, i, 17, f'=IF(OR(K{i}="모든 적",K{i}="주변 범위"),O{i}/N{i}*(1-AOECUT),0)', fmt="#,##0")
        put(ws, i, 18, f'=IF(E{i}="","",H{i}/E{i})', fmt="0.000")
    n_a = len(A_) + 1
    r = n_a + 2
    ws.cell(r, 1, "반사 피해가 분열체 방어력에 깎이는 비율 (관측 평타 ÷ 공격력의 중앙값, 딸랑귀는 대체값이라 뺌)").font = F_BOLD
    put(ws, r, 13, "=MEDIAN(R2,R4,R5,R6)", fmt="0.000")
    name(wb, "REFLMUL", f"'아군 DB'!$M${r}", "반사 피해가 방어력에 깎이고 남는 비율 (관측 평타 ÷ 공격력 중앙값)")
    ws.cell(r + 1, 1, "평타 간격 = BASIC_T × 100 ÷ 속도 · 스킬 기대 피해 = 보통 × (1 − 치명확률) + 치명 × 치명확률 · 광역 피해는 분열체 1마리에게 들어가는 값(다수 공격 피해 감소 뒤). 피해는 글라틀 10단계(방어력 1,183)에서 본 값.").font = F_NOTE
    table(ws, f"A1:R{n_a}", "아군")
    ws.freeze_panes = "B2"

    # ── 1턴 창 ───────────────────────────────────────────
    ws = wb.create_sheet("1턴 창")
    ws["A1"] = "첫 분열체가 쓰러진 뒤 부활 시간(15초) 안에 남은 3마리를 다 잡을 수 있나 — 평균값 계산 (무작위·느려짐·반격 피해는 뺌)"
    ws["A1"].font = F_BOLD
    head(ws, 3, ["몬몬", "창 안 평타 수", "창 안 스킬 수", "단일 피해", "광역 피해 (분열체 1마리)"], [16, 12, 12, 12, 16])
    party = ["콜리킹", "딸랑귀", "쥐강이", "파이온", "콘센파리"]
    for i, m in enumerate(party, 4):
        M = f"MATCH(A{i},'아군 DB'!$A:$A,0)"
        put(ws, i, 1, m, font=F_IN)
        put(ws, i, 2, f"=REVIVE_T/INDEX('아군 DB'!$M:$M,{M})", fmt="0.0")
        put(ws, i, 3, f"=REVIVE_T/INDEX('아군 DB'!$N:$N,{M})", fmt="0.00")
        put(ws, i, 4, f"=INDEX('아군 DB'!$P:$P,{M})*REVIVE_T", font=F_LINK, fmt="#,##0")
        put(ws, i, 5, f"=INDEX('아군 DB'!$Q:$Q,{M})*REVIVE_T", font=F_LINK, fmt="#,##0")
    put(ws, 9, 1, "합계", font=F_BOLD)
    put(ws, 9, 4, "=SUM(D4:D8)", font=F_BOLD, fmt="#,##0")
    put(ws, 9, 5, "=SUM(E4:E8)", font=F_BOLD, fmt="#,##0")
    out = [
        ("남은 분열체 수", "=PIECES-1", "0"),
        ("1턴에 잡을 수 있는 분열체 1마리 체력 (상한)", "=D9/B11+E9", "#,##0"),
        ("중반 10단계 분열체 체력", "=INDEX('보스 단계표'!$I:$I,MATCH(REF_STAGE,'보스 단계표'!$A:$A,0))", "#,##0"),
        ("판정", '=IF(B13<=B12,"열쇠 없이도 1턴 안에 잡힘","열쇠 없이는 1턴 안에 못 잡음")', None),
    ]
    for i, (k, f_, fmt) in enumerate(out, 11):
        put(ws, i, 1, k, font=F_BOLD)
        put(ws, i, 2, f_, fmt=fmt)
    ws.cell(16, 1, "평균 화력만 본 상한이라 실제로는 스킬이 그 15초 안에 들어오는지(게이지 위치), 치명타, 반격으로 쓰러지는 몬몬에 따라 갈림 → 시뮬레이션 결과(결과 요약)와 같이 볼 것").font = F_NOTE
    ws.column_dimensions["A"].width = 40

    # ── 전투 시간 ────────────────────────────────────────
    ws = wb.create_sheet("전투 시간")
    ws["A1"] = "부활이 한 번도 없을 때의 이론 최소 시간 vs 시뮬레이션 클리어 시간 (중반 10단계, 기준 파티)"
    ws["A1"].font = F_BOLD
    rowsT = [
        ("한 몸 체력", "=INDEX('보스 단계표'!$H:$H,MATCH(REF_STAGE,'보스 단계표'!$A:$A,0))", "#,##0"),
        ("분열체 체력 × 4", "=PIECES*INDEX('보스 단계표'!$I:$I,MATCH(REF_STAGE,'보스 단계표'!$A:$A,0))", "#,##0"),
        ("기준 파티 초당 피해 — 한 몸 (광역도 그대로)", "=SUMPRODUCT(('아군 DB'!$C$2:$C$10=\"기준\")*('아군 DB'!$H$2:$H$10/'아군 DB'!$M$2:$M$10+'아군 DB'!$O$2:$O$10/'아군 DB'!$N$2:$N$10))", "#,##0"),
        ("기준 파티 초당 피해 — 분열체 4마리 전체 (광역 감소 반영)", "=SUMIFS('아군 DB'!$P:$P,'아군 DB'!$C:$C,\"기준\")+PIECES*SUMIFS('아군 DB'!$Q:$Q,'아군 DB'!$C:$C,\"기준\")", "#,##0"),
        ("한 몸 구간 시간 (초)", "=B3/B5", "0"),
        ("분열 구간 최소 시간 (초)", "=B4/B6", "0"),
        ("부활 없을 때 최소 시간 (초)", "=B7+B8", "0"),
        ("시뮬레이션: 톡찌리 클리어 시간 중앙값 (초)", "=SUMIFS('결과 DB'!$G:$G,'결과 DB'!$A:$A,\"구간\",'결과 DB'!$B:$B,2,'결과 DB'!$D:$D,\"tok\")", "0"),
        ("시뮬레이션: 대조군 클리어 시간 중앙값 (초)", "=SUMIFS('결과 DB'!$G:$G,'결과 DB'!$A:$A,\"구간\",'결과 DB'!$B:$B,2,'결과 DB'!$D:$D,\"ctrl\")", "0"),
        ("톡찌리 — 최소 시간과의 차 (초)", "=B10-B9", "0"),
        ("대조군 — 최소 시간과의 차 (초)", "=B11-B9", "0"),
    ]
    for i, (k, f_, fmt) in enumerate(rowsT, 3):
        put(ws, i, 1, k, font=F_BOLD if i in (9, 10, 11) else F_BODY)
        put(ws, i, 2, f_, fmt=fmt)
        put(ws, i, 3, "=TEXT(B%d/86400,\"m:ss\")" % i if i >= 7 else None)
    ws.cell(15, 1, "최소 시간과 실제 시간의 차 = 부활 반복·느려짐·반격·아군 이탈로 늘어난 시간. 화력은 평균값이라 부활 반복이 적은 톡찌리 쪽이 최소 시간에 가까움.").font = F_NOTE
    ws.column_dimensions["A"].width = 52
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 10

    # ── 결과 DB ──────────────────────────────────────────
    ws = wb.create_sheet("결과 DB")
    head(ws, 1, ["표", "순서/단계", "설정", "파티 키", "파티", "분열체 체력", "클리어 시간 (초)", "클리어율 (%)", "부활 (회)", "반격 (회)", "쓰러진 아군 (명)"], [8, 9, 34, 8, 34, 11, 11, 11, 9, 9, 11])
    r = 2
    def addrow(kind, order, setting, x):
        nonlocal r
        vals = [kind, order, setting, x.get("key"), x.get("party"), x.get("hp"), x.get("time"), x.get("clear"), x.get("revives"), x.get("counters"), x.get("deaths")]
        for j, v in enumerate(vals, 1):
            put(ws, r, j, v, font=F_IN if j >= 6 else F_BODY, fmt="#,##0" if j == 6 else ("0.0" if j == 8 else None))
        r += 1
    for x in json.loads((REP / "sweep.json").read_text(encoding="utf-8"))["rows"]:
        addrow("체력별", 0, "중반 설정", x)
    for x in json.loads((REP / "bands.json").read_text(encoding="utf-8"))["rows"]:
        addrow("구간", x["order"], x["band"], x)
    for x in json.loads((REP / "sync.json").read_text(encoding="utf-8"))["rows"]:
        addrow("속도", x["order"], x["sync"], x)
    for x in json.loads((REP / "steps.json").read_text(encoding="utf-8"))["rows"]:
        addrow("설정 단계", x["step"], x["setting"], x)
    last_db = r - 1
    for nm, col, d in [("R_TABLE", "A", "표 종류 (체력별 · 구간 · 속도 · 설정 단계)"), ("R_ORDER", "B", "순서/단계 번호 (구간 1~3, 속도 1~3)"), ("R_KEY", "D", "파티 키 (base · ctrl · tok · mong · chot · duo)"),
                       ("R_HP", "F", "분열체 체력"), ("R_TIME", "G", "클리어 시간 (초, 이긴 판 중앙값)"), ("R_CLEAR", "H", "클리어율 (%)")]:
        name(wb, nm, f"'결과 DB'!${col}$2:${col}${last_db}", d)
    ws.cell(r + 1, 1, "tools/split-sim.mjs 1,000판 결과 (tools/split-report.mjs 가 만든 sweep·bands·sync·steps.json). 파티 키: base 기준 · ctrl 대조군 · tok 톡찌리 · mong 몽실벌 · chot 촛동 · duo 톡찌리+몽실벌").font = F_NOTE
    table(ws, f"A1:K{last_db}", "결과")
    ws.freeze_panes = "A2"

    # ── 결과 요약 ────────────────────────────────────────
    ws = wb.create_sheet("결과 요약")
    keys = [("base", "기준 파티"), ("ctrl", "대조군"), ("tok", "톡찌리"), ("mong", "몽실벌"), ("chot", "촛동"), ("duo", "톡찌리 + 몽실벌")]
    ws["A1"] = "구간별 클리어율 (%) — 결과 DB에서 SUMIFS"
    ws["A1"].font = F_BOLD
    head(ws, 2, ["구간"] + [k[1] for k in keys], [26] + [13] * len(keys))
    bands = [(1, "초반 1~6"), (2, "중반 7~15"), (3, "후반 16~20")]
    for i, (o, b) in enumerate(bands, 3):
        put(ws, i, 1, b)
        for j, (k, _) in enumerate(keys, 2):
            put(ws, i, j, f"=SUMIFS('결과 DB'!$H:$H,'결과 DB'!$A:$A,\"구간\",'결과 DB'!$B:$B,{o},'결과 DB'!$D:$D,\"{k}\")", font=F_LINK, fmt="0.0")
    ws["A7"] = "구간별 클리어 시간 (분:초, 이긴 판 중앙값)"
    ws["A7"].font = F_BOLD
    head(ws, 8, ["구간"] + [k[1] for k in keys])
    for i, (o, b) in enumerate(bands, 9):
        put(ws, i, 1, b)
        for j, (k, _) in enumerate(keys, 2):
            put(ws, i, j, f"=TEXT(SUMIFS('결과 DB'!$G:$G,'결과 DB'!$A:$A,\"구간\",'결과 DB'!$B:$B,{o},'결과 DB'!$D:$D,\"{k}\")/86400,\"m:ss\")", font=F_LINK)
    ws["A13"] = "열쇠 효과 (대조군 대비 %p) — 같은 화력에서 열쇠 효과만 다름"
    ws["A13"].font = F_BOLD
    head(ws, 14, ["구간", "톡찌리 − 대조군", "몽실벌 − 대조군", "촛동 − 대조군", "톡찌리+몽실벌 − 대조군"])
    for i, (o, b) in enumerate(bands, 15):
        put(ws, i, 1, b)
        for j, k in enumerate(["tok", "mong", "chot", "duo"], 2):
            col = get_column_letter(2 + [x[0] for x in keys].index(k))
            put(ws, i, j, f"={col}{i - 12}-C{i - 12}", fmt="+0.0;-0.0;0")
    ws["A19"] = "분열체 체력별 (중반 설정) — 체력이 조금 바뀌어도 흔들리는지 보기"
    ws["A19"].font = F_BOLD
    hps = sorted({int(x["hp"]) for x in json.loads((REP / "sweep.json").read_text(encoding="utf-8"))["rows"]})
    head(ws, 20, ["분열체 체력"] + [k[1] for k in keys])
    for i, hp in enumerate(hps, 21):
        put(ws, i, 1, hp, font=F_IN, fmt="#,##0")
        for j, (k, _) in enumerate(keys, 2):
            put(ws, i, j, f"=SUMIFS('결과 DB'!$H:$H,'결과 DB'!$A:$A,\"체력별\",'결과 DB'!$F:$F,$A{i},'결과 DB'!$D:$D,\"{k}\")", font=F_LINK, fmt="0.0")
    rr = 21 + len(hps)
    put(ws, rr, 1, "평균 (아래 범위)", font=F_BOLD)
    for j, (k, _) in enumerate(keys, 2):
        put(ws, rr, j, f"=AVERAGEIFS('결과 DB'!$H:$H,'결과 DB'!$A:$A,\"체력별\",'결과 DB'!$D:$D,\"{k}\",'결과 DB'!$F:$F,\">=\"&$B${rr + 1},'결과 DB'!$F:$F,\"<=\"&$B${rr + 2})", font=F_BOLD, fmt="0.0")
    put(ws, rr + 1, 1, "범위 시작")
    put(ws, rr + 1, 2, 13000, font=F_IN, fmt="#,##0", fill=FILL_IN)
    put(ws, rr + 2, 1, "범위 끝")
    put(ws, rr + 2, 2, 15000, font=F_IN, fmt="#,##0", fill=FILL_IN)
    ws.cell(rr + 4, 1, "노란 칸(범위)을 바꾸면 평균이 다시 계산됨. 시작 게이지가 모두 0이라 결과가 거의 정해진 흐름이어서 체력 하나보다 범위 평균으로 판단.").font = F_NOTE
    ws.freeze_panes = "B3"

    # ── 시뮬레이션 기준 ──────────────────────────────────
    ws = wb.create_sheet("시뮬레이션 기준")
    head(ws, 1, ["구분", "항목", "값", "근거"], [16, 18, 100, 12])
    crit = json.loads((REP / "criteria.json").read_text(encoding="utf-8"))["rows"]
    for i, c in enumerate(crit, 2):
        put(ws, i, 1, c["group"])
        put(ws, i, 2, c["item"])
        put(ws, i, 3, c["value"], wrap=True)
        put(ws, i, 4, c["basis"], fill=FILL_KEY if c["basis"] == "관측" else None)
    table(ws, f"A1:D{len(crit) + 1}", "기준")
    ws.freeze_panes = "A2"

    build_monsters(wb)
    build_monmon(wb)
    build_dash(wb)
    finish_names(wb)
    if MISSING:
        print("메모 없는 머리글:", sorted(MISSING))

    for s in wb.worksheets:
        s.sheet_view.zoomScale = 100
    wb.calculation.fullCalcOnLoad = True
    wb.save(OUT)
    print(OUT)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
