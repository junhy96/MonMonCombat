"""PPT 그래프 다듬기 — 이미 만든(사용자가 고친) pptx 의 그래프 XML 만 바꿈. 나머지 슬라이드 내용은 그대로.
  · 두 파티를 나란히 비교하는 막대 그래프: 막대를 가늘게(gapWidth) + 같은 묶음 안 막대 사이 간격(overlap 음수)
  · 「누적 클리어 확률」 선 그래프: 2:30 · 3:00 · 4:00 · 최종(옆 표와 같은 시점)에만 원형 마크,
    선마다 뚜렷하게 다른 색, 아래 범례 대신 선 바로 옆에 파티 이름
실행: python tools/deck-chart-style.py docs/deck/monmon-assignment-draft.pptx   (같은 파일에 덮어씀, 열려 있으면 실패)
      node tools/build-deck.cjs 로 다시 만든 뒤에도 이것을 한 번 돌림
"""
import os
import re
import shutil
import sys
import tempfile
import zipfile

from lxml import etree

C = "http://schemas.openxmlformats.org/drawingml/2006/chart"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS = {"c": C, "a": A}
q = lambda p, t: f"{{{C if p == 'c' else A}}}{t}"

BAR_GAP, BAR_OVERLAP = 160, -35          # 막대 굵기 ↓ (묶음 사이 160%), 묶음 안 막대 사이 35% 띄움
LINE_COLORS = {"기본 파티": "8C8C99", "톡찌리": "615BAE", "멘티삿": "27AE60", "톡찌리 + 멘티삿": "E2803A", "톡찌리 + 토볼트": "C0392B"}
MARK_T = [150, 180, 240, 600]             # 옆 표: 2:30 · 3:00 · 4:00 · 최종
STEP = 10                                 # 업타임 표 간격 (초) → 점 번호 = t / 10
LABEL_AT = {"톡찌리 + 멘티삿": (60, "t"), "톡찌리 + 토볼트": (60, "b")}  # 끝에서 둘이 겹쳐서 위 · 아래로
LABEL_DEFAULT = (60, "r")                 # 나머지는 마지막 점 오른쪽


def el(tag, **attrs):
    p, t = tag.split(":")
    e = etree.Element(q(p, t))
    for k, v in attrs.items():
        e.set(k, str(v))
    return e


def sub(parent, tag, **attrs):
    e = el(tag, **attrs)
    parent.append(e)
    return e


def solid(parent, color):
    f = sub(parent, "a:solidFill")
    sub(f, "a:srgbClr", val=color)


def title_text(root):
    t = root.find(".//c:title", NS)
    return "".join(x.text or "" for x in t.iter(q("a", "t"))) if t is not None else ""


def style_bars(root):
    n = 0
    for bc in root.iter(q("c", "barChart")):
        if len(bc.findall("c:ser", NS)) < 2:
            continue
        gw = bc.find("c:gapWidth", NS)
        if gw is None:
            gw = el("c:gapWidth")
            bc.findall("c:ser", NS)[-1].addnext(gw) if bc.find("c:dLbls", NS) is None else bc.find("c:dLbls", NS).addnext(gw)
        gw.set("val", str(BAR_GAP))
        ov = bc.find("c:overlap", NS)
        if ov is None:
            ov = el("c:overlap")
            gw.addnext(ov)
        ov.set("val", str(BAR_OVERLAP))
        n += 1
    return n


def series_name(ser):
    v = ser.find("c:tx//c:v", NS)
    return v.text if v is not None else ""


def style_uptime(root):
    lc = root.find(".//c:lineChart", NS)
    for ser in lc.findall("c:ser", NS):
        name = series_name(ser)
        color = LINE_COLORS.get(name, "615BAE")
        # 선 색 · 굵기
        sp = ser.find("c:spPr", NS)
        if sp is None:
            sp = el("c:spPr")
            (ser.find("c:tx", NS) or ser.find("c:order", NS)).addnext(sp)
        for ch in list(sp):
            sp.remove(ch)
        ln = sub(sp, "a:ln", w=31750, cap="rnd")
        solid(ln, color)
        sub(ln, "a:round")
        # 계열 전체는 마크 없음
        mk = ser.find("c:marker", NS)
        if mk is None:
            mk = el("c:marker")
            sp.addnext(mk)
        for ch in list(mk):
            mk.remove(ch)
        sub(mk, "c:symbol", val="none")
        # 표와 같은 시점에만 원형 마크
        for old in ser.findall("c:dPt", NS):
            ser.remove(old)
        prev = mk
        for t in MARK_T:
            d = el("c:dPt")
            sub(d, "c:idx", val=t // STEP)
            m = sub(d, "c:marker")
            sub(m, "c:symbol", val="circle")
            sub(m, "c:size", val=8)
            msp = sub(m, "c:spPr")
            solid(msp, color)
            mln = sub(msp, "a:ln", w=12700)
            solid(mln, "FFFFFF")
            sub(d, "c:bubble3D", val=0)
            prev.addnext(d)
            prev = d
        # 선 옆 이름
        old = ser.find("c:dLbls", NS)
        if old is not None:
            ser.remove(old)
        idx, pos = LABEL_AT.get(name, LABEL_DEFAULT)
        dl = el("c:dLbls")
        one = sub(dl, "c:dLbl")
        sub(one, "c:idx", val=idx)
        tx = sub(one, "c:txPr")
        sub(tx, "a:bodyPr", wrap="none")
        sub(tx, "a:lstStyle")
        p = sub(tx, "a:p")
        ppr = sub(p, "a:pPr")
        rpr = sub(ppr, "a:defRPr", sz=1050, b=1)
        solid(rpr, color)
        sub(rpr, "a:latin", typeface="프리젠테이션 6 SemiBold")
        sub(rpr, "a:ea", typeface="프리젠테이션 6 SemiBold")
        sub(p, "a:endParaRPr", lang="ko-KR")
        sub(one, "c:dLblPos", val=pos)
        for k, v in (("showLegendKey", 0), ("showVal", 0), ("showCatName", 0), ("showSerName", 1), ("showPercent", 0), ("showBubbleSize", 0)):
            sub(one, f"c:{k}", val=v)
        for k in ("showLegendKey", "showVal", "showCatName", "showSerName", "showPercent", "showBubbleSize"):
            sub(dl, f"c:{k}", val=0)
        prev.addnext(dl)
    # 범례 지우고, 오른쪽에 이름 자리 남기기
    chart = root.find("c:chart", NS)
    lg = chart.find("c:legend", NS)
    if lg is not None:
        chart.remove(lg)
    pa = chart.find("c:plotArea", NS)
    lay = pa.find("c:layout", NS)
    if lay is None:
        lay = el("c:layout")
        pa.insert(0, lay)
    for ch in list(lay):
        lay.remove(ch)
    ml = sub(lay, "c:manualLayout")
    sub(ml, "c:layoutTarget", val="inner")
    sub(ml, "c:xMode", val="edge")
    sub(ml, "c:yMode", val="edge")
    for k, v in (("x", 0.075), ("y", 0.13), ("w", 0.74), ("h", 0.7)):
        sub(ml, f"c:{k}", val=v)


def main(path):
    src = zipfile.ZipFile(path)
    out = {}
    for n in src.namelist():
        if not re.fullmatch(r"ppt/charts/chart\d+\.xml", n):
            continue
        root = etree.fromstring(src.read(n))
        changed = False
        if style_bars(root):
            changed = True
            print(n, "막대:", title_text(root))
        if root.find(".//c:lineChart", NS) is not None and "누적 클리어 확률" in title_text(root):
            style_uptime(root)
            changed = True
            print(n, "선:", title_text(root))
        if changed:
            out[n] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    fd, tmp = tempfile.mkstemp(suffix=".pptx", dir=os.path.dirname(os.path.abspath(path)))
    os.close(fd)
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            dst.writestr(info, out.get(info.filename, src.read(info.filename)))
    src.close()
    shutil.move(tmp, path)
    print("고친 그래프", len(out), "→", path)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1])
