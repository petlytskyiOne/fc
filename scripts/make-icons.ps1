# Генерує PNG-іконки "Cards": біла картка на синьому градієнті.
# Геометрія та сама, що у векторній іконці android/.../drawable/ic_launcher_fg_cards.xml
# (полотно 108 одиниць, видима частина — центральні 72).
# Запуск: powershell -ExecutionPolicy Bypass -File scripts\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$res = Join-Path $root 'android\app\src\main\res'
$public = Join-Path $root 'public'

$blueTop = [System.Drawing.Color]::FromArgb(255, 0x3B, 0x6F, 0xF0)
$blueBottom = [System.Drawing.Color]::FromArgb(255, 0x1D, 0x3F, 0xA8)
$white = [System.Drawing.Color]::White
$backCard = [System.Drawing.Color]::FromArgb(115, 255, 255, 255)
$lineColor = [System.Drawing.Color]::FromArgb(255, 0xC3, 0xD3, 0xF7)
$accentLine = [System.Drawing.Color]::FromArgb(255, 0x3B, 0x6F, 0xF0)

function New-RoundRect([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# Малює картки в одиницях 108-полотна; $u — пікселів на одиницю, ($ox,$oy) — зсув початку полотна
function Draw-Cards($g, [single]$u, [single]$ox, [single]$oy) {
  $state = $g.Save()
  $g.TranslateTransform($ox, $oy)
  $g.ScaleTransform($u, $u)

  # Задня картка: центр (58,50), поворот +9°
  $s1 = $g.Save()
  $g.TranslateTransform(58, 50); $g.RotateTransform(9)
  $p = New-RoundRect -23 -17 46 34 5
  $g.FillPath((New-Object System.Drawing.SolidBrush $backCard), $p)
  $g.Restore($s1)

  # Передня картка: центр (53,57), поворот -5°
  $s2 = $g.Save()
  $g.TranslateTransform(53, 57); $g.RotateTransform(-5)
  $p = New-RoundRect -23 -17 46 34 5
  $g.FillPath((New-Object System.Drawing.SolidBrush $white), $p)
  $g.FillPath((New-Object System.Drawing.SolidBrush $accentLine), (New-RoundRect -15 -9 18 3.6 1.8))
  $g.FillPath((New-Object System.Drawing.SolidBrush $lineColor), (New-RoundRect -15 -1.8 30 3.6 1.8))
  $g.FillPath((New-Object System.Drawing.SolidBrush $lineColor), (New-RoundRect -15 5.4 22 3.6 1.8))
  $g.Restore($s2)

  $g.Restore($state)
}

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  return @($bmp, $g)
}

function Fill-Background($g, [int]$w, [int]$h, $clip) {
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, $w, $h), $blueTop, $blueBottom, 45
  if ($clip) { $g.FillPath($brush, $clip) } else { $g.FillRectangle($brush, 0, 0, $w, $h) }
}

function Save-Png($bmp, $g, [string]$path) {
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

# Повна іконка: shape = square (заокруглений квадрат) | round | full (без маски)
function Make-Icon([int]$size, [string]$shape, [string]$path) {
  $bmp, $g = New-Canvas $size $size
  $clip = $null
  if ($shape -eq 'square') { $clip = New-RoundRect 0 0 $size $size ($size * 0.22) }
  if ($shape -eq 'round') { $clip = New-Object System.Drawing.Drawing2D.GraphicsPath; $clip.AddEllipse(0, 0, $size, $size) }
  Fill-Background $g $size $size $clip
  $u = $size / 72.0
  Draw-Cards $g $u (-18 * $u) (-18 * $u)
  Save-Png $bmp $g $path
}

function Make-Splash([string]$path) {
  $old = [System.Drawing.Image]::FromFile($path)
  $w = $old.Width; $h = $old.Height
  $old.Dispose()
  $bmp, $g = New-Canvas $w $h
  Fill-Background $g $w $h $null
  $u = [Math]::Min($w, $h) * 0.45 / 72.0
  Draw-Cards $g $u ($w / 2 - 54 * $u) ($h / 2 - 54 * $u)
  Save-Png $bmp $g $path
}

$densities = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($d in $densities.Keys) {
  $s = $densities[$d]
  Make-Icon $s 'square' (Join-Path $res "mipmap-$d\ic_launcher.png")
  Make-Icon $s 'round' (Join-Path $res "mipmap-$d\ic_launcher_round.png")
}
Get-ChildItem $res -Recurse -Filter splash.png | ForEach-Object { Make-Splash $_.FullName }

Make-Icon 180 'full' (Join-Path $public 'apple-touch-icon.png')
Make-Icon 512 'square' (Join-Path $public 'icon-512.png')
Make-Icon 192 'square' (Join-Path $public 'icon-192.png')
Write-Host 'Icons generated.'
