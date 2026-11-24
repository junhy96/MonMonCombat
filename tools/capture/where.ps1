# 지금 게임 화면이 몇 번 몬몬인지: 이름 영역을 저장해 둔 상세 화면(<번호>-0.png)들과 비교해 가장 비슷한 번호를 찾는다.
param([string]$Raw = 'data/monmon/raw')
. "$PSScriptRoot/game.ps1"
$NAME = @{ X = 170; Y = 130; W = 360; H = 60 }
function Get-NameHash($p) { $b = [System.Drawing.Bitmap]::FromFile((Resolve-Path $p)); try { $sb = New-Object System.Text.StringBuilder; for ($y = $NAME.Y; $y -lt $NAME.Y + $NAME.H; $y += 4) { for ($x = $NAME.X; $x -lt $NAME.X + $NAME.W; $x += 4) { $c = $b.GetPixel($x, $y); [void]$sb.Append([char](65 + [int](($c.R + $c.G + $c.B) / 48))) } }; $sb.ToString() } finally { $b.Dispose() } }
$tmp = Join-Path $Raw '_now.png'
Save-GameShot $tmp
$now = Get-NameHash $tmp
Get-ChildItem (Join-Path $Raw '*-0.png') | ForEach-Object {
  $h = Get-NameHash $_.FullName; $s = 0; for ($i = 0; $i -lt $h.Length; $i++) { if ($h[$i] -eq $now[$i]) { $s++ } }
  [pscustomobject]@{ Id = $_.Name.Substring(0, 3); Sim = [math]::Round($s / $h.Length, 3) }
} | Sort-Object Sim -Descending | Select-Object -First 3
