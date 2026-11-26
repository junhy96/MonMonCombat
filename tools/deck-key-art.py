"""열쇠 몬몬 그림을 배경 없이 오려 가운데 맞춤 → docs/deck/assets/key-*.png (PPT 열쇠 몬몬 슬라이드)
도감 그림(data/monmon/art/NNN.png, 400×400)은 배경이 칠해져 있고 왼쪽에 게임 UI 조각이 붙어 있어,
굵은 검은 외곽선 바깥(테두리에서 이어진 밝은 영역)을 배경으로 보고 지운 뒤 몬스터만 정사각형 가운데에 둠.
실행: python tools/deck-key-art.py
"""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/deck/assets"
KEYS = {"099": "톡찌리", "055": "멘티삿", "010": "토볼트"}
UI_STRIP = 46      # 왼쪽 UI 조각 폭 (px)
DARK = 80          # 외곽선으로 보는 밝기
PAD = 0.10         # 오린 뒤 둘레 여백 비율
STEP = 14          # 배경으로 번지는 이웃 색 차이 (RGB 합)


def cutout(src):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
    bg = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    for x in range(UI_STRIP):          # UI 조각 칸은 통째로 배경
        for y in range(h):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        if bg[x][y]:
            continue
        bg[x][y] = True
        c = px[x, y]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not bg[nx][ny]:
                n = px[nx, ny]
                # 배경은 부드러운 그라데이션 → 이웃끼리 색이 비슷할 때만 번짐. 외곽선(어두움)이나 색이 확 바뀌는 곳에서 멈춤
                if nx < UI_STRIP or abs(n[0] - c[0]) + abs(n[1] - c[1]) + abs(n[2] - c[2]) <= STEP:   # 어두운 배경(토볼트)도 번지게, 외곽선과의 큰 색 차이에서 멈춤
                    q.append((nx, ny))
    for x in range(w):
        for y in range(h):
            if bg[x][y]:
                px[x, y] = (0, 0, 0, 0)
    box = im.getbbox()
    sub = im.crop(box)
    side = int(max(sub.size) * (1 + 2 * PAD))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(sub, ((side - sub.width) // 2, (side - sub.height) // 2), sub)
    return canvas, box


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for num, name in KEYS.items():
        img, box = cutout(ROOT / f"data/monmon/art/{num}.png")
        img.resize((512, 512), Image.LANCZOS).save(OUT / f"key-{num}.png")
        print(num, name, "몬스터 영역", box, "→", OUT / f"key-{num}.png")


if __name__ == "__main__":
    main()
