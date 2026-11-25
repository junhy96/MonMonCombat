"""에픽 몬몬 표(data/monmon/epic/*.csv) + 버프·디버프 인덱스(data/effects/effects.csv) → 엑셀 한 파일
실행: node tools/epic-list.mjs && python tools/epic-xlsx.py
출력: data/monmon/epic/epic-monmon.xlsx
시트: 요약 · 에픽 몬몬 · 에픽 스킬 · 효과별 등급 · 기존 보스 기믹 · 버프·디버프 인덱스
"""
import csv
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
EPIC = ROOT / "data/monmon/epic"
EFFECTS = ROOT / "data/effects"
DUNGEONS = ROOT / "data/dungeons"
OUT = EPIC / "epic-monmon.xlsx"

FONT = "맑은 고딕"
HEAD_FILL = PatternFill("solid", fgColor="1F3A5F")
HEAD_FONT = Font(name=FONT, bold=True, color="FFFFFF", size=10)
BODY_FONT = Font(name=FONT, size=10)
BOLD = Font(name=FONT, size=10, bold=True)
TITLE = Font(name=FONT, size=14, bold=True)
NOTE = Font(name=FONT, size=9, italic=True, color="666666")
THIN = Side(style="thin", color="D0D7E2")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
BUFF_FILL = PatternFill("solid", fgColor="E8F3E8")
DEBUFF_FILL = PatternFill("solid", fgColor="FBE9E9")
OTHER_FILL = PatternFill("solid", fgColor="EEF1F6")
GRADES = ["전설", "에픽", "레어", "고급", "일반"]


def read_csv(path: Path) -> list[list[str]]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.reader(f))


def num(v: str):
    s = v.strip()
    if s and s.lstrip("-").isdigit() and not (len(s) > 1 and s.startswith("0")):
        return int(s)
    return v


def table(ws, rows, widths, wrap=(), start_row=1, numeric=True):
    """rows[0] = 머리글. 머리글 고정·필터·테두리·줄바꿈 열 지정."""
    for c, h in enumerate(rows[0], 1):
        cell = ws.cell(start_row, c, h)
        cell.font, cell.fill, cell.border = HEAD_FONT, HEAD_FILL, BOX
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for r, row in enumerate(rows[1:], start_row + 1):
        for c, v in enumerate(row, 1):
            cell = ws.cell(r, c, num(v) if numeric else v)
            cell.font, cell.border = BODY_FONT, BOX
            cell.alignment = Alignment(vertical="top", wrap_text=rows[0][c - 1] in wrap)
    for c, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(c)].width = w
    ws.row_dimensions[start_row].height = 30
    last = get_column_letter(len(rows[0]))
    ws.auto_filter.ref = f"A{start_row}:{last}{start_row + len(rows) - 1}"
    ws.freeze_panes = ws.cell(start_row + 1, 3)


def main():
    epics = read_csv(EPIC / "epics.csv")
    skills = read_csv(EPIC / "epic-skills.csv")
    by_grade = read_csv(EPIC / "effects-by-grade.csv")
    effects = read_csv(EFFECTS / "effects.csv")
    n_epic = len(epics) - 1
    wb = Workbook()

    # ── 에픽 몬몬 ──
    ws = wb.active
    ws.title = "에픽 몬몬"
    table(ws, epics, [6, 10, 5, 7, 7, 8, 7, 8, 8, 8, 7, 8, 8, 8, 8, 12, 14, 14, 14, 8, 6, 60], wrap={"가진 효과"})
    for r in range(2, n_epic + 2):
        for c in range(8, 16):
            ws.cell(r, c).number_format = "#,##0"

    # ── 에픽 스킬 ──
    ws = wb.create_sheet("에픽 스킬")
    table(ws, skills, [6, 10, 11, 16, 8, 14, 36, 90], wrap={"효과", "설명 (화면)"})

    # ── 효과별 등급 ── (에픽 비중은 수식으로)
    ws = wb.create_sheet("효과별 등급")
    head = by_grade[0]
    rows = [head] + [r for r in by_grade[1:]]
    table(ws, rows, [24, 7, 7, 7, 7, 7, 7, 10, 12, 70], wrap={"에픽 보유 몬몬"})
    share_col = head.index("에픽 비중") + 1
    low_col = head.index("레어 이하 보유") + 1
    for r in range(2, len(rows) + 1):
        ws.cell(r, share_col).value = f"=IF(B{r}=0,0,D{r}/B{r})"
        ws.cell(r, share_col).number_format = "0%"
        ws.cell(r, low_col).value = f"=E{r}+F{r}+G{r}"
        ws.cell(r, 2).value = f"=SUM(C{r}:G{r})"
        if ws.cell(r, 4).value and ws.cell(r, 4).value > 0 and (ws.cell(r, 5).value or 0) + (ws.cell(r, 6).value or 0) + (ws.cell(r, 7).value or 0) == 0:
            for c in range(1, len(head) + 1):
                ws.cell(r, c).fill = PatternFill("solid", fgColor="FFF4CC")
    note_r = len(rows) + 2
    ws.cell(note_r, 1, "노란 줄 = 에픽이 갖고 있고 레어 이하에는 없는 효과. 보유 수는 스킬 효과 칸 기준(설명 문장에만 나오는 기믹은 빠짐), 도감 285마리.").font = NOTE

    # ── 기존 보스 기믹 ── (data/dungeons/boss-gimmicks.csv + key-effects.csv, 공략 창 문구로 정리)
    gim = read_csv(DUNGEONS / "boss-gimmicks.csv")
    keys = read_csv(DUNGEONS / "key-effects.csv")
    ws = wb.create_sheet("기존 보스 기믹")
    table(ws, gim, [16, 14, 14, 48, 40, 26, 34, 16, 34], wrap=set(gim[0]), numeric=False)
    for r in range(2, len(gim) + 1):
        ws.row_dimensions[r].height = 90
    k0 = len(gim) + 3
    ws.cell(k0 - 1, 1, "열쇠로 쓰인 효과 (공략 창 '필요한 효과' 기준) — 버프·디버프 인덱스의 '기존 보스 열쇠' 열이 이 표를 참조").font = BOLD
    for j, h in enumerate(keys[0]):
        cell = ws.cell(k0, 1 + j, h)
        cell.font, cell.fill, cell.border = HEAD_FONT, HEAD_FILL, BOX
    for i, row in enumerate(keys[1:], k0 + 1):
        for j, v in enumerate(row):
            cell = ws.cell(i, 1 + j, v)
            cell.font, cell.border = BODY_FONT, BOX
    key_rng = (k0 + 1, k0 + len(keys) - 1)
    ws.auto_filter.ref = f"A1:{get_column_letter(len(gim[0]))}{len(gim)}"

    # ── 버프·디버프 인덱스 ──
    ws = wb.create_sheet("버프·디버프 인덱스")
    eh = effects[0]
    keep = ["ID", "구분", "이름", "효과", "단계", "수치", "단위", "효과 설명", "메모"]
    idx = [eh.index(k) for k in keep]
    icon_i = eh.index("아이콘")
    head = ["아이콘"] + keep + ["보유 전체", "전설", "에픽", "레어", "고급", "일반", "기존 보스 열쇠"]
    rows = [head] + [[""] + [r[i] for i in idx] + [""] * 7 for r in effects[1:]]
    table(ws, rows, [7, 18, 8, 22, 14, 6, 6, 6, 60, 26, 9, 7, 7, 7, 7, 7, 26], wrap={"효과 설명", "메모"})
    G = "'기존 보스 기믹'"
    for r in range(2, len(rows) + 1):
        ws.cell(r, 17).value = (f"=IFERROR(INDEX({G}!$B${key_rng[0]}:$B${key_rng[1]},MATCH($E{r},{G}!$A${key_rng[0]}:$A${key_rng[1]},0)),"
                                f"IF($C{r}=\"버프\",\"(버프 종류 무관: 울프릭 · 고블렛)\",IF($C{r}=\"디버프\",\"(디버프 종류 무관: 볼트피온 · 고블렛)\",\"\")))")
    for r, src in enumerate(effects[1:], 2):
        ws.row_dimensions[r].height = 34
        kind = src[eh.index("구분")]
        fill = BUFF_FILL if kind == "버프" else DEBUFF_FILL if kind == "디버프" else OTHER_FILL
        for c in range(2, 11):
            ws.cell(r, c).fill = fill
        icon = src[icon_i]
        if icon and (EFFECTS / icon).exists():
            img = XlImage(str(EFFECTS / icon))
            img.width, img.height = 30, 28
            ws.add_image(img, f"A{r}")
        # 보유 수: 효과별 등급 시트에서 이름으로 찾아옴 (없으면 0)
        for k, g in enumerate(["B", "C", "D", "E", "F", "G"]):
            col = 11 + k
            ws.cell(r, col).value = f"=IFERROR(INDEX('효과별 등급'!{g}:{g},MATCH($D{r},'효과별 등급'!$A:$A,0)),0)"
    ws.freeze_panes = "E2"
    note_r = len(rows) + 2
    ws.cell(note_r, 1, "출처: data/effects/effects.csv (게임 내 효과 설명 화면). 초록 = 버프, 빨강 = 디버프, 회색 = 즉시 효과·목록 밖. 보유 수는 '효과별 등급' 시트에서 가져옴.").font = NOTE

    # ── 요약 (맨 앞) ──
    ws = wb.create_sheet("요약", 0)
    ws["A1"] = "에픽 몬몬 요약 — 문항 2 (에픽 열쇠 던전)"
    ws["A1"].font = TITLE
    ws["A2"] = f"도감 285마리 중 에픽 {n_epic}마리 · 모두 4성, 최대 레벨 40 · 아래 수는 '에픽 몬몬' 시트에서 수식으로 셈"
    ws["A2"].font = NOTE
    E = "'에픽 몬몬'"
    col = {h: get_column_letter(i + 1) for i, h in enumerate(epics[0])}

    def block(r0, c0, title, key, values):
        ws.cell(r0, c0, title).font = BOLD
        for j, h in enumerate([key, "몬몬 수", "비율"]):
            cell = ws.cell(r0 + 1, c0 + j, h)
            cell.font, cell.fill, cell.border = HEAD_FONT, HEAD_FILL, BOX
            cell.alignment = Alignment(horizontal="center")
        for i, v in enumerate(values):
            r = r0 + 2 + i
            L = col[key]
            ws.cell(r, c0, v).font = BODY_FONT
            ws.cell(r, c0 + 1, f"=COUNTIF({E}!${L}$2:${L}${n_epic + 1},{get_column_letter(c0)}{r})").font = BODY_FONT
            ws.cell(r, c0 + 2, f"={get_column_letter(c0 + 1)}{r}/{n_epic}").font = BODY_FONT
            ws.cell(r, c0 + 2).number_format = "0%"
            for j in range(3):
                ws.cell(r, c0 + j).border = BOX
        tr = r0 + 2 + len(values)
        ws.cell(tr, c0, "합계").font = BOLD
        ws.cell(tr, c0 + 1, f"=SUM({get_column_letter(c0 + 1)}{r0 + 2}:{get_column_letter(c0 + 1)}{tr - 1})").font = BOLD
        return tr

    def distinct(key):
        vals = [r[epics[0].index(key)] for r in epics[1:]]
        return sorted(set(vals), key=lambda v: (-vals.count(v), v))

    end1 = block(4, 1, "역할", "역할", distinct("역할"))
    block(4, 5, "거리", "거리", distinct("거리"))
    end3 = block(4, 9, "속성", "속성", distinct("속성"))

    r0 = max(end1, end3) + 2
    ws.cell(r0, 1, "에픽 이상만 가진 효과 (레어·고급·일반 보유 0)").font = BOLD
    hdr = ["효과", "에픽", "전설", "에픽 보유 몬몬"]
    for j, h in enumerate(hdr):
        cell = ws.cell(r0 + 1, 1 + j, h)
        cell.font, cell.fill, cell.border = HEAD_FONT, HEAD_FILL, BOX
    bh = by_grade[0]
    only = [r for r in by_grade[1:] if int(r[bh.index("에픽")]) > 0 and int(r[bh.index("레어 이하 보유")]) == 0]
    for i, r in enumerate(only):
        rr = r0 + 2 + i
        ws.cell(rr, 1, r[0])
        ws.cell(rr, 2, f"=INDEX('효과별 등급'!D:D,MATCH(A{rr},'효과별 등급'!A:A,0))")
        ws.cell(rr, 3, f"=INDEX('효과별 등급'!C:C,MATCH(A{rr},'효과별 등급'!A:A,0))")
        ws.cell(rr, 4, r[bh.index("에픽 보유 몬몬")])
        for j in range(4):
            ws.cell(rr, 1 + j).font, ws.cell(rr, 1 + j).border = BODY_FONT, BOX
    for c, w in zip("ABCDEFGHIJK", [22, 9, 9, 44, 2, 9, 9, 9, 2, 9, 9]):
        ws.column_dimensions[c].width = w
    ws.column_dimensions["L"].width = 9
    ws.cell(r0 + 3 + len(only), 1, "시트: 에픽 몬몬(78마리 스탯·스킬·효과) · 에픽 스킬(스킬 전문) · 효과별 등급(효과마다 등급별 보유 수) · 기존 보스 기믹(9종 기믹·해결 기믹) · 버프·디버프 인덱스(효과 설명·아이콘·기존 보스 열쇠)").font = NOTE

    for s in wb.worksheets:
        s.sheet_view.zoomScale = 100
    wb.calculation.fullCalcOnLoad = True   # openpyxl은 수식 값을 저장하지 않음 → 엑셀이 열 때 계산
    wb.save(OUT)
    print(OUT)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
