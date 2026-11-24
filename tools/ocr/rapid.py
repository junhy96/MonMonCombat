"""몬몬 시트 글자 읽기: maple-kakao-bot(relay/windows-pc/ocrwin.py)과 같은 설정 — RapidOCR + PP-OCRv5 한국어(mobile), 글줄 방향 맞추기 끔.
실행: python tools/ocr/rapid.py <그림.png> [...]   (필요: pip install rapidocr onnxruntime pillow)
출력: 같은 이름의 .txt (위→아래, 같은 줄은 왼→오른쪽), 화면에도 찍는다.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rapidocr import LangRec, ModelType, OCRVersion, RapidOCR

SCALE = 2
ENGINE = RapidOCR(params={"Rec.lang_type": LangRec.KOREAN, "Rec.ocr_version": OCRVersion.PPOCRV5, "Rec.model_type": ModelType.MOBILE,
                          "Det.ocr_version": OCRVersion.PPOCRV5, "Det.model_type": ModelType.MOBILE,
                          "Global.use_cls": False, "Global.log_level": "error"})


CHUNK = 900   # 긴 시트를 한 번에 넣으면 줄여서 읽어 글자를 틀린다 → 조각 사이 흰 틈에서 이 높이 안팎으로 잘라 따로 읽는다


def chunks(img: Image.Image) -> list[tuple[int, int]]:
    """시트 조각(compose.mjs 가 8px 순백 틈으로 이어 붙임) 경계에서 자른 (위, 아래) 목록"""
    a = np.array(img)
    white = (a.min(axis=(1, 2)) == 255)
    cuts, run = [0], 0
    for y, w in enumerate(white):
        run = run + 1 if w else 0
        if run == 6:
            cuts.append(y)
    cuts.append(img.height)
    out, top = [], 0
    for c in cuts[1:]:
        if c - top >= CHUNK or c == img.height:
            out.append((top, c))
            top = c
    return [(t, b) for t, b in out if b - t > 4]


def boxes(a: np.ndarray) -> list[dict]:
    """효과 줄의 숫자 칸: 시계(지속 턴, 파란 테두리) → kind 'T', 모래시계(대기시간, 빨간 테두리) → kind 'C'.
    테두리 색 픽셀을 이어 덩어리로 묶고, 속이 빈 납작한 사각형(가로 40~100, 세로 20~50)만 칸으로 본다."""
    R, G, B = (a[:, :, k].astype(int) for k in range(3))
    found = []
    for kind, mask in (("T", (R < 100) & (G > 70) & (G < 150) & (B > 170)), ("C", (R > 170) & (G < 110) & (B < 110))):
        seen = np.zeros(mask.shape, bool)
        for y0, x0 in zip(*np.nonzero(mask)):
            if seen[y0, x0]:
                continue
            stack, pts = [(y0, x0)], []
            seen[y0, x0] = True
            while stack:
                y, x = stack.pop()
                pts.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            ys, xs = [p[0] for p in pts], [p[1] for p in pts]
            x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
            w, h = x2 - x1 + 1, y2 - y1 + 1
            if 40 <= w <= 100 and 20 <= h <= 50 and len(pts) < 0.45 * w * h:
                found.append({"kind": kind, "x1": x1, "x2": x2, "y1": y1, "y2": y2})
    return found


def box_digit(img: Image.Image, b: dict) -> str | None:
    """칸 오른쪽(아이콘 뒤)의 숫자만 크게 읽는다"""
    # 글자 하나뿐이라 글자 찾기(det)가 놓친다 → 인식(rec)만 돌린다. 한 자리 숫자가 아니면 크기를 바꿔 한 번 더
    w = b["x2"] - b["x1"]
    cell = img.crop((b["x1"] + int(w * 0.5), b["y1"] + 4, b["x2"] - 3, b["y2"] - 3))
    for scale, pad in ((2, 0), (3, 12), (1, 6)):
        big = cell.resize((cell.width * scale, cell.height * scale), Image.LANCZOS)
        if pad:
            bg = Image.new("RGB", (big.width + 2 * pad, big.height + 2 * pad), big.getpixel((big.width - 1, big.height // 2)))
            bg.paste(big, (pad, pad))
            big = bg
        r = ENGINE(np.ascontiguousarray(np.array(big)[:, :, ::-1]), use_det=False, use_cls=False, use_rec=True)
        t = "".join(map(str, r.txts or [])).strip()
        if len(t) == 1 and t.isdigit():
            return t
    return None


def read(path: str) -> list[dict]:
    img = Image.open(path).convert("RGB")
    out = []
    for top, bot in chunks(img):
        part = img.crop((0, top, img.width, bot))
        big = part.resize((part.width * SCALE, part.height * SCALE), Image.LANCZOS)
        r = ENGINE(np.ascontiguousarray(np.array(big)[:, :, ::-1]), use_det=True, use_cls=False, use_rec=True)   # 숫자 칸 읽기가 det 를 끈 채로 남기지 않게
        lines = []
        for box, text, score in zip(r.boxes if r.boxes is not None else [], r.txts or [], r.scores or []):
            xs, ys = [p[0] for p in box], [p[1] for p in box]
            lines.append({"text": str(text), "x": min(xs) / SCALE, "x2": max(xs) / SCALE, "y": top + min(ys) / SCALE, "h": (max(ys) - min(ys)) / SCALE, "score": float(score)})
        # 숫자 칸은 따로 읽어 "T2"(지속 2턴) / "C5"(대기 5턴) 로 넣고, 그 자리에 겹친 OCR 조각은 뺀다
        for b in boxes(np.array(part)):
            d = box_digit(part, b)
            bx1, bx2, by1, by2 = b["x1"], b["x2"], top + b["y1"], top + b["y2"]
            lines = [l for l in lines if not (bx1 - 4 <= (l["x"] + l["x2"]) / 2 <= bx2 + 4 and by1 - 6 <= l["y"] + l["h"] / 2 <= by2 + 6)]
            if d:
                lines.append({"text": b["kind"] + d, "x": bx1, "x2": bx2, "y": by1 + 2, "h": by2 - by1 - 4, "score": 1.0})
        out += lines
    return out


def rows(lines: list[dict]) -> list[str]:
    """세로 위치가 겹치는 조각을 한 줄로 묶는다"""
    lines.sort(key=lambda l: l["y"])
    groups: list[list[dict]] = []
    for l in lines:
        if groups and abs(l["y"] - groups[-1][0]["y"]) < max(6, l["h"] * 0.5):
            groups[-1].append(l)
        else:
            groups.append([l])
    return [" | ".join(f"{g['text']}" + (f" (?{g['score']:.2f})" if g["score"] < 0.8 else "") for g in sorted(gr, key=lambda g: g["x"])) for gr in groups]


if __name__ == "__main__":
    # python tools/ocr/rapid.py <그림...>  → 화면에만
    # python tools/ocr/rapid.py --all      → data/monmon/sheets/*.png 를 data/monmon/ocr/*.txt 로 (이미 있으면 건너뜀)
    sys.stdout.reconfigure(encoding="utf-8")
    if "--all" in sys.argv:
        out = Path("data/monmon/ocr")
        out.mkdir(parents=True, exist_ok=True)
        for p in sorted(Path("data/monmon/sheets").glob("*.png")):
            dst = out / (p.stem + ".txt")
            if dst.exists():
                continue
            dst.write_text("\n".join(rows(read(str(p)))) + "\n", encoding="utf-8")
            print(p.stem, flush=True)
    else:
        for p in sys.argv[1:]:
            print(f"== {p}\n" + "\n".join(rows(read(p))))
