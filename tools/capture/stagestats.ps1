# 던전 단계별 보스 스탯: 단계 목록 화면에서 시작해, 열린 단계마다 [전투] → 편성 화면 상단 ⓘ → 보스 스탯 창을 찍는다.
# [시작](에너지 사용)은 누르지 않는다. 잠긴 단계(전투 버튼 없음)를 만나면 멈춘다.
# 실행: pwsh tools/capture/stagestats.ps1 -Out data/dungeons/_raw/green-crystal -Python <python.exe> [-From 1] [-To 20]
#  → <Out>/stat-NN.png (보스 스탯 창 부분)
param([Parameter(Mandatory)][string]$Out, [Parameter(Mandatory)][string]$Python, [int]$From = 1, [int]$To = 20)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/game.ps1"
New-Item -ItemType Directory -Force $Out | Out-Null
$BACK = @(122, 1380); $INFO = @(520, 150)
$t = Join-Path $Out '_t.png'
$env:PYTHONIOENCODING = 'utf-8'
# 글자 하나를 찾아 @(x, y) 또는 $null
function Find-Text([string]$word) { Save-GameShot $t; $p = ((& $Python -I tools/ocr/locate.py $t $word) | Select-Object -First 1) -split ' '; if ($p[0] -eq '-') { return $null }; return ,@([int]$p[0], [int]$p[1]) }
function Invoke-ListTop { for ($i = 0; $i -lt 8; $i++) { Invoke-GameDrag 460 600 460 1250 12 250 } }
Invoke-ListTop
for ($n = $From; $n -le $To; $n++) {
  # 목록에서 "스테이지 N" 줄을 찾는다 (안 보이면 조금씩 내려 본다)
  $row = $null
  for ($k = 0; $k -lt 8 -and -not $row; $k++) {
    $row = Find-Text "스테이지 $n"
    if (-not $row -or $row[1] -gt 1200) { $row = $null; Invoke-GameDrag 460 1100 460 800 15 700 }
  }
  if (-not $row) { Write-Host "스테이지 $n 줄을 못 찾음 — 멈춤"; break }
  # 같은 줄 오른쪽의 [전투] 버튼 (잠겨 있으면 자물쇠라 편성 화면이 안 열림)
  Invoke-GameClick 680 ($row[1] + 45) 1800
  $start = Find-Text '시작'
  if (-not $start -or $start[1] -lt 1250) { Write-Host "스테이지 $n 은 잠김(편성 화면 없음) — 멈춤"; break }
  Invoke-GameClick $INFO[0] $INFO[1] 1000
  Save-GameShot (Join-Path $Out ('stat-{0:D2}.png' -f $n))
  Invoke-GameClick $INFO[0] $INFO[1] 600          # 스탯 창 닫기
  Invoke-GameClick $BACK[0] $BACK[1] 1500         # 단계 목록으로
  Write-Host "스테이지 $n 찍음"
}
Remove-Item $t -ErrorAction SilentlyContinue
