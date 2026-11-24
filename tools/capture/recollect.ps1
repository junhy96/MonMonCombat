# 다시 찍기: 지금 화면(마지막으로 찍은 번호 -From)에서 < 로 거슬러 가며, 지정한 번호만 스킬 팝업을 다른 위치로 다시 찍는다.
# 레어(별 3개)는 스킬 원이 3개라 위치가 다름: 309 / 458 / 609. (전설·에픽 4개 235/385/533/683, 고급·일반 2개 384/534)
# 번호가 맞는지는 저장해 둔 상세 화면(<번호>-0.png)의 이름 영역과 비교해서 확인하고, 다르면 멈춘다.
param([int]$From, [string]$IdList, [int[]]$Xs = @(309, 458, 609), [string]$Raw = 'data/monmon/raw', [int]$WaitPopup = 900)
$ErrorActionPreference = 'Stop'
$Ids = @($IdList.Split(',') | ForEach-Object { [int]$_.Trim() })
. "$PSScriptRoot/game.ps1"
$PREV = @(175, 628); $CLOSE = @(600, 230)
$NAME = @{ X = 170; Y = 130; W = 360; H = 60 }
function Get-RegionHash($path, $r) {
  $b = [System.Drawing.Bitmap]::FromFile((Resolve-Path $path))
  try { $sb = New-Object System.Text.StringBuilder; for ($y = $r.Y; $y -lt $r.Y + $r.H; $y += 4) { for ($x = $r.X; $x -lt $r.X + $r.W; $x += 4) { $c = $b.GetPixel($x, $y); [void]$sb.Append([char](65 + [int](($c.R + $c.G + $c.B) / 48))) } }; return $sb.ToString() } finally { $b.Dispose() }
}
function Get-Similarity($a, $b) { if ($a.Length -ne $b.Length) { return 0 }; $s = 0; for ($i = 0; $i -lt $a.Length; $i++) { if ($a[$i] -eq $b[$i]) { $s++ } }; return $s / $a.Length }
$tmp = Join-Path $Raw '_now.png'
$log = Join-Path $Raw 'recollect-log.txt'
$min = ($Ids | Measure-Object -Minimum).Minimum
$max = ($Ids | Measure-Object -Maximum).Maximum
# 지금 위치가 다시 찍을 범위보다 앞이면 > 로 맨 뒤 번호까지 먼저 간다 (찍지 않고 번호만 확인)
for ($n = $From; $n -lt $max; $n++) {
  Save-GameShot $tmp
  $sim = Get-Similarity (Get-RegionHash $tmp $NAME) (Get-RegionHash (Join-Path $Raw ('{0:D3}-0.png' -f $n)) $NAME)
  if ($sim -lt 0.95) { Add-Content $log "$n 이동 중 이름이 다름 — 멈춤"; Write-Host "멈춤: $n 위치가 어긋남"; exit 1 }
  Invoke-GameClick 745 628 1200
}
if ($From -lt $max) { $From = $max }
for ($n = $From; $n -ge $min; $n--) {
  $id = '{0:D3}' -f $n
  Save-GameShot $tmp
  $sim = Get-Similarity (Get-RegionHash $tmp $NAME) (Get-RegionHash (Join-Path $Raw "$id-0.png") $NAME)
  if ($sim -lt 0.95) { Add-Content $log "$id 이름이 저장한 것과 다름 ($([math]::Round($sim, 2))) — 멈춤"; Write-Host "멈춤: $id 위치가 어긋남"; exit 1 }
  if ($Ids -contains $n) {
    1..4 | ForEach-Object { Remove-Item (Join-Path $Raw "$id-$_.png") -ErrorAction SilentlyContinue }
    for ($k = 0; $k -lt $Xs.Count; $k++) {
      Invoke-GameClick $Xs[$k] 793 $WaitPopup
      Save-GameShot (Join-Path $Raw "$id-$($k + 1).png")
      Invoke-GameClick $CLOSE[0] $CLOSE[1] 500
    }
    Add-Content $log "$id 다시 찍음 ($($Xs.Count)개)"; Write-Host "$id 다시 찍음"
  }
  if ($n -gt $min) { Invoke-GameClick $PREV[0] $PREV[1] 1200 }
}
Remove-Item $tmp -ErrorAction SilentlyContinue
