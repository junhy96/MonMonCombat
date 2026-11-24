# 몬몬 마스터즈(Google Play Games, crosvm) 창 캡처·클릭 도구 — 도감 수집 스크립트가 불러 쓴다.
# 좌표는 모두 "창 안" 기준 픽셀(창 왼쪽 위 = 0,0). 창 크기가 바뀌면 클릭 위치가 어긋나므로 시작할 때 크기를 확인한다.
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class MM {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
[void][MM]::SetProcessDPIAware()

function Get-GameWindow {
  $p = Get-Process crosvm -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*몬몬*' } | Select-Object -First 1
  if (-not $p) { throw '몬몬 마스터즈 창을 찾지 못했습니다' }
  $r = New-Object MM+RECT
  [void][MM]::GetWindowRect($p.MainWindowHandle, [ref]$r)
  [pscustomobject]@{ Handle = $p.MainWindowHandle; X = $r.L; Y = $r.T; W = $r.R - $r.L; H = $r.B - $r.T }
}

function Save-GameShot([string]$Path) {
  $g = Get-GameWindow
  [void][MM]::SetForegroundWindow($g.Handle)
  $bmp = New-Object System.Drawing.Bitmap $g.W, $g.H
  $gr = [System.Drawing.Graphics]::FromImage($bmp)
  $gr.CopyFromScreen($g.X, $g.Y, 0, 0, $bmp.Size)
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $gr.Dispose(); $bmp.Dispose()
}

function Invoke-GameClick([int]$X, [int]$Y, [int]$WaitMs = 600) {
  $g = Get-GameWindow
  [void][MM]::SetForegroundWindow($g.Handle)
  [void][MM]::SetCursorPos($g.X + $X, $g.Y + $Y)
  Start-Sleep -Milliseconds 60
  [MM]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)  # 왼쪽 누름
  Start-Sleep -Milliseconds 60
  [MM]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)  # 왼쪽 뗌
  Start-Sleep -Milliseconds $WaitMs
}

# 끌기: (X1,Y1)에서 눌러 (X2,Y2)까지 천천히 옮긴 뒤 뗀다 — 팝업 안쪽 스크롤용
function Invoke-GameDrag([int]$X1, [int]$Y1, [int]$X2, [int]$Y2, [int]$Steps = 20, [int]$WaitMs = 600) {
  $g = Get-GameWindow
  [void][MM]::SetForegroundWindow($g.Handle)
  [void][MM]::SetCursorPos($g.X + $X1, $g.Y + $Y1)
  Start-Sleep -Milliseconds 60
  [MM]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  for ($i = 1; $i -le $Steps; $i++) {
    [void][MM]::SetCursorPos($g.X + $X1 + [int](($X2 - $X1) * $i / $Steps), $g.Y + $Y1 + [int](($Y2 - $Y1) * $i / $Steps))
    Start-Sleep -Milliseconds 15
  }
  Start-Sleep -Milliseconds 150   # 멈춘 채로 잠깐 두어 관성으로 더 밀리지 않게
  [MM]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds $WaitMs
}

# 휠: 화면 (X,Y)에서 Clicks 칸만큼 (음수 = 아래로)
function Invoke-GameWheel([int]$X, [int]$Y, [int]$Clicks = -3, [int]$WaitMs = 600) {
  $g = Get-GameWindow
  [void][MM]::SetForegroundWindow($g.Handle)
  [void][MM]::SetCursorPos($g.X + $X, $g.Y + $Y)
  Start-Sleep -Milliseconds 60
  [MM]::mouse_event(0x0800, 0, 0, [BitConverter]::ToUInt32([BitConverter]::GetBytes([int]($Clicks * 120)), 0), [UIntPtr]::Zero)
  Start-Sleep -Milliseconds $WaitMs
}
