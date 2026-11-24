"""스탯 8칸을 칸마다 따로 읽는다 (시트 전체를 읽으면 작은 '0'을 놓치거나 아이콘을 숫자로 읽는 일이 있어서).
실행: python tools/ocr/stats.py [번호...]   (없으면 전부) → data/monmon/ocr/<번호>.stats.txt (한 줄에 숫자 8개, 못 읽은 칸은 ?)
칸 위치: 상세 화면(raw/<번호>-0.png) 스탯 영역 x130 y885 660×170 = 4칸×2줄, 숫자는 칸 오른쪽."""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from rapid import ENGINE  # noqa: E402

X, Y, W, H = 130, 885, 660, 170


def cell_text(img: Image.Image, scale: int) -> str:
    # 어두운 칸의 흰 숫자 → 흰 바탕 검은 숫자로 뒤집고 여백을 둔다
    from PIL import ImageOps
    big = ImageOps.invert(ImageOps.grayscale(img)).resize((img.width * scale, img.height * scale), Image.LANCZOS).convert("RGB")
    pad = Image.new("RGB", (big.width + 60, big.height + 60), (255, 255, 255))
    pad.paste(big, (30, 30))
    r = ENGINE(np.ascontiguousarray(np.array(pad)[:, :, ::-1]))
    return "".join(str(t) for t in (r.txts or []))


def read_stats(path: Path) -> list[str]:
    shot = Image.open(path).convert("RGB")
    out = []
    for row in range(2):
        for col in range(4):
            cx, cy = X + col * W // 4, Y + row * H // 2
            cell = shot.crop((cx + 63, cy + 15, cx + W // 4 - 8, cy + H // 2 - 15))
            val = "?"
            for scale in (2, 3):
                m = re.fullmatch(r"([\d,]+)%?", cell_text(cell, scale).replace(" ", ""))
                if m:
                    val = m.group(1).replace(",", "")
                    break
            out.append(val)
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ids = sys.argv[1:] or sorted(p.name[:3] for p in Path("data/monmon/raw").glob("*-0.png"))
    for no in ids:
        vals = read_stats(Path(f"data/monmon/raw/{no}-0.png"))
        Path(f"data/monmon/ocr/{no}.stats.txt").write_text(" ".join(vals) + "\n", encoding="utf-8")
        print(no, *vals, flush=True)
