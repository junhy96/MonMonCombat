# 보스 하나 전부: 열려 있는 보스 공략 창 → 공략 정보·보스 스킬 찍기 → 창 닫고 단계 목록 찍기 → 글자 읽기 → 표
# 실행: pwsh tools/capture/boss.ps1 -Name green-crystal -Python <rapidocr 가 깔린 python.exe>
#  → data/dungeons/_raw/<Name>/ (캡처·OCR 글자), data/dungeons/<Name>/ (guide.json, boss-stages.csv, boss-skills.csv)
param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string]$Python)
$ErrorActionPreference = 'Stop'
$raw = "data/dungeons/_raw/$Name"
& pwsh -NoProfile -File "$PSScriptRoot/bossguide.ps1" -Out $raw -Python $Python
if ($LASTEXITCODE) { throw '보스 공략 찍기 실패' }
& pwsh -NoProfile -File "$PSScriptRoot/bossguide.ps1" -Out $raw -Stages
$env:PYTHONIOENCODING = 'utf-8'
& $Python -I tools/ocr/guide.py $raw | Out-Null
& $Python -I -c "import sys,re; sys.path.insert(0,'tools/ocr'); import guide; from pathlib import Path; guide.BODY=(150,440,780,1320); d=Path(r'$raw'); fs=sorted(d.glob('stages-[0-9][0-9].png')); (d/'stages.txt').write_text('\n'.join(guide.merge([guide.read_body(f) for f in fs]))+'\n', encoding='utf-8')"
node tools/ocr/bossguide.mjs $raw "data/dungeons/$Name"
