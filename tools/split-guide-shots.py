"""분열 보스 공략 창 목업을 탭 · 구간별로 잘라 찍기 — docs/split-guide/shots/*.png
index.html 의 캡처 모드(#shot=…)로 창 틀은 두고 그 부분만 보이게 한 뒤, 헤드리스 크롬으로 찍고 빈 배경을 잘라냄.
실행: node tools/split-guide.mjs && python tools/split-guide-shots.py
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
PAGE = (ROOT / "docs/split-guide/index.html").as_uri()
OUT = ROOT / "docs/split-guide/shots"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
SHOTS = [  # (파일, 캡처 모드, 무엇)
    ("01-overview.png", "overview", "공략 정보 — 보스 소개"),
    ("02-points-early.png", "band-0", "공략 포인트 — 초반 1~6"),
    ("03-points-mid.png", "band-1", "공략 포인트 — 중반 7~15"),
    ("04-points-late.png", "band-2", "공략 포인트 — 후반 16~20"),
    ("05-needed.png", "needed", "필요한 효과"),
    ("06-skills-1.png", "skills-1", "보스 스킬 ① (1~5)"),
    ("07-skills-2.png", "skills-2", "보스 스킬 ② (6~10)"),
]
PAD = 24  # 잘라낸 뒤 둘레 여백 (px, 2배율)


def trim(path):
    im = Image.open(path).convert("RGB")
    bg = Image.new("RGB", im.size, im.getpixel((2, 2)))
    box = ImageChops.difference(im, bg).point(lambda v: 255 if v > 12 else 0).getbbox()
    l, t, r, b = box
    im.crop((max(0, l - PAD), max(0, t - PAD), min(im.width, r + PAD), min(im.height, b + PAD))).save(path, optimize=True)
    return im.size, (r - l, b - t)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as prof:
        for fn, mode, what in SHOTS:
            out = OUT / fn
            subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={prof}",
                            "--force-device-scale-factor=2", "--window-size=520,2600", "--virtual-time-budget=4000",
                            f"--screenshot={out}", f"{PAGE}#shot={mode}"], check=True, capture_output=True, timeout=120)
            _, size = trim(out)
            print(f"{fn}  {what}  {size[0]}x{size[1]}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
