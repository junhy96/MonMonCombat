"""보스 공략 창 캡처(tools/capture/bossguide.ps1) → 글자. 끌어 내리며 찍은 여러 장을 이어 붙여, 겹친 줄은 한 번만.
실행: python tools/ocr/guide.py <캡처 폴더> [...]   → 폴더 안 info-early.txt, info-mid.txt, info-late.txt, skills.txt
"""
import re
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import rapid  # noqa: E402

BODY = (150, 290, 770, 1335)   # 창 안쪽 (854×1440 캡처 기준)


def read_body(path: Path) -> list[str]:
    # 어두운 바탕의 빨간 글씨([기절] 등)를 놓치지 않게: 각 픽셀의 R·G·B 중 가장 큰 값으로 흑백을 만든다
    import numpy as np
    a = np.array(Image.open(path).convert("RGB").crop(BODY))
    img = Image.fromarray(a.max(axis=2)).convert("RGB")
    tmp = path.with_suffix(".body.png")
    img.save(tmp)
    try:
        return rapid.rows(rapid.read(str(tmp)))
    finally:
        tmp.unlink()


def merge(pages: list[list[str]]) -> list[str]:
    """앞 장의 끝과 다음 장의 앞이 겹치는 만큼 빼고 잇는다"""
    key = lambda s: re.sub(r"\s|\(\?0\.\d+\)", "", s)
    out: list[str] = []
    for page in pages:
        best = 0
        for k in range(min(len(out), len(page)), 0, -1):
            if [key(x) for x in out[-k:]] == [key(x) for x in page[:k]]:
                best = k
                break
        out += page[best:]
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for d in map(Path, sys.argv[1:]):
        for prefix in ("info-early", "info-mid", "info-late", "skills"):
            files = sorted(d.glob(f"{prefix}-[0-9][0-9].png"))
            if not files:
                continue
            text = "\n".join(merge([read_body(f) for f in files]))
            (d / f"{prefix}.txt").write_text(text + "\n", encoding="utf-8")
            print(f"== {d.name} {prefix} ({len(files)}장)\n{text}\n")
