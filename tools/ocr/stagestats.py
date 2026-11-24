"""단계별 보스 스탯 창 캡처(tools/capture/stagestats.ps1 의 stat-NN.png) → 표
실행: python tools/ocr/stagestats.py <캡처 폴더> <출력 csv>
스탯 창: 편성 화면 상단 ⓘ 를 누르면 뜨는 창 (보스 이름 + 체력·공격력·방어력·속도·치명확률·치명피해·효과저항·효과명중).
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import rapid  # noqa: E402

BOX = (285, 195, 640, 620)
LABELS = [("체력", "hp"), ("공격력", "atk"), ("방어력", "def"), ("속도", "spd"), ("치명확률", "critRate"), ("치명피해", "critDmg"), ("효과저항", "effRes"), ("효과명중", "effAcc")]


def read(path: Path) -> dict:
    a = np.array(Image.open(path).convert("RGB").crop(BOX))
    tmp = path.with_suffix(".box.png")
    Image.fromarray(a.max(axis=2)).convert("RGB").save(tmp)
    try:
        rows = rapid.rows(rapid.read(str(tmp)))
    finally:
        tmp.unlink()
    out = {"name": rows[0].split(" | ")[0] if rows else None}
    for r in rows:
        parts = [re.sub(r"\s*\(\?0\.\d+\)", "", p).strip() for p in r.split(" | ")]
        text = "".join(parts).replace(" ", "")
        for label, key in LABELS:
            if text.startswith(label) or any(p.replace(" ", "").endswith(label) for p in parts):
                nums = re.findall(r"[\d,]+", text[len(label):] if text.startswith(label) else parts[-1])
                if nums:
                    out[key] = int(nums[-1].replace(",", ""))
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    d, dst = Path(sys.argv[1]), Path(sys.argv[2])
    lines = ["단계,보스," + ",".join(l for l, _ in LABELS)]
    for f in sorted(d.glob("stat-[0-9][0-9].png")):
        r = read(f)
        n = int(f.stem[5:])
        lines.append(",".join([str(n), r.get("name") or ""] + [str(r.get(k, "")) for _, k in LABELS]))
        print(lines[-1])
    dst.write_text("﻿" + "\r\n".join(lines) + "\r\n", encoding="utf-8")
