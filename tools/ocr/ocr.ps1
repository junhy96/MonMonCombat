# Windows 내장 OCR(Windows.Media.Ocr, 한국어)로 이미지 글자 읽기 — Windows PowerShell 5.1에서 실행 (WinRT).
# 사용: powershell -NoProfile -File tools/ocr/ocr.ps1 <이미지> [x y w h] [배율]
#  출력: 줄마다 "y<TAB>x<TAB>글자" (원본 좌표)
param([string]$Path, [int]$X = 0, [int]$Y = 0, [int]$W = 0, [int]$H = 0, [double]$Scale = 2)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Path))
if ($W -le 0) { $W = $src.Width - $X }; if ($H -le 0) { $H = $src.Height - $Y }
$dst = New-Object System.Drawing.Bitmap ([int]($W * $Scale)), ([int]($H * $Scale))
$g = [System.Drawing.Graphics]::FromImage($dst); $g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $dst.Width, $dst.Height), (New-Object System.Drawing.Rectangle $X, $Y, $W, $H), 'Pixel')
$tmp = [System.IO.Path]::GetTempFileName() + '.png'; $dst.Save($tmp); $g.Dispose(); $dst.Dispose(); $src.Dispose()

$lang = New-Object Windows.Globalization.Language 'ko'
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if (-not $engine) { throw '한국어 OCR이 설치되어 있지 않습니다' }
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tmp)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
foreach ($l in $res.Lines) { $r = (@($l.Words) | Select-Object -First 1).BoundingRect; "{0}`t{1}`t{2}" -f [int]($Y + $r.Y / $Scale), [int]($X + $r.X / $Scale), $l.Text }
$stream.Dispose(); Remove-Item $tmp
