"""PPT 5 · 6쪽 글라틀 한 주기 타수 고침 — 사용자가 고친 pptx 에서 해당 글자만 바꿈 (다른 슬라이드 · 서식은 그대로)
고친 이유 (사용자 확인 2026-11-26): 보스 게이지 12초는 10단계(보스 속도 100)에서 잰 값. 예전 표는 12초를 속도 80 값으로 놓고
10단계를 9.6초로 줄여 타수를 적게 셌음 → 게임에서 다회 1마리로 60번이 첫 주기에 깨지는 것과 안 맞았음.
새 기준: 10단계 12초, 보스 속도에 비례 (1~6단계 15초 · 11단계부터 9.6초 — 비례는 확인 필요), 등껍질은 스킬마다 가득으로 다시(사용자 확인).
실행: python tools/deck-fix-glattle.py docs/split-report/monmon-assignment-draft.pptx
"""
import os
import shutil
import sys
import tempfile
import zipfile

from pptx import Presentation
from pptx.dml.color import RGBColor

GREEN, RED, OLIVE, INK = RGBColor(0x4A, 0x85, 0x56), RGBColor(0xB5, 0x42, 0x3A), RGBColor(0x8A, 0x7A, 0x33), RGBColor(0x2A, 0x27, 0x40)


def one(w, h):          # 속도 100 몬몬 1명이 창 w초 동안 등껍질을 때리는 횟수 (평타 1.6초 · 스킬 16초, 스킬 h타)
    return w / 1.6 + w / 16 * h


def row(w, need_min, need_max):
    cols = [(0, 0), (3, 5), (5, 5), (2, 10), (4, 10), (5, 10)]
    out = []
    for n, h in cols:
        v = round(n * one(w, h) + (5 - n) * one(w, 1))
        mark, col = ("✔", GREEN) if v >= need_max else (("△", OLIVE) if v >= need_min else ("✘", RED))
        out.append((f"{v} {mark}", col))
    return out


def set_text(tf_or_cell, text, color=None):
    tf = tf_or_cell.text_frame
    p = tf.paragraphs[0]
    runs = p.runs
    if not runs:
        p.text = text
        runs = p.runs
    runs[0].text = text
    for r in runs[1:]:
        r._r.getparent().remove(r._r)
    for extra in tf.paragraphs[1:]:
        extra._p.getparent().remove(extra._p)
    if color is not None:
        runs[0].font.color.rgb = color


def find(slide, starts):
    for sh in slide.shapes:
        if sh.has_text_frame and sh.text_frame.text.startswith(starts):
            return sh
    raise SystemExit(f"못 찾음: {starts}")


def main(path):
    p = Presentation(path)
    s5, s6 = p.slides[4], p.slides[5]
    # 5쪽 표
    tbl = next(sh for sh in s5.shapes if sh.has_table).table
    assert tbl.cell(0, 0).text.startswith("단계"), "5쪽 표가 예상과 다름"
    spec = [("1~6 (80 · 60번)", 15.0, 60, 60), ("7~10 (100 · 70~90번)", 12.0, 70, 90), ("11~ (125 · 70~90번)", 9.6, 70, 90)]
    for i, (lab, w, lo, hi) in enumerate(spec, 1):
        set_text(tbl.cell(i, 0), lab)
        set_text(tbl.cell(i, 1), f"{w / 1.6:.1f} ({w:g}초)")
        for j, (txt, col) in enumerate(row(w, lo, hi), 2):
            set_text(tbl.cell(i, j), txt, col)
            tbl.cell(i, j).text_frame.paragraphs[0].runs[0].font.bold = txt.endswith("✔")
    set_text(find(s5, "한 주기 타수"), "한 주기 타수 — 7단계부터는 열쇠만으로 빠듯하고, 90번은 한 주기 안에 못 깬다")
    set_text(find(s5, "보스 스킬 한 주기 동안"), "보스 스킬 한 주기 동안 파티 5명이 등껍질을 때리는 횟수 (평타도 1번씩 셈). ✔ 깸 · △ 70번이면 깸, 90번이면 못 깸 · ✘ 못 깸. 레벨 · 별로 바뀌는 칸이 없습니다.")
    set_text(find(s5, "다회 몬몬 스킬 타수 합"), "다회 1명(10회)이면 60번 — 실제 파티(콘센파리 10회 1명, 평균 속도 112)는 68번으로 첫 주기에 깸 (게임 관측과 같음)")
    set_text(find(s5, "10회 다회 5명이어도"), "70번은 10회 다회 5명(75번), 또는 실제 파티 다회 2명(61번) + 아군 [속도 +15%] ≈ 70번. 90번은 10회 5명 + 속도 +15%로도 86번 → 한 주기 안에 못 깸")
    set_text(find(s5, "가정:"), "가정: 5명 모두 속도 100 · 생존. 보스 게이지 10단계(속도 100) 12초 관측 → 보스 속도에 비례로 보고 1~6단계 15초 · 11단계부터 9.6초 (비례는 확인 필요). 등껍질은 보스 스킬마다 가득으로 다시 생김 (확인)")
    # 6쪽 문제 1
    t6 = next(sh for sh in s6.shapes if sh.has_table).table
    assert t6.cell(1, 0).text.strip() == "1", "6쪽 표가 예상과 다름"
    set_text(t6.cell(1, 1), "7단계부터 열쇠만으로 빠듯, 90번은 못 엶")
    set_text(t6.cell(1, 2), "70번은 10회 다회 5명(75번)이나 다회 2명 + 속도 +15%, 90번은 다회 5명 + 속도 +15%로도 86번")
    set_text(t6.cell(1, 3), "다회를 늘려도 90번이 나오는 판은 안 깨짐")
    # 파일 전체를 다시 저장하면 [Content_Types] 등록 방식이 바뀜 → 고친 5 · 6쪽 XML 만 원본 파일에 끼워 넣음
    fd, tmp = tempfile.mkstemp(suffix=".pptx", dir=os.path.dirname(os.path.abspath(path)))
    os.close(fd)
    p.save(tmp)
    names = {s5.part.partname.lstrip("/"), s6.part.partname.lstrip("/")}
    with zipfile.ZipFile(tmp) as z:
        new = {n: z.read(n) for n in names}
    out = tmp + ".out"
    with zipfile.ZipFile(path) as src, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            dst.writestr(info, new.get(info.filename, src.read(info.filename)))
    os.remove(tmp)
    shutil.move(out, path)
    print("5 · 6쪽 고침 (", ", ".join(sorted(names)), ") →", path)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1])
