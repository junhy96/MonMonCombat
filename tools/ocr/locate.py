"""그림에서 글자를 찾아 가운데 좌표를 찍는다 (화면마다 위치가 다른 버튼 찾기용).
실행: python tools/ocr/locate.py <그림.png> <글자> [<글자> ...]  → 글자마다 한 줄 "x y" (못 찾으면 "- -")
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import rapid  # noqa: E402

img = Image.open(sys.argv[1]).convert("RGB")
a = np.array(img)
big = Image.fromarray(a.max(axis=2)).convert("RGB").resize((img.width * 2, img.height * 2), Image.LANCZOS)
r = rapid.ENGINE(np.ascontiguousarray(np.array(big)[:, :, ::-1]), use_det=True, use_cls=False, use_rec=True)
boxes = list(zip(r.boxes if r.boxes is not None else [], r.txts or []))
for want in sys.argv[2:]:
    hit = next(((b, t) for b, t in boxes if want.replace(" ", "") in str(t).replace(" ", "")), None)
    if hit:
        xs, ys = [p[0] for p in hit[0]], [p[1] for p in hit[0]]
        print(round(sum(xs) / 4 / 2), round(sum(ys) / 4 / 2))
    else:
        print("- -")
