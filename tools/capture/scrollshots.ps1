# 잘린 스킬 팝업 다시 찍기: 팝업을 열고 안쪽을 아래로 스크롤하며 <번호>-<칸>-s1.png, -s2.png … 를 찍는다 (화면이 더 안 바뀌면 멈춤).
# 목록 파일: 한 줄에 "<번호> <칸>" (칸 = 1부터, 스킬 순서). node tools/ocr/cutlist.mjs 가 만든다.
# 걷는 방법은 recollect.ps1 과 같다: 지금 화면(-From 번호)에서 > 로 목록의 맨 뒤 번호까지 간 뒤 < 로 거슬러 오며 찍는다.
# 번호가 맞는지는 저장해 둔 상세 화면(<번호>-0.png)의 이름 영역과 비교해서 확인하고, 다르면 멈춘다.
# 스킬 원 위치: 4개 235/385/533/683 · 3개 309/458/609 · 2개 384/534 (y 793)
param([int]$From, [string]$List = 'data/monmon/raw/cut-list.txt', [string]$Raw = 'data/monmon/raw', [int]$WaitPopup = 900,
      [ValidateSet('wheel', 'drag')][string]$Mode = 'drag', [int]$MaxScroll = 4)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/game.ps1"
$PREV = @(175, 628); $NEXT = @(745, 628); $CLOSE = @(600, 230)
$XS = @{ 4 = @(235, 385, 533, 683); 3 = @(309, 458, 609); 2 = @(384, 534) }
$NAME = @{ X = 170; Y = 130; W = 360; H = 60 }
$PANEL = @{ X = 170; Y = 120; W = 580; H = 620 }   # 팝업 안쪽(스크롤이 바뀌었는지 볼 곳)
function Get-RegionHash($path, $r) {
  $b = [System.Drawing.Bitmap]::FromFile((Resolve-Path $path))
  try { $sb = New-Object System.Text.StringBuilder; for ($y = $r.Y; $y -lt $r.Y + $r.H; $y += 4) { for ($x = $r.X; $x -lt $r.X + $r.W; $x += 4) { $c = $b.GetPixel($x, $y); [void]$sb.Append([char](65 + [int](($c.R + $c.G + $c.B) / 48))) } }; return $sb.ToString() } finally { $b.Dispose() }
}
function Get-Similarity($a, $b) { if ($a.Length -ne $b.Length) { return 0 }; $s = 0; for ($i = 0; $i -lt $a.Length; $i++) { if ($a[$i] -eq $b[$i]) { $s++ } }; return $s / $a.Length }
function Invoke-Scroll { if ($Mode -eq 'wheel') { Invoke-GameWheel 460 500 -5 900 } else { Invoke-GameDrag 460 680 460 330 20 900 } }

# 목록: 번호 → @{ N = 스킬 수; Slots = @(칸...) }
$jobs = @{}
foreach ($line in Get-Content $List) {
  $p = $line.Trim() -split '\s+'; if ($p.Count -lt 3) { continue }
  $n = [int]$p[0]
  if (-not $jobs.ContainsKey($n)) { $jobs[$n] = @{ N = [int]$p[2]; Slots = @() } }
  $jobs[$n].Slots += [int]$p[1]
}
$tmp = Join-Path $Raw '_now.png'; $log = Join-Path $Raw 'scroll-log.txt'
$ids = @($jobs.Keys | Sort-Object); $min = $ids[0]; $max = $ids[-1]
function Assert-At($n) {
  Save-GameShot $tmp
  $sim = Get-Similarity (Get-RegionHash $tmp $NAME) (Get-RegionHash (Join-Path $Raw ('{0:D3}-0.png' -f $n)) $NAME)
  if ($sim -lt 0.95) { Add-Content $log ('{0:D3} 이름이 저장한 것과 다름 ({1}) — 멈춤' -f $n, [math]::Round($sim, 2)); Write-Host "멈춤: $n 위치가 어긋남"; exit 1 }
}
for ($n = $From; $n -lt $max; $n++) { Assert-At $n; Invoke-GameClick $NEXT[0] $NEXT[1] 1200 }
if ($From -lt $max) { $From = $max }
for ($n = $From; $n -ge $min; $n--) {
  Assert-At $n
  if ($jobs.ContainsKey($n)) {
    $id = '{0:D3}' -f $n; $pos = $XS[[int]$jobs[$n]['N']]
    foreach ($k in $jobs[$n].Slots) {
      Get-ChildItem (Join-Path $Raw "$id-$k-s*.png") -ErrorAction SilentlyContinue | Remove-Item
      Invoke-GameClick $pos[$k - 1] 793 $WaitPopup
      Save-GameShot $tmp; $before = Get-RegionHash $tmp $PANEL; $shots = 0
      for ($s = 1; $s -le $MaxScroll; $s++) {
        Invoke-Scroll
        $f = Join-Path $Raw "$id-$k-s$s.png"; Save-GameShot $f
        $now = Get-RegionHash $f $PANEL
        if ((Get-Similarity $before $now) -gt 0.995) { Remove-Item $f; break }   # 더 안 내려감
        $before = $now; $shots++
      }
      Invoke-GameClick $CLOSE[0] $CLOSE[1] 500
      Add-Content $log "$id 칸 $k 스크롤 $shots 장"; Write-Host "$id 칸 $k → $shots 장"
    }
  }
  if ($n -gt $min) { Invoke-GameClick $PREV[0] $PREV[1] 1200 }
}
Remove-Item $tmp -ErrorAction SilentlyContinue
