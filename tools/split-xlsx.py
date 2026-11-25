"""분열 보스 시뮬레이션 검산용 엑셀 — docs/split-report/split-boss-sim.xlsx
입력값(이름 붙은 셀) → 수식으로 보스 단계표·아군 화력·1턴 창·전투 시간을 다시 계산하고,
몬테카를로 결과(tools/split-sim.mjs)는 DB 시트로 넣어 INDEX/MATCH·SUMIFS·AVERAGEIFS 로 요약.
실행: node tools/split-report.mjs && node tools/split-criteria.mjs && python tools/split-xlsx.py
"""
import csv
import json
import sys
from pathlib import Path

from openpyxl import Workbook
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


def head(ws, row, cols, widths=None):
    for i, h in enumerate(cols, 1):
        c = ws.cell(row, i, h)
        c.font, c.fill, c.border = F_HEAD, FILL_HEAD, BOX
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 32
    if widths:
        for i, w in enumerate(widths, 1):
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


def name(wb, nm, ref):
    wb.defined_names[nm] = DefinedName(nm, attr_text=ref)


def table(ws, ref, nm):
    t = Table(displayName=nm, ref=ref)
    t.tableStyleInfo = TableStyleInfo(name="TableStyleLight9", showRowStripes=True)
    ws.add_table(t)


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
        ("시트 순서", "입력값 → 공통곡선 → 보스 단계표 → 아군 DB → 1턴 창 → 전투 시간 → 결과 DB → 결과 요약 → 시뮬레이션 기준"),
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
        name(wb, nm, f"'입력값'!$B${i}")
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
    name(wb, "C_POS", f"'공통곡선'!$A$2:$A${cl}")
    name(wb, "C_HP", f"'공통곡선'!$B$2:$B${cl}")
    name(wb, "C_ATK", f"'공통곡선'!$C$2:$C${cl}")
    name(wb, "C_DEF", f"'공통곡선'!$D$2:$D${cl}")
    name(wb, "C_GL", f"'공통곡선'!$F$2:$F${cl}")
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
    name(wb, "REFLMUL", f"'아군 DB'!$M${r}")
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

    for s in wb.worksheets:
        s.sheet_view.zoomScale = 100
    wb.calculation.fullCalcOnLoad = True
    wb.save(OUT)
    print(OUT)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
