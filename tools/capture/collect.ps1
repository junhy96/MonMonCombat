# 도감 수집: 상세 화면에서 시작해 몬몬마다 [상세 화면 + 스킬 4개 팝업]을 캡처하고 > 로 다음 몬몬으로 넘어간다.
# 사용: pwsh -File tools/capture/collect.ps1 [-Max 300] [-Out data/monmon/raw] [-Start 1]
#  - 시작 전에 게임을 도감 첫 몬몬의 상세 화면에 두고, 도는 동안 마우스·창을 건드리지 않는다.
#  - 첫 몬몬의 이름 영역으로 돌아오면(한 바퀴) 멈춘다. 상세 화면이 아니면(다른 화면으로 샜으면) 멈춘다.
#  - 파일: <번호>-0.png = 상세, <번호>-1~4.png = 스킬 팝업. log.txt에 진행 기록.
param([int]$Max = 300, [string]$Out = 'data/monmon/raw', [int]$Start = 1, [int]$WaitPopup = 900, [int]$WaitNext = 1200)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/game.ps1"

# ── 좌표 (창 854×1440 기준) ──
$SKILLS = @(@(235, 793), @(385, 793), @(533, 793), @(683, 793))
$NEXT = @(745, 628)
$CLOSE = @(600, 230)        # 팝업 닫기: 레벨 표시 오른쪽 빈 곳 (보정에서 확인 — 아래 획득 방법 버튼은 피함)
$NAME = @{ X = 170; Y = 130; W = 360; H = 60 }      # 몬몬 이름 영역 (한 바퀴 판정)
$FOOT = @{ X = 450; Y = 1330; W = 380; H = 90 }     # 아래 "기본정보·상세정보·미션" 버튼 (상세 화면 판정)

$g = Get-GameWindow
if ($g.W -ne 854 -or $g.H -ne 1440) { throw "창 크기가 $($g.W)x$($g.H) 입니다 — 854x1440일 때 좌표를 맞췄습니다" }
New-Item -ItemType Directory -Force $Out | Out-Null
$log = Join-Path $Out 'log.txt'

function Get-RegionHash($path, $r) {
  $b = [System.Drawing.Bitmap]::FromFile((Resolve-Path $path))
  try {
    $sb = New-Object System.Text.StringBuilder
    for ($y = $r.Y; $y -lt $r.Y + $r.H; $y += 4) { for ($x = $r.X; $x -lt $r.X + $r.W; $x += 4) { $c = $b.GetPixel($x, $y); [void]$sb.Append([char](65 + [int](($c.R + $c.G + $c.B) / 48))) } }
    return $sb.ToString()
  } finally { $b.Dispose() }
}
function Get-Similarity($a, $b) { if ($a.Length -ne $b.Length) { return 0 }; $s = 0; for ($i = 0; $i -lt $a.Length; $i++) { if ($a[$i] -eq $b[$i]) { $s++ } }; return $s / $a.Length }

$firstName = $null; $footRef = $null; $prevName = $null
for ($n = $Start; $n -lt $Start + $Max; $n++) {
  $id = '{0:D3}' -f $n
  $detail = Join-Path $Out "$id-0.png"
  Save-GameShot $detail
  $nameHash = Get-RegionHash $detail $NAME
  $footHash = Get-RegionHash $detail $FOOT
  if (-not $footRef) { $footRef = $footHash }
  elseif ((Get-Similarity $footHash $footRef) -lt 0.9) { Add-Content $log "$id 상세 화면이 아님 — 멈춤"; Write-Host "멈춤: $id 상세 화면이 아님"; break }
  if (-not $firstName) { $firstName = $nameHash }
  elseif ($n -gt $Start + 1 -and (Get-Similarity $nameHash $firstName) -gt 0.97) { Remove-Item $detail; Add-Content $log "$id 첫 몬몬으로 돌아옴 — 끝"; Write-Host "끝: 한 바퀴 ($($n - $Start)개)"; break }
  if ($prevName -and (Get-Similarity $nameHash $prevName) -gt 0.99) { Remove-Item $detail; Add-Content $log "$id 앞 몬몬과 같음(> 가 더 넘어가지 않음) — 끝"; Write-Host "끝: 더 넘어가지 않음"; break }
  $prevName = $nameHash

  for ($k = 0; $k -lt 4; $k++) {
    Invoke-GameClick $SKILLS[$k][0] $SKILLS[$k][1] $WaitPopup
    Save-GameShot (Join-Path $Out "$id-$($k + 1).png")
    Invoke-GameClick $CLOSE[0] $CLOSE[1] 500
  }
  Add-Content $log "$id ok $(Get-Date -Format 'HH:mm:ss')"
  Write-Host "$id ok"
  Invoke-GameClick $NEXT[0] $NEXT[1] $WaitNext
}
