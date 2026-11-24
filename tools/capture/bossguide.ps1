# 보스 공략 창(던전 → 보스 공략) 스크랩: 지금 열려 있는 보스 한 명을 찍는다.
#  - 공략 정보 탭: 초반·중반·후반 구간 탭마다, 창 안쪽을 끝까지 끌어 내리며 찍기 → <Out>/info-<구간>-NN.png
#  - 보스 스킬 탭: 끝까지 끌어 내리며 찍기 → <Out>/skills-NN.png
# 화면이 더 안 바뀌면(끝까지 내려감) 멈춘다. 입장·전투 버튼은 누르지 않는다.
# 좌표는 창 854×1440 기준 (2026-11-25 카니보 화면에서 잼).
param([Parameter(Mandatory)][string]$Out, [int]$MaxScroll = 12, [switch]$SkillsOnly, [switch]$Stages, [string]$Python)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/game.ps1"
New-Item -ItemType Directory -Force $Out | Out-Null
$TAB_INFO = @(298, 225); $TAB_SKILL = @(620, 225)
$BANDS = [ordered]@{ early = @(257, 1065); mid = @(452, 1065); late = @(654, 1065) }   # 맨 위로 올린 상태에서의 위치
$BODY = @{ X = 150; Y = 290; W = 620; H = 1040 }   # 창 안쪽(스크롤되는 곳)
$DETAIL = @(745, 318)   # 보스 스킬 탭의 "자세히 보기" 스위치 (켜지면 파란색)
function Test-DetailOn { $t = Join-Path $Out '_t.png'; Save-GameShot $t; $b = [System.Drawing.Bitmap]::FromFile((Resolve-Path $t)); try { $c = $b.GetPixel($DETAIL[0] - 22, $DETAIL[1]); return ($c.B -gt 180 -and $c.R -lt 120) } finally { $b.Dispose(); Remove-Item $t } }
function Get-RegionHash($path, $r) {
  $b = [System.Drawing.Bitmap]::FromFile((Resolve-Path $path))
  try { $sb = New-Object System.Text.StringBuilder; for ($y = $r.Y; $y -lt $r.Y + $r.H; $y += 6) { for ($x = $r.X; $x -lt $r.X + $r.W; $x += 6) { $c = $b.GetPixel($x, $y); [void]$sb.Append([char](65 + [int](($c.R + $c.G + $c.B) / 48))) } }; return $sb.ToString() } finally { $b.Dispose() }
}
function Get-Similarity($a, $b) { if ($a.Length -ne $b.Length) { return 0 }; $s = 0; for ($i = 0; $i -lt $a.Length; $i++) { if ($a[$i] -eq $b[$i]) { $s++ } }; return $s / $a.Length }
function Invoke-ToTop { for ($i = 0; $i -lt 6; $i++) { Invoke-GameDrag 460 500 460 1250 12 250 } ; Start-Sleep -Milliseconds 500 }
function Save-Scrolled([string]$prefix) {
  $n = 1; $f = Join-Path $Out ('{0}-{1:D2}.png' -f $prefix, $n); Save-GameShot $f; $prev = Get-RegionHash $f $BODY
  for ($s = 1; $s -le $MaxScroll; $s++) {
    Invoke-GameDrag 460 1200 460 650 20 700
    $f = Join-Path $Out ('{0}-{1:D2}.png' -f $prefix, ($n + 1)); Save-GameShot $f
    $now = Get-RegionHash $f $BODY
    if ((Get-Similarity $prev $now) -gt 0.995) { Remove-Item $f; break }
    $prev = $now; $n++
  }
  Write-Host "$prefix → $n 장"
}
if ($Stages) {
  $CLOSE = @(748, 133); $LIST = @{ X = 150; Y = 450; W = 620; H = 860 }
  Invoke-GameClick $CLOSE[0] $CLOSE[1] 900
  for ($i = 0; $i -lt 8; $i++) { Invoke-GameDrag 460 600 460 1250 12 250 }
  $n = 1; $f = Join-Path $Out ('stages-{0:D2}.png' -f $n); Save-GameShot $f; $prev = Get-RegionHash $f $LIST
  for ($k = 1; $k -le 10; $k++) {
    Invoke-GameDrag 460 1200 460 650 20 700
    $f = Join-Path $Out ('stages-{0:D2}.png' -f ($n + 1)); Save-GameShot $f; $now = Get-RegionHash $f $LIST
    if ((Get-Similarity $prev $now) -gt 0.995) { Remove-Item $f; break }
    $prev = $now; $n++
  }
  Write-Host "stages: $n"; exit 0
}
if (-not $SkillsOnly) {
Invoke-GameClick $TAB_INFO[0] $TAB_INFO[1] 800
foreach ($band in $BANDS.Keys) {
  Invoke-ToTop
  # 구간 탭 위치는 소개 글 길이에 따라 달라서, 화면에서 "1~6" 같은 글자를 찾아 누른다 (없으면 기본 위치)
  $pos = $BANDS[$band]
  if ($Python) {
    $t = Join-Path $Out '_t.png'; Save-GameShot $t
    # 구간이 둘뿐인 던전(초반 1~6 · 후반 7~20)도 있다 → 후반은 "16~20" 또는 "7~20", 못 찾은 구간은 건너뜀
    $labels = @{ early = @('초반'); mid = @('중반'); late = @('후반') }[$band]   # 구간 경계(1~6, 7~11 …)는 던전마다 달라서 이름으로 찾는다
    $env:PYTHONIOENCODING = 'utf-8'
    $found = $null
    foreach ($label in $labels) { $xy = (& $Python -I tools/ocr/locate.py $t $label) -split ' '; if ($xy[0] -ne '-') { $found = $xy; break } }
    Remove-Item $t
    if (-not $found) { Write-Host "$band 구간 탭 없음 — 건너뜀"; continue }
    $pos = @([int]$found[0], ([int]$found[1] - 20))
  }
  Invoke-GameClick $pos[0] $pos[1] 700
  Save-Scrolled "info-$band"
}
}
Invoke-GameClick $TAB_SKILL[0] $TAB_SKILL[1] 800
Invoke-ToTop
if (-not (Test-DetailOn)) { Invoke-GameClick $DETAIL[0] $DETAIL[1] 800 }   # 자세한 설명으로
if (-not (Test-DetailOn)) { Write-Host '자세히 보기 스위치를 켜지 못함 — 멈춤'; exit 1 }
Get-ChildItem (Join-Path $Out 'skills-*.png') -ErrorAction SilentlyContinue | Remove-Item
Save-Scrolled 'skills'
Invoke-GameClick $TAB_INFO[0] $TAB_INFO[1] 600
Invoke-ToTop
# (아래는 -Stages 로만) 보스 공략 창을 닫고 던전 단계 목록(스테이지 번호·보스 레벨·보상)을 끝까지 끌어 내리며 찍는다 → <Out>/stages-NN.png
